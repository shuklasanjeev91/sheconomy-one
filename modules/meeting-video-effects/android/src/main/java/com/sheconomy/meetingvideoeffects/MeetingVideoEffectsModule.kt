package com.sheconomy.meetingvideoeffects

import android.os.Build
import android.os.PowerManager
import android.app.ActivityManager
import android.content.Context
import com.oney.WebRTCModule.videoEffects.ProcessorProvider
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

object MeetingBackgroundConfig {
  @Volatile var mode: String = "off"
  @Volatile var imagePath: String? = null
  @Volatile var blurRadius: Double = 12.0
}

class MeetingVideoEffectsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MeetingVideoEffects")

    Function("registerProcessor") {
      val context = resolveAppContext() ?: return@Function false
      ProcessorProvider.addProcessor(
        "sheconomyVirtualBackground",
        MeetingBackgroundProcessorFactory(context),
      )
      true
    }

    Function("configure") { options: Map<String, Any?> ->
      MeetingBackgroundConfig.mode = options["mode"] as? String ?: "off"
      MeetingBackgroundConfig.imagePath = options["imagePath"] as? String
      MeetingBackgroundConfig.blurRadius = (options["blurRadius"] as? Number)?.toDouble() ?: 12.0
    }

    Function("isSupported") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return@Function false
      val context = resolveAppContext() ?: return@Function true
      val lowRam = context
        .getSystemService(Context.ACTIVITY_SERVICE)
        ?.let { it as? ActivityManager }
        ?.isLowRamDevice == true
      !lowRam
    }
  }

  private fun resolveAppContext(): Context? {
    return appContext.reactContext?.applicationContext
      ?: appContext.currentActivity?.applicationContext
  }
}
