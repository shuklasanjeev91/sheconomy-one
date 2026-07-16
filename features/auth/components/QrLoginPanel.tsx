import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import QRCode from 'react-native-qrcode-svg'

import { Button, Spinner, Text, YStack, useAppToast } from '~/components/ui'
import {
  buildQrLoginUrl,
  createQrLoginChallenge,
  pollQrLoginChallenge,
  redeemQrLoginChallenge,
  type QrChallenge,
} from '~/features/auth/services/qr-login'
import { useAppUi } from '~/lib/theme/useAppUi'

type QrLoginPanelProps = {
  onSuccess: () => void
  onCancel: () => void
}

/** Web-only: show QR for the phone app to approve, then redeem session. */
export function QrLoginPanel({ onSuccess, onCancel }: QrLoginPanelProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const [challenge, setChallenge] = useState<QrChallenge | null>(null)
  const [status, setStatus] = useState('Starting…')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (Platform.OS !== 'web') return
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    void (async () => {
      const created = await createQrLoginChallenge()
      if (cancelled) return
      if (created.error || !created.challenge) {
        setError(created.error || 'Could not start QR login')
        return
      }
      setChallenge(created.challenge)
      setStatus('Scan with your phone (signed in to SHEconomy)')

      timer = setInterval(() => {
        void (async () => {
          const poll = await pollQrLoginChallenge(created.challenge!.id)
          if (cancelled) return
          if (poll.status === 'expired') {
            setError('This QR code expired. Close and try again.')
            if (timer) clearInterval(timer)
            return
          }
          if (poll.status === 'approved' || poll.status === 'consumed') {
            if (timer) clearInterval(timer)
            setStatus('Approved — signing you in…')
            const redeemed = await redeemQrLoginChallenge(created.challenge!.id)
            if (cancelled) return
            if (redeemed.error) {
              setError(redeemed.error)
              toast.show(redeemed.error, { tone: 'danger' })
              return
            }
            onSuccess()
          }
        })()
      }, 2000)
    })()

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [onSuccess, toast])

  if (Platform.OS !== 'web') return null

  return (
    <YStack
      gap="$3"
      padding="$4"
      borderRadius={16}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surfaceMuted}
      alignItems="center"
    >
      <Text fontWeight="700" color={ui.text} fontSize={15}>
        Log in with phone
      </Text>
      <Text fontSize={13} color={ui.textMuted} textAlign="center" lineHeight={18}>
        {error ?? status}
      </Text>
      {challenge && !error ? (
        <YStack alignItems="center" gap="$2">
          <YStack padding="$3" backgroundColor="white" borderRadius={12}>
            <QRCode value={buildQrLoginUrl(challenge.device_code)} size={180} />
          </YStack>
          <Text fontSize={11} color={ui.textMuted} textAlign="center">
            Code: {challenge.device_code}
          </Text>
        </YStack>
      ) : (
        <Spinner size="large" />
      )}
      <Button tone="ghost" size="$3" onPress={onCancel}>
        Cancel
      </Button>
    </YStack>
  )
}
