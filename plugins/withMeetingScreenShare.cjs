/**
 * Co-Work Present (screen share) on native.
 *
 * iOS: a ReplayKit broadcast upload extension streams frames over the app-group
 * socket that react-native-webrtc's ScreenCapturer listens on
 * (`RTCAppGroupIdentifier` / `RTCScreenSharingExtension` Info.plist keys).
 * Extension sources live in ./screen-share-extension (Jitsi reference, Apache-2.0).
 *
 * Android: MediaProjection permission. The foreground service is enabled at
 * startup by modules/call-audio and declared by withAndroidFgsCompliance.
 */
const fs = require('node:fs')
const path = require('node:path')
const plist = require('@expo/plist').default
const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
} = require('@expo/config-plugins')

const DEFAULT_EXTENSION_NAME = 'ScreenShareExtension'
const DEPLOYMENT_TARGET = '16.0'
const SOURCE_DIR = path.join(__dirname, 'screen-share-extension')
const SWIFT_FILES = [
  'SampleHandler.swift',
  'SampleUploader.swift',
  'SocketConnection.swift',
  'DarwinNotificationCenter.swift',
  'Atomic.swift',
]
const APP_GROUP_PLACEHOLDER = 'group.com.jitsi.example-screensharing.appgroup'

function resolveIds(mod, extensionName, appGroupId) {
  const bundleId = mod.ios?.bundleIdentifier ?? ''
  return {
    appGroup: appGroupId ?? `group.${bundleId}`,
    extensionBundleId: `${bundleId}.${extensionName}`,
  }
}

function withScreenShareInfoPlist(config, extensionName, appGroupId) {
  return withInfoPlist(config, (mod) => {
    const { appGroup, extensionBundleId } = resolveIds(mod, extensionName, appGroupId)
    mod.modResults.RTCScreenSharingExtension = extensionBundleId
    mod.modResults.RTCAppGroupIdentifier = appGroup
    return mod
  })
}

function withScreenShareEntitlements(config, extensionName, appGroupId) {
  return withEntitlementsPlist(config, (mod) => {
    const { appGroup } = resolveIds(mod, extensionName, appGroupId)
    const groups = mod.modResults['com.apple.security.application-groups'] ?? []
    if (!groups.includes(appGroup)) {
      mod.modResults['com.apple.security.application-groups'] = [...groups, appGroup]
    }
    return mod
  })
}

function withScreenShareXcodeProject(config, extensionName) {
  return withXcodeProject(config, (mod) => {
    const project = mod.modResults
    if (project.pbxTargetByName(extensionName)) return mod
    const { extensionBundleId } = resolveIds(mod, extensionName)

    const target = project.addTarget(extensionName, 'app_extension', extensionName, extensionBundleId)
    const group = project.addPbxGroup(SWIFT_FILES, extensionName, extensionName, '"<group>"')
    const mainGroupId = project.getFirstProject().firstProject.mainGroup
    project.getPBXGroupByKey(mainGroupId).children.push({ value: group.uuid, comment: extensionName })
    project.addBuildPhase(
      SWIFT_FILES.map((file) => `${extensionName}/${file}`),
      'PBXSourcesBuildPhase',
      'Sources',
      target.uuid,
    )

    const configurations = project.pbxXCBuildConfigurationSection()
    const listId = project.pbxNativeTargetSection()[target.uuid]?.buildConfigurationList
    const list = listId ? project.pbxXCConfigurationList()[listId] : null
    for (const entry of list?.buildConfigurations ?? []) {
      const settings = configurations[entry.value]?.buildSettings
      if (!settings) continue
      settings.SWIFT_VERSION = '5.0'
      settings.IPHONEOS_DEPLOYMENT_TARGET = DEPLOYMENT_TARGET
      settings.TARGETED_DEVICE_FAMILY = '"1,2"'
      settings.CODE_SIGN_ENTITLEMENTS = `${extensionName}/${extensionName}.entitlements`
      settings.CODE_SIGN_STYLE = 'Automatic'
      settings.PRODUCT_BUNDLE_IDENTIFIER = `"${extensionBundleId}"`
      settings.GENERATE_INFOPLIST_FILE = 'NO'
      settings.INFOPLIST_FILE = `${extensionName}/Info.plist`
      settings.CURRENT_PROJECT_VERSION = '1'
      settings.MARKETING_VERSION = '1.0'
    }
    return mod
  })
}

