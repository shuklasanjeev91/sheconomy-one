import { useState } from 'react'

import { Icons, Input, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { SHEAI_LANGUAGES, SHEAI_PROMPT_CHIPS } from '~/lib/search/sheai'
import { useAppUi } from '~/lib/theme/useAppUi'

const COMPOSER_PLACEHOLDER =
  'e.g. something special for my mother’s 60th birthday… या बताइये क्या चाहिए…'

type SheaiPromptProps = {
  compact?: boolean
  /** Defaults to the full landing layout (`!compact`). */
  showComposer?: boolean
  onPickChip: (query: string) => void
  onSubmit?: (query: string) => void
}

export function SheaiComposer({
  onSubmit,
  placeholder = COMPOSER_PLACEHOLDER,
  large = false,
  autoFocus,
}: {
  onSubmit: (query: string) => void
  placeholder?: string
  large?: boolean
  autoFocus?: boolean
}) {
  const ui = useAppUi()
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)

  function submit() {
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setValue('')
  }

  const buttonSize = large ? 46 : 32

  return (
    <XStack
      width="100%"
      alignItems="center"
      gap="$2"
      paddingLeft={large ? 18 : 14}
      paddingRight={8}
      paddingVertical={8}
      minHeight={large ? 62 : 48}
      borderRadius={large ? 24 : 14}
      borderWidth={1.5}
      borderColor={focused ? ui.brand : ui.borderSubtle}
      backgroundColor={ui.surface}
    >
      <Input
        flex={1}
        minWidth={0}
        unstyled
        value={value}
        autoFocus={autoFocus}
        onChangeText={setValue}
        onSubmitEditing={submit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        returnKeyType="search"
        placeholder={placeholder}
        fontSize={large ? 15 : 14}
        fontWeight="500"
        color={ui.text}
        placeholderTextColor={ui.textMuted}
        borderWidth={0}
        backgroundColor="transparent"
        accessibilityLabel="Ask SHEai"
      />
      <XStack
        width={buttonSize}
        height={buttonSize}
        flexShrink={0}
        borderRadius={large ? 14 : 10}
        alignItems="center"
        justifyContent="center"
        backgroundColor={ui.brand}
        cursor="pointer"
        hoverStyle={{ opacity: 0.92 }}
        pressStyle={{ opacity: 0.88 }}
        onPress={submit}
        accessibilityRole="button"
        accessibilityLabel="Ask SHEai"
      >
        <Icons.Sparkles size={large ? 18 : 15} color={ui.onBrand} />
      </XStack>
    </XStack>
  )
}

export function SheaiPrompt({ compact, showComposer, onPickChip, onSubmit }: SheaiPromptProps) {
  const ui = useAppUi()
  const submit = onSubmit ?? onPickChip
  const composerVisible = showComposer ?? !compact

  return (
    <YStack
      gap={compact ? '$2.5' : '$4'}
      width="100%"
      maxWidth={compact ? '100%' : 660}
      alignSelf="center"
      alignItems={compact ? 'flex-start' : 'center'}
      paddingHorizontal={compact ? '$3' : 0}
    >
      {!compact ? (
        <XStack
          width={44}
          height={44}
          borderRadius={12}
          backgroundColor={ui.brand}
          alignItems="center"
          justifyContent="center"
        >
          <Icons.Sparkles size={20} color={ui.onBrand} />
        </XStack>
      ) : null}

      <YStack gap="$1.5" width="100%" alignItems={compact ? 'flex-start' : 'center'}>
        <Text
          fontSize={11}
          fontWeight="700"
          color={ui.brand}
          letterSpacing={1.2}
          textAlign={compact ? 'left' : 'center'}
        >
          POWERED BY SHEAI · UNDERSTANDS YOU
        </Text>
        <Text
          fontSize={compact ? 16 : 28}
          fontWeight="800"
          color={ui.text}
          letterSpacing={-0.4}
          textAlign={compact ? 'left' : 'center'}
        >
          Tell me what you truly want
        </Text>
        <Text
          fontSize={compact ? 13 : 15}
          color={ui.textSecondary}
          lineHeight={compact ? 19 : 22}
          textAlign={compact ? 'left' : 'center'}
          maxWidth={compact ? '100%' : 480}
        >
          Describe a feeling, an occasion, a person — SHEai finds the listing. No keywords needed.
        </Text>
      </YStack>

      <XStack gap="$1.5" flexWrap="wrap" justifyContent={compact ? 'flex-start' : 'center'}>
        {SHEAI_LANGUAGES.map((lang) => (
          <XStack
            key={lang}
            paddingHorizontal="$2.5"
            paddingVertical="$1"
            borderRadius={radius.pill}
            backgroundColor={ui.roseSurface}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            alignItems="center"
            gap="$1.5"
          >
            <YStack width={5} height={5} borderRadius={999} backgroundColor={ui.brand} />
            <Text fontSize={11} fontWeight="600" color={ui.brand}>
              {lang}
            </Text>
          </XStack>
        ))}
      </XStack>

      {composerVisible ? (
        <YStack gap="$2" width="100%" maxWidth={660}>
          <SheaiComposer onSubmit={submit} large={!compact} autoFocus={!compact} />
          {!compact ? (
            <Text fontSize={12} color={ui.textMuted} textAlign="center">
              Just describe it naturally · Press Enter to ask SHEai
            </Text>
          ) : null}
        </YStack>
      ) : null}

      <YStack gap="$1.5" width="100%">
        <Text
          fontSize={11}
          fontWeight="700"
          color={ui.textMuted}
          letterSpacing={0.6}
          textAlign={compact ? 'left' : 'center'}
        >
          OTHERS ARE ASKING
        </Text>
        <XStack gap="$2" flexWrap="wrap" justifyContent={compact ? 'flex-start' : 'center'}>
          {SHEAI_PROMPT_CHIPS.map((chip) => (
            <XStack
              key={chip.label}
              paddingHorizontal="$3"
              paddingVertical="$2"
              borderRadius={radius.pill}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surface}
              cursor="pointer"
              hoverStyle={{ backgroundColor: ui.surfaceHover, borderColor: ui.brand }}
              pressStyle={{ opacity: 0.88 }}
              onPress={() => onPickChip(chip.query)}
              accessibilityRole="button"
              accessibilityLabel={`Ask SHEai: ${chip.label}`}
            >
              <Text fontSize={13} fontWeight="600" color={ui.text}>
                {chip.label}
              </Text>
            </XStack>
          ))}
        </XStack>
      </YStack>
    </YStack>
  )
}

export function SheaiAskAgain({ onSubmit }: { onSubmit: (query: string) => void }) {
  const ui = useAppUi()

  return (
    <YStack gap="$2.5" width="100%">
      <Text fontSize={11} fontWeight="700" color={ui.textMuted} letterSpacing={0.6}>
        ASK SHEAI AGAIN
      </Text>
      <SheaiComposer onSubmit={onSubmit} placeholder="Describe what you want…" />
      <XStack gap="$2" flexWrap="wrap">
        {SHEAI_PROMPT_CHIPS.slice(0, 4).map((chip) => (
          <XStack
            key={chip.label}
            paddingHorizontal="$2.5"
            paddingVertical="$1.5"
            borderRadius={radius.pill}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surface}
            cursor="pointer"
            hoverStyle={{ backgroundColor: ui.surfaceHover, borderColor: ui.brand }}
            pressStyle={{ opacity: 0.88 }}
            onPress={() => onSubmit(chip.query)}
            accessibilityRole="button"
            accessibilityLabel={`Ask SHEai: ${chip.label}`}
          >
            <Text fontSize={12} fontWeight="600" color={ui.text}>
              {chip.label}
            </Text>
          </XStack>
        ))}
      </XStack>
    </YStack>
  )
}
