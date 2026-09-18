/**
 * Fix Android blank screen-share race:
 * MediaProjectionService.launch() is async; createScreenStream()/startCapture()
 * used to run immediately and fail silently when the FGS was not yet in
 * FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION (issue #1799 / PR #1800 upstream).
 *
 * Also keep the share notification ongoing + perceptible.
 */
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(
  __dirname,
  '..',
  'node_modules',
  '@livekit',
  'react-native-webrtc',
  'android',
  'src',
  'main',
  'java',
  'com',
  'oney',
  'WebRTCModule',
)

function patchFile(fileName, transform) {
  const target = path.join(root, fileName)
  if (!fs.existsSync(target)) return false
  const original = fs.readFileSync(target, 'utf8')
  const next = transform(original)
  if (next === original) return false
  fs.writeFileSync(target, next)
  console.log(`[patch-webrtc-media-projection] Patched ${fileName}`)
  return true
}

// 1) Ongoing / perceptible notification while Present is active.
patchFile('MediaProjectionNotification.java', (contents) =>
  contents.replace(
    `.setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(false)
                .setUsesChronometer(false)
                .setAutoCancel(true)`,
    `.setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setOngoing(true)
                .setUsesChronometer(false)
                .setAutoCancel(false)`,
  ),
)

// 2) Latch so callers can wait until startForeground(mediaProjection) completes.
patchFile('MediaProjectionService.java', (contents) => {
  let next = contents
  if (!next.includes('import java.util.concurrent.CountDownLatch')) {
    next = next.replace(
      'import java.util.Random;',
      `import java.util.Random;\nimport java.util.concurrent.CountDownLatch;\nimport java.util.concurrent.TimeUnit;`,
    )
  }
  if (!next.includes('foregroundReadyLatch')) {
    next = next.replace(
      'static final int NOTIFICATION_ID = new Random().nextInt(99999) + 10000;',
      `static final int NOTIFICATION_ID = new Random().nextInt(99999) + 10000;\n\n    private static volatile CountDownLatch foregroundReadyLatch;`,
    )
  }
  if (!next.includes('awaitForegroundReady')) {
    next = next.replace(
      'public static void launch(Context context) {\n        if (!WebRTCModuleOptions.getInstance().enableMediaProjectionService) {\n            return;\n        }\n\n        MediaProjectionNotification.createNotificationChannel(context);',
      `public static boolean awaitForegroundReady(long timeoutMs) {\n        CountDownLatch latch = foregroundReadyLatch;\n        if (latch == null) {\n            // Service disabled or already finished — do not block capture.\n            return true;\n        }\n        try {\n            return latch.await(timeoutMs, TimeUnit.MILLISECONDS);\n        } catch (InterruptedException e) {\n            Thread.currentThread().interrupt();\n            return false;\n        }\n    }\n\n    public static void launch(Context context) {\n        if (!WebRTCModuleOptions.getInstance().enableMediaProjectionService) {\n            return;\n        }\n\n        foregroundReadyLatch = new CountDownLatch(1);\n        MediaProjectionNotification.createNotificationChannel(context);`,
    )
  }
  if (!next.includes('foregroundReadyLatch.countDown()')) {
    next = next.replace(
      `if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        return START_NOT_STICKY;`,
      `if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        CountDownLatch latch = foregroundReadyLatch;
        if (latch != null) {
            latch.countDown();
        }

        return START_NOT_STICKY;`,
    )
  }
  // If launch fails, never leave createScreenStream blocked forever.
  if (!next.includes('foregroundReadyLatch.countDown();') || next.indexOf('Media projection service not started') < 0) {
    // already handled below via replace of catch blocks
  }
  next = next.replace(
    `} catch (RuntimeException e) {
            // Avoid crashing due to ForegroundServiceStartNotAllowedException (API level 31).
            // See: https://developer.android.com/guide/components/foreground-services#background-start-restrictions
            Log.w(TAG, "Media projection service not started", e);
            return;
        }

        if (componentName == null) {
            Log.w(TAG, "Media projection service not started");
        } else {
            Log.i(TAG, "Media projection service started");
        }`,
    `} catch (RuntimeException e) {
            // Avoid crashing due to ForegroundServiceStartNotAllowedException (API level 31).
            // See: https://developer.android.com/guide/components/foreground-services#background-start-restrictions
            Log.w(TAG, "Media projection service not started", e);
            CountDownLatch failed = foregroundReadyLatch;
            if (failed != null) {
                failed.countDown();
            }
            return;
        }

        if (componentName == null) {
            Log.w(TAG, "Media projection service not started");
            CountDownLatch failed = foregroundReadyLatch;
            if (failed != null) {
                failed.countDown();
            }
        } else {
            Log.i(TAG, "Media projection service started");
        }`,
  )
  return next
})

// 3) Wait for FGS before startCapture — fixes blank Android Present tracks.
patchFile('GetUserMediaImpl.java', (contents) => {
  if (contents.includes('awaitForegroundReady')) return contents
  return contents.replace(
    `ThreadUtils.runOnExecutor(() -> {
                        MediaProjectionService.launch(activity);
                        createScreenStream();
                    });`,
    `ThreadUtils.runOnExecutor(() -> {
                        MediaProjectionService.launch(activity);
                        boolean foregroundReady = MediaProjectionService.awaitForegroundReady(5000);
                        if (!foregroundReady) {
                            Log.e(TAG, "MediaProjectionService foreground not ready within timeout");
                        }
                        createScreenStream();
                    });`,
  )
})

// 4) Log swallowed startCapture failures (blank share debugging).
patchFile('AbstractVideoCaptureController.java', (contents) => {
  let next = contents
  if (!next.includes('import android.util.Log')) {
    next = next.replace(
      'import androidx.annotation.Nullable;',
      'import android.util.Log;\n\nimport androidx.annotation.Nullable;',
    )
  }
  if (!next.includes('Failed to start video capture')) {
    next = next.replace(
      `public void startCapture() {
        try {
            videoCapturer.startCapture(targetWidth, targetHeight, targetFps);
        } catch (RuntimeException e) {
            // XXX This can only fail if we initialize the capturer incorrectly,
            // which we don't. Thus, ignore any failures here since we trust
            // ourselves.
        }
    }`,
      `public void startCapture() {
        try {
            videoCapturer.startCapture(targetWidth, targetHeight, targetFps);
        } catch (RuntimeException e) {
            // MediaProjection race / missing FGS — log so Present blank tracks are diagnosable.
            Log.e("WebRTCModule", "Failed to start video capture", e);
        }
    }`,
    )
  }
  return next
})
