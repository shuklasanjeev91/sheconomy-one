import { useEffect } from 'react'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { ScreenCenter } from '~/components/layout'
import { Spinner, Text } from '~/components/ui'
import { createMeeting } from '~/co-work/lib/meetings'
import { openInstantMeetingSession } from '~/co-work/lib/instant-meeting-session'
import { useProfile } from '~/hooks/useProfile'
import { useAppToast } from '~/components/ui'
import { coWorkRoutes } from '~/lib/routes'
import { navigateApp } from '~/lib/platform/navigate'

/**
 * Dev-only route: create a meeting, set a global dev flag and open instant session
 * so the meeting room will auto-start screen share (if supported).
 */
export default function DevAutoScreenShareRoute() {
  const { user, profile } = useProfile()
  const toast = useAppToast()

  useEffect(() => {
    if (!user) {
      toast.show('Sign in required', { tone: 'info', message: 'Please sign in to run the dev auto-share test.' })
      navigateApp('/auth/sign-in')
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const hostLabel = profile?.full_name?.trim() || profile?.username?.trim() || 'Dev'
        const meeting = await createMeeting(user.id, {
          title: `${hostLabel} Dev AutoShare`,
          startNow: true,
          securitySettings: { videoOffOnJoin: false },
        })

        if (cancelled) return

        if (!meeting?.meeting_code) {
          throw new Error('Meeting created without a join code')
        }

        // Set the dev flag so the LiveKit content auto-starts screen share.
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        ;(globalThis as any).__AUTO_SCREEN_SHARE = true

        openInstantMeetingSession({ code: meeting.meeting_code, meeting, autoJoin: true })
      } catch (err) {
        toast.show('Dev auto-share failed', { tone: 'error', message: err instanceof Error ? err.message : String(err) })
        navigateApp(coWorkRoutes.home)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user])

  return (
    <AppErrorBoundary scope="DevAutoShare" alwaysShowError>
      <ScreenCenter backgroundColor="#0c080a">
        <Spinner size="large" color="#D81B60" />
        <Text color="#ccc" marginTop="$3" fontSize={14}>
          Creating dev meeting and starting screen share…
        </Text>
      </ScreenCenter>
    </AppErrorBoundary>
  )
}
