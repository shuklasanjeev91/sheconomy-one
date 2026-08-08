import { useMemo, type ReactNode } from 'react'

import { Image, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { cleanCmsBody, stripHtml } from '~/lib/cms'
import { useAppUi } from '~/lib/theme/useAppUi'

function renderInline(text: string, keyPrefix: string) {
  const parts: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let match: RegExpExecArray | null
  let idx = 0
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index))
    }
    const token = match[0]
    if (token.startsWith('**')) {
      parts.push(
        <Text key={`${keyPrefix}-b-${idx++}`} fontWeight="800">
          {token.slice(2, -2)}
        </Text>,
      )
    } else if (token.startsWith('*')) {
      parts.push(
        <Text key={`${keyPrefix}-i-${idx++}`} fontStyle="italic">
          {token.slice(1, -1)}
        </Text>,
      )
    } else {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)
      if (linkMatch) {
        parts.push(
          <Text key={`${keyPrefix}-l-${idx++}`} color="$blue10" textDecorationLine="underline">
            {linkMatch[1]}
          </Text>,
        )
      } else {
        parts.push(token)
      }
    }
    last = match.index + token.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

/** Lightweight markdown renderer for public CMS blog bodies. */
export function CmsMarkdownBody({
  source,
  format = 'markdown',
}: {
  source: string | null | undefined
  format?: string | null
}) {
  const ui = useAppUi()
  const cleaned = cleanCmsBody(source)

  const blocks = useMemo(() => {
    if (!cleaned.trim()) return [] as ReactNode[]
    if (format === 'plain' || format === 'html') {
      // HTML posts often include poster/marketing markup — show readable text only.
      const text =
        format === 'html'
          ? stripHtml(
              cleaned
                .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, '\n')
                .replace(/<br\s*\/?>/gi, '\n'),
            )
          : cleaned
      return text
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, i) => (
          <Text key={`p-${i}`} color={ui.text} lineHeight={26} fontSize={16}>
            {line}
          </Text>
        ))
    }

    const lines = cleaned.replace(/\r\n/g, '\n').split('\n')
    const nodes: ReactNode[] = []
    let listItems: string[] = []
    let key = 0

    const flushList = () => {
      if (!listItems.length) return
      nodes.push(
        <YStack key={`list-${key++}`} gap="$1.5" paddingLeft="$3">
          {listItems.map((item, i) => (
            <XStack key={i} gap="$2" alignItems="flex-start">
              <Text color={ui.textMuted} fontSize={16}>
                •
              </Text>
              <Text color={ui.text} flex={1} fontSize={16} lineHeight={24}>
                {renderInline(item, `li-${i}`)}
              </Text>
            </XStack>
          ))}
        </YStack>,
      )
      listItems = []
    }

    for (const raw of lines) {
      const line = raw.trimEnd()
      if (!line.trim()) {
        flushList()
        continue
      }
      if (/^[-*]\s+/.test(line)) {
        listItems.push(line.replace(/^[-*]\s+/, ''))
        continue
      }
      flushList()
      if (line.startsWith('## ')) {
        nodes.push(
          <Text key={`h2-${key++}`} fontSize={22} fontWeight="800" color={ui.text} marginTop="$2">
            {renderInline(line.slice(3), `h2-${key}`)}
          </Text>,
        )
      } else if (line.startsWith('# ')) {
        nodes.push(
          <Text key={`h1-${key++}`} fontSize={26} fontWeight="800" color={ui.text} marginTop="$2">
            {renderInline(line.slice(2), `h1-${key}`)}
          </Text>,
        )
      } else if (line.startsWith('> ')) {
        nodes.push(
          <YStack
            key={`q-${key++}`}
            paddingLeft="$3"
            borderLeftWidth={3}
            borderLeftColor={ui.borderSubtle}
          >
            <Text color={ui.textSecondary} fontStyle="italic" fontSize={16} lineHeight={24}>
              {renderInline(line.slice(2), `q-${key}`)}
            </Text>
          </YStack>,
        )
      } else if (/^!\[[^\]]*\]\([^)]+\)$/.test(line.trim())) {
        const imgMatch = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(line.trim())
        if (imgMatch) {
          nodes.push(
            <Image
              key={`img-${key++}`}
              src={imgMatch[2]}
              width="100%"
              height={280}
              borderRadius={radius.card}
              objectFit="cover"
              alt={imgMatch[1] || 'Image'}
            />,
          )
        }
      } else {
        nodes.push(
          <Text key={`p-${key++}`} color={ui.text} lineHeight={26} fontSize={16}>
            {renderInline(line, `p-${key}`)}
          </Text>,
        )
      }
    }
    flushList()
    return nodes
  }, [cleaned, format, ui.borderSubtle, ui.text, ui.textMuted, ui.textSecondary])

  if (!cleaned.trim()) {
    return (
      <Text color={ui.textMuted} fontStyle="italic">
        This post has no content yet.
      </Text>
    )
  }

  return <YStack gap="$3">{blocks}</YStack>
}
