// ---------------------------------------------------------------------------
// SHEconomy UI — a premium, cross-platform (web + iOS + Android) component
// kit built on top of Tamagui. Import everything from here:
//
//   import { Button, Card, Input, useAppToast } from '~/components/ui'
//
// Organized to mirror Tamagui's own component categories.
// ---------------------------------------------------------------------------

// Forms
export * from '~/components/ui/Button'
export * from '~/components/ui/Checkbox'
export * from '~/components/ui/ValidatedField'
export * from '~/components/ui/Input'
export * from '~/components/ui/DateTimeField'
export * from '~/components/ui/Label'
export * from '~/components/ui/Progress'
export * from '~/components/ui/RadioGroup'
export * from '~/components/ui/Select'
export * from '~/components/ui/Slider'
export * from '~/components/ui/Switch'
export * from '~/components/ui/ToggleGroup'

// Menus
export * from '~/components/ui/Menu'

// Panels
export * from '~/components/ui/Accordion'
export * from '~/components/ui/AlertDialog'
export * from '~/components/ui/ConfirmDialog'
export * from '~/components/ui/Dialog'
export * from '~/components/ui/Popover'
export * from '~/components/ui/Sheet'
export * from '~/components/ui/BottomSheet'
export * from '~/components/ui/NativeFullscreenAdapt'
export * from '~/components/ui/Tabs'
export * from '~/components/ui/Tooltip'
export * from '~/components/ui/Toast'
export * from '~/components/ui/ScreenState'
export * from '~/components/ui/Skeleton'
export * from '~/components/ui/ActionProgress'

// Content
export * from '~/components/ui/Avatar'
export * from '~/components/ui/Badge'
export * from '~/components/ui/Card'
export * from '~/components/ui/ListItem'

// Visual
export * from '~/components/ui/BrandGradient'
export * from '~/components/ui/Separator'
export * from '~/components/ui/Spinner'

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

// Keyboard-aware ScrollView — see the file for why iOS needs the inset.
export { KeyboardAvoidedByParentContext, ScrollView } from '~/components/ui/ScrollView'

// Native-safe Image — percentage width/height must not land in RN `source`.
export { Image } from '~/components/ui/Image'
export type { AppImageProps } from '~/components/ui/Image'

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
} from '~/components/ui/Text'

export { LinearGradient } from 'tamagui/linear-gradient'
export { FocusScope } from '@tamagui/focus-scope'

// Namespaced (not `export *`) since lucide has icons literally named
// `Badge`, `Menu`, etc. that would otherwise collide with our components.
// Usage: <Icons.Check /> <Icons.ChevronDown />
// Curated subset — full @tamagui/lucide-icons re-export OOMs Hermes on device (~39MB).
export * as Icons from '~/components/ui/icons'

export { BRAND_THEME, gradients, radius, shadows, getShadowStyle } from '~/config/tokens'
