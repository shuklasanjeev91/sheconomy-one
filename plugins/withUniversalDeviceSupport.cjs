/**
 * Ensures the app runs native full-screen on iPhone + iPad (and Android tablets),
 * instead of iPhone-compatibility / letterboxed mode on larger devices.
 *
 * Expo's ios.supportsTablet alone can be dropped on prebuild; this plugin
 * forces UIDeviceFamily + TARGETED_DEVICE_FAMILY on every native generation.
 *
 * Also marks non-essential Android hardware features as optional so Play does
 * not filter out Phone / Tablet / Desktop / XR devices (see Play Console
 * "Required hardware feature declarations are restricting your app's
 * availability").
 */
const {
  AndroidConfig,
  createRunOncePlugin,
  withInfoPlist,
  withXcodeProject,
  withAndroidManifest,
} = require('@expo/config-plugins')

const IPAD_ORIENTATIONS = [
  'UIInterfaceOrientationPortrait',
  'UIInterfaceOrientationPortraitUpsideDown',
  'UIInterfaceOrientationLandscapeLeft',
  'UIInterfaceOrientationLandscapeRight',
]

/**
 * Features Play (and libraries) often treat as required because an activity
 * locks orientation, or a permission implies the hardware. None of these are
 * hard requirements for SHEconomy — meetings / checkout still work without them.
 */
const OPTIONAL_ANDROID_FEATURES = [
  'android.hardware.screen.portrait',
  'android.hardware.screen.landscape',
  'android.hardware.wifi',
  'android.hardware.camera',
  'android.hardware.camera.autofocus',
  'android.hardware.microphone',
  'android.hardware.location',
  'android.hardware.location.gps',
  'android.hardware.location.network',
  'android.hardware.bluetooth',
  'android.hardware.bluetooth_le',
  'android.hardware.telephony',
  'android.hardware.touchscreen',
]

function ensureOptionalUsesFeature(manifest, featureName) {
  if (!Array.isArray(manifest['uses-feature'])) {
    manifest['uses-feature'] = []
  }

  const existing = manifest['uses-feature'].find(
    (entry) => entry?.$?.['android:name'] === featureName,
  )

  if (existing) {
    existing.$['android:required'] = 'false'
    return
  }

  manifest['uses-feature'].push({
    $: {
      'android:name': featureName,
      'android:required': 'false',
    },
  })
}

function withIosUniversalDevices(config) {
  config = withInfoPlist(config, (mod) => {
    mod.modResults.UIDeviceFamily = [1, 2]
    mod.modResults['UISupportedInterfaceOrientations~ipad'] = IPAD_ORIENTATIONS
    if (!mod.modResults.UISupportedInterfaceOrientations) {
      mod.modResults.UISupportedInterfaceOrientations = [
        'UIInterfaceOrientationPortrait',
        'UIInterfaceOrientationLandscapeLeft',
        'UIInterfaceOrientationLandscapeRight',
      ]
    }
    return mod
  })

  config = withXcodeProject(config, (mod) => {
    const project = mod.modResults
    const configurations = project.pbxXCBuildConfigurationSection()
    const buildNumber = String(config.ios?.buildNumber || config.version || '1')
    const marketingVersion = String(config.version || '1.0')

    for (const key of Object.keys(configurations)) {
      const entry = configurations[key]
      if (!entry || typeof entry !== 'object' || !entry.buildSettings) continue

      const settings = entry.buildSettings
      // Main app + extensions should all be universal (1 = iPhone, 2 = iPad).
      if (settings.TARGETED_DEVICE_FAMILY != null) {
        settings.TARGETED_DEVICE_FAMILY = '"1,2"'
      }

      // Keep ScreenShare / NSE CFBundleVersion aligned with the parent app.
      // Mismatched extension versions break ReplayKit screen share on device.
      if (settings.PRODUCT_BUNDLE_IDENTIFIER) {
        settings.CURRENT_PROJECT_VERSION = buildNumber
        settings.MARKETING_VERSION = marketingVersion
      }
    }

    return mod
  })

  return config
}

function withAndroidTabletSupport(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest)
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest)

    application.$['android:supportsRtl'] = 'true'
    mainActivity.$['android:resizeableActivity'] = 'true'
    // Allow portrait + landscape; meeting UI adapts via orientation layout policy.
    mainActivity.$['android:screenOrientation'] = 'fullUser'

    const configChanges = mainActivity.$['android:configChanges'] || ''
    const required = [
      'keyboard',
      'keyboardHidden',
      'orientation',
      'screenSize',
      'screenLayout',
      'uiMode',
      'smallestScreenSize',
    ]
    const merged = new Set(
      configChanges
        .split('|')
        .map((part) => part.trim())
        .filter(Boolean)
        .concat(required),
    )
    mainActivity.$['android:configChanges'] = [...merged].join('|')

    for (const featureName of OPTIONAL_ANDROID_FEATURES) {
      ensureOptionalUsesFeature(manifest, featureName)
    }

    return mod
  })
}

function withUniversalDeviceSupport(config) {
  config = withIosUniversalDevices(config)
  config = withAndroidTabletSupport(config)
  return config
}

module.exports = createRunOncePlugin(
  withUniversalDeviceSupport,
  'with-universal-device-support',
  '1.2.0',
)
