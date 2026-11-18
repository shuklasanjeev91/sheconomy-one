/** Shared SHEconomy branded chrome for transactional emails. */

const BRAND_NAME = 'SHEconomy'
const BRAND_PRIMARY = '#D81B60'
const BRAND_CORAL = '#FF8C42'
const BRAND_PINK = '#FF5E9B'
const BRAND_BG = '#fef9f5'
const BRAND_SURFACE = '#ffffff'
const BRAND_TEXT = '#1a1a2e'
const BRAND_MUTED = '#5c5c6e'
const BRAND_FOOTER = '#9ca3af'
const LOGO_URL =
  'https://zsaqrrzwygzwrlzgymxk.supabase.co/storage/v1/object/public/sheconomy-logo/1024X1024.png'
const SITE_URL = 'https://sheconomy.in'
const SUPPORT_EMAIL = 'info@sheconomy.in'

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const GRADIENT = `linear-gradient(135deg, ${BRAND_PRIMARY} 0%, ${BRAND_PINK} 50%, ${BRAND_CORAL} 100%)`
const CTA_STYLE =
  `display:inline-block;background:${GRADIENT};color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:50px;box-shadow:0 4px 14px rgba(216,27,96,0.35);letter-spacing:0.3px;`
const P_STYLE = `margin:0 0 14px;color:${BRAND_MUTED};font-size:15px;line-height:1.7;`
const STRONG_STYLE = `color:${BRAND_TEXT};font-weight:700;`

export type WrapEmailHtmlOptions = {
  /** Skip wrapping even for fragments. */
  skipLayout?: boolean
  preheader?: string
}

/** True when the body is already a full HTML document (legacy branded templates). */
export function isFullHtmlEmail(html: string | null | undefined): boolean {
  if (!html) return false
  return /^\s*<(!DOCTYPE|html)\b/i.test(html)
}

/**
 * Inline brand styles onto bare fragment tags so every template looks designed
 * even before the outer chrome is applied.
 */
export function enhanceFragmentContent(html: string): string {
  let out = String(html ?? '')

  // Paragraph that only wraps a bare link → CTA block (avoids invalid <p><div>).
  out = out.replace(
    /<p(?:\s[^>]*)?>\s*<a\s+href="([^"]+)"(?![^>]*\bstyle\s*=)[^>]*>\s*([\s\S]*?)\s*<\/a>\s*<\/p>/gi,
    (_m, href: string, label: string) => {
      const h = String(href)
      if (/^mailto:/i.test(h)) {
        return `<p style="${P_STYLE}"><a href="${h}" style="color:${BRAND_PRIMARY};text-decoration:none;font-weight:600;">${label}</a></p>`
      }
      return `<div style="text-align:center;margin:24px 0 8px;"><a href="${h}" style="${CTA_STYLE}">${label}</a></div>`
    },
  )

  // Remaining bare <a href="...">Label</a> → centered gradient CTA.
  out = out.replace(
    /<a\s+href="([^"]+)"(?![^>]*\bstyle\s*=)([^>]*)>([\s\S]*?)<\/a>/gi,
    (_m, href: string, _attrs: string, label: string) => {
      const h = String(href)
      if (/^mailto:/i.test(h)) {
        return `<a href="${h}" style="color:${BRAND_PRIMARY};text-decoration:none;font-weight:600;">${label}</a>`
      }
      return `<div style="text-align:center;margin:24px 0 8px;"><a href="${h}" style="${CTA_STYLE}">${label}</a></div>`
    },
  )

  // Bare <p> → branded body copy.
  out = out.replace(
    /<p(?![^>]*\bstyle\s*=)(\s[^>]*)?>/gi,
    `<p style="${P_STYLE}">`,
  )

  // Bare <strong> → darker emphasis.
  out = out.replace(
    /<strong(?![^>]*\bstyle\s*=)(\s[^>]*)?>/gi,
    `<strong style="${STRONG_STYLE}">`,
  )

  return out
}

/**
 * Wrap a fragment (or plain text) in branded table chrome.
 * Full HTML documents are returned unchanged.
 */
export function wrapEmailHtml(
  bodyHtml: string,
  opts: WrapEmailHtmlOptions = {},
): string {
  const raw = String(bodyHtml ?? '').trim()
  if (!raw) return raw
  if (opts.skipLayout || isFullHtmlEmail(raw)) return raw

  const preheader = escapeHtml(opts.preheader ?? '')
  const content = enhanceFragmentContent(raw)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${BRAND_NAME}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND_BG};font-family:${FONT};">
  ${
    preheader
      ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>`
      : ''
  }
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND_BG};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${BRAND_SURFACE};border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(200,40,80,0.10);">
          <tr>
            <td style="background:${GRADIENT};padding:32px 40px;text-align:center;">
              <img src="${LOGO_URL}" alt="${BRAND_NAME}" height="56" style="display:inline-block;vertical-align:middle;border:0;border-radius:12px;background:#fff;" />
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:12px;letter-spacing:0.5px;">
                Women-led Businesses &middot; India's Marketplace
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:${GRADIENT};height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:32px 40px 16px;font-family:${FONT};font-size:15px;line-height:1.7;color:${BRAND_TEXT};">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background:linear-gradient(135deg,#fffaf6 0%,#fceaf1 50%,#fffaf6 100%);border-top:1px solid #f2e4ea;padding:20px 40px;text-align:center;font-family:${FONT};">
              <p style="margin:0 0 4px;font-weight:700;color:${BRAND_PRIMARY};font-size:13px;letter-spacing:1px;">${BRAND_NAME.toUpperCase()}</p>
              <p style="margin:0 0 6px;color:${BRAND_FOOTER};font-size:11px;line-height:1.5;">Empowering women entrepreneurs across India</p>
              <p style="margin:0 0 6px;color:${BRAND_FOOTER};font-size:12px;">
                Need help? Contact
                <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};text-decoration:none;">${SUPPORT_EMAIL}</a>
              </p>
              <a href="${SITE_URL}" style="color:${BRAND_PRIMARY};font-size:11px;text-decoration:none;">www.sheconomy.in</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
