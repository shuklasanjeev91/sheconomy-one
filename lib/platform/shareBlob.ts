import { Platform } from 'react-native'

/** Save or share a file blob — download on web, share sheet on iOS/Android. */
export async function shareBlob(blob: Blob, filename: string, mimeType?: string) {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') return
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
    return
  }

  const [{ cacheDirectory, writeAsStringAsync, EncodingType }, Sharing] = await Promise.all([
    import('expo-file-system/legacy'),
    import('expo-sharing'),
  ])
  const reader = new FileReader()
  const base64 = await new Promise<string>((resolve, reject) => {
    reader.onloadend = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Could not read file'))
        return
      }
      const encoded = result.split(',')[1]
      if (!encoded) {
        reject(new Error('Could not encode file'))
        return
      }
      resolve(encoded)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'))
    reader.readAsDataURL(blob)
  })

  const uri = `${cacheDirectory}${filename}`
  await writeAsStringAsync(uri, base64, { encoding: EncodingType.Base64 })
  const canShare = await Sharing.isAvailableAsync()
  if (!canShare) {
    throw new Error('Sharing is not available on this device')
  }

  await Sharing.shareAsync(uri, {
    mimeType: mimeType ?? (blob.type || 'application/octet-stream'),
    dialogTitle: filename,
  })
}
