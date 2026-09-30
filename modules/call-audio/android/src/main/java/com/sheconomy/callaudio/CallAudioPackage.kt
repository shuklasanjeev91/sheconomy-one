package com.sheconomy.callaudio

import android.app.Application
import android.content.Context
import android.media.AudioAttributes
import android.os.Build
import com.oney.WebRTCModule.WebRTCModuleOptions
import expo.modules.core.interfaces.ApplicationLifecycleListener
import expo.modules.core.interfaces.Package
import org.webrtc.audio.JavaAudioDeviceModule

class CallAudioPackage : Package {
  override fun createApplicationLifecycleListeners(context: Context): List<ApplicationLifecycleListener> =
    listOf(CallAudioLifecycleListener())
}

/** Must run before React Native creates WebRTCModule, which reads these options once. */
class CallAudioLifecycleListener : ApplicationLifecycleListener {
  override fun onCreate(application: Application) {
    val options = WebRTCModuleOptions.getInstance()
    // Present (screen share) needs the MediaProjection foreground service.
    options.enableMediaProjectionService = true

    val hardwareProcessing = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
    options.audioDeviceModule = JavaAudioDeviceModule.builder(application)
      .setUseHardwareAcousticEchoCanceler(hardwareProcessing)
      .setUseHardwareNoiseSuppressor(hardwareProcessing)
      .setSamplesReadyCallback(CallMicTap)
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
          .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
          .build(),
      )
      .createAudioDeviceModule()
  }
}
