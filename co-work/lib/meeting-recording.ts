import { shareBlob } from '~/lib/platform/shareBlob'

/** Cloud recordings are composed on the SFU; captions are saved alongside locally. */
export async function downloadCaptionTranscript(lines: string[], meetingCode: string) {
  const body = lines.length > 0 ? lines.join('\n') : 'No captions captured during this recording.'
  const blob = new Blob([body], { type: 'text/plain;charset=utf-8' })
  await shareBlob(blob, `sheconomy-${meetingCode}-${Date.now()}.captions.txt`, blob.type)
}
