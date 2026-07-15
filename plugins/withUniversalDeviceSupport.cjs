/**
 * Ensures the app runs native full-screen on iPhone + iPad (and Android tablets),
 * instead of iPhone-compatibility / letterboxed mode on larger devices.
 *
 * Expo's ios.supportsTablet alone can be dropped on prebuild; this plugin
 * forces UIDeviceFamily + TARGETED_DEVICE_FAMILY on every native generation.
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

    for (const key of Object.keys(configurations)) {
      const entry = configurations[key]
      if (!entry || typeof entry !== 'object' || !entry.buildSettings) continue

      const settings = entry.buildSettings
      // Main app + extensions should all be universal (1 = iPhone, 2 = iPad).
      if (settings.TARGETED_DEVICE_FAMILY != null) {
        settings.TARGETED_DEVICE_FAMILY = '"1,2"'
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
  '1.0.0',
)
