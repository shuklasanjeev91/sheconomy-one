package com.sheconomy.callaudio

import android.content.Context
import android.content.Intent
import android.media.AudioFormat
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import org.webrtc.audio.JavaAudioDeviceModule
import java.io.IOException
import java.io.OutputStream
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.TimeUnit

private const val TAG = "CaptionSpeech"
private const val TARGET_RATE = 16_000

/**
 * Receives the microphone PCM that WebRTC is already capturing for the call.
 * Runs on WebRTC's AudioRecord thread, so it must never block.
 */
object CallMicTap : JavaAudioDeviceModule.SamplesReadyCallback {
  @Volatile private var sink: PcmPipeWriter? = null
  @Volatile private var lastSampleAtMs = 0L

  fun isLive(): Boolean = SystemClock.elapsedRealtime() - lastSampleAtMs < 1_500

  internal fun attach(writer: PcmPipeWriter?) {
    sink = writer
  }

  override fun onWebRtcAudioRecordSamplesReady(samples: JavaAudioDeviceModule.AudioSamples) {
    lastSampleAtMs = SystemClock.elapsedRealtime()
    val writer = sink ?: return
    if (samples.audioFormat != AudioFormat.ENCODING_PCM_16BIT) return
    writer.offer(samples.data, samples.sampleRate, samples.channelCount)
  }
}

/** Downmixes to 16 kHz mono PCM16 and feeds the recognizer pipe off the audio thread. */
internal class PcmPipeWriter(private val output: OutputStream) {
  private val queue = ArrayBlockingQueue<ByteArray>(300)
  @Volatile private var open = true
  private var carry = 0.0

  private val thread = Thread({
    try {
      while (open) {
        val chunk = queue.poll(200, TimeUnit.MILLISECONDS) ?: continue
        output.write(chunk)
      }
    } catch (_: IOException) {
    } catch (_: InterruptedException) {
    } finally {
      open = false
      try {
        output.close()
      } catch (_: IOException) {
      }
    }
  }, "CaptionSpeechPipe").apply { isDaemon = true }

  init {
    thread.start()
  }

  fun offer(data: ByteArray, sampleRate: Int, channels: Int) {
    if (!open || sampleRate <= 0 || channels <= 0) return
    queue.offer(resample(data, sampleRate, channels))
  }

  private fun resample(data: ByteArray, sampleRate: Int, channels: Int): ByteArray {
    val frames = data.size / (2 * channels)
    if (sampleRate == TARGET_RATE && channels == 1) return data
    val step = sampleRate.toDouble() / TARGET_RATE
    val out = ByteArray(((frames - carry) / step).toInt().coerceAtLeast(0) * 2 + 2)
    var written = 0
    var position = carry
    while (position < frames && written + 1 < out.size) {
      val frame = position.toInt()
      var sum = 0
      for (channel in 0 until channels) {
        val index = (frame * channels + channel) * 2
        sum += (data[index].toInt() and 0xff) or (data[index + 1].toInt() shl 8)
      }
      val sample = sum / channels
      out[written] = (sample and 0xff).toByte()
      out[written + 1] = (sample shr 8).toByte()
      written += 2
      position += step
    }
    carry = (position - frames).coerceAtLeast(0.0)
    return if (written == out.size) out else out.copyOf(written)
  }

  fun close() {
    open = false
    thread.interrupt()
  }
}

/**
 * Live-caption speech recognition that shares the call microphone with WebRTC.
 * Android 13+ reads WebRTC's captured PCM through EXTRA_AUDIO_SOURCE, so the
 * recognizer never competes with the call for the mic. Older versions (or
 * recognizers that reject the audio source) open the mic directly.
 * Every SpeechRecognizer call must happen on the main thread.
 */
