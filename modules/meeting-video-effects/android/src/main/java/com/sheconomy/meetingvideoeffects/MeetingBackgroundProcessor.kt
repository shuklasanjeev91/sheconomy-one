package com.sheconomy.meetingvideoeffects

import android.content.Context
import android.app.ActivityManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Matrix
import android.graphics.Paint
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.SystemClock
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.Segmentation
import com.google.mlkit.vision.segmentation.selfie.SelfieSegmenterOptions
import com.oney.WebRTCModule.videoEffects.VideoFrameProcessor
import com.oney.WebRTCModule.videoEffects.VideoFrameProcessorFactoryInterface
import java.io.File
import java.io.FileInputStream
import java.io.InputStream
import java.nio.ByteBuffer
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import org.webrtc.JavaI420Buffer
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoFrame

class MeetingBackgroundProcessorFactory(private val context: Context) :
  VideoFrameProcessorFactoryInterface {
  override fun build(): VideoFrameProcessor = MeetingBackgroundProcessor(context)
}

private data class MaskSnapshot(val values: FloatArray, val width: Int, val height: Int)

/** Person cutout runs off the camera thread. Keep the copy small enough to stay real-time. */
private const val MAX_PROCESS_WIDTH = 960
private const val MASK_WIDTH = 320
private const val MIN_PROCESS_INTERVAL_MS = 140L
private const val CIRCUIT_OPEN_MS = 3_000L
/** Below this is background: a lower floor kept the halo where the real room showed through. */
private const val MATTE_LOW_CONFIDENCE = 0.40f
private const val MATTE_HIGH_CONFIDENCE = 0.80f
/** Weight of the previous matte. Higher values left a ghost trail when the person moved. */
private const val TEMPORAL_MATTE_BLEND = 0.25f

private class MeetingBackgroundProcessor(private val context: Context) : VideoFrameProcessor {
  private val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
  private val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
  private var cachedImagePath: String? = null
  private var cachedImage: Bitmap? = null
  private var pendingOutput: VideoFrame.I420Buffer? = null
  private val outputLock = Any()
  private val busy = AtomicBoolean(false)
  private val segmenter = Segmentation.getClient(
    SelfieSegmenterOptions.Builder()
      .setDetectorMode(SelfieSegmenterOptions.STREAM_MODE)
      .enableRawSizeMask()
      .build(),
  )
  @Volatile private var segmentInFlight = false
  private var lastProcessAt = 0L
  private var skipBudget = 12
  private var lastSeenGeneration = -1
  private var circuitOpenUntil = 0L
  private var previousMask: MaskSnapshot? = null

  private val executor = java.util.concurrent.Executors.newSingleThreadExecutor()
  @Volatile private var decodeInFlightPath: String? = null

  override fun process(frame: VideoFrame, textureHelper: SurfaceTextureHelper): VideoFrame {
    if (!MeetingBackgroundConfig.effectActive()) {
      clearPending()
      return frame
    }
    // Never toI420 on this call. The capturer thread must return the camera
    // buffer before the next Camera2 frame or the preview freezes.
    scheduleComposite(frame, textureHelper)
    val cached = synchronized(outputLock) { pendingOutput?.also { it.retain() } }
    if (cached != null) {
      return VideoFrame(cached, frame.rotation, frame.timestampNs)
    }
    return frame
  }

  private fun clearPending() {
    val previous = synchronized(outputLock) {
      val current = pendingOutput
      pendingOutput = null
      current
    }
    try {
      previous?.release()
    } catch (_: Throwable) {
    }
  }

