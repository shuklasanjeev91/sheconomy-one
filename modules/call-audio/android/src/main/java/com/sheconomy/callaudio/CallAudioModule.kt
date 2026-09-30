package com.sheconomy.callaudio

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Rational
import androidx.core.app.OnPictureInPictureModeChangedProvider
import androidx.core.app.PictureInPictureModeChangedInfo
import androidx.core.util.Consumer
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.ReactApplication
import com.facebook.react.modules.core.DefaultHardwareBackBtnHandler
import com.twilio.audioswitch.AudioDevice
import com.twilio.audioswitch.AudioSwitch
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.lang.ref.WeakReference

private const val PIP_EVENT = "onPictureInPictureModeChanged"
private const val CAPTION_SPEECH_EVENT = "onCaptionSpeech"

private val OUTPUT_KINDS: List<Pair<String, Class<out AudioDevice>>> = listOf(
  "bluetooth" to AudioDevice.BluetoothHeadset::class.java,
  "headset" to AudioDevice.WiredHeadset::class.java,
  "speaker" to AudioDevice.Speakerphone::class.java,
  "earpiece" to AudioDevice.Earpiece::class.java,
)

private fun kindOf(device: AudioDevice): String? =
  OUTPUT_KINDS.firstOrNull { it.second == device.javaClass }?.first

private fun deviceClassOf(kind: String): Class<out AudioDevice>? =
  OUTPUT_KINDS.firstOrNull { it.first == kind }?.second

private fun audioMode(name: String?): Int? = when (name) {
  "normal" -> AudioManager.MODE_NORMAL
  "inCall" -> AudioManager.MODE_IN_CALL
  "inCommunication" -> AudioManager.MODE_IN_COMMUNICATION
  else -> null
}

private fun focusMode(name: String?): Int? = when (name) {
  "gain" -> AudioManager.AUDIOFOCUS_GAIN
  "gainTransient" -> AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
  "gainTransientExclusive" -> AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE
  "gainTransientMayDuck" -> AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
  else -> null
}

private fun usageType(name: String?): Int? = when (name) {
  "voiceCommunication" -> AudioAttributes.USAGE_VOICE_COMMUNICATION
  "media" -> AudioAttributes.USAGE_MEDIA
  else -> null
}

private fun contentType(name: String?): Int? = when (name) {
  "speech" -> AudioAttributes.CONTENT_TYPE_SPEECH
  "music" -> AudioAttributes.CONTENT_TYPE_MUSIC
  else -> null
}

private fun streamType(name: String?): Int? = when (name) {
  "voiceCall" -> AudioManager.STREAM_VOICE_CALL
  "music" -> AudioManager.STREAM_MUSIC
  else -> null
}

/** AudioSwitch is not thread safe: every call runs on the main looper. */
private class CallAudioRouter(private val context: Context) {
  private val handler = Handler(Looper.getMainLooper())
  private var audioSwitch: AudioSwitch? = null

  var preferred: List<Class<out AudioDevice>> = OUTPUT_KINDS.map { it.second }
  var manageAudioFocus = true
  var focusMode = AudioManager.AUDIOFOCUS_GAIN
  var audioMode = AudioManager.MODE_IN_COMMUNICATION
  var streamType = AudioManager.STREAM_VOICE_CALL
  var usageType = AudioAttributes.USAGE_VOICE_COMMUNICATION
  var contentType = AudioAttributes.CONTENT_TYPE_SPEECH
  var forceHandleAudioRouting = false

  fun applyToRunning() {
    handler.post {
      audioSwitch?.let { switch -> applyTo(switch) }
    }
  }

  private fun applyTo(switch: AudioSwitch) {
    switch.manageAudioFocus = manageAudioFocus
    switch.focusMode = focusMode
    switch.audioMode = audioMode
    switch.audioStreamType = streamType
    switch.audioAttributeUsageType = usageType
    switch.audioAttributeContentType = contentType
    switch.forceHandleAudioRouting = forceHandleAudioRouting
  }

