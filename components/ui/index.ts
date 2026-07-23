// ---------------------------------------------------------------------------
// SHEconomy UI — a premium, cross-platform (web + iOS + Android) component
// kit built on top of Tamagui. Import everything from here:
//
//   import { Button, Card, Input, useAppToast } from '~/components/ui'
//
// Organized to mirror Tamagui's own component categories.
// ---------------------------------------------------------------------------

// Forms
export * from './Button'
export * from './Checkbox'
export * from './ValidatedField'
export * from './Input'
export * from './DateTimeField'
export * from './Label'
export * from './Progress'
export * from './RadioGroup'
export * from './Select'
export * from './Slider'
export * from './Switch'
export * from './ToggleGroup'

// Menus
export * from './Menu'

// Panels
export * from './Accordion'
export * from './AlertDialog'
export * from './ConfirmDialog'
export * from './Dialog'
export * from './Popover'
export * from './Sheet'
export * from './BottomSheet'
export * from './NativeFullscreenAdapt'
export * from './Tabs'
export * from './Tooltip'
export * from './Toast'
export * from './ScreenState'
export * from './Skeleton'
export * from './ActionProgress'

// Content
export * from './Avatar'
export * from './Badge'
export * from './Card'
export * from './ListItem'

// Visual
export * from './BrandGradient'
export * from './Separator'
export * from './Spinner'

// Re-export the primitives that need no restyling — layout, a11y and
// structural helpers already work great as-is, straight from Tamagui.
// (RovingFocusGroup lives in the separate `@tamagui/roving-focus-group`
// package if you need it directly.)
export {
  Adapt,
  Anchor,
  Circle,
  Form,
  Group,
  Portal,
  ScrollView,
  Square,
  Theme,
  Unspaced,
  VisuallyHidden,
  XStack,
  YStack,
  ZStack,
  useMedia,
  useTheme,
} from 'tamagui'

// Native-safe Image — percentage width/height must not land in RN `source`.
export { Image } from './Image'
export type { AppImageProps } from './Image'

export {
  Text,
  Paragraph,
  SizableText,
  H1,
  H2,
  H3,
  H4,
  H5,
  H6,
  MAX_FONT_SIZE_MULTIPLIER,
} from './Text'

export { LinearGradient } from 'tamagui/linear-gradient'
export { FocusScope } from '@tamagui/focus-scope'

// Namespaced (not `export *`) since lucide has icons literally named
// `Badge`, `Menu`, etc. that would otherwise collide with our components.
// Usage: <Icons.Check /> <Icons.ChevronDown />
export * as Icons from '@tamagui/lucide-icons'

export { BRAND_THEME, gradients, radius, shadows, getShadowStyle } from '~/config/tokens'
