/**
 * Play-visible Present notification.
 *
 * Play FGS policy: service starts only after the user grants the system share
 * sheet (RESULT_OK), with a HIGH-importance ongoing notification.
 * react-native-webrtc 124 already waits for startForeground before capturing.
 */
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(
  __dirname,
  '..',
  'node_modules',
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

console.log('[patch-webrtc-media-projection] done')