  fun start() {
    handler.post {
      if (audioSwitch != null) return@post
      val switch = AudioSwitch(context, false, { }, preferred)
      applyTo(switch)
      switch.start { _, _ -> }
      switch.activate()
      audioSwitch = switch
    }
  }

  fun stop() {
    handler.removeCallbacksAndMessages(null)
    handler.post {
      audioSwitch?.stop()
      audioSwitch = null
    }
  }

  fun outputs(): List<String> =
    audioSwitch?.availableAudioDevices?.mapNotNull { kindOf(it) } ?: emptyList()

  fun select(kind: String) {
    val target = deviceClassOf(kind) ?: return
    handler.post {
      val switch = audioSwitch ?: return@post
      switch.availableAudioDevices.firstOrNull { it.javaClass == target }?.let { switch.selectDevice(it) }
    }
  }
}

/** Android keeps PiP windows between these aspect ratios; anything outside throws. */
private fun pipAspectRatio(width: Int, height: Int): Rational {
  val w = width.coerceAtLeast(1)
  val h = height.coerceAtLeast(1)
  val ratio = w.toFloat() / h
  return when {
    ratio > 2.39f -> Rational(239, 100)
    ratio < 1f / 2.39f -> Rational(100, 239)
    else -> Rational(w, h)
  }
}

class CallAudioModule : Module() {
  private var router: CallAudioRouter? = null
  private var captionSpeech: CaptionSpeech? = null
  private var autoPip = false
  private var pipAspect = Rational(9, 16)
  private var pipListenerActivity: WeakReference<Activity>? = null
  private val pipListener = Consumer<PictureInPictureModeChangedInfo> { info ->
    syncReactHostWithPip(info.isInPictureInPictureMode)
    sendEvent(PIP_EVENT, mapOf("active" to info.isInPictureInPictureMode))
  }

  // Android pauses the activity in PiP, and a paused React host stops mounting Fabric
  // updates, so the PiP window would keep a cropped frame of the full-size layout.
  private fun syncReactHostWithPip(active: Boolean) {
    val activity = pipListenerActivity?.get() ?: return
    val host = (activity.application as? ReactApplication)?.reactHost ?: return
    if (active) {
      host.onHostResume(activity, activity as? DefaultHardwareBackBtnHandler)
      return
    }
    val resumed = (activity as? LifecycleOwner)?.lifecycle?.currentState?.isAtLeast(Lifecycle.State.RESUMED) == true
    if (!resumed) host.onHostPause(activity)
  }

  private fun router(): CallAudioRouter? {
    router?.let { return it }
    val context = appContext.reactContext?.applicationContext ?: return null
    return CallAudioRouter(context).also { router = it }
  }

  private fun captionSpeech(): CaptionSpeech? {
    captionSpeech?.let { return it }
    val context = appContext.reactContext?.applicationContext ?: return null
    return CaptionSpeech(context) { event -> sendEvent(CAPTION_SPEECH_EVENT, event) }
      .also { captionSpeech = it }
  }

