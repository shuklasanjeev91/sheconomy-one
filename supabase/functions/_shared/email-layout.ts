/** Shared SHEconomy Mailchimp-style chrome for transactional emails. */

const BRAND_NAME = 'SHEconomy'
const BRAND_PRIMARY = '#D81B60'
const BRAND_CORAL = '#FF8C42'
const BRAND_PINK = '#FF5E9B'
const BRAND_BG = '#f7f1f4'
const BRAND_SURFACE = '#ffffff'
const BRAND_TEXT = '#1a1a2e'
const BRAND_MUTED = '#5c5c6e'
const BRAND_FOOTER = '#9ca3af'
const LOGO_URL =
  'https://zsaqrrzwygzwrlzgymxk.supabase.co/storage/v1/object/public/sheconomy-logo/1024X1024.png'
const SITE_URL = 'https://www.sheconomy.in'
const SUPPORT_EMAIL = 'info@sheconomy.in'

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const GRADIENT = `linear-gradient(135deg, ${BRAND_PRIMARY} 0%, ${BRAND_PINK} 50%, ${BRAND_CORAL} 100%)`
const CTA_STYLE =
  `display:inline-block;background:${GRADIENT};color:#ffffff;font-weight:800;font-size:15px;text-decoration:none;padding:15px 36px;border-radius:50px;box-shadow:0 6px 18px rgba(216,27,96,0.30);letter-spacing:0.2px;`
const P_STYLE = `margin:0 0 14px;color:${BRAND_MUTED};font-size:15px;line-height:1.7;`
const STRONG_STYLE = `color:${BRAND_TEXT};font-weight:700;`
const H1_STYLE =
  'margin:0 0 12px;font-size:28px;font-weight:800;color:#1a1a2e;line-height:1.2;letter-spacing:-0.3px;'
const EYEBROW_STYLE =
  'margin:0 0 6px;font-size:11px;font-weight:800;color:#D81B60;text-transform:uppercase;letter-spacing:1.6px;'
const TRUST_HTML =
  '<p style="margin:14px 0 0;text-align:center;font-size:12px;color:#9ca3af;line-height:1.5;">Secure checkout · Women-led brands · Easy returns</p>'

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
      return `<div style="text-align:center;margin:22px 0 8px;"><a href="${h}" style="${CTA_STYLE}">${label}</a></div>`
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
      return `<div style="text-align:center;margin:22px 0 8px;"><a href="${h}" style="${CTA_STYLE}">${label}</a></div>`
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

  // Normalize legacy h2 heroes → Mailchimp h1.
  out = out.replace(/<\/?h2\b/gi, (tag) => tag.replace(/h2/i, 'h1'))
  out = out.replace(
    /<h1(?![^>]*\bstyle\s*=)(\s[^>]*)?>/gi,
    `<h1 style="${H1_STYLE}">`,
  )
  out = out.replace(
    /<h1([^>]*)style="([^"]*)"/gi,
    (_m, attrs: string, style: string) => {
      if (/font-size\s*:\s*2[4-9]px|font-size\s*:\s*3/i.test(style)) {
        return `<h1${attrs}style="${style}"`
      }
      return `<h1${attrs}style="${H1_STYLE}"`
    },
  )

  // Soft-upgrade common eyebrow paragraphs that used older letter-spacing.
  out = out.replace(
    /<p([^>]*style="[^"]*text-transform:\s*uppercase[^"]*")>/gi,
    (full) => {
      if (/letter-spacing:\s*1\.6px/i.test(full)) return full
      return full.replace(
        /letter-spacing:\s*[\d.]+px/i,
        'letter-spacing:1.6px',
      ).replace(
        /font-weight:\s*\d+/i,
        'font-weight:800',
      )
    },
  )

  // Append trust strip once if the fragment did not already include it.
  if (!/Women-led brands/i.test(out) && !/Secure checkout/i.test(out)) {
    out = `${out}\n${TRUST_HTML}`
  }

  return out
}

/**
 * Wrap a fragment (or plain text) in Mailchimp-style branded table chrome.
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
  <meta name="supported-color-schemes" content="light" />
  <title>${BRAND_NAME}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:${BRAND_BG};font-family:${FONT};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  ${
    preheader
      ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${preheader}</div>`
      : ''
  }
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND_BG};">
    <tr>
      <td align="center" style="padding:28px 14px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${BRAND_SURFACE};border-radius:20px;overflow:hidden;box-shadow:0 8px 28px rgba(200,40,80,0.12);">
          <tr>
            <td style="background:${GRADIENT};padding:28px 36px 24px;text-align:center;">
              <img src="${LOGO_URL}" alt="${BRAND_NAME}" height="52" style="display:inline-block;vertical-align:middle;border:0;border-radius:12px;background:#fff;" />
              <p style="margin:10px 0 0;color:rgba(255,255,255,0.92);font-size:12px;letter-spacing:0.6px;font-weight:600;">
                Women-led Businesses &middot; India's Marketplace
              </p>
            </td>
          </tr>
          <tr>
            <td style="height:3px;background:${GRADIENT};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:30px 36px 18px;font-family:${FONT};font-size:15px;line-height:1.7;color:${BRAND_TEXT};">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background:linear-gradient(135deg,#fffaf6 0%,#fceaf1 55%,#fffaf6 100%);border-top:1px solid #f2e4ea;padding:22px 36px;text-align:center;font-family:${FONT};">
              <p style="margin:0 0 6px;font-weight:800;color:${BRAND_PRIMARY};font-size:12px;letter-spacing:1.4px;">${BRAND_NAME.toUpperCase()}</p>
              <p style="margin:0 0 8px;color:${BRAND_FOOTER};font-size:11px;line-height:1.55;">Empowering women entrepreneurs across India</p>
              <p style="margin:0 0 8px;color:${BRAND_FOOTER};font-size:12px;">
                Need help?
                <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};text-decoration:none;font-weight:600;">${SUPPORT_EMAIL}</a>
              </p>
              <a href="${SITE_URL}" style="color:${BRAND_PRIMARY};font-size:11px;text-decoration:none;font-weight:600;">www.sheconomy.in</a>
              <p style="margin:12px 0 0;color:#c4c4ce;font-size:10px;line-height:1.5;">
                You received this email because you have a SHEconomy account.
              </p>
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

/** Exported for tests / admin previews. */
export const emailLayoutTokens = {
  BRAND_NAME,
  BRAND_PRIMARY,
  EYEBROW_STYLE,
  H1_STYLE,
  P_STYLE,
  CTA_STYLE,
  TRUST_HTML,
}
