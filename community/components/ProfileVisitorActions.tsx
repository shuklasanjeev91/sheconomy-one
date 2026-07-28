import { useState } from 'react'

import { createDirectConversation } from '~/chat/lib/chats'
import { IntroductionRequestButton } from '~/community/components/IntroductionRequestButton'
import { MessageIcebreakerButton } from '~/community/components/MessageIcebreakerButton'
import { ProfileConnectButton } from '~/community/components/ProfileConnectButton'
import { ProfileFollowButton } from '~/community/components/ProfileFollowButton'
import {
  blockCommunityMember,
  reportCommunityMember,
} from '~/community/lib/moderation'
import { requestRecommendation } from '~/community/lib/recommendations'
import { ShareSheet } from '~/components/share/ShareSheet'
import {
  AppBottomSheet,
  Icons,
  Separator,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { buildSignInUrl } from '~/lib/auth/redirect'
import { chatRoutes, communityRoutes, routes } from '~/lib/routes'
import { copyShareLink, getProfileShareUrl } from '~/lib/share'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'
import { navigateApp } from '~/lib/platform/navigate'

type ProfileVisitorActionsProps = {
  targetUserId: string
  targetUsername: string
  displayName: string
  headline?: string | null
  industry?: string | null
  creatorMode?: boolean
  mutualCount?: number
  /** LinkedIn-style: open connections in a bottom sheet on the profile. */
  onViewConnections?: () => void
}

/**
 * LinkedIn-style visitor toolbar:
 * Message · Connect/Pending · Follow · ⋯ More
 */
export function ProfileVisitorActions({
  targetUserId,
  targetUsername,
  displayName,
  headline,
  industry,
  creatorMode,
  mutualCount = 0,
  onViewConnections,
}: ProfileVisitorActionsProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const { user } = useSupabase()
  const [moreOpen, setMoreOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [introOpen, setIntroOpen] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [messaging, setMessaging] = useState(false)
  const [askingRec, setAskingRec] = useState(false)

  const profileUrl = getProfileShareUrl(targetUsername)
  const signInRedirect = routes.userProfile(targetUsername)

  function requireAuth(action: string) {
    toast.show('Sign in required', {
      tone: 'default',
      message: `Sign in to ${action}.`,
    })
    navigateApp(buildSignInUrl(signInRedirect) as never)
  }

  async function openDirectMessage() {
    if (!user?.id) {
      requireAuth('send messages')
      return
    }
    setMessaging(true)
    const { conversationId, error } = await createDirectConversation(targetUserId)
    setMessaging(false)
    setMoreOpen(false)
    if (error || !conversationId) {
      toast.show('Could not start chat', { tone: 'danger', message: error ?? undefined })
      return
    }
    navigateApp(chatRoutes.conversation(conversationId) as never)
  }

  return (
    <>
      <XStack gap="$2" flexWrap="wrap" alignItems="center" justifyContent="flex-end">
        <MessageIcebreakerButton
          targetUserId={targetUserId}
          targetUsername={targetUsername}
          displayName={displayName}
          headline={headline}
          industry={industry}
          creatorMode={creatorMode}
        />
        <ProfileConnectButton targetUserId={targetUserId} />
        <ProfileFollowButton targetUserId={targetUserId} />
        <XStack
          width={36}
          height={36}
          borderRadius={999}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          hoverStyle={{ backgroundColor: ui.surfaceMuted }}
          pressStyle={{ opacity: 0.85 }}
          accessibilityLabel="More"
          onPress={() => setMoreOpen(true)}
        >
          <Icons.MoreHorizontal size={18} color={ui.text} />
        </XStack>
      </XStack>

      <AppBottomSheet open={moreOpen} onOpenChange={setMoreOpen} title="More" scrollable>
        <YStack gap="$1" paddingHorizontal="$3" paddingBottom="$6">
          <Text fontSize={12} fontWeight="700" color={ui.textMuted} paddingHorizontal="$2" paddingTop="$1" paddingBottom="$2">
            Share
          </Text>
          <MoreRow
            icon={Icons.Share2}
            label="Share profile via…"
            description="Send this profile with the system share sheet"
            onPress={() => {
              setMoreOpen(false)
              setShareOpen(true)
            }}
          />
          <MoreRow
            icon={Icons.Link}
            label="Copy profile link"
            description={profileUrl}
            onPress={() => {
              void copyShareLink(profileUrl).then((copied) => {
                setMoreOpen(false)
                toast.show(copied ? 'Profile link copied' : 'Could not copy link', {
                  tone: copied ? 'success' : 'danger',
                })
              })
            }}
          />
          <MoreRow
            icon={Icons.MessageCircle}
            label={messaging ? 'Opening chat…' : 'Send in a message'}
            description={`Message ${displayName.split(' ')[0] ?? displayName} about this profile`}
            disabled={messaging}
            onPress={() => void openDirectMessage()}
          />

          <Separator marginVertical="$3" />

          <Text fontSize={12} fontWeight="700" color={ui.textMuted} paddingHorizontal="$2" paddingBottom="$2">
            Network
          </Text>
          <MoreRow
            icon={Icons.Users}
            label="View connections"
            description={`See who ${displayName.split(' ')[0] ?? displayName} is connected with`}
            onPress={() => {
              setMoreOpen(false)
              if (onViewConnections) {
                onViewConnections()
                return
              }
              navigateApp(communityRoutes.userConnections(targetUsername) as never)
            }}
          />
          <MoreRow
            icon={Icons.Handshake}
            label="Request an introduction"
            description={
              mutualCount > 0
                ? 'Ask a mutual connection to introduce you'
                : 'Available when you share mutual connections'
            }
            disabled={mutualCount <= 0}
            onPress={() => {
              if (!user?.id) {
                requireAuth('request introductions')
                return
              }
              setMoreOpen(false)
              setIntroOpen(true)
            }}
          />
          <MoreRow
            icon={Icons.Award}
            label={askingRec ? 'Sending…' : 'Ask for a recommendation'}
            description={`Request a recommendation from ${displayName.split(' ')[0] ?? displayName}`}
            disabled={askingRec}
            onPress={() => {
              if (!user?.id) {
                requireAuth('ask for recommendations')
                return
              }
              setAskingRec(true)
              void requestRecommendation({
                requesterId: user.id,
                requestedFromId: targetUserId,
              }).then((result) => {
                setAskingRec(false)
                setMoreOpen(false)
                if (result.error) {
                  toast.show('Could not send request', { tone: 'danger', message: result.error })
                  return
                }
                toast.show('Recommendation requested', {
                  tone: 'success',
                  message: `${displayName} will be notified.`,
                })
              })
            }}
          />

          <Separator marginVertical="$3" />

          <Text fontSize={12} fontWeight="700" color={ui.textMuted} paddingHorizontal="$2" paddingBottom="$2">
            Safety
          </Text>
          <MoreRow
            icon={Icons.Flag}
            label={reporting ? 'Reporting…' : 'Report'}
            description="Report this profile for review"
            disabled={reporting}
            onPress={() => {
              if (!user?.id) {
                requireAuth('report members')
                return
              }
              setReporting(true)
              void reportCommunityMember(user.id, targetUserId).then((result) => {
                setReporting(false)
                setMoreOpen(false)
                if (result.error) {
                  toast.show('Could not report', { tone: 'danger', message: result.error })
                  return
                }
                toast.show('Report submitted', {
                  tone: 'success',
                  message: 'Thanks for helping keep the community safe.',
                })
              })
            }}
          />
          <MoreRow
            icon={Icons.Ban}
            label={blocking ? 'Blocking…' : 'Block'}
            description={`${displayName.split(' ')[0] ?? displayName} won’t see your profile or posts`}
            destructive
            disabled={blocking}
            onPress={() => {
              if (!user?.id) {
                requireAuth('block members')
                return
              }
              setBlocking(true)
              void blockCommunityMember(user.id, targetUserId).then((result) => {
                setBlocking(false)
                setMoreOpen(false)
                if (result.error) {
                  toast.show('Could not block', { tone: 'danger', message: result.error })
                  return
                }
                toast.show('Member blocked', { tone: 'default' })
                navigateApp(communityRoutes.network)
              })
            }}
          />
        </YStack>
      </AppBottomSheet>

      <IntroductionRequestButton
        hideTrigger
        open={introOpen}
        onOpenChange={setIntroOpen}
        targetUserId={targetUserId}
        targetUsername={targetUsername}
        targetDisplayName={displayName}
      />

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        title="Share profile"
        copyLabel="Copy profile link"
        copyToastMessage="Profile link copied to clipboard."
        payload={{
          url: profileUrl,
          title: displayName,
          text: headline ?? undefined,
        }}
      />
    </>
  )
}

function MoreRow({
  icon: Icon,
  label,
  description,
  onPress,
  destructive,
  disabled,
}: {
  icon: typeof Icons.Share2
  label: string
  description?: string
  onPress: () => void
  destructive?: boolean
  disabled?: boolean
}) {
  const ui = useAppUi()
  const iconColor = destructive ? ui.danger : ui.textSecondary

  return (
    <XStack
      gap="$3"
      alignItems="center"
      paddingVertical="$3"
      paddingHorizontal="$2"
      borderRadius={12}
      opacity={disabled ? 0.45 : 1}
      cursor={disabled ? 'default' : 'pointer'}
      hoverStyle={disabled ? undefined : { backgroundColor: ui.surfaceMuted }}
      pressStyle={disabled ? undefined : { opacity: 0.85 }}
      onPress={disabled ? undefined : onPress}
    >
      <YStack
        width={42}
        height={42}
        borderRadius={999}
        alignItems="center"
        justifyContent="center"
        backgroundColor={ui.surfaceMuted}
        flexShrink={0}
      >
        <Icon size={20} color={iconColor} />
      </YStack>
      <YStack flex={1} minWidth={0} gap={2}>
        <Text fontSize={15} fontWeight="600" color={destructive ? ui.danger : ui.text}>
          {label}
        </Text>
        {description ? (
          <Text fontSize={13} color={ui.textMuted} numberOfLines={2} lineHeight={18}>
            {description}
          </Text>
        ) : null}
      </YStack>
      <Icons.ChevronRight size={18} color={ui.textMuted} flexShrink={0} />
    </XStack>
  )
}
