import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'

import { Button, Icons, Image, Input, Text, TextArea, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

type EditorMode = 'write' | 'preview'

export type CmsMarkdownEditorProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minRows?: number
  onRequestImageInsert?: (insert: (url: string, alt: string) => void) => void
}

function wrapSelection(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  before: string,
  after: string,
  placeholder = 'text',
): { next: string; cursor: number } {
  const selected = text.slice(selectionStart, selectionEnd) || placeholder
  const next =
    text.slice(0, selectionStart) + before + selected + after + text.slice(selectionEnd)
  const cursor = selectionStart + before.length + selected.length + after.length
  return { next, cursor }
}

function prefixLines(text: string, selectionStart: number, selectionEnd: number, prefix: string) {
  const before = text.slice(0, selectionStart)
  const selected = text.slice(selectionStart, selectionEnd)
  const after = text.slice(selectionEnd)
  const block = selected || 'List item'
  const lines = block.split('\n').map((line) => `${prefix}${line || 'List item'}`)
  const next = before + lines.join('\n') + after
  return { next, cursor: before.length + lines.join('\n').length }
}

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

function MarkdownPreview({ source }: { source: string }) {
  const ui = useAppUi()
  const blocks = useMemo(() => {
    const lines = source.replace(/\r\n/g, '\n').split('\n')
    const nodes: ReactNode[] = []
    let listItems: string[] = []
    let key = 0

    const flushList = () => {
      if (!listItems.length) return
      nodes.push(
        <YStack key={`list-${key++}`} gap="$1" paddingLeft="$3">
          {listItems.map((item, i) => (
            <XStack key={i} gap="$2" alignItems="flex-start">
              <Text color={ui.textMuted}>•</Text>
              <Text color={ui.text} flex={1}>
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
          <Text key={`h2-${key++}`} fontSize={20} fontWeight="800" color={ui.text}>
            {renderInline(line.slice(3), `h2-${key}`)}
          </Text>,
        )
      } else if (line.startsWith('# ')) {
        nodes.push(
          <Text key={`h1-${key++}`} fontSize={24} fontWeight="800" color={ui.text}>
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
            <Text color={ui.textSecondary} fontStyle="italic">
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
              source={{ uri: imgMatch[2] }}
              width="100%"
              maxHeight={280}
              borderRadius={radius.card}
              resizeMode="cover"
              alt={imgMatch[1] || 'Image'}
            />,
          )
        }
      } else {
        nodes.push(
          <Text key={`p-${key++}`} color={ui.text} lineHeight={22}>
            {renderInline(line, `p-${key}`)}
          </Text>,
        )
      }
    }
    flushList()
    return nodes
  }, [source, ui.borderSubtle, ui.text, ui.textMuted, ui.textSecondary])

  if (!source.trim()) {
    return (
      <Text color={ui.textMuted} fontStyle="italic">
        Nothing to preview yet.
      </Text>
    )
  }

  return (
    <YStack gap="$3">
      {blocks}
    </YStack>
  )
}

export function CmsMarkdownEditor({
  value,
  onChange,
  placeholder = 'Write your content in Markdown…',
  minRows = 12,
  onRequestImageInsert,
}: CmsMarkdownEditorProps) {
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()
  const [mode, setMode] = useState<EditorMode>('write')
  const [linkUrl, setLinkUrl] = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)
  const selectionRef = useRef({ start: 0, end: 0 })

  const rememberSelection = useCallback((start: number, end: number) => {
    selectionRef.current = { start, end }
  }, [])

  const applyTransform = useCallback(
    (fn: (text: string, start: number, end: number) => { next: string; cursor: number }) => {
      const { start, end } = selectionRef.current
      const { next, cursor } = fn(value, start, end)
      onChange(next)
      selectionRef.current = { start: cursor, end: cursor }
    },
    [onChange, value],
  )

  const toolbar = (
    <XStack gap="$1" flexWrap="wrap" alignItems="center">
      <Button
        size="$2"
        tone={mode === 'write' ? undefined : 'outline'}
        onPress={() => setMode('write')}
      >
        Write
      </Button>
      <Button
        size="$2"
        tone={mode === 'preview' ? undefined : 'outline'}
        onPress={() => setMode('preview')}
      >
        Preview
      </Button>
      {mode === 'write' ? (
        <>
          <Button
            size="$2"
            tone="outline"
            onPress={() => applyTransform((t, s, e) => wrapSelection(t, s, e, '**', '**'))}
          >
            B
          </Button>
          <Button
            size="$2"
            tone="outline"
            onPress={() => applyTransform((t, s, e) => wrapSelection(t, s, e, '*', '*'))}
          >
            I
          </Button>
          <Button
            size="$2"
            tone="outline"
            onPress={() =>
              applyTransform((t, s, e) => {
                const selected = t.slice(s, e) || 'Heading'
                const lineStart = t.lastIndexOf('\n', s - 1) + 1
                const lineEnd = t.indexOf('\n', e)
                const endIdx = lineEnd === -1 ? t.length : lineEnd
                const line = t.slice(lineStart, endIdx)
                const stripped = line.replace(/^#+\s*/, '') || selected
                const nextLine = `## ${stripped}`
                const next = t.slice(0, lineStart) + nextLine + t.slice(endIdx)
                return { next, cursor: lineStart + nextLine.length }
              })
            }
          >
            H2
          </Button>
          <Button
            size="$2"
            tone="outline"
            icon={Icons.List}
            onPress={() => applyTransform((t, s, e) => prefixLines(t, s, e, '- '))}
          />
          <Button
            size="$2"
            tone="outline"
            onPress={() =>
              applyTransform((t, s, e) => {
                const selected = t.slice(s, e) || 'Quote'
                const lineStart = t.lastIndexOf('\n', s - 1) + 1
                const lineEnd = t.indexOf('\n', e)
                const endIdx = lineEnd === -1 ? t.length : lineEnd
                const nextLine = `> ${selected}`
                const next = t.slice(0, lineStart) + nextLine + t.slice(endIdx)
                return { next, cursor: lineStart + nextLine.length }
              })
            }
          >
            Quote
          </Button>
          <Button
            size="$2"
            tone="outline"
            icon={Icons.Link}
            onPress={() => setShowLinkInput(true)}
          />
          {onRequestImageInsert ? (
            <Button
              size="$2"
              tone="outline"
              icon={Icons.Image}
              onPress={() =>
                onRequestImageInsert((url, alt) => {
                  const snippet = `\n![${alt || 'Image'}](${url})\n`
                  onChange(value + snippet)
                })
              }
            />
          ) : null}
        </>
      ) : null}
    </XStack>
  )

  return (
    <YStack gap="$2">
      {toolbar}
      {showLinkInput && mode === 'write' ? (
        <XStack gap="$2" flexWrap="wrap" alignItems="center">
          <Input
            flex={1}
            minWidth={isDesktop ? 240 : '100%'}
            value={linkUrl}
            onChangeText={setLinkUrl}
            placeholder="https://example.com"
          />
          <Button
            size="$2"
            onPress={() => {
              const url = linkUrl.trim() || 'https://'
              applyTransform((t, s, e) => wrapSelection(t, s, e, '[', `](${url})`, 'link text'))
              setLinkUrl('')
              setShowLinkInput(false)
            }}
          >
            Insert
          </Button>
          <Button size="$2" tone="outline" onPress={() => setShowLinkInput(false)}>
            Cancel
          </Button>
        </XStack>
      ) : null}
      {mode === 'write' ? (
        <TextArea
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          minHeight={minRows * 22}
          onSelectionChange={(e) => {
            rememberSelection(e.nativeEvent.selection.start, e.nativeEvent.selection.end)
          }}
          borderColor={ui.borderSubtle}
        />
      ) : (
        <YStack
          minHeight={minRows * 22}
          padding="$3"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surfaceMuted}
        >
          <MarkdownPreview source={value} />
        </YStack>
      )}
    </YStack>
  )
}
