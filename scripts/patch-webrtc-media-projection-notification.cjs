/**
 * Keep MediaProjection FGS notification ongoing + perceptible while screen sharing.
 */
const fs = require('node:fs')
const path = require('node:path')

const target = path.join(
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
  'MediaProjectionNotification.java',
)

if (!fs.existsSync(target)) {
  process.exit(0)
}

let contents = fs.readFileSync(target, 'utf8')
const original = contents

contents = contents.replace(
  `.setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(false)
                .setUsesChronometer(false)
                .setAutoCancel(true)`,
  `.setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setOngoing(true)
                .setUsesChronometer(false)
                .setAutoCancel(false)`,
)

if (contents !== original) {
  fs.writeFileSync(target, contents)
  console.log('[patch-webrtc-media-projection-notification] Patched', target)
}