internal class CaptionSpeech(
  private val context: Context,
  private val emit: (Map<String, Any?>) -> Unit,
) {
  private var recognizer: SpeechRecognizer? = null
  private var writer: PcmPipeWriter? = null
  private var readEnd: ParcelFileDescriptor? = null
  private var mode = "mic"
  private var heardAnything = false
  private var callAudioFailures = 0
  private var lastPartial = ""
  private val handler = Handler(Looper.getMainLooper())

  // A piped audio source never reaches end-of-stream, so the recognizer keeps one
  // pass open indefinitely and never delivers final results. End it ourselves.
  private val endPass = Runnable {
    recognizer?.stopListening()
    closePipe()
    handler.postDelayed(forceIdle, RESULT_WAIT_MS)
  }

  private val forceIdle = Runnable {
    if (recognizer == null) return@Runnable
    Log.w(TAG, "no result after ending pass mode=$mode")
    release(cancel = true)
    emit(mapOf("type" to "idle", "mode" to mode))
  }

  fun start(locale: String): String {
    if (!SpeechRecognizer.isRecognitionAvailable(context)) {
      throw IllegalStateException("Speech recognition is unavailable on this device")
    }
    release(cancel = true)
    val speech = SpeechRecognizer.createSpeechRecognizer(context)
    speech.setRecognitionListener(listener)
    recognizer = speech

    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
      putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
      putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
      putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)
      putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2_000L)
      putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1_500L)
    }

    mode = "mic"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && callAudioFailures < 2 && CallMicTap.isLive()) {
      val pipe = ParcelFileDescriptor.createPipe()
      readEnd = pipe[0]
      val pipeWriter = PcmPipeWriter(ParcelFileDescriptor.AutoCloseOutputStream(pipe[1]))
      writer = pipeWriter
      CallMicTap.attach(pipeWriter)
      intent.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE, pipe[0])
      intent.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_CHANNEL_COUNT, 1)
      intent.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_ENCODING, AudioFormat.ENCODING_PCM_16BIT)
      intent.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_SAMPLING_RATE, TARGET_RATE)
      mode = "call"
    }

    heardAnything = false
    lastPartial = ""
    speech.startListening(intent)
    handler.postDelayed(endPass, MAX_PASS_MS)
    Log.d(TAG, "start locale=$locale mode=$mode")
    return mode
  }

  fun stop() {
    handler.removeCallbacks(endPass)
    recognizer?.stopListening()
    closePipe()
  }

  fun release(cancel: Boolean) {
    handler.removeCallbacks(endPass)
    handler.removeCallbacks(forceIdle)
    closePipe()
    recognizer?.let { speech ->
      if (cancel) speech.cancel()
      speech.destroy()
    }
    recognizer = null
  }

  private fun closePipe() {
    CallMicTap.attach(null)
    writer?.close()
    writer = null
    try {
      readEnd?.close()
    } catch (_: IOException) {
    }
    readEnd = null
  }

  private fun firstResult(bundle: Bundle?): String? =
    bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
      ?.firstOrNull { it.isNotBlank() }
      ?.trim()

  private fun finish() {
    release(cancel = false)
    emit(mapOf("type" to "idle", "mode" to mode))
  }

  private val listener = object : RecognitionListener {
    override fun onReadyForSpeech(params: Bundle?) {
      emit(mapOf("type" to "ready", "mode" to mode))
    }

    override fun onBeginningOfSpeech() {
      emit(mapOf("type" to "start", "mode" to mode))
    }

    override fun onRmsChanged(rmsdB: Float) {}

    override fun onBufferReceived(buffer: ByteArray?) {}

    override fun onEndOfSpeech() {
      emit(mapOf("type" to "end", "mode" to mode))
    }

    override fun onPartialResults(partialResults: Bundle?) {
      val text = firstResult(partialResults) ?: return
      heardAnything = true
      if (mode == "call") callAudioFailures = 0
      if (text != lastPartial) {
        lastPartial = text
        handler.removeCallbacks(endPass)
        handler.postDelayed(endPass, PAUSE_END_MS)
      }
      emit(mapOf("type" to "partial", "text" to text, "mode" to mode))
    }

    override fun onResults(results: Bundle?) {
      firstResult(results)?.let { text ->
        heardAnything = true
        emit(mapOf("type" to "final", "text" to text, "mode" to mode))
      }
      finish()
    }

    override fun onError(error: Int) {
      Log.w(TAG, "error=$error mode=$mode heard=$heardAnything")
      // Two outright rejections of the piped call audio switch this session to the mic.
      if (mode == "call" && !heardAnything && error in REJECTED_AUDIO_SOURCE_ERRORS) {
        callAudioFailures += 1
      }
      emit(mapOf("type" to "error", "code" to error, "mode" to mode))
      finish()
    }

    override fun onEvent(eventType: Int, params: Bundle?) {}
  }

  private companion object {
    const val PAUSE_END_MS = 1_200L
    const val MAX_PASS_MS = 30_000L
    const val RESULT_WAIT_MS = 3_000L

    val REJECTED_AUDIO_SOURCE_ERRORS = setOf(
      SpeechRecognizer.ERROR_AUDIO,
      SpeechRecognizer.ERROR_CLIENT,
      SpeechRecognizer.ERROR_SERVER,
      12, // ERROR_LANGUAGE_NOT_SUPPORTED
      13, // ERROR_LANGUAGE_UNAVAILABLE
      14, // ERROR_CANNOT_CHECK_SUPPORT
    )
  }
}