  private fun scheduleComposite(frame: VideoFrame, textureHelper: SurfaceTextureHelper?) {
    val helper = textureHelper ?: return
    val thermalPressure = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
      powerManager.currentThermalStatus >= PowerManager.THERMAL_STATUS_SEVERE
    if (activityManager.isLowRamDevice || thermalPressure) {
      clearPending()
      return
    }
    val now = SystemClock.elapsedRealtime()
    if (now < circuitOpenUntil) return

    if (MeetingBackgroundConfig.generation != lastSeenGeneration) {
      lastSeenGeneration = MeetingBackgroundConfig.generation
      skipBudget = 8
      previousMask = null
      if (MeetingBackgroundConfig.mode == "image") {
        val path = MeetingBackgroundConfig.imagePath
        if (!path.isNullOrBlank() && path != cachedImagePath) requestDecodeAsync(path)
      }
    }
    if (skipBudget > 0) {
      skipBudget--
      return
    }
    if (now - lastProcessAt < MIN_PROCESS_INTERVAL_MS) return
    if (MeetingBackgroundConfig.mode == "image") {
      val path = MeetingBackgroundConfig.imagePath
      if (path.isNullOrBlank()) return
      if (cachedImagePath != path || cachedImage == null) {
        requestDecodeAsync(path)
        return
      }
    }
    if (!busy.compareAndSet(false, true)) return

    frame.retain()
    lastProcessAt = now
    helper.handler.post {
      var cameraReleased = false
      var handedOff = false
      try {
        val i420 = try {
          frame.buffer.toI420()
        } catch (t: Throwable) {
          android.util.Log.e("MeetingBgProcessor", "toI420 failed — passthrough", t)
          openCircuit()
          null
        }
        val rotation = frame.rotation
        try {
          frame.release()
        } catch (_: Throwable) {
        }
        cameraReleased = true
        if (i420 == null) return@post
        handedOff = true
        // Segmentation stays off this handler. Blocking it stalls Camera2.
        executor.execute {
          try {
            val output = renderCopiedFrame(i420, rotation)
            if (output != null) {
              val previous = synchronized(outputLock) {
                val current = pendingOutput
                pendingOutput = output
                current
              }
              try {
                previous?.release()
              } catch (_: Throwable) {
              }
            }
          } catch (t: Throwable) {
            android.util.Log.e("MeetingBgProcessor", "composite failed — passthrough", t)
          } finally {
            try {
              i420.release()
            } catch (_: Throwable) {
            }
            busy.set(false)
          }
        }
      } catch (t: Throwable) {
        android.util.Log.e("MeetingBgProcessor", "copy failed — passthrough", t)
        openCircuit()
      } finally {
        if (!cameraReleased) {
          try {
            frame.release()
          } catch (_: Throwable) {
          }
        }
        if (!handedOff) busy.set(false)
      }
    }
  }

  private fun openCircuit() {
    circuitOpenUntil = SystemClock.elapsedRealtime() + CIRCUIT_OPEN_MS
    skipBudget = 24
  }

  /** Camera frame is already released. Work only on this copied I420. */
  private fun renderCopiedFrame(i420: VideoFrame.I420Buffer, rotation: Int): VideoFrame.I420Buffer? {
    val origW = i420.width
    val origH = i420.height
    val (procW, procH) = processSize(origW, origH)
    val source = try {
      i420ToBitmap(i420, procW, procH)
    } catch (t: Throwable) {
      android.util.Log.e("MeetingBgProcessor", "i420ToBitmap failed — passthrough", t)
      openCircuit()
      return null
    }

    // Segment the upright picture. The camera buffer itself may be rotated.
    val upright = rotateBitmap(source, rotation)
    if (upright !== source) source.recycle()
    if (MeetingBackgroundConfig.mode == "off") {
      val graded = applyVideoFilter(upright)
      if (graded !== upright) upright.recycle()
      return finishFrame(graded, origW, origH, rotation)
    }
    val maskSource = if (upright.width > MASK_WIDTH) {
      val maskHeight = (upright.height * MASK_WIDTH / upright.width).coerceAtLeast(2)
      Bitmap.createScaledBitmap(upright, MASK_WIDTH, maskHeight - maskHeight % 2, true)
    } else {
      upright
    }
    val mask = personMask(maskSource)
    if (maskSource !== upright) maskSource.recycle()
    val background = backgroundFor(upright) ?: run {
      upright.recycle()
      return null
    }
    var composited = try {
      composite(upright, background, mask)
    } catch (t: Throwable) {
      if (background !== cachedImage && background !== upright) background.recycle()
      upright.recycle()
      android.util.Log.e("MeetingBgProcessor", "composite failed — passthrough", t)
      openCircuit()
      return null
    }
    if (background !== cachedImage && background !== upright) background.recycle()
    upright.recycle()
    val graded = applyVideoFilter(composited)
    if (graded !== composited) composited.recycle()
    return finishFrame(graded, origW, origH, rotation)
  }

