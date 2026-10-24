import { useEffect, useRef, useState } from 'react'
import { XStack, YStack } from 'tamagui'

import { Text } from '~/components/ui/Text'
import { fetchWritingIssues, type WritingIssue } from '~/lib/ai'

type WritingSuggestionBarProps = {
  value: string
  onApply: (next: string) => void
  paused?: boolean
}

function issueKey(issue: WritingIssue): string {
  return `${issue.start}:${issue.end}:${issue.suggestions[0] ?? ''}`
}

export function applyWritingIssue(value: string, issue: WritingIssue): string {
  const suggestion = issue.suggestions[0]
  if (!suggestion || issue.start < 0 || issue.end > value.length || issue.end <= issue.start) return value
  return `${value.slice(0, issue.start)}${suggestion}${value.slice(issue.end)}`
}

/** Tap-to-replace spell and grammar chip, shown under a sentence field. */
export function WritingSuggestionBar({ value, onApply, paused = false }: WritingSuggestionBarProps) {
  const [issues, setIssues] = useState<WritingIssue[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const ticket = useRef(0)

  useEffect(() => {
    setDismissed(new Set())
    if (paused) return
    const words = value.trim().split(/\s+/).filter(Boolean)
    if (words.length < 2) {
      setIssues([])
      return
    }
    const current = ++ticket.current
    const handle = setTimeout(() => {
      void fetchWritingIssues(value)
        .then((rows) => {
          if (current === ticket.current) setIssues(rows)
        })
        .catch(() => {
          if (current === ticket.current) setIssues([])
        })
    }, 500)
    return () => {
      clearTimeout(handle)
    }
  }, [paused, value])

  const visible = issues.filter(
    (issue) =>
      !dismissed.has(issueKey(issue)) &&
      issue.end <= value.length &&
      value.slice(issue.start, issue.end).length > 0,
  )
  const issue = visible[0]
  if (paused || !issue) return null

  const original = value.slice(issue.start, issue.end).replace(/\s+/g, ' ')
  const suggestion = issue.suggestions[0]
  const more = visible.length - 1

  return (
    <XStack alignItems="center" gap={8} marginTop={6} alignSelf="flex-start" maxWidth="100%">
      <XStack
        alignItems="center"
        gap={6}
        paddingHorizontal={10}
        paddingVertical={6}
        borderRadius={999}
        borderWidth={1}
        borderColor="$borderColor"
        backgroundColor="$background"
        cursor="pointer"
        hoverStyle={{ backgroundColor: '$backgroundHover' }}
        pressStyle={{ opacity: 0.85 }}
        onPress={() => onApply(applyWritingIssue(value, issue))}
        accessibilityLabel={`Replace ${original} with ${suggestion}`}
        accessibilityRole="button"
      >
        <Text fontSize={12} fontWeight="600" color="$color12" numberOfLines={1}>
          {original} → {suggestion}
        </Text>
      </XStack>
      {more > 0 ? (
        <Text fontSize={12} color="$color10">
          +{more}
        </Text>
      ) : null}
      <YStack
        paddingHorizontal={8}
        paddingVertical={4}
        cursor="pointer"
        pressStyle={{ opacity: 0.7 }}
        onPress={() => {
          setDismissed((current) => new Set(current).add(issueKey(issue)))
        }}
        accessibilityLabel="Dismiss suggestion"
        accessibilityRole="button"
      >
        <Text fontSize={12} fontWeight="700" color="$color10">
          Dismiss
        </Text>
      </YStack>
    </XStack>
  )
}
