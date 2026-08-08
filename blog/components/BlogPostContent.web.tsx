import { useMemo } from 'react'
import { Platform } from 'react-native'

import { Text, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

import { bodyToHtml } from '~/blog/lib/blog-html'

const PROSE_CSS = `
.blog-prose { color: inherit; line-height: 1.7; font-size: 16px; }
.blog-prose h1, .blog-prose h2, .blog-prose h3, .blog-prose h4 {
  font-weight: 800; margin: 1.25em 0 0.5em; line-height: 1.25; color: inherit;
}
.blog-prose h1 { font-size: 1.75rem; }
.blog-prose h2 { font-size: 1.45rem; }
.blog-prose h3 { font-size: 1.2rem; }
.blog-prose p { margin: 0 0 1em; }
.blog-prose a { color: #D81B60; text-decoration: none; }
.blog-prose a:hover { text-decoration: underline; }
.blog-prose img { max-width: 100%; height: auto; border-radius: 12px; margin: 1em 0; }
.blog-prose blockquote {
  border-left: 3px solid #D81B60; margin: 1em 0; padding: 0.5em 1em;
  background: rgba(216,27,96,0.06); border-radius: 0 8px 8px 0;
}
.blog-prose ul, .blog-prose ol { padding-left: 1.4em; margin: 0 0 1em; }
.blog-prose li { margin: 0.35em 0; }
.blog-prose code { background: rgba(0,0,0,0.06); padding: 0.1em 0.35em; border-radius: 4px; font-size: 0.9em; }
.blog-prose pre { background: #1a1a1a; color: #f5f5f5; padding: 1em; border-radius: 12px; overflow-x: auto; }
.blog-prose hr { border: none; border-top: 1px solid rgba(0,0,0,0.1); margin: 1.5em 0; }
.cms-img-layout-left, .cms-img-layout-right {
  display: flex; gap: 1.25rem; align-items: flex-start; margin: 1.25em 0; flex-wrap: wrap;
}
.cms-img-layout-left { flex-direction: row; }
.cms-img-layout-right { flex-direction: row-reverse; }
.cms-img-layout-center { display: flex; flex-direction: column; align-items: center; margin: 1.25em 0; }
.cms-img-layout-left__image, .cms-img-layout-right__image { flex: 0 0 42%; max-width: 320px; }
.cms-img-layout-left__content, .cms-img-layout-right__content { flex: 1; min-width: 200px; }
.cms-text-align-center { text-align: center; }
.cms-text-align-right { text-align: right; }
.cms-text-align-justify { text-align: justify; }
`

/** Web: render CMS HTML/markdown with prose styles (matches sheconomy_web blogs). */
export function BlogPostContent({
  body,
  format = 'html',
}: {
  body: string | null | undefined
  format?: string | null
}) {
  const ui = useAppUi()
  const html = useMemo(() => bodyToHtml(body || '', format), [body, format])

  if (!body?.trim()) {
    return (
      <Text color={ui.textMuted} fontStyle="italic">
        This post has no content yet.
      </Text>
    )
  }

  if (Platform.OS !== 'web') {
    return null
  }

  return (
    <YStack width="100%">
      <style dangerouslySetInnerHTML={{ __html: PROSE_CSS }} />
      <div
        className="blog-prose"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: html }}
        style={{ color: ui.text }}
      />
    </YStack>
  )
}
