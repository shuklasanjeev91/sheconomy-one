import type { PickedImage } from '~/lib/media/pick-image'

export type ChatComposerAttachment = {
  uri: string
  mimeType: string
  fileName?: string
  fileSize?: number
}

/** Route a picked file to image vs generic file send handlers in chat. */
export function sendPickedItemAsChatAttachment(
  item: PickedImage & { fileSize?: number },
  handlers: {
    onSendImage: (attachment: ChatComposerAttachment) => void
    onSendFile: (attachment: ChatComposerAttachment) => void
  },
) {
  const mimeType = item.mimeType || 'application/octet-stream'
  const attachment: ChatComposerAttachment = {
    uri: item.uri,
    mimeType,
    fileName: item.fileName,
    fileSize: item.fileSize,
  }

  if (mimeType.startsWith('image/')) {
    handlers.onSendImage(attachment)
    return
  }

  handlers.onSendFile(attachment)
}
