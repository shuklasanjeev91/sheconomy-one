import { useThemeName } from 'tamagui'

import { type AppUiTokens, appUiDark, appUiLight } from '~/lib/theme/app-ui'

export function useAppUi(): AppUiTokens {
  const themeName = useThemeName()
  return themeName === 'dark' ? appUiDark : appUiLight
}

export function useIsDarkTheme() {
  return useThemeName() === 'dark'
}
