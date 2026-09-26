/**
 * Fix Android blank screen-share race + Play-visible Present notification.
 *
 * MediaProjectionService.launch() is async; createScreenStream()/startCapture()
 * must wait until startForeground(MEDIA_PROJECTION) completes.
 *
 * Play FGS policy: service starts only after the user grants the system share
 * sheet (RESULT_OK), with a HIGH-importance ongoing notification.
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
const stringsPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@livekit',
  'react-native-webrtc',
  'android',
  'src',
  'main',
  'res',
  'values',
  'strings.xml',
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

if (fs.existsSync(stringsPath)) {
  const next = `<resources>
    <string name="media_projection_notification_title">Sharing your screen</string>
    <string name="media_projection_notification_text">SHEconomy Co-Work is sharing your screen in a live meeting. Tap Present again to stop.</string>
    <string name="ongoing_notification_channel_name">Screen sharing</string>
</resources>
`
  if (fs.readFileSync(stringsPath, 'utf8') !== next) {
    fs.writeFileSync(stringsPath, next)
    console.log('[patch-webrtc-media-projection] Patched strings.xml')
  }
}

patchFile('MediaProjectionNotification.java', (contents) => {
  let next = contents
  next = next.replace(
    'NotificationManager.IMPORTANCE_DEFAULT);',
    'NotificationManager.IMPORTANCE_HIGH);',
  )
  next = next.replace(
    'NotificationManager.IMPORTANCE_LOW);',
    'NotificationManager.IMPORTANCE_HIGH);',
  )
  next = next.replace(
    'builder.setCategory(NotificationCompat.CATEGORY_CALL)',
    'builder.setCategory(NotificationCompat.CATEGORY_SERVICE)',
  )
  next = next.replace(
    `.setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(false)
                .setUsesChronometer(false)
                .setAutoCancel(true)`,
    `.setPriority(NotificationCompat.PRIORITY_HIGH)
                .setOngoing(true)
                .setUsesChronometer(false)
                .setAutoCancel(false)`,
  )
  next = next.replace(
    `.setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setOngoing(true)
                .setUsesChronometer(false)
                .setAutoCancel(false)`,
    `.setPriority(NotificationCompat.PRIORITY_HIGH)
                .setOngoing(true)
                .setUsesChronometer(false)
                .setAutoCancel(false)`,
  )
  next = next.replace(
    `.setPriority(NotificationCompat.PRIORITY_HIGH)
                .setOngoing(true)
                .setUsesChronometer(false)
                .setAutoCancel(false)`,
    `.setPriority(NotificationCompat.PRIORITY_HIGH)
                .setOngoing(true)
                .setUsesChronometer(false)
                .setAutoCancel(false)`,
  )
  return next
})

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
      `public static boolean awaitForegroundReady(long timeoutMs) {\n        CountDownLatch latch = foregroundReadyLatch;\n        if (latch == null) {\n            return true;\n        }\n        try {\n            return latch.await(timeoutMs, TimeUnit.MILLISECONDS);\n        } catch (InterruptedException e) {\n            Thread.currentThread().interrupt();\n            return false;\n        }\n    }\n\n    public static void launch(Context context) {\n        if (!WebRTCModuleOptions.getInstance().enableMediaProjectionService) {\n            return;\n        }\n\n        foregroundReadyLatch = new CountDownLatch(1);\n        MediaProjectionNotification.createNotificationChannel(context);`,
    )
  }
  if (!next.includes('latch.countDown()')) {
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
            Log.e("WebRTCModule", "Failed to start video capture", e);
        }
    }`,
    )
  }
  return next
})

console.log('[patch-webrtc-media-projection] done')
