/** Shared SHEconomy branded chrome for transactional emails. */

const BRAND_NAME = 'SHEconomy'
const BRAND_PRIMARY = '#D81B60'
const BRAND_CORAL = '#FF8C42'
const BRAND_BG = '#fef9f5'
const BRAND_SURFACE = '#ffffff'
const BRAND_TEXT = '#241B35'
const BRAND_MUTED = '#6B5B73'
const LOGO_URL =
  'https://zsaqrrzwygzwrlzgymxk.supabase.co/storage/v1/object/public/sheconomy-logo/1024X1024.png'
const SITE_URL = 'https://sheconomy.in'
const SUPPORT_URL = 'https://sheconomy.in/support'

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
  const content = raw

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${BRAND_NAME}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND_BG};">
  ${
    preheader
      ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>`
      : ''
  }
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND_BG};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${BRAND_SURFACE};border-radius:16px;overflow:hidden;border:1px solid #f2e4ea;">
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND_PRIMARY} 0%,${BRAND_CORAL} 100%);padding:20px 24px;text-align:center;">
              <img src="${LOGO_URL}" width="48" height="48" alt="${BRAND_NAME}" style="display:inline-block;border:0;border-radius:12px;background:#fff;" />
              <div style="margin-top:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;letter-spacing:0.2px;color:#ffffff;">
                ${BRAND_NAME}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:${BRAND_TEXT};">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 24px 24px;border-top:1px solid #f2e4ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:${BRAND_MUTED};text-align:center;">
              <a href="${SITE_URL}" style="color:${BRAND_PRIMARY};text-decoration:none;font-weight:600;">${SITE_URL.replace('https://', '')}</a>
              <span style="color:#c9b8c2;"> · </span>
              <a href="${SUPPORT_URL}" style="color:${BRAND_MUTED};text-decoration:underline;">Help &amp; support</a>
              <div style="margin-top:8px;">You received this email because of activity on your ${BRAND_NAME} account.</div>
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
