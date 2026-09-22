package com.sheconomy.meetingvideoeffects

import android.content.Context
import android.app.ActivityManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.SystemClock
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.Segmentation
import com.google.mlkit.vision.segmentation.SegmentationMask
import com.google.mlkit.vision.segmentation.selfie.SelfieSegmenterOptions
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

private const val MAX_PROCESS_WIDTH = 640
private const val MIN_PROCESS_INTERVAL_MS = 80L
private const val SLOW_FRAME_MS = 45L

private class MeetingBackgroundProcessor(private val context: Context) : VideoFrameProcessor {
  private val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
  private val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
  private val segmenter = Segmentation.getClient(
    SelfieSegmenterOptions.Builder()
      .setDetectorMode(SelfieSegmenterOptions.STREAM_MODE)
      .enableRawSizeMask()
      .build(),
  )
  private val segmentationInFlight = AtomicBoolean(false)
  @Volatile private var latestMask: MaskSnapshot? = null
  private var cachedImagePath: String? = null
  private var cachedImage: Bitmap? = null
  private var lastOutput: VideoFrame.I420Buffer? = null
  private var lastProcessAt = 0L
  private var skipBudget = 0

  override fun process(frame: VideoFrame, textureHelper: SurfaceTextureHelper): VideoFrame {
    val thermalPressure = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
      powerManager.currentThermalStatus >= PowerManager.THERMAL_STATUS_SEVERE
    if (MeetingBackgroundConfig.mode == "off" || activityManager.isLowRamDevice || thermalPressure) {
      return frame
    }

    val now = SystemClock.elapsedRealtime()
    if (skipBudget > 0 || now - lastProcessAt < MIN_PROCESS_INTERVAL_MS) {
      if (skipBudget > 0) skipBudget--
      lastOutput?.let { cached ->
        cached.retain()
        return VideoFrame(cached, frame.rotation, frame.timestampNs)
      }
      return frame
    }

    val started = SystemClock.elapsedRealtime()
    val i420 = frame.buffer.toI420() ?: return frame
    val origW = i420.width
    val origH = i420.height
    val (procW, procH) = processSize(origW, origH)
    val source = try {
      i420ToBitmap(i420, procW, procH)
    } finally {
      i420.release()
    }

    requestMask(source)
    val mask = latestMask ?: fallbackMask(source.width, source.height)

    val background = backgroundFor(source)
    var composited = composite(source, background, mask)
    if (background !== cachedImage && background !== source) background.recycle()
    source.recycle()
    if (composited.width != origW || composited.height != origH) {
      val scaled = Bitmap.createScaledBitmap(composited, origW, origH, true)
      if (scaled !== composited) composited.recycle()
      composited = scaled
    }
    val output = bitmapToI420(composited)
    composited.recycle()

    val elapsed = SystemClock.elapsedRealtime() - started
    lastProcessAt = SystemClock.elapsedRealtime()
    if (elapsed > SLOW_FRAME_MS) skipBudget = 2

    releaseLast()
    lastOutput = output
    output.retain()
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

  private fun requestMask(source: Bitmap) {
    if (!segmentationInFlight.compareAndSet(false, true)) return
    val inferenceBitmap = source.copy(Bitmap.Config.ARGB_8888, false)
    segmenter.process(InputImage.fromBitmap(inferenceBitmap, 0))
      .addOnSuccessListener { mask -> latestMask = snapshot(mask) }
      .addOnCompleteListener {
        inferenceBitmap.recycle()
        segmentationInFlight.set(false)
      }
  }

  private fun snapshot(mask: SegmentationMask): MaskSnapshot {
    val buffer = mask.buffer
    buffer.rewind()
    val values = FloatArray(mask.width * mask.height)
    buffer.asFloatBuffer().get(values)
    return MaskSnapshot(values, mask.width, mask.height)
  }

  private fun backgroundFor(source: Bitmap): Bitmap {
    val path = MeetingBackgroundConfig.imagePath
    if (MeetingBackgroundConfig.mode == "image" && !path.isNullOrBlank()) {
      if (cachedImagePath != path) {
        cachedImage?.recycle()
        cachedImage = decodeBackgroundBitmap(path)
        cachedImagePath = path
      }
      cachedImage?.let { image ->
        return centerCrop(image, source.width, source.height)
      }
      return source
    }

    val divisor = (MeetingBackgroundConfig.blurRadius / 2.0).toInt().coerceIn(4, 12)
    val tiny = Bitmap.createScaledBitmap(
      source,
      (source.width / divisor).coerceAtLeast(32),
      (source.height / divisor).coerceAtLeast(18),
      true,
    )
    val blurred = Bitmap.createScaledBitmap(tiny, source.width, source.height, true)
    tiny.recycle()
    return blurred
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
      for (x in 0 until width) {
        val mx = (x * mask.width / width).coerceAtMost(mask.width - 1)
        val alpha = ((mask.values[my * mask.width + mx] - 0.15f) / 0.7f).coerceIn(0f, 1f)
        val index = y * width + x
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

  private fun i420ToBitmap(buffer: VideoFrame.I420Buffer, outW: Int, outH: Int): Bitmap {
    val srcW = buffer.width
    val srcH = buffer.height
    val pixels = IntArray(outW * outH)
    for (y in 0 until outH) {
      val srcY = (y * srcH / outH).coerceAtMost(srcH - 1)
      for (x in 0 until outW) {
        val srcX = (x * srcW / outW).coerceAtMost(srcW - 1)
        val yy = unsigned(buffer.dataY, srcY * buffer.strideY + srcX)
        val uu = unsigned(buffer.dataU, (srcY / 2) * buffer.strideU + srcX / 2)
        val vv = unsigned(buffer.dataV, (srcY / 2) * buffer.strideV + srcX / 2)
        val c = yy - 16
        val d = uu - 128
        val e = vv - 128
        val r = ((298 * c + 409 * e + 128) shr 8).coerceIn(0, 255)
        val g = ((298 * c - 100 * d - 208 * e + 128) shr 8).coerceIn(0, 255)
        val b = ((298 * c + 516 * d + 128) shr 8).coerceIn(0, 255)
        pixels[y * outW + x] = (0xff shl 24) or (r shl 16) or (g shl 8) or b
      }
    }
    return Bitmap.createBitmap(pixels, outW, outH, Bitmap.Config.ARGB_8888)
  }

  private fun bitmapToI420(bitmap: Bitmap): JavaI420Buffer {
    val width = bitmap.width
    val height = bitmap.height
    val pixels = IntArray(width * height)
    bitmap.getPixels(pixels, 0, width, 0, 0, width, height)
    val output = JavaI420Buffer.allocate(width, height)

    for (y in 0 until height) {
      for (x in 0 until width) {
        val pixel = pixels[y * width + x]
        val r = (pixel shr 16) and 0xff
        val g = (pixel shr 8) and 0xff
        val b = pixel and 0xff
        output.dataY.put(y * output.strideY + x, ((77 * r + 150 * g + 29 * b) shr 8).toByte())
        if (y % 2 == 0 && x % 2 == 0) {
          val u = (((-43 * r - 85 * g + 128 * b) shr 8) + 128).coerceIn(0, 255)
          val v = (((128 * r - 107 * g - 21 * b) shr 8) + 128).coerceIn(0, 255)
          output.dataU.put((y / 2) * output.strideU + x / 2, u.toByte())
          output.dataV.put((y / 2) * output.strideV + x / 2, v.toByte())
        }
      }
    }
    return output
  }

  private fun unsigned(buffer: ByteBuffer, index: Int): Int = buffer.get(index).toInt() and 0xff
}
