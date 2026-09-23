package com.sheconomy.meetingvideoeffects

import android.content.Context
import android.app.ActivityManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.SystemClock
import com.oney.WebRTCModule.videoEffects.VideoFrameProcessor
import com.oney.WebRTCModule.videoEffects.VideoFrameProcessorFactoryInterface
import java.nio.ByteBuffer
import java.util.concurrent.atomic.AtomicBoolean
import org.webrtc.JavaI420Buffer
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoFrame

class MeetingBackgroundProcessorFactory(private val context: Context) :
  VideoFrameProcessorFactoryInterface {
  override fun build(): VideoFrameProcessor = MeetingBackgroundProcessor(context)
}

private data class MaskSnapshot(val values: FloatArray, val width: Int, val height: Int)

/** Keep processing rare and tiny — Camera2 freezes if toI420 holds buffers too long. */
private const val MAX_PROCESS_WIDTH = 240
private const val MIN_PROCESS_INTERVAL_MS = 280L
private const val SLOW_FRAME_MS = 22L
private const val CIRCUIT_OPEN_MS = 3_000L

private class MeetingBackgroundProcessor(private val context: Context) : VideoFrameProcessor {
  private val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
  private val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
  @Volatile private var latestMask: MaskSnapshot? = null
  private var cachedImagePath: String? = null
  private var cachedImage: Bitmap? = null
  private var lastOutput: VideoFrame.I420Buffer? = null
  private var lastProcessAt = 0L
  private var skipBudget = 12
  private var lastSeenGeneration = -1
  private var circuitOpenUntil = 0L

  private val executor = java.util.concurrent.Executors.newSingleThreadExecutor()
  @Volatile private var decodeInFlightPath: String? = null

  override fun process(frame: VideoFrame, textureHelper: SurfaceTextureHelper): VideoFrame {
    // HARD STOP: toI420 on the Camera2 capturer path freezes many Android devices
    // ("Client must return video buffers"). Always passthrough — soft UI preview
    // handles local background display instead.
    return frame
  }

  private fun openCircuit() {
    circuitOpenUntil = SystemClock.elapsedRealtime() + CIRCUIT_OPEN_MS
    skipBudget = 24
  }

  @Suppress("unused")
  private fun processInternal(frame: VideoFrame): VideoFrame {
    val thermalPressure = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
      powerManager.currentThermalStatus >= PowerManager.THERMAL_STATUS_SEVERE
    if (MeetingBackgroundConfig.mode == "off" || activityManager.isLowRamDevice || thermalPressure) {
      releaseLast()
      return frame
    }

    val now = SystemClock.elapsedRealtime()
    if (now < circuitOpenUntil) return frame

    // New configure() → passthrough while the new JPEG loads off-thread.
    if (MeetingBackgroundConfig.generation != lastSeenGeneration) {
      lastSeenGeneration = MeetingBackgroundConfig.generation
      skipBudget = 18
      if (MeetingBackgroundConfig.mode == "image") {
        val path = MeetingBackgroundConfig.imagePath
        if (!path.isNullOrBlank() && path != cachedImagePath) {
          requestDecodeAsync(path)
        }
      }
    }

    if (skipBudget > 0 || now - lastProcessAt < MIN_PROCESS_INTERVAL_MS) {
      if (skipBudget > 0) skipBudget--
      return frame
    }

    // Image mode without a ready bitmap: never toI420 — keep camera live.
    if (MeetingBackgroundConfig.mode == "image") {
      val path = MeetingBackgroundConfig.imagePath
      if (path.isNullOrBlank()) return frame
      if (cachedImagePath != path || cachedImage == null) {
        requestDecodeAsync(path)
        return frame
      }
    }

    val started = SystemClock.elapsedRealtime()
    val i420 = try {
      frame.buffer.toI420()
    } catch (t: Throwable) {
      android.util.Log.e("MeetingBgProcessor", "toI420 failed — passthrough", t)
      openCircuit()
      return frame
    } ?: return frame

    val origW = i420.width
    val origH = i420.height
    val (procW, procH) = processSize(origW, origH)
    val source = try {
      i420ToBitmap(i420, procW, procH)
    } catch (t: Throwable) {
      try { i420.release() } catch (_: Throwable) {}
      android.util.Log.e("MeetingBgProcessor", "i420ToBitmap failed — passthrough", t)
      openCircuit()
      return frame
    } finally {
      try { i420.release() } catch (_: Throwable) {}
    }

    if (SystemClock.elapsedRealtime() - started > SLOW_FRAME_MS) {
      source.recycle()
      openCircuit()
      lastProcessAt = SystemClock.elapsedRealtime()
      return frame
    }

    // Oval matte only — ML Kit on the capturer path freezes Camera2 on many devices.
    val mask = latestMask ?: fallbackMask(source.width, source.height)
    val background = backgroundFor(source) ?: run {
      source.recycle()
      return frame
    }
    var composited = try {
      composite(source, background, mask)
    } catch (t: Throwable) {
      if (background !== cachedImage && background !== source) background.recycle()
      source.recycle()
      android.util.Log.e("MeetingBgProcessor", "composite failed — passthrough", t)
      openCircuit()
      return frame
    }
    if (background !== cachedImage && background !== source) background.recycle()
    source.recycle()

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
      return frame
    }
    composited.recycle()