function withScreenShareExtensionFiles(config, extensionName, appGroupId) {
  return withDangerousMod(config, [
    'ios',
    async (mod) => {
      const { appGroup } = resolveIds(mod, extensionName, appGroupId)
      const extensionPath = path.join(mod.modRequest.platformProjectRoot, extensionName)
      fs.mkdirSync(extensionPath, { recursive: true })

      fs.writeFileSync(
        path.join(extensionPath, 'Info.plist'),
        plist.build({
          CFBundleDevelopmentRegion: '$(DEVELOPMENT_LANGUAGE)',
          CFBundleDisplayName: 'Screen Share',
          CFBundleExecutable: '$(EXECUTABLE_NAME)',
          CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)',
          CFBundleInfoDictionaryVersion: '6.0',
          CFBundleName: '$(PRODUCT_NAME)',
          CFBundlePackageType: '$(PRODUCT_BUNDLE_PACKAGE_TYPE)',
          CFBundleShortVersionString: '$(MARKETING_VERSION)',
          CFBundleVersion: '$(CURRENT_PROJECT_VERSION)',
          NSExtension: {
            NSExtensionPointIdentifier: 'com.apple.broadcast-services-upload',
            NSExtensionPrincipalClass: '$(PRODUCT_MODULE_NAME).SampleHandler',
            RPBroadcastProcessMode: 'RPBroadcastProcessModeSampleBuffer',
          },
        }),
      )

      for (const file of SWIFT_FILES) {
        let contents = fs.readFileSync(path.join(SOURCE_DIR, file), 'utf8')
        if (file === 'SampleHandler.swift') contents = contents.replace(APP_GROUP_PLACEHOLDER, appGroup)
        fs.writeFileSync(path.join(extensionPath, file), contents)
      }

      fs.writeFileSync(
        path.join(extensionPath, `${extensionName}.entitlements`),
        plist.build({ 'com.apple.security.application-groups': [appGroup] }),
      )
      return mod
    },
  ])
}

/** ccache wrappers from the app target break linking the Swift-only extension. */
function withScreenSharePodfile(config, extensionName) {
  return withDangerousMod(config, [
    'ios',
    (mod) => {
      const podfilePath = path.join(mod.modRequest.platformProjectRoot, 'Podfile')
      const contents = fs.readFileSync(podfilePath, 'utf8')
      const marker = '# [withMeetingScreenShare]'
      if (contents.includes(marker) || !contents.includes('post_install')) return mod

      const snippet = `
    ${marker} plain clang for the broadcast extension
    installer.aggregate_targets.map(&:user_project).uniq(&:path).each do |project|
      extension_target = project.native_targets.find { |t| t.name == '${extensionName}' }
      next unless extension_target
      extension_target.build_configurations.each do |ext_config|
        ext_config.build_settings['CC'] = '$(DEVELOPER_DIR)/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang'
        ext_config.build_settings['CXX'] = '$(DEVELOPER_DIR)/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang++'
        ext_config.build_settings['LD'] = '$(DEVELOPER_DIR)/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang'
        ext_config.build_settings['LDPLUSPLUS'] = '$(DEVELOPER_DIR)/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang++'
      end
      project.save()
    end`

      // Insert before the `end` that closes `post_install do |installer|`.
      const lines = contents.split('\n')
      let depth = 0
      let insertAt = -1
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim()
        if (/^post_install\s+do/.test(trimmed)) {
          depth = 1
          continue
        }
        if (depth === 0) continue
        if (/\bdo\b(\s+\|.*\|)?\s*$/.test(trimmed)) depth++
        if (trimmed === 'end' && --depth === 0) {
          insertAt = i
          break
        }
      }
      if (insertAt !== -1) {
        lines.splice(insertAt, 0, snippet)
        fs.writeFileSync(podfilePath, lines.join('\n'))
      }
      return mod
    },
  ])
}

function withScreenShareAndroidPermission(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest
    const permission = 'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION'
    manifest['uses-permission'] = manifest['uses-permission'] ?? []
    if (!manifest['uses-permission'].some((entry) => entry.$?.['android:name'] === permission)) {
      manifest['uses-permission'].push({ $: { 'android:name': permission } })
    }
    return mod
  })
}

/** Meeting / call Picture-in-Picture (Activity PiP — no foreground service needed). */
function withMeetingPictureInPicture(config) {
  return withAndroidManifest(config, (mod) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults)
    activity.$['android:supportsPictureInPicture'] = 'true'
    activity.$['android:resizeableActivity'] = 'true'
    return mod
  })
}

function withMeetingScreenShare(config, options = {}) {
  const extensionName = options.ios?.extensionName ?? DEFAULT_EXTENSION_NAME
  const appGroupId = options.ios?.appGroupIdentifier
  config = withScreenShareInfoPlist(config, extensionName, appGroupId)
  config = withScreenShareEntitlements(config, extensionName, appGroupId)
  config = withScreenShareXcodeProject(config, extensionName)
  config = withScreenShareExtensionFiles(config, extensionName, appGroupId)
  config = withScreenSharePodfile(config, extensionName)
  config = withScreenShareAndroidPermission(config)
  config = withMeetingPictureInPicture(config)
  return config
}

module.exports = createRunOncePlugin(withMeetingScreenShare, 'withMeetingScreenShare', '1.0.0')
