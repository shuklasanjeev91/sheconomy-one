import { useEffect, useState } from 'react'
import { useFonts } from 'expo-font'

export function useAppFonts(): [boolean] {
  useFonts({
    Inter: require('@tamagui/font-inter/otf/Inter-Medium.otf'),
    InterBold: require('@tamagui/font-inter/otf/Inter-Bold.otf'),
  })

  // Never block the shell on font bytes — Tamagui falls back to system fonts until ready.
  return [true]
}
