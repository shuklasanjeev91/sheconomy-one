/**
 * Port of sheconomy_web blog HTML/markdown rendering helpers.
 * Used for public blog article bodies (not admin).
 */

const LAYOUT_CSS: Record<string, string> = {
  'image-left': 'cms-img-layout-left',
  'image-right': 'cms-img-layout-right',
  'image-center': 'cms-img-layout-center',
}

export function processCustomBlocks(html: string): string {
  let out = html
  out = out.replace(
    /:::(image-left|image-right|image-center)(?:\s+align=(left|center|right|justify))?\r?\n([\s\S]*?)\n:::/gm,
    (_, type, textAlign, inner) => {
      const lines = String(inner).replace(/\r\n/g, '\n').trim().split('\n')
      const imgLine = lines[0] || ''
      const textContent = lines.slice(1).join('\n').trim()
      const imgHtml = imgLine.replace(
        /!\[([^\]]*)\]\(([^)]+)\)/,
        (__: string, alt: string, src: string) =>
          `<img src="${src}" alt="${alt}" loading="lazy" class="layout-img" />`,
      )
      const cssClass = LAYOUT_CSS[type] || 'cms-img-layout-left'
      const alignClass = textAlign && textAlign !== 'left' ? ` cms-text-align-${textAlign}` : ''
      return [
        `<div class="${cssClass}">`,
        `<div class="${cssClass}__image">${imgHtml}</div>`,
        `<div class="${cssClass}__content${alignClass}">${textContent.replace(/\n/g, '<br />')}</div>`,
        `</div>`,
      ].join('')
    },
  )

  out = out.replace(/:::align-(left|center|right|justify)\r?\n([\s\S]*?)\n:::/gm, (_, align, content) => {
    return `<div class="cms-text-align-${align}">${String(content)
      .replace(/\r\n/g, '\n')
      .trim()
      .replace(/\n/g, '<br />')}</div>`
  })

  return out
}

export function markdownToHtml(md: string): string {
  let html = processCustomBlocks(md)

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang}">${String(code)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')}</code></pre>`
  })

  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html.replace(/^######\s+(.*$)/gm, '<h6>$1</h6>')
  html = html.replace(/^#####\s+(.*$)/gm, '<h5>$1</h5>')
  html = html.replace(/^####\s+(.*$)/gm, '<h4>$1</h4>')
  html = html.replace(/^###\s+(.*$)/gm, '<h3>$1</h3>')
  html = html.replace(/^##\s+(.*$)/gm, '<h2>$1</h2>')
  html = html.replace(/^#\s+(.*$)/gm, '<h1>$1</h1>')
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  )
  html = html.replace(/^>\s+(.*$)/gm, '<blockquote><p>$1</p></blockquote>')
  html = html.replace(/^---$/gm, '<hr />')
  html = html.replace(/^[\*\-]\s+(.*$)/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
  html = html.replace(/^\d+\.\s+(.*$)/gm, '<li>$1</li>')

  html = html
    .split(/\n\n+/)
    .map((block) => {
      block = block.trim()
      if (!block) return ''
      if (
        block.startsWith('<h') ||
        block.startsWith('<pre') ||
        block.startsWith('<ul') ||
        block.startsWith('<ol') ||
        block.startsWith('<blockquote') ||
        block.startsWith('<hr') ||
        block.startsWith('<li') ||
        block.startsWith('<div')
      ) {
        return block
      }
      return `<p>${block.replace(/\n/g, '<br />')}</p>`
    })
    .join('\n')

  return html
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * True when CMS HTML is a marketing poster (full-viewport image / clip-path)
 * rather than a readable article body.
 */
export function isPosterHeavyHtml(html: string): boolean {
  if (!html) return false
  const text = stripHtmlToText(html)
  const imgCount = (html.match(/<img[\s>]/gi) || []).length
  const hasPosterCss =
    /100vh|100dvh|clip-path|background-clip\s*:\s*text|position\s*:\s*fixed|position\s*:\s*absolute|mix-blend-mode|mask-image/i.test(
      html,
    )
  if (hasPosterCss) return true
  // Almost no text but a big visual = poster
  if (imgCount >= 1 && text.length < 120) return true
  if (text.length < 40 && html.length > 800) return true
  return false
}

/** Convert poster-heavy HTML into simple readable paragraphs. */
export function htmlToReadableParagraphs(html: string): string {
  const text = html
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!text) return '<p></p>'
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, '<br />')}</p>`)
    .join('\n')
}

/** Lightweight sanitizer for public blog HTML — kills fullscreen poster CSS. */
export function sanitizeBlogHtml(html: string): string {
  let out = html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<iframe(?![^>]*\bsrc=["']https?:)/gi, '<iframe data-blocked="1"')

  // Strip ALL inline styles — CMS posters use style= for 100vh / absolute / clip-path.
  out = out.replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, '')

  // Drop width/height attrs that force huge images
  out = out.replace(/\s(width|height)\s*=\s*("\d+"|'\d+'|\d+)/gi, '')

  return out
}

export function bodyToHtml(body: string, format: string | null | undefined): string {
  if (!body) return ''
  if (format === 'plain') {
    return body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br />')
  }

  if (format === 'markdown') {
    return sanitizeBlogHtml(markdownToHtml(body))
  }

  // HTML from CMS: neutralize poster layouts before rendering.
  const raw = processCustomBlocks(body)
  if (isPosterHeavyHtml(raw)) {
    const readable = htmlToReadableParagraphs(raw)
    return sanitizeBlogHtml(readable)
  }
  return sanitizeBlogHtml(raw)
}