  private fun finishFrame(bitmap: Bitmap, origW: Int, origH: Int, rotation: Int): VideoFrame.I420Buffer? {
    var composited = bitmap
    val unrotated = rotateBitmap(composited, (360 - ((rotation % 360) + 360) % 360) % 360)
    if (unrotated !== composited) composited.recycle()
    composited = unrotated

    if (composited.width != origW || composited.height != origH) {
      val scaled = Bitmap.createScaledBitmap(composited, origW, origH, true)
      if (scaled !== composited) composited.recycle()
      composited = scaled
    }
    val output = try {
      bitmapToI420(composited)
    } catch (t: Throwable) {
      composited.recycle()
      android.util.Log.e("MeetingBgProcessor", "bitmapToI420 failed — passthrough", t)
      openCircuit()
      return null
    }
    composited.recycle()
    return output
  }

  private fun applyVideoFilter(source: Bitmap): Bitmap {
    val matrix = videoFilterMatrix(MeetingBackgroundConfig.filter) ?: return source
    val out = Bitmap.createBitmap(source.width, source.height, Bitmap.Config.ARGB_8888)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { colorFilter = ColorMatrixColorFilter(matrix) }
    Canvas(out).drawBitmap(source, 0f, 0f, paint)
    return out
  }

  private fun videoFilterMatrix(filter: String): ColorMatrix? {
    val matrix = ColorMatrix()
    when (filter) {
      "warm" -> matrix.set(floatArrayOf(
        1.12f, 0.06f, 0f, 0f, 8f,
        0.02f, 1.02f, 0f, 0f, 2f,
        0f, 0f, 0.84f, 0f, 0f,
        0f, 0f, 0f, 1f, 0f,
      ))
      "cool" -> matrix.set(floatArrayOf(
        0.86f, 0f, 0.04f, 0f, 0f,
        0f, 1f, 0.02f, 0f, 0f,
        0f, 0.04f, 1.14f, 0f, 6f,
        0f, 0f, 0f, 1f, 0f,
      ))
      "vivid" -> {
        matrix.setSaturation(1.45f)
        val contrast = ColorMatrix()
        val scale = 1.08f
        val translate = (-0.5f * scale + 0.5f) * 255f
        contrast.set(floatArrayOf(
          scale, 0f, 0f, 0f, translate,
          0f, scale, 0f, 0f, translate,
          0f, 0f, scale, 0f, translate,
          0f, 0f, 0f, 1f, 0f,
        ))
        matrix.postConcat(contrast)
      }
      "mono" -> matrix.setSaturation(0f)
      "soft" -> {
        matrix.setSaturation(0.92f)
        val soft = ColorMatrix(floatArrayOf(
          0.94f, 0f, 0f, 0f, 18f,
          0f, 0.94f, 0f, 0f, 18f,
          0f, 0f, 0.94f, 0f, 18f,
          0f, 0f, 0f, 1f, 0f,
        ))
        matrix.postConcat(soft)
      }
      else -> return null
    }
    return matrix
  }

  private fun rotateBitmap(bitmap: Bitmap, rotation: Int): Bitmap {
    val degrees = ((rotation % 360) + 360) % 360
    if (degrees == 0) return bitmap
    val matrix = android.graphics.Matrix()
    matrix.postRotate(degrees.toFloat())
    return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
  }

  private fun processSize(width: Int, height: Int): Pair<Int, Int> {
    if (width <= MAX_PROCESS_WIDTH) {
      return (width - width % 2).coerceAtLeast(2) to (height - height % 2).coerceAtLeast(2)
    }
    val scaledHeight = (height * MAX_PROCESS_WIDTH / width).coerceAtLeast(2)
    return MAX_PROCESS_WIDTH to (scaledHeight - scaledHeight % 2).coerceAtLeast(2)
  }

  private fun backgroundFor(source: Bitmap): Bitmap? {
    val path = MeetingBackgroundConfig.imagePath
    if (MeetingBackgroundConfig.mode == "image" && !path.isNullOrBlank()) {
      if (cachedImagePath == path && cachedImage != null) {
        return centerCrop(cachedImage!!, source.width, source.height)
      }
      requestDecodeAsync(path)
      return null
    }

    return blurBitmap(source)
  }

  /**
   * Roughly matches the web `blur(12px)` canvas filter. Halving step by step and
   * growing back in doublings approximates a Gaussian; one big bilinear jump
   * barely softens the frame once WebRTC compresses it.
   */
  private fun blurBitmap(source: Bitmap): Bitmap {
    val strength = MeetingBackgroundConfig.blurRadius.coerceIn(4.0, 24.0)
    val targetW = (source.width / (strength * 1.6)).toInt().coerceIn(24, 160)
    val targetH = (targetW.toLong() * source.height / source.width).toInt().coerceAtLeast(16)
    var current = source
    var w = source.width
    var h = source.height
    fun step(nextW: Int, nextH: Int) {
      val next = Bitmap.createScaledBitmap(current, nextW.coerceAtLeast(1), nextH.coerceAtLeast(1), true)
      if (next !== current && current !== source) current.recycle()
      current = next
      w = next.width
      h = next.height
    }
    while (w / 2 >= targetW) step(w / 2, h / 2)
    if (w != targetW) step(targetW, targetH)
    while (w * 2 < source.width) step(w * 2, h * 2)
    step(source.width, source.height)
    return current
  }

