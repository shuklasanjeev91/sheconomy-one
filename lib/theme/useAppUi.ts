import { type AppUiTokens, appUiDark, appUiLight } from '~/lib/theme/app-ui'
import { useResolvedScheme } from '~/lib/theme/scheme-override'

export function useAppUi(): AppUiTokens {
  return useResolvedScheme() === 'dark' ? appUiDark : appUiLight
}

export function useIsDarkTheme() {
  return useResolvedScheme() === 'dark'
}
