/**
 * Make CallKeep's Android call FGS notification perceptible for Play policy:
 * - IMPORTANCE_DEFAULT channel (not IMPORTANCE_NONE)
 * - CATEGORY_CALL + content text
 * - startForeground(id, notification, type) on API 29+ with microphone|phoneCall
 */
const fs = require('node:fs')
const path = require('node:path')

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-callkeep',
  'android',
  'src',
  'main',
  'java',
  'io',
  'wazo',
  'callkeep',
  'VoiceConnectionService.java',
)

if (!fs.existsSync(target)) {
  process.exit(0)
}

let contents = fs.readFileSync(target, 'utf8')
const original = contents

if (!contents.includes('import android.content.pm.ServiceInfo;')) {
  contents = contents.replace(
    'import android.content.ComponentName;',
    'import android.content.ComponentName;\nimport android.content.pm.ServiceInfo;',
  )
}

contents = contents.replace(
  'NotificationChannel chan = new NotificationChannel(NOTIFICATION_CHANNEL_ID, channelName, NotificationManager.IMPORTANCE_NONE);\n        chan.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);',
  `NotificationChannel chan = new NotificationChannel(NOTIFICATION_CHANNEL_ID, channelName, NotificationManager.IMPORTANCE_DEFAULT);
        chan.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        chan.setShowBadge(false);
        chan.enableVibration(false);`,
)

contents = contents.replace(
  `notificationBuilder.setOngoing(true)
            .setContentTitle(foregroundSettings.getString("notificationTitle"))
            .setPriority(NotificationManager.IMPORTANCE_MIN)
            .setCategory(Notification.CATEGORY_SERVICE);`,
  `String notificationTitle = foregroundSettings.getString("notificationTitle");
        String notificationText = foregroundSettings.hasKey("notificationText")
            ? foregroundSettings.getString("notificationText")
            : "A SHEconomy call is in progress. Tap to return to the call.";
        notificationBuilder.setOngoing(true)
            .setContentTitle(notificationTitle)
            .setContentText(notificationText)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setOnlyAlertOnce(true);`,
)

contents = contents.replace(
  `try {
            startForeground(FOREGROUND_SERVICE_TYPE_MICROPHONE, notification);
        } catch (Exception e) {
            Log.w(TAG, "[VoiceConnectionService] Can't start foreground service : " + e.toString());
        }`,
  `try {
            final int fgsTypes = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                | ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, fgsTypes);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            Log.w(TAG, "[VoiceConnectionService] Can't start foreground service : " + e.toString());
        }`,
)

contents = contents.replace(
  `try {
            stopForeground(FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } catch (Exception e) {
            Log.w(TAG, "[VoiceConnectionService] can't stop foreground service :" + e.toString());
        }`,
  `try {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } catch (Exception e) {
            try {
                stopForeground(true);
            } catch (Exception nested) {
                Log.w(TAG, "[VoiceConnectionService] can't stop foreground service :" + nested.toString());
            }
        }`,
)

if (contents !== original) {
  fs.writeFileSync(target, contents)
  console.log('[patch-callkeep-fgs-notification] Patched', target)
}
