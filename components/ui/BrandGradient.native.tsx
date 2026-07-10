import { LinearGradient } from 'expo-linear-gradient'
import type { ViewProps } from 'react-native'
import { StyleSheet } from 'react-native'

import { gradients } from '~/config/tokens'

export type BrandGradientProps = ViewProps & {
  variant?: keyof typeof gradients
}

/** Native hero gradients via expo-linear-gradient (avoids Tamagui LinearGradient setup). */
export function BrandGradient({ variant = 'brand', style, ...props }: BrandGradientProps) {
  const colors = gradients[variant] as string[]

  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.fill, style]}
      {...props}
    />
  )
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
})
