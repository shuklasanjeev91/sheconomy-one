import { useMemo, useState } from 'react'

import { Badge, Icons, Input, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { generateSlug } from '~/lib/cms'
import { useAppUi } from '~/lib/theme/useAppUi'

export type CmsTagChip = { id: string; name: string }

export type CmsTagsInputProps = {
  value: CmsTagChip[]
  onChange: (tags: CmsTagChip[]) => void
  availableTags: { id: string; name: string; slug: string }[]
}

export function CmsTagsInput({ value, onChange, availableTags }: CmsTagsInputProps) {
  const ui = useAppUi()
  const [query, setQuery] = useState('')

  const suggestions = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    const selected = new Set(value.map((t) => t.id))
    return availableTags
      .filter(
        (tag) =>
          !selected.has(tag.id) &&
          (tag.name.toLowerCase().includes(needle) || tag.slug.toLowerCase().includes(needle)),
      )
      .slice(0, 8)
  }, [availableTags, query, value])

  function addTag(tag: CmsTagChip) {
    if (value.some((t) => t.id === tag.id || t.name.toLowerCase() === tag.name.toLowerCase())) return
    onChange([...value, tag])
    setQuery('')
  }

  function addFromQuery() {
    const name = query.trim()
    if (!name) return
    const exact = availableTags.find((t) => t.name.toLowerCase() === name.toLowerCase())
    if (exact) {
      addTag({ id: exact.id, name: exact.name })
      return
    }
    const slug = generateSlug(name)
    if (!slug) return
    addTag({ id: `new:${slug}`, name })
  }

  function removeTag(id: string) {
    onChange(value.filter((t) => t.id !== id))
  }

  return (
    <YStack gap="$2">
      <XStack gap="$2" flexWrap="wrap">
        {value.map((tag) => (
          <XStack
            key={tag.id}
            alignItems="center"
            gap="$1"
            paddingHorizontal="$2"
            paddingVertical="$1"
            borderRadius={radius.chip}
            backgroundColor={ui.surfaceMuted}
            borderWidth={1}
            borderColor={ui.borderSubtle}
          >
            <Badge tone={tag.id.startsWith('new:') ? 'warning' : 'neutral'}>{tag.name}</Badge>
            <XStack
              padding="$1"
              cursor="pointer"
              onPress={() => removeTag(tag.id)}
              hoverStyle={{ opacity: 0.7 }}
            >
              <Icons.X size={14} color={ui.textMuted} />
            </XStack>
          </XStack>
        ))}
      </XStack>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Type a tag and press Enter"
        onSubmitEditing={() => addFromQuery()}
      />
      {suggestions.length ? (
        <YStack gap="$1">
          <Text fontSize={12} color={ui.textMuted} fontWeight="600">
            Matching tags
          </Text>
          <XStack gap="$2" flexWrap="wrap">
            {suggestions.map((tag) => (
              <XStack
                key={tag.id}
                paddingHorizontal="$2"
                paddingVertical="$1"
                borderRadius={radius.chip}
                borderWidth={1}
                borderColor={ui.borderSubtle}
                backgroundColor={ui.surface}
                cursor="pointer"
                onPress={() => addTag({ id: tag.id, name: tag.name })}
                hoverStyle={{ backgroundColor: ui.surfaceMuted }}
              >
                <Text fontSize={13} color={ui.text}>
                  {tag.name}
                </Text>
              </XStack>
            ))}
          </XStack>
        </YStack>
      ) : null}
    </YStack>
  )
}