    val elapsed = SystemClock.elapsedRealtime() - started
    lastProcessAt = SystemClock.elapsedRealtime()
    if (elapsed > SLOW_FRAME_MS) openCircuit()

    releaseLast()
    return VideoFrame(output, frame.rotation, frame.timestampNs)
  }

  private fun releaseLast() {
    lastOutput?.release()
    lastOutput = null
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

    val divisor = (MeetingBackgroundConfig.blurRadius / 2.0).toInt().coerceIn(6, 14)
    val tiny = Bitmap.createScaledBitmap(
      source,
      (source.width / divisor).coerceAtLeast(24),
      (source.height / divisor).coerceAtLeast(16),
      true,
    )
    val blurred = Bitmap.createScaledBitmap(tiny, source.width, source.height, true)
    tiny.recycle()
    return blurred
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

  private fun fallbackMask(width: Int, height: Int): MaskSnapshot {
    val values = FloatArray(width * height)
    val cx = width / 2f
    val cy = height * 0.42f
    val rx = width * 0.28f
    val ry = height * 0.38f
    for (y in 0 until height) {
      for (x in 0 until width) {
        val nx = (x - cx) / rx
        val ny = (y - cy) / ry
        values[y * width + x] = if (nx * nx + ny * ny <= 1f) 1f else 0f
      }
    }
    return MaskSnapshot(values, width, height)
  }

  private fun decodeBackgroundBitmap(path: String): Bitmap? {
    return try {
      when {
        path.contains("android_asset") -> {
          val assetPath = path
            .substringAfter("android_asset/")
            .substringAfter("android_asset")
            .trimStart('/')
          if (assetPath.isBlank()) null
          else context.assets.open(assetPath).use { stream ->
            BitmapFactory.decodeStream(stream)
          }
        }
        path.startsWith("file:") -> {
          val parsed = Uri.parse(path).path
          BitmapFactory.decodeFile(parsed)
            ?: BitmapFactory.decodeFile(path.removePrefix("file://"))
            ?: BitmapFactory.decodeFile(path.removePrefix("file:"))
        }
        path.startsWith("content:") || path.startsWith("android.resource:") -> {
          context.contentResolver.openInputStream(Uri.parse(path))?.use { stream ->
            BitmapFactory.decodeStream(stream)
          }
        }
        path.startsWith("/") -> BitmapFactory.decodeFile(path)
        else -> BitmapFactory.decodeFile(path)
      }
    } catch (_: Exception) {
      null
    }
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
      val my = (y * mask.height / height).coerceAtMost(mask.height - 1)
      val rowOffset = y * width
      for (x in 0 until width) {
        val mx = (x * mask.width / width).coerceAtMost(mask.width - 1)
        val alpha = ((mask.values[my * mask.width + mx] - 0.15f) / 0.7f).coerceIn(0f, 1f)
        val index = rowOffset + x
        fg[index] = blend(fg[index], bg[index], alpha)
      }
    }
    return Bitmap.createBitmap(fg, width, height, Bitmap.Config.ARGB_8888)
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
