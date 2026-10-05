package com.sheconomy.playinappupdate

import android.app.Activity
import android.os.Build
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.UpdateAvailability
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Google Play in-app updates (IMMEDIATE flow): Play shows its own full-screen
 * update UI, downloads and installs the new build, then restarts the app.
 * Only works for installs that came from Google Play.
 */
class PlayInAppUpdateModule : Module() {
  private var manager: AppUpdateManager? = null

  private fun manager(): AppUpdateManager? {
    manager?.let { return it }
    val context = appContext.reactContext?.applicationContext ?: return null
    return AppUpdateManagerFactory.create(context).also { manager = it }
  }

  override fun definition() = ModuleDefinition {
    Name("PlayInAppUpdate")

    // The installed APK's versionName/versionCode. JS has no other reliable source:
    // Constants.expoConfig reflects the running OTA's manifest, not the binary.
    Function("getInstalledVersion") {
      val context = appContext.reactContext?.applicationContext ?: return@Function null
      val info = context.packageManager.getPackageInfo(context.packageName, 0)
      val versionCode =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          info.longVersionCode
        } else {
          @Suppress("DEPRECATION")
          info.versionCode.toLong()
        }
      mapOf("versionName" to info.versionName, "versionCode" to versionCode.toString())
    }

    // Resolves "accepted" | "cancelled" | "failed" | "unavailable"; never rejects.
    AsyncFunction("startImmediateUpdate") { promise: Promise ->
      val updateManager = manager()
      val activity = appContext.currentActivity
      if (updateManager == null || activity == null) {
        promise.resolve("unavailable")
        return@AsyncFunction
      }

      // An AppUpdateInfo can start a flow only once, so fetch a fresh one per call.
      updateManager.appUpdateInfo
        .addOnSuccessListener { info ->
          val availability = info.updateAvailability()
          val canStart =
            availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS ||
              (availability == UpdateAvailability.UPDATE_AVAILABLE &&
                info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE))
          if (!canStart) {
            promise.resolve("unavailable")
            return@addOnSuccessListener
          }

          updateManager
            .startUpdateFlow(info, activity, AppUpdateOptions.defaultOptions(AppUpdateType.IMMEDIATE))
            .addOnSuccessListener { resultCode ->
              promise.resolve(
                when (resultCode) {
                  Activity.RESULT_OK -> "accepted"
                  Activity.RESULT_CANCELED -> "cancelled"
                  else -> "failed"
                },
              )
            }
            .addOnFailureListener { promise.resolve("failed") }
        }
        .addOnFailureListener { promise.resolve("unavailable") }
    }
  }
}
