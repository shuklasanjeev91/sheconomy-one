package com.sheconomy.meetingvideoeffects

import android.content.Context
import android.app.ActivityManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.PowerManager
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

  override fun process(frame: VideoFrame, textureHelper: SurfaceTextureHelper): VideoFrame {
    val thermalPressure = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
      powerManager.currentThermalStatus >= PowerManager.THERMAL_STATUS_SEVERE
    if (MeetingBackgroundConfig.mode == "off" || activityManager.isLowRamDevice || thermalPressure) {
      val copy = frame.buffer.toI420() ?: run {
        frame.buffer.retain()
        return VideoFrame(frame.buffer, frame.rotation, frame.timestampNs)
      }
      return VideoFrame(copy, frame.rotation, frame.timestampNs)
    }

    val i420 = frame.buffer.toI420() ?: run {
      frame.buffer.retain()
      return VideoFrame(frame.buffer, frame.rotation, frame.timestampNs)
    }
    val source = try {
      i420ToBitmap(i420)
    } finally {
      i420.release()
    }

    requestMask(source)
    val mask = latestMask
    if (mask == null) {
      val raw = bitmapToI420(source)
      source.recycle()
      return VideoFrame(raw, frame.rotation, frame.timestampNs)
    }

    val background = backgroundFor(source)
    val composited = composite(source, background, mask)
    if (background !== cachedImage && background !== source) background.recycle()
    source.recycle()
    val output = bitmapToI420(composited)
    composited.recycle()
    return VideoFrame(output, frame.rotation, frame.timestampNs)
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
      // Image mode with a failed decode must not silently fall back to blur —
      // that looks like the upload "did nothing" / applied the wrong effect.
      return source
    }

    // A small downsample/upscale gives a stable real-time blur on API 24+.
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

  private fun decodeBackgroundBitmap(path: String): Bitmap? {
    return try {
      when {
        path.startsWith("file:") -> {
          val localPath = Uri.parse(path).path
          localPath?.let(BitmapFactory::decodeFile)
        }
        path.startsWith("content:") -> {
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
    val scaledWidth = (image.width * scale).toInt()
    val scaledHeight = (image.height * scale).toInt()
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
        // Feather the ML mask around the subject edge.
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

  private fun i420ToBitmap(buffer: VideoFrame.I420Buffer): Bitmap {
    val width = buffer.width
    val height = buffer.height
    val pixels = IntArray(width * height)
    for (y in 0 until height) {
      for (x in 0 until width) {
        val yy = unsigned(buffer.dataY, y * buffer.strideY + x)
        val uu = unsigned(buffer.dataU, (y / 2) * buffer.strideU + x / 2)
        val vv = unsigned(buffer.dataV, (y / 2) * buffer.strideV + x / 2)
        val c = yy - 16
        val d = uu - 128
        val e = vv - 128
        val r = ((298 * c + 409 * e + 128) shr 8).coerceIn(0, 255)
        val g = ((298 * c - 100 * d - 208 * e + 128) shr 8).coerceIn(0, 255)
        val b = ((298 * c + 516 * d + 128) shr 8).coerceIn(0, 255)
        pixels[y * width + x] = (0xff shl 24) or (r shl 16) or (g shl 8) or b
      }
    }
    return Bitmap.createBitmap(pixels, width, height, Bitmap.Config.ARGB_8888)
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
