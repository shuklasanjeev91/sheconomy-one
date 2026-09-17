/**
 * Responsive SHEconomy Co-Work meeting invitation email (Deno edge copy).
 * Keep in sync with lib/calendar/meeting-invite-email.ts
 */

export type MeetingInviteEmailInput = {
  brandLabel?: string
  meetingTitle: string
  hostName?: string | null
  dateLabel: string
  timeLabel: string
  endsLabel?: string | null
  joinUrl: string
  meetingIdLabel: string
  passcode?: string | null
  personalMessage?: string | null
  googleCalendarUrl: string
  outlookCalendarUrl: string
  timezoneNote?: string | null
  hostZoneHint?: string | null
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) =>
    ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character]!,
  )
}

export function formatMeetingIdForEmail(code: string): string {
  const clean = String(code || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  if (clean.length <= 3) return clean
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`.trim()
}

export function buildMeetingInviteEmailText(input: MeetingInviteEmailInput): string {
  const brand = input.brandLabel || 'SHEconomy Co-Work'
  const lines = [
    brand,
    '',
    input.meetingTitle,
    '',
    'You are invited to a meeting.',
    input.hostName ? `Host: ${input.hostName}` : null,
    '',
    'Date:',
    input.dateLabel,
    '',
    'Time:',
    input.timeLabel,
    input.endsLabel || null,
    input.timezoneNote || null,
    input.hostZoneHint || null,
    '',
    `Join Meeting: ${input.joinUrl}`,
    '',
    'Meeting ID:',
    input.meetingIdLabel,
    input.passcode ? ['', 'Passcode:', input.passcode].join('\n') : null,
    input.personalMessage ? `\n${input.personalMessage}\n` : null,
    '',
    'Add to Calendar:',
    `Google Calendar: ${input.googleCalendarUrl}`,
    `Outlook: ${input.outlookCalendarUrl}`,
    'Or open the attached ICS file.',
  ]
  return lines.filter((line) => line !== null).join('\n')
}

export function buildMeetingInviteEmailHtml(input: MeetingInviteEmailInput): string {
  const brand = escapeHtml(input.brandLabel || 'SHEconomy Co-Work')
  const title = escapeHtml(input.meetingTitle)
  const dateLabel = escapeHtml(input.dateLabel)
  const timeLabel = escapeHtml(input.timeLabel)
  const endsLabel = input.endsLabel ? escapeHtml(input.endsLabel) : null
  const joinUrl = escapeHtml(input.joinUrl)
  const meetingId = escapeHtml(input.meetingIdLabel)
  const passcode = input.passcode ? escapeHtml(input.passcode) : null
  const hostName = input.hostName ? escapeHtml(input.hostName) : null
  const message = input.personalMessage ? escapeHtml(input.personalMessage) : null
  const googleUrl = escapeHtml(input.googleCalendarUrl)
  const outlookUrl = escapeHtml(input.outlookCalendarUrl)
  const timezoneNote = input.timezoneNote ? escapeHtml(input.timezoneNote) : null
  const hostZoneHint = input.hostZoneHint ? escapeHtml(input.hostZoneHint) : null

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
  <style type="text/css">
    html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    * { -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse !important; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    a { text-decoration: none; }
    .wrapper { width: 100% !important; }
    .container { width: 100% !important; max-width: 600px !important; }
    .stack-pad { padding-left: 28px !important; padding-right: 28px !important; }
    .join-btn {
      display: inline-block !important;
      background: #C2185B !important;
      color: #ffffff !important;
      font-weight: 700 !important;
      font-size: 16px !important;
      line-height: 1.2 !important;
      padding: 16px 32px !important;
      border-radius: 999px !important;
      text-align: center !important;
    }
    .cal-btn {
      display: inline-block !important;
      background: #ffffff !important;
      color: #C2185B !important;
      border: 1px solid #C2185B !important;
      font-weight: 700 !important;
      font-size: 14px !important;
      padding: 12px 18px !important;
      border-radius: 999px !important;
      margin: 4px 6px 4px 0 !important;
    }
    @media only screen and (max-width: 620px) {
      .stack-pad { padding-left: 18px !important; padding-right: 18px !important; }
      .title { font-size: 24px !important; line-height: 1.25 !important; }
      .join-btn { width: 100% !important; box-sizing: border-box !important; }
      .cal-btn { display: block !important; width: 100% !important; box-sizing: border-box !important; margin: 0 0 10px 0 !important; text-align: center !important; }
      .meta-value { font-size: 18px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#F7F2F5;font-family:Arial,Helvetica,sans-serif;color:#241B35;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    You are invited to ${title}. Join on ${brand}.
  </div>
  <table role="presentation" class="wrapper" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F7F2F5;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" class="container" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #EEDFE7;">
          <tr>
            <td class="stack-pad" style="padding:28px 28px 20px;background-color:#C2185B;color:#ffffff;">
              <div style="font-size:12px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;opacity:0.95;">${brand}</div>
              <h1 class="title" style="margin:12px 0 0;font-size:28px;line-height:1.25;font-weight:800;color:#ffffff;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td class="stack-pad" style="padding:28px;">
              <p style="margin:0 0 22px;font-size:16px;line-height:1.5;color:#241B35;">
                You are invited to a meeting.${hostName ? `<br><span style="color:#6B6475;">Hosted by <strong style="color:#241B35;">${hostName}</strong></span>` : ''}
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FAF7F9;border:1px solid #EEDFE7;border-radius:14px;">
                <tr>
                  <td style="padding:18px 18px 10px;">
                    <div style="font-size:12px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;color:#8A7A86;">Date</div>
                    <div class="meta-value" style="margin-top:6px;font-size:20px;font-weight:800;color:#241B35;line-height:1.3;">${dateLabel}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 18px 18px;">
                    <div style="font-size:12px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;color:#8A7A86;">Time</div>
                    <div class="meta-value" style="margin-top:6px;font-size:20px;font-weight:800;color:#241B35;line-height:1.3;">${timeLabel}</div>
                    ${endsLabel ? `<div style="margin-top:6px;font-size:13px;color:#6B6475;">${endsLabel}</div>` : ''}
                    ${timezoneNote ? `<div style="margin-top:8px;font-size:12px;color:#6B6475;line-height:1.4;">${timezoneNote}</div>` : ''}
                    ${hostZoneHint ? `<div style="margin-top:4px;font-size:12px;color:#6B6475;line-height:1.4;">${hostZoneHint}</div>` : ''}
                  </td>
                </tr>
              </table>

              ${
                message
                  ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:18px;"><tr><td style="padding:14px 16px;background:#FFF5F9;border-radius:12px;border:1px solid #F3D0DF;font-size:14px;line-height:1.5;color:#241B35;">${message}</td></tr></table>`
                  : ''
              }

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 8px;">
                <tr>
                  <td align="center">
                    <a class="join-btn" href="${joinUrl}" target="_blank" style="display:inline-block;background:#C2185B;color:#ffffff;font-weight:700;font-size:16px;line-height:1.2;padding:16px 32px;border-radius:999px;text-align:center;">Join Meeting</a>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:22px;">
                <tr>
                  <td style="padding:0 0 14px;">
                    <div style="font-size:12px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;color:#8A7A86;">Meeting ID</div>
                    <div class="meta-value" style="margin-top:6px;font-size:22px;font-weight:800;letter-spacing:1px;color:#241B35;">${meetingId}</div>
                  </td>
                </tr>
                ${
                  passcode
                    ? `<tr>
                  <td style="padding:0 0 14px;">
                    <div style="font-size:12px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;color:#8A7A86;">Passcode</div>
                    <div class="meta-value" style="margin-top:6px;font-size:22px;font-weight:800;letter-spacing:1px;color:#241B35;">${passcode}</div>
                  </td>
                </tr>`
                    : ''
                }
                <tr>
                  <td style="padding:4px 0 0;">
                    <div style="font-size:12px;color:#6B6475;word-break:break-all;line-height:1.4;">
                      Meeting link:<br>
                      <a href="${joinUrl}" style="color:#C2185B;font-weight:600;">${joinUrl}</a>
                    </div>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;border-top:1px solid #EEDFE7;">
                <tr>
                  <td style="padding-top:22px;">
                    <div style="font-size:14px;font-weight:800;color:#241B35;margin-bottom:12px;">Add to Calendar</div>
                    <a class="cal-btn" href="${googleUrl}" target="_blank" style="display:inline-block;background:#ffffff;color:#C2185B;border:1px solid #C2185B;font-weight:700;font-size:14px;padding:12px 18px;border-radius:999px;margin:4px 6px 4px 0;">Google Calendar</a>
                    <a class="cal-btn" href="${outlookUrl}" target="_blank" style="display:inline-block;background:#ffffff;color:#C2185B;border:1px solid #C2185B;font-weight:700;font-size:14px;padding:12px 18px;border-radius:999px;margin:4px 6px 4px 0;">Outlook</a>
                    <div style="margin-top:12px;font-size:12px;color:#6B6475;line-height:1.45;">
                      Or open the attached ICS file — your calendar app will show the meeting in your local timezone.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="stack-pad" style="padding:0 28px 24px;">
              <div style="font-size:11px;color:#9A8C96;line-height:1.45;">
                Sent by ${brand}. If you weren’t expecting this invite, you can ignore this email.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
