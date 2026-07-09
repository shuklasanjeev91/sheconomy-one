import { Platform } from 'react-native'
import { useFonts } from 'expo-font'

if (Platform.OS === 'web') {
  // Vite inlines these as CSS; Metro eliminates this branch on iOS/Android.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@tamagui/font-inter/css/400.css')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@tamagui/font-inter/css/600.css')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@tamagui/font-inter/css/700.css')
}

export function useAppFonts(): [boolean] {
  const [loaded] = useFonts(
    Platform.OS === 'web'
      ? {}
      : {
          Inter: require('@tamagui/font-inter/otf/Inter-Medium.otf'),
          InterBold: require('@tamagui/font-inter/otf/Inter-Bold.otf'),
        },
  )

  return [Platform.OS === 'web' ? true : loaded]
}