  private fun requestDecodeAsync(path: String) {
    if (cachedImagePath == path && cachedImage != null) return
    if (decodeInFlightPath == path) return
    decodeInFlightPath = path
    val generation = MeetingBackgroundConfig.generation
    executor.execute {
      try {
        val decoded = decodeBackgroundBitmap(path)
        val sized = decoded?.let { downsampleForBackground(it) }
        if (sized !== decoded) decoded?.recycle()
        if (
          MeetingBackgroundConfig.generation == generation &&
          MeetingBackgroundConfig.imagePath == path &&
          MeetingBackgroundConfig.mode == "image"
        ) {
          cachedImage?.recycle()
          cachedImage = sized
          cachedImagePath = path
        } else {
          sized?.recycle()
        }
      } catch (_: Exception) {
        // Keep passthrough until a later configure retry.
      } finally {
        if (decodeInFlightPath == path) decodeInFlightPath = null
      }
    }
  }

  private fun downsampleForBackground(image: Bitmap): Bitmap {
    val maxEdge = 960
    val longest = maxOf(image.width, image.height)
    if (longest <= maxEdge) return image
    val scale = maxEdge.toFloat() / longest
    val w = (image.width * scale).toInt().coerceAtLeast(2)
    val h = (image.height * scale).toInt().coerceAtLeast(2)
    return Bitmap.createScaledBitmap(image, w - w % 2, h - h % 2, true)
  }

  /** Person confidence, 1 = keep the camera pixel. Segmentation runs on the background executor. */
  private fun personMask(bitmap: Bitmap): MaskSnapshot {
    if (segmentInFlight) return previousMask ?: emptyMask(bitmap.width, bitmap.height)
    return try {
      val image = InputImage.fromBitmap(bitmap, 0)
      val task = segmenter.process(image)
      segmentInFlight = true
      task.addOnCompleteListener { segmentInFlight = false }
      val mask = Tasks.await(task, 2_000, TimeUnit.MILLISECONDS)
      val buffer = mask.buffer
      buffer.rewind()
      val count = mask.width * mask.height
      if (count <= 0 || buffer.remaining() < count * 4) {
        return emptyMask(bitmap.width, bitmap.height)
      }
      val values = FloatArray(count)
      for (i in values.indices) {
        values[i] = buffer.float.coerceIn(0f, 1f)
      }
      smoothMask(MaskSnapshot(values, mask.width, mask.height))
    } catch (t: Throwable) {
      android.util.Log.w("MeetingBgProcessor", "segmentation unavailable — full blur", t)
      previousMask ?: emptyMask(bitmap.width, bitmap.height)
    }
  }

  private fun emptyMask(width: Int, height: Int): MaskSnapshot {
    return MaskSnapshot(FloatArray(width * height), width.coerceAtLeast(1), height.coerceAtLeast(1))
  }

  private fun smoothMask(mask: MaskSnapshot): MaskSnapshot {
    val width = mask.width
    val height = mask.height
    val shaped = FloatArray(mask.values.size)
    for (y in 0 until height) {
      val row = y * width
      val above = ((y - 1).coerceAtLeast(0)) * width
      val below = ((y + 1).coerceAtMost(height - 1)) * width
      for (x in 0 until width) {
        val left = (x - 1).coerceAtLeast(0)
        val right = (x + 1).coerceAtMost(width - 1)
        val confidence = (
          mask.values[above + left] +
            mask.values[above + x] * 2f +
            mask.values[above + right] +
            mask.values[row + left] * 2f +
            mask.values[row + x] * 4f +
            mask.values[row + right] * 2f +
            mask.values[below + left] +
            mask.values[below + x] * 2f +
            mask.values[below + right]
          ) / 16f
        shaped[row + x] = personAlpha(confidence)
      }
    }

    val previous = previousMask
    if (previous?.width == width && previous.height == height && previous.values.size == shaped.size) {
      for (i in shaped.indices) {
        shaped[i] = previous.values[i] * TEMPORAL_MATTE_BLEND + shaped[i] * (1f - TEMPORAL_MATTE_BLEND)
      }
    }

    return MaskSnapshot(shaped, width, height).also { previousMask = it }
  }

