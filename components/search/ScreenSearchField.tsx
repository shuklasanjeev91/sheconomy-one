import { Icons, Input, XStack } from '~/components/ui'
import { recordAppSearchTerm } from '~/lib/search/history'
import type { SearchScope } from '~/lib/search/types'
import { appRoutes } from '~/lib/routes'
import { navigateApp } from '~/lib/platform/navigate'
import { useAppUi } from '~/lib/theme/useAppUi'

type ScreenSearchFieldProps = {
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  /** When set, Enter/submit opens unified `/search` for this scope. */
  unifiedScope?: SearchScope
  onSubmit?: () => void
  /** Pill shape (default) or flat inside a parent card. */
  variant?: 'pill' | 'plain'
  /** Show clear button when value is non-empty. */
  clearable?: boolean
}

/**
 * Inline search bar used on list screens — same debounce/submit behavior as the header omnibox.
 */
export function ScreenSearchField({
  value,
  onChangeText,
  placeholder = 'Search',
  unifiedScope,
  onSubmit,
  variant = 'pill',
  clearable = true,
}: ScreenSearchFieldProps) {
  const ui = useAppUi()

  function handleSubmit() {
    const trimmed = value.trim()
    if (unifiedScope && trimmed) {
      recordAppSearchTerm(trimmed)
      navigateApp(appRoutes.search(trimmed, unifiedScope) as never)
    }
    onSubmit?.()
  }

  const isPlain = variant === 'plain'

  return (
    <XStack
      alignItems="center"
      gap={8}
      paddingHorizontal={isPlain ? 0 : 12}
      paddingVertical={0}
      height={isPlain ? undefined : 42}
      minHeight={isPlain ? undefined : 42}
      borderRadius={isPlain ? 0 : 999}
      borderWidth={isPlain ? 0 : 1}
      borderColor={ui.borderSubtle}
      backgroundColor={isPlain ? 'transparent' : ui.surface}
      width="100%"
    >
      <Icons.Search size={isPlain ? 18 : 16} color={ui.textMuted} flexShrink={0} />

      <Input
        flex={1}
        minWidth={0}
        unstyled
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={handleSubmit}
        returnKeyType="search"
        placeholder={placeholder}
        borderWidth={0}
        backgroundColor="transparent"
        paddingHorizontal={0}
        fontSize={14}
        color={ui.text}
        placeholderTextColor={ui.textMuted}
      />

      {clearable && value.length > 0 ? (
        <XStack
          width={28}
          height={28}
          flexShrink={0}
          alignItems="center"
          justifyContent="center"
          borderRadius={999}
          cursor="pointer"
          hoverStyle={{ backgroundColor: ui.surfaceHover }}
          pressStyle={{ opacity: 0.8 }}
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          aria-label="Clear search"
        >
          <Icons.X size={14} color={ui.textMuted} />
        </XStack>
      ) : null}
    </XStack>
  )
}
