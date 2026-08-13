import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

import { ScreenCenter, ScreenFill } from '~/components/layout'
import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { resolveMeetingRecordingShare } from '~/co-work/lib/livekit-recording-client'
import { publishRecordingAsClassLesson } from '~/co-work/lib/publish-recording'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { classRoutes, coWorkRoutes } from '~/lib/routes'
import { navigateApp } from '~/lib/platform/navigate'
import { openExternalUrl } from '~/lib/platform/openUrl'
import { useSupabase } from '~/providers/SupabaseProvider'

type MeetingRecordingPlaybackScreenProps = {
  token: string
}

export function MeetingRecordingPlaybackScreen({ token }: MeetingRecordingPlaybackScreenProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const toast = useAppToast()
  const { user } = useSupabase()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [meta, setMeta] = useState<{
    durationSeconds?: number | null
    createdAt?: string | null
  }>({})

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      if (!token.trim()) {
        setError('This recording link is incomplete.')
        setLoading(false)
        return
      }

      const result = await resolveMeetingRecordingShare(token.trim())
      if (cancelled) return
      if (!result.ok || !result.playbackUrl) {
        setError(result.error || 'Recording unavailable')
        setPlaybackUrl(null)
        setRecordingId(null)
        setLoading(false)
        return
      }

      setPlaybackUrl(result.playbackUrl)
      setRecordingId(result.recordingId ?? null)
      setMeta({
        durationSeconds: result.durationSeconds,
        createdAt: result.createdAt,
      })
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [token])

  async function handlePublishAsClass() {
    if (!user?.id) {
      toast.show('Sign in to publish', { tone: 'default' })
      return
    }
    if (!recordingId) {
      toast.show('Recording id missing', { tone: 'warning' })
      return
    }
    setPublishing(true)
    try {
      const result = await publishRecordingAsClassLesson({
        userId: user.id,
        recordingId,
        meetingTitle: 'Co-Work meeting recording',
      })
      if (result.error) {
        toast.show('Could not publish lesson', { tone: 'danger', message: result.error })
        return
      }
      toast.show('Published to Class', {
        tone: 'success',
        message: 'Lesson created with a durable recording link.',
      })
      navigateApp(classRoutes.home)
    } finally {
      setPublishing(false)
    }
  }

  if (loading) {
    return (
      <ScreenCenter backgroundColor={coworkUi.pageBg}>
        <Spinner size="large" color={coworkUi.brand} />
        <Text color={coworkUi.textSecondary} marginTop="$3">
          Opening recording…
        </Text>
      </ScreenCenter>
    )
  }

  if (error || !playbackUrl) {
    return (
      <ScreenCenter backgroundColor={coworkUi.pageBg} padding="$6" gap="$4">
        <YStack
          width={56}
          height={56}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          backgroundColor={coworkUi.brandMuted}
        >
          <Icons.AlertTriangle size={24} color={coworkUi.brand} />
        </YStack>
        <Text fontSize={18} fontWeight="700" color={coworkUi.text} textAlign="center">
          Recording unavailable
        </Text>
        <Text color={coworkUi.textSecondary} textAlign="center">
          {error}
        </Text>
        <Button tone="outline" borderRadius={999} onPress={() => navigateApp(coWorkRoutes.home)}>
          Back to Co-Work
        </Button>
      </ScreenCenter>
    )
  }

  const durationLabel =
    meta.durationSeconds && meta.durationSeconds > 0
      ? `${Math.floor(meta.durationSeconds / 60)}:${(meta.durationSeconds % 60)
          .toString()
          .padStart(2, '0')}`
      : null

  return (
    <ScreenFill backgroundColor="#0c080a" padding="$4" gap="$4">
      <YStack gap="$2" maxWidth={960} width="100%" alignSelf="center">
        <Text fontSize={22} fontWeight="800" color="#fff">
          Meeting recording
        </Text>
        <Text color="rgba(255,255,255,0.65)" fontSize={13}>
          {[
            durationLabel ? `Duration ${durationLabel}` : null,
            meta.createdAt ? new Date(meta.createdAt).toLocaleString() : null,
            'Link expires soon for security',
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </YStack>

      <YStack
        flex={1}
        width="100%"
        maxWidth={960}
        alignSelf="center"
        borderRadius={18}
        overflow="hidden"
        backgroundColor="#1a1216"
        borderWidth={1}
        borderColor="rgba(255,255,255,0.12)"
        minHeight={280}
      >
        {Platform.OS === 'web' ? (
          <video
            src={playbackUrl}
            controls
            playsInline
            style={{ width: '100%', height: '100%', minHeight: 280, background: '#000' }}
          />
        ) : (
          <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" padding="$6">
            <Text color="#fff" textAlign="center">
              Tap below to play or download this recording on your device.
            </Text>
            <Button
              tone="primary"
              borderRadius={999}
              icon={<Icons.Download size={16} color="white" />}
              onPress={() => void openExternalUrl(playbackUrl)}
            >
              Open recording
            </Button>
          </YStack>
        )}
      </YStack>

      <XStack maxWidth={960} width="100%" alignSelf="center" gap="$2" flexWrap="wrap">
        {Platform.OS === 'web' ? (
          <Button
            tone="outline"
            borderRadius={999}
            borderColor="rgba(255,255,255,0.2)"
            color="#fff"
            icon={<Icons.Download size={16} color="#fff" />}
            onPress={() => void openExternalUrl(playbackUrl)}
          >
            Download MP4
          </Button>
        ) : null}
        {recordingId ? (
          <Button
            tone="primary"
            borderRadius={999}
            disabled={publishing}
            icon={
              publishing ? (
                <Spinner size="small" color="white" />
              ) : (
                <Icons.GraduationCap size={16} color="white" />
              )
            }
            onPress={() => void handlePublishAsClass()}
          >
            {publishing ? 'Publishing…' : 'Publish as Class lesson'}
          </Button>
        ) : null}
      </XStack>
    </ScreenFill>
  )
}