  private fun openBackgroundStream(path: String): InputStream? {
    return when {
      path.contains("android_asset") -> {
        val assetPath = path
          .substringAfter("android_asset/")
          .substringAfter("android_asset")
          .trimStart('/')
        if (assetPath.isBlank()) null else context.assets.open(assetPath)
      }
      path.startsWith("content:") || path.startsWith("android.resource:") ->
        context.contentResolver.openInputStream(Uri.parse(path))
      else -> {
        val candidates = if (path.startsWith("file:")) {
          listOfNotNull(Uri.parse(path).path, path.removePrefix("file://"), path.removePrefix("file:"))
        } else {
          listOf(path)
        }
        candidates.map(::File).firstOrNull { it.isFile }?.let(::FileInputStream)
      }
    }
  }

  private fun decodeBackgroundBitmap(path: String): Bitmap? {
    return try {
      val bitmap = openBackgroundStream(path)?.use { BitmapFactory.decodeStream(it) } ?: return null
      // Camera photos store "which way is up" as EXIF; the raw pixels can be sideways.
      val orientation = runCatching {
        openBackgroundStream(path)?.use {
          ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
        }
      }.getOrNull() ?: ExifInterface.ORIENTATION_NORMAL
      applyExifOrientation(bitmap, orientation)
    } catch (_: Exception) {
      null
    }
  }

  private fun applyExifOrientation(bitmap: Bitmap, orientation: Int): Bitmap {
    val matrix = Matrix()
    when (orientation) {
      ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
      ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
      ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
      ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.postScale(-1f, 1f)
      ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.postScale(1f, -1f)
      ExifInterface.ORIENTATION_TRANSPOSE -> {
        matrix.postRotate(90f)
        matrix.postScale(-1f, 1f)
      }
      ExifInterface.ORIENTATION_TRANSVERSE -> {
        matrix.postRotate(270f)
        matrix.postScale(-1f, 1f)
      }
      else -> return bitmap
    }
    val oriented = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    if (oriented !== bitmap) bitmap.recycle()
    return oriented
  }

  private fun centerCrop(image: Bitmap, width: Int, height: Int): Bitmap {
    val scale = maxOf(width.toFloat() / image.width, height.toFloat() / image.height)
    val scaledWidth = (image.width * scale).toInt().coerceAtLeast(1)
    val scaledHeight = (image.height * scale).toInt().coerceAtLeast(1)
    val scaled = Bitmap.createScaledBitmap(image, scaledWidth, scaledHeight, true)
    val cropped = Bitmap.createBitmap(
      scaled,
      ((scaledWidth - width) / 2).coerceAtLeast(0),
      ((scaledHeight - height) / 2).coerceAtLeast(0),
      width.coerceAtMost(scaled.width),
      height.coerceAtMost(scaled.height),
    )
    if (scaled !== image) scaled.recycle()
    return if (cropped.width == width && cropped.height == height) cropped
    else Bitmap.createScaledBitmap(cropped, width, height, true).also { cropped.recycle() }
  }

  private fun composite(source: Bitmap, background: Bitmap, mask: MaskSnapshot): Bitmap {
    val width = source.width
    val height = source.height
    val fg = IntArray(width * height)
    val bg = IntArray(width * height)
    source.getPixels(fg, 0, width, 0, 0, width, height)
    background.getPixels(bg, 0, width, 0, 0, width, height)

    for (y in 0 until height) {
      val rowOffset = y * width
      for (x in 0 until width) {
        val alpha = sampleMask(mask, x, y, width, height)
        val index = rowOffset + x
        fg[index] = blend(fg[index], bg[index], alpha)
      }
    }
    return Bitmap.createBitmap(fg, width, height, Bitmap.Config.ARGB_8888)
  }

