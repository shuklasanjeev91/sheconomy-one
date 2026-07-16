import { resolvePushPlatform } from '~/lib/notifications/push-config'

export function pushPlatformLabel(): string {
  const platform = resolvePushPlatform()
  if (platform === 'ios') return 'iOS'
  if (platform === 'android') return 'Android'
  return 'web'
}
