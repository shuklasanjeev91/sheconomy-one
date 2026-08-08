import { useEffect, useMemo } from 'react'
import { Platform } from 'react-native'

import { CmsMarkdownBody } from '~/components/blog/CmsMarkdownBody'
import { Text, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

import { bodyToHtml } from '~/blog/lib/blog-html'

const STYLE_ID = 'sheconomy-blog-prose-css'

const PROSE_CSS = `
.blog-prose {
  color: inherit;
  line-height: 1.75;
  font-size: 17px;
  word-break: break-word;
  width: 100%;
  max-width: 100%;
  position: relative;
  overflow: hidden;
  isolation: isolate;
}
.blog-prose * {
  max-width: 100% !important;
  box-sizing: border-box;
}
.blog-prose h1, .blog-prose h2, .blog-prose h3, .blog-prose h4 {
  font-weight: 800; margin: 1.4em 0 0.55em; line-height: 1.3; color: inherit;
}
.blog-prose h1 { font-size: 1.65rem; }
.blog-prose h2 { font-size: 1.4rem; }
.blog-prose h3 { font-size: 1.2rem; }
.blog-prose p { margin: 0 0 1.05em; }
.blog-prose a { color: #D81B60; text-decoration: none; }
.blog-prose a:hover { text-decoration: underline; }
.blog-prose img,
.blog-prose video,
.blog-prose iframe {
  display: block;
  max-width: 100% !important;
  width: 100% !important;
  height: auto !important;
  max-height: 420px !important;
  object-fit: contain;
  background: rgba(0,0,0,0.03);
  border-radius: 12px;
  margin: 1.35em auto;
  position: relative !important;
}
.blog-prose blockquote {
  border-left: 3px solid #D81B60;
  margin: 1.25em 0;
  padding: 0.65em 1em;
  background: rgba(216,27,96,0.06);
  border-radius: 0 10px 10px 0;
}
.blog-prose ul, .blog-prose ol { padding-left: 1.35em; margin: 0 0 1em; }
.blog-prose li { margin: 0.4em 0; }
.blog-prose code {
  background: rgba(0,0,0,0.06);
  padding: 0.12em 0.4em;
  border-radius: 4px;
  font-size: 0.92em;
}
.blog-prose pre {
  background: #1a1a1a;
  color: #f5f5f5;
  padding: 1em;
  border-radius: 12px;
  overflow-x: auto;
  max-width: 100%;
}
.blog-prose hr {
  border: none;
  border-top: 1px solid rgba(0,0,0,0.1);
  margin: 1.75em 0;
}
.blog-prose table { display: block; overflow-x: auto; width: 100%; }
.cms-img-layout-left, .cms-img-layout-right {
  display: flex; gap: 1.25rem; align-items: flex-start; margin: 1.25em 0; flex-wrap: wrap;
}
.cms-img-layout-left { flex-direction: row; }
.cms-img-layout-right { flex-direction: row-reverse; }
.cms-img-layout-center { display: flex; flex-direction: column; align-items: center; margin: 1.25em 0; }
.cms-img-layout-left__image, .cms-img-layout-right__image { flex: 0 0 42%; max-width: 280px; }
.cms-img-layout-left__content, .cms-img-layout-right__content { flex: 1; min-width: 180px; }
.cms-text-align-center { text-align: center; }
.cms-text-align-right { text-align: right; }
.cms-text-align-justify { text-align: justify; }

@media (max-width: 699px) {
  .blog-prose { font-size: 16px; line-height: 1.7; }
  .blog-prose img, .blog-prose video, .blog-prose iframe {
    max-height: 220px !important;
    border-radius: 10px;
  }
  .cms-img-layout-left, .cms-img-layout-right { flex-direction: column; }
  .cms-img-layout-left__image, .cms-img-layout-right__image { max-width: 100%; }
}
@media (min-width: 700px) and (max-width: 979px) {
  .blog-prose { font-size: 16.5px; }
  .blog-prose img, .blog-prose video, .blog-prose iframe {
    max-height: 320px !important;
  }
}
@media (min-width: 980px) {
  .blog-prose { font-size: 17.5px; }
  .blog-prose img, .blog-prose video, .blog-prose iframe {
    max-height: 420px !important;
  }
}
`

function ensureProseStyles() {
  if (typeof document === 'undefined') return
  const existing = document.getElementById(STYLE_ID)
  if (existing) {
    existing.textContent = PROSE_CSS
    return
  }
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = PROSE_CSS
  document.head.appendChild(el)
}

/**
 * Public blog article body.
 * Web: sanitized HTML/markdown prose. Native: CmsMarkdownBody.
 */
export function BlogPostContent({
  body,
  format = 'html',
}: {
  body: string | null | undefined
  format?: string | null
}) {
  const ui = useAppUi()
  const html = useMemo(() => bodyToHtml(body || '', format), [body, format])

  useEffect(() => {
    if (Platform.OS === 'web') ensureProseStyles()
  }, [])

  if (!body?.trim()) {
    return (
      <Text color={ui.textMuted} fontStyle="italic">
        This post has no content yet.
      </Text>
    )
  }

  if (Platform.OS !== 'web') {
    return <CmsMarkdownBody source={body} format={format === 'html' ? 'html' : format} />
  }

  if (!html.replace(/<[^>]*>/g, '').trim()) {
    return (
      <Text color={ui.textMuted} fontStyle="italic">
        This post has no readable text yet.
      </Text>
    )
  }

  return (
    <YStack width="100%" maxWidth="100%" overflow="hidden">
      <div
        className="blog-prose"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: html }}
        style={{
          color: String(ui.text),
          width: '100%',
          maxWidth: '100%',
          display: 'block',
          overflow: 'hidden',
          position: 'relative',
        }}
      />
    </YStack>
  )
}
