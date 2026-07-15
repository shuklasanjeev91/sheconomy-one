import { useEffect, useState } from 'react'
import { Image, type ImageStyle, type StyleProp } from 'react-native'

type QrCodeSvgProps = {
  value: string
  size?: number
  backgroundColor?: string
  color?: string
  style?: StyleProp<ImageStyle>
}

/**
 * Web build stub for `react-native-qrcode-svg`.
 * The published package ships JSX in `.js`, which Rolldown rejects during `one build`.
 */
export default function QRCodeSvg({
  value,
  size = 128,
  backgroundColor = '#ffffff',
  color = '#000000',
  style,
}: QrCodeSvgProps) {
  const [uri, setUri] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void import('qrcode')
      .then(({ toDataURL }) =>
        toDataURL(value, {
          width: size,
          margin: 1,
          color: {
            dark: color,
            light: backgroundColor,
          },
        }),
      )
      .then((dataUrl) => {
        if (!cancelled) setUri(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setUri(null)
      })
    return () => {
      cancelled = true
    }
  }, [value, size, backgroundColor, color])

  if (!uri) return null

  return (
    <Image
      source={{ uri }}
      style={[{ width: size, height: size }, style]}
      accessibilityLabel="QR code"
    />
  )
}
