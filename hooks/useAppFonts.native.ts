import { useEffect, useState } from 'react'
import { useFonts } from 'expo-font'

export function useAppFonts(): [boolean] {
  const [loaded, fontError] = useFonts({
    Inter: require('@tamagui/font-inter/otf/Inter-Medium.otf'),
    InterBold: require('@tamagui/font-inter/otf/Inter-Bold.otf'),
  })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (loaded || fontError) {
      setReady(true)
      return
    }
    const timeout = setTimeout(() => setReady(true), 2500)
    return () => clearTimeout(timeout)
  }, [loaded, fontError])

  return [ready]
}
