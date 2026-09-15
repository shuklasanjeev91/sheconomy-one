package com.sheconomy.meetingvideoeffects

import android.os.Build
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
      val context = appContext.reactContext ?: return@Function false
      ProcessorProvider.addProcessor(
        "sheconomyVirtualBackground",
        MeetingBackgroundProcessorFactory(context.applicationContext),
      )
      true
    }

    Function("configure") { options: Map<String, Any?> ->
      MeetingBackgroundConfig.mode = options["mode"] as? String ?: "off"
      MeetingBackgroundConfig.imagePath = options["imagePath"] as? String
      MeetingBackgroundConfig.blurRadius = (options["blurRadius"] as? Number)?.toDouble() ?: 12.0
    }

    Function("isSupported") {
      val context = appContext.reactContext
      val lowRam = context
        ?.getSystemService(Context.ACTIVITY_SERVICE)
        ?.let { it as? ActivityManager }
        ?.isLowRamDevice ?: true
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && !lowRam
    }
  }
}
