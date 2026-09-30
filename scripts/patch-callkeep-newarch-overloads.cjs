/**
 * New Architecture (TurboModules) rejects overloaded @ReactMethod names.
 * CallKeep ships displayIncomingCall/startCall 3-arg + 4-arg overloads — remove
 * the shorter @ReactMethod annotations so only the hasVideo variants are exported.
 *
 * See: https://github.com/react-native-webrtc/react-native-callkeep/issues/798
 */
const fs = require('node:fs')
const path = require('node:path')

const MARKER = 'sheconomy-callkeep-no-overload-reactmethods'

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
  'RNCallKeepModule.java',
)

if (!fs.existsSync(target)) {
  process.exit(0)
}

let contents = fs.readFileSync(target, 'utf8')
if (contents.includes(MARKER)) {
  process.exit(0)
}

const original = contents

const replacements = [
  [
    `    @ReactMethod
    public void displayIncomingCall(String uuid, String number, String callerName) {
        this.displayIncomingCall(uuid, number, callerName, false, null);
    }`,
    `    // ${MARKER}: New Arch forbids overloaded @ReactMethod names
    public void displayIncomingCall(String uuid, String number, String callerName) {
        this.displayIncomingCall(uuid, number, callerName, false, null);
    }`,
  ],
  [
    `    @ReactMethod
    public void startCall(String uuid, String number, String callerName) {
        this.startCall(uuid, number, callerName, false, null);
    }`,
    `    // ${MARKER}: New Arch forbids overloaded @ReactMethod names
    public void startCall(String uuid, String number, String callerName) {
        this.startCall(uuid, number, callerName, false, null);
    }`,
  ],
]

for (const [from, to] of replacements) {
  if (!contents.includes(from)) {
    console.warn('[patch-callkeep-newarch-overloads] pattern not found:', from.slice(0, 80))
    continue
  }
  contents = contents.replace(from, to)
}

if (contents !== original) {
  fs.writeFileSync(target, contents)
  console.log('[patch-callkeep-newarch-overloads] Patched', path.relative(process.cwd(), target))
} else {
  console.warn('[patch-callkeep-newarch-overloads] No changes applied')
}