  private fun sampleMask(mask: MaskSnapshot, x: Int, y: Int, width: Int, height: Int): Float {
    val fx = (x + 0.5f) * mask.width / width - 0.5f
    val fy = (y + 0.5f) * mask.height / height - 0.5f
    val x0 = fx.toInt().coerceIn(0, mask.width - 1)
    val y0 = fy.toInt().coerceIn(0, mask.height - 1)
    val x1 = (x0 + 1).coerceAtMost(mask.width - 1)
    val y1 = (y0 + 1).coerceAtMost(mask.height - 1)
    val tx = (fx - x0).coerceIn(0f, 1f)
    val ty = (fy - y0).coerceIn(0f, 1f)
    val row0 = y0 * mask.width
    val row1 = y1 * mask.width
    val top = mask.values[row0 + x0] + (mask.values[row0 + x1] - mask.values[row0 + x0]) * tx
    val bottom = mask.values[row1 + x0] + (mask.values[row1 + x1] - mask.values[row1 + x0]) * tx
    return top + (bottom - top) * ty
  }

  /** Solid person, soft edge. Lower confidence keeps hair instead of chopping it off. */
  private fun personAlpha(confidence: Float): Float {
    val x = ((confidence - MATTE_LOW_CONFIDENCE) / (MATTE_HIGH_CONFIDENCE - MATTE_LOW_CONFIDENCE)).coerceIn(0f, 1f)
    return x * x * (3f - 2f * x)
  }

  private fun blend(foreground: Int, background: Int, alpha: Float): Int {
    val inverse = 1f - alpha
    val r = (((foreground shr 16) and 0xff) * alpha + ((background shr 16) and 0xff) * inverse).toInt()
    val g = (((foreground shr 8) and 0xff) * alpha + ((background shr 8) and 0xff) * inverse).toInt()
    val b = ((foreground and 0xff) * alpha + (background and 0xff) * inverse).toInt()
    return (0xff shl 24) or (r shl 16) or (g shl 8) or b
  }

  private fun i420ToBitmap(i420: VideoFrame.I420Buffer, width: Int, height: Int): Bitmap {
    val y = i420.dataY
    val u = i420.dataU
    val v = i420.dataV
    val strideY = i420.strideY
    val strideU = i420.strideU
    val strideV = i420.strideV
    val srcW = i420.width
    val srcH = i420.height
    val pixels = IntArray(width * height)
    for (row in 0 until height) {
      val sy = (row * srcH / height).coerceAtMost(srcH - 1)
      for (col in 0 until width) {
        val sx = (col * srcW / width).coerceAtMost(srcW - 1)
        val yVal = y.get(sy * strideY + sx).toInt() and 0xff
        val uvRow = (sy / 2) * strideU
        val uvCol = sx / 2
        val uVal = (u.get(uvRow + uvCol).toInt() and 0xff) - 128
        val vVal = (v.get((sy / 2) * strideV + uvCol).toInt() and 0xff) - 128
        var r = (yVal + 1.370705f * vVal).toInt()
        var g = (yVal - 0.337633f * uVal - 0.698001f * vVal).toInt()
        var b = (yVal + 1.732446f * uVal).toInt()
        if (r < 0) r = 0 else if (r > 255) r = 255
        if (g < 0) g = 0 else if (g > 255) g = 255
        if (b < 0) b = 0 else if (b > 255) b = 255
        pixels[row * width + col] = (0xff shl 24) or (r shl 16) or (g shl 8) or b
      }
    }
    return Bitmap.createBitmap(pixels, width, height, Bitmap.Config.ARGB_8888)
  }

  private fun bitmapToI420(bitmap: Bitmap): VideoFrame.I420Buffer {
    val width = bitmap.width - bitmap.width % 2
    val height = bitmap.height - bitmap.height % 2
    val pixels = IntArray(width * height)
    bitmap.getPixels(pixels, 0, width, 0, 0, width, height)
    val buffer = JavaI420Buffer.allocate(width, height)
    val yBuf = buffer.dataY
    val uBuf = buffer.dataU
    val vBuf = buffer.dataV
    val strideY = buffer.strideY
    val strideU = buffer.strideU
    val strideV = buffer.strideV
    for (row in 0 until height) {
      for (col in 0 until width) {
        val c = pixels[row * width + col]
        val r = (c shr 16) and 0xff
        val g = (c shr 8) and 0xff
        val b = c and 0xff
        val y = ((66 * r + 129 * g + 25 * b + 128) shr 8) + 16
        yBuf.put(row * strideY + col, y.toByte())
        if (row % 2 == 0 && col % 2 == 0) {
          val u = ((-38 * r - 74 * g + 112 * b + 128) shr 8) + 128
          val v = ((112 * r - 94 * g - 18 * b + 128) shr 8) + 128
          uBuf.put((row / 2) * strideU + col / 2, u.toByte())
          vBuf.put((row / 2) * strideV + col / 2, v.toByte())
        }
      }
    }
    return buffer
  }
}
