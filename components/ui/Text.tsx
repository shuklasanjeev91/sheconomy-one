import { forwardRef, type ComponentType } from 'react'
import { Text as RNText } from 'react-native'
import {
  H1 as TH1,
  H2 as TH2,
  H3 as TH3,
  H4 as TH4,
  H5 as TH5,
  H6 as TH6,
  Paragraph as TParagraph,
  SizableText as TSizableText,
  Text as TText,
  type GetProps,
} from 'tamagui'

/** Cap OS accessibility font scaling so layout stays usable on Large/Largest settings. */
export const MAX_FONT_SIZE_MULTIPLIER = 1.3

// Catch RN Text / Tamagui internals that bypass our wrappers (no-op in unit mocks).
try {
  if (RNText) {
    const rnDefaults =
      (RNText as { defaultProps?: { maxFontSizeMultiplier?: number } }).defaultProps ?? {}
    ;(RNText as { defaultProps?: Record<string, unknown> }).defaultProps = {
      ...rnDefaults,
      maxFontSizeMultiplier: rnDefaults.maxFontSizeMultiplier ?? MAX_FONT_SIZE_MULTIPLIER,
    }
  }
} catch {
  // ignore — vitest react-native stub may not expose Text
}

type WithFontCap = { maxFontSizeMultiplier?: number }

function withFontCap<P extends WithFontCap>(Component: ComponentType<P>, displayName: string) {
  const Wrapped = forwardRef<unknown, P>(function FontCapped(props, ref) {
    const { maxFontSizeMultiplier = MAX_FONT_SIZE_MULTIPLIER, ...rest } = props
    return <Component ref={ref as never} maxFontSizeMultiplier={maxFontSizeMultiplier} {...(rest as P)} />
  })
  Wrapped.displayName = displayName
  return Wrapped
}

export const Text = withFontCap(TText as ComponentType<GetProps<typeof TText>>, 'Text')
export const Paragraph = withFontCap(
  TParagraph as ComponentType<GetProps<typeof TParagraph>>,
  'Paragraph',
)
export const SizableText = withFontCap(
  TSizableText as ComponentType<GetProps<typeof TSizableText>>,
  'SizableText',
)
export const H1 = withFontCap(TH1 as ComponentType<GetProps<typeof TH1>>, 'H1')
export const H2 = withFontCap(TH2 as ComponentType<GetProps<typeof TH2>>, 'H2')
export const H3 = withFontCap(TH3 as ComponentType<GetProps<typeof TH3>>, 'H3')
export const H4 = withFontCap(TH4 as ComponentType<GetProps<typeof TH4>>, 'H4')
export const H5 = withFontCap(TH5 as ComponentType<GetProps<typeof TH5>>, 'H5')
export const H6 = withFontCap(TH6 as ComponentType<GetProps<typeof TH6>>, 'H6')