  private fun pipSupported(activity: Activity?): Boolean =
    activity != null &&
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
      activity.packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)

  private fun attachPipListener(activity: Activity?) {
    if (activity == null || pipListenerActivity?.get() === activity) return
    detachPipListener()
    val provider = activity as? OnPictureInPictureModeChangedProvider ?: return
    provider.addOnPictureInPictureModeChangedListener(pipListener)
    pipListenerActivity = WeakReference(activity)
  }

  private fun detachPipListener() {
    (pipListenerActivity?.get() as? OnPictureInPictureModeChangedProvider)
      ?.removeOnPictureInPictureModeChangedListener(pipListener)
    pipListenerActivity = null
  }

  private fun pipParams(): PictureInPictureParams? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return null
    val builder = PictureInPictureParams.Builder().setAspectRatio(pipAspect)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setAutoEnterEnabled(autoPip).setSeamlessResizeEnabled(false)
    }
    return builder.build()
  }

  private fun enterPip(activity: Activity?): Boolean {
    if (!pipSupported(activity) || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
    attachPipListener(activity)
    if (activity!!.isInPictureInPictureMode) return true
    return try {
      activity.enterPictureInPictureMode(pipParams()!!)
    } catch (_: Exception) {
      false
    }
  }

  override fun definition() = ModuleDefinition {
    Name("CallAudio")

    Events(PIP_EVENT, CAPTION_SPEECH_EVENT)

    AsyncFunction("startCaptionSpeech") { locale: String ->
      val speech = captionSpeech()
        ?: throw IllegalStateException("Speech recognition is unavailable on this device")
      speech.start(locale)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("stopCaptionSpeech") {
      captionSpeech?.stop()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("cancelCaptionSpeech") {
      captionSpeech?.release(cancel = true)
    }.runOnQueue(Queues.MAIN)

    Function("isPictureInPictureSupported") {
      pipSupported(appContext.currentActivity)
    }

    Function("isInPictureInPicture") {
      val activity = appContext.currentActivity
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && activity?.isInPictureInPictureMode == true
    }

    AsyncFunction("enterPictureInPicture") { width: Int, height: Int ->
      pipAspect = pipAspectRatio(width, height)
      enterPip(appContext.currentActivity)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setAutoPictureInPicture") { enabled: Boolean, width: Int, height: Int ->
      autoPip = enabled
      pipAspect = pipAspectRatio(width, height)
      val activity = appContext.currentActivity
      attachPipListener(activity)
      if (pipSupported(activity) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        try {
          activity!!.setPictureInPictureParams(pipParams()!!)
        } catch (_: Exception) {
        }
      }
    }.runOnQueue(Queues.MAIN)

    OnActivityEntersForeground {
      attachPipListener(appContext.currentActivity)
    }

    // onPause can land after the PiP callback when entering programmatically.
    OnActivityEntersBackground {
      val activity = pipListenerActivity?.get()
      if (activity != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && activity.isInPictureInPictureMode) {
        Handler(Looper.getMainLooper()).post { syncReactHostWithPip(activity.isInPictureInPictureMode) }
      }
    }

    // Android 12+ auto-enters from setAutoEnterEnabled; older versions only get onUserLeaveHint.
    OnUserLeavesActivity {
      if (autoPip && Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        enterPip(appContext.currentActivity)
      }
    }

    OnDestroy {
      detachPipListener()
      Handler(Looper.getMainLooper()).post { captionSpeech?.release(cancel = true) }
    }

    AsyncFunction("configureAndroid") { options: Map<String, Any?> ->
      val router = router() ?: return@AsyncFunction
      (options["preferredOutputList"] as? List<*>)?.let { list ->
        val classes = list.mapNotNull { (it as? String)?.let(::deviceClassOf) }
        if (classes.isNotEmpty()) router.preferred = classes
      }
      (options["manageAudioFocus"] as? Boolean)?.let { router.manageAudioFocus = it }
      focusMode(options["audioFocusMode"] as? String)?.let { router.focusMode = it }
      audioMode(options["audioMode"] as? String)?.let { router.audioMode = it }
      streamType(options["audioStreamType"] as? String)?.let { router.streamType = it }
      usageType(options["audioAttributesUsageType"] as? String)?.let { router.usageType = it }
      contentType(options["audioAttributesContentType"] as? String)?.let { router.contentType = it }
      (options["forceHandleAudioRouting"] as? Boolean)?.let { router.forceHandleAudioRouting = it }
      router.applyToRunning()
    }

    AsyncFunction("configureApple") { _: Map<String, Any?> -> }

    AsyncFunction("start") {
      router()?.start()
    }

    AsyncFunction("stop") {
      router?.stop()
    }

    AsyncFunction("getOutputs") {
      router()?.outputs() ?: emptyList<String>()
    }

    AsyncFunction("selectOutput") { outputId: String ->
      router()?.select(outputId)
    }

    AsyncFunction("showRoutePicker") { }
  }
}
