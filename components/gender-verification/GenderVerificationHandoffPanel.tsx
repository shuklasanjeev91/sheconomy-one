import { useEffect, useRef, useState } from 'react'
import QRCode from 'react-native-qrcode-svg'

import { Button, Icons, Spinner, Text, YStack } from '~/components/ui'
import {
  buildGenderVerificationHandoffUrl,
  createGenderVerificationHandoff,
  pollGenderVerificationHandoff,
  type GenderVerificationHandoff,
} from '~/lib/gender-verification/handoff'
import { useAppUi } from '~/lib/theme/useAppUi'

type GenderVerificationHandoffPanelProps = {
  onVerified: () => void
  onClose: () => void
  /** Present when this computer has a camera and can run the check itself. */
  onUseCamera?: () => void
}

export function GenderVerificationHandoffPanel({
  onVerified,
  onClose,
  onUseCamera,
}: GenderVerificationHandoffPanelProps) {
  const ui = useAppUi()
  const onVerifiedRef = useRef(onVerified)
  onVerifiedRef.current = onVerified
  const [handoff, setHandoff] = useState<GenderVerificationHandoff | null>(null)
  const [status, setStatus] = useState('Preparing a QR code…')
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    let finished = false
    let timer: ReturnType<typeof setInterval> | null = null
    setHandoff(null)
    setError(null)
    setStatus('Preparing a QR code…')

    void (async () => {
      const created = await createGenderVerificationHandoff()
      if (cancelled) return
      if (created.error || !created.handoff) {
        setError(created.error || 'Could not start phone verification.')
        return
      }
      setHandoff(created.handoff)
      setError(null)
      setStatus('Scan with a phone that has a camera')

      timer = setInterval(() => {
        void (async () => {
          const poll = await pollGenderVerificationHandoff(created.handoff!.id)
          if (cancelled) return
          if (poll.status === 'expired' || poll.status === 'missing') {
            setError('This QR code expired. Create a new one.')
            if (timer) clearInterval(timer)
            return
          }
          if (poll.status === 'opened') {
            setStatus(
              poll.failureReason
                ? 'Still open on your phone — you can try the camera check again there.'
                : 'Phone connected. Finish the camera check there.',
            )
          }
          if (poll.status === 'verified') {
            if (finished) return
            finished = true
            if (timer) clearInterval(timer)
            setStatus('Verified')
            onVerifiedRef.current()
          }
        })()
      }, 2000)
    })()

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [attempt])

  const url = handoff ? buildGenderVerificationHandoffUrl(handoff.token) : null

  return (
    <YStack width="100%" gap="$3" padding="$4" alignItems="center">
      <Icons.Smartphone size={28} color={ui.brand} />
      <Text fontSize={18} fontWeight="800" color={ui.text} textAlign="center">
        Verify with your phone
      </Text>
      <Text fontSize={14} color={ui.textMuted} textAlign="center" lineHeight={20} maxWidth={420}>
        {onUseCamera
          ? 'Scan this QR code with a phone camera. The link opens on that phone and starts human verification for this account.'
          : 'This device has no camera. Scan the QR code with a phone that does. The link opens there and starts human verification for this account.'}
      </Text>
      <Text fontSize={13} color={ui.text} textAlign="center" lineHeight={18}>
        {error ?? status}
      </Text>
      {url && !error ? (
        <YStack padding="$3" backgroundColor="white" borderRadius={12}>
          <QRCode value={url} size={196} />
        </YStack>
      ) : error ? null : (
        <Spinner size="large" />
      )}
      {error ? (
        <Button tone="primary" size="$4" borderRadius={999} onPress={() => setAttempt((value) => value + 1)}>
          New QR code
        </Button>
      ) : null}
      {onUseCamera ? (
        <Button tone="outline" size="$4" borderRadius={999} width="100%" onPress={onUseCamera}>
          Use this device&apos;s camera
        </Button>
      ) : null}
      <Button tone="ghost" size="$3" onPress={onClose}>
        Skip for now
      </Button>
    </YStack>
  )
}
