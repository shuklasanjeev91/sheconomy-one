import { Platform } from 'react-native'
import { usePathname } from 'one'

import { AI_NAME } from '~/config/brand'
import { useComposerState } from '~/community/lib/composer-store'
import { Icons, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import {
  isCoWorkMeetingRoomPath,
  isCreatePostPath,
} from '~/lib/routes'
import { useInstantMeetingSession } from '~/co-work/lib/instant-meeting-session'
import { useGlobalSession } from '~/lib/session/global-session'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useAiAssistOptional } from '~/providers/ai-assist-context'
import { useDictationOptional } from '~/providers/dictation-context'

/**
 * Global SHERPA dictation toggle — speak and type into the focused field.
 * Hidden in meetings / post compose / SHERPA sheet (sheet has its own mic).
 */
export function DictationFab() {
  const ui = useAppUi()
  const pathname = usePathname()
  const dictation = useDictationOptional()
  const assist = useAiAssistOptional()
  const { open: composerOpen } = useComposerState()
  const { isDesktop, mobileTabBarOffset, safeLeft, safeBottom } = useAppLayout()
  const instantMeeting = useInstantMeetingSession()
  const globalSession = useGlobalSession()
  const instantFullscreen =
    !!instantMeeting &&
    globalSession?.presentation !== 'minimized' &&
    globalSession?.presentation !== 'pip'

  if (
    !dictation?.supported ||
    composerOpen ||
    assist?.open ||
    isCreatePostPath(pathname ?? '') ||
    isCoWorkMeetingRoomPath(pathname ?? '') ||
    instantFullscreen
  ) {
    return null
  }

  const bottom = isDesktop
    ? Math.max(safeBottom, 24)
    : Math.max(mobileTabBarOffset + 12, safeBottom + 12)
  const left = Math.max(safeLeft, 16)
  const listening = dictation.listening

  return (
    <YStack
      position={Platform.OS === 'web' ? ('fixed' as never) : 'absolute'}
      bottom={bottom}
      left={left}
      width={48}
      height={48}
      borderRadius={radius.pill}
      backgroundColor={listening ? ui.brand : ui.surface}
      borderWidth={listening ? 0 : 1}
      borderColor={ui.borderSubtle}
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      zIndex={40}
      elevation={Platform.OS === 'android' ? 4 : undefined}
      shadowColor="#000"
      shadowOpacity={0.16}
      shadowRadius={8}
      shadowOffset={{ width: 0, height: 3 }}
      hoverStyle={{ opacity: 0.92 }}
      pressStyle={{ scale: 0.94 }}
      onPress={() => void dictation.toggle()}
      aria-label={listening ? `Stop ${AI_NAME} dictation` : `${AI_NAME} dictation — speak to type`}
      {...(Platform.OS === 'web'
        ? { role: 'button' as const }
        : {
            accessibilityRole: 'button' as const,
            accessibilityState: { selected: listening },
          })}
    >
      {listening ? (
        <Icons.MicOff size={20} color="#fff" />
      ) : (
        <Icons.Mic size={20} color={ui.brand} />
      )}
    </YStack>
  )
}
