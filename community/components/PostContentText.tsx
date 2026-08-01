import { useMemo, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import {
  htmlToPlainText,
  parsePostText,
  shouldTruncatePost,
  truncatePost,
  type PostTextSegment,
} from '~/community/lib/post-text'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Text, XStack, YStack } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

type PressEvent = {
  stopPropagation?: () => void
  preventDefault?: () => void
}

type PostContentTextProps = {
  content: string
  fontSize?: number
  lineHeight?: number
  collapsible?: boolean
  /** Tap the body (not "see more"/"see less") — e.g. open post detail from the feed. */
  onPressContent?: () => void
}

function stopPress(event?: PressEvent) {
  event?.stopPropagation?.()
  event?.preventDefault?.()
}

export function PostContentText({
  content,
  fontSize = 15,
  lineHeight = 24,
  collapsible = true,
  onPressContent,
}: PostContentTextProps) {
  const communityUi = useCommunityUi()
  const ui = useAppUi()
  const [expanded, setExpanded] = useState(false)
  const plainContent = useMemo(() => htmlToPlainText(content), [content])
  const canCollapse = collapsible && shouldTruncatePost(plainContent)
  const visibleContent =
    canCollapse && !expanded ? truncatePost(plainContent) : plainContent
  const segments = useMemo(() => parsePostText(visibleContent), [visibleContent])

  return (
    <YStack width="100%" minWidth={0} gap={4}>
      <YStack
        width="100%"
        minWidth={0}
        cursor={onPressContent ? 'pointer' : undefined}
        onPress={onPressContent}
        pressStyle={onPressContent ? { opacity: 0.92 } : undefined}
      >
        <Text fontSize={fontSize} color={ui.text} lineHeight={lineHeight} whiteSpace="pre-wrap">
          <PostTextSegments segments={segments} />
        </Text>
      </YStack>

      {canCollapse && !expanded ? (
        <XStack
          alignSelf="flex-start"
          cursor="pointer"
          role="button"
          accessibilityRole="button"
          accessibilityLabel="See more"
          hitSlop={8}
          onPress={(event: PressEvent) => {
            // Parent feed/article cards often wrap this block in a link — don't navigate.
            stopPress(event)
            setExpanded(true)
          }}
          hoverStyle={{ opacity: 0.85 }}
          pressStyle={{ opacity: 0.7 }}
        >
          <Text
            fontSize={fontSize}
            fontWeight="600"
            color={ui.textMuted}
            hoverStyle={{ color: communityUi.brand, textDecorationLine: 'underline' }}
          >
            see more
          </Text>
        </XStack>
      ) : null}

      {canCollapse && expanded ? (
        <XStack
          alignSelf="flex-start"
          cursor="pointer"
          role="button"
          accessibilityRole="button"
          accessibilityLabel="See less"
          hitSlop={8}
          onPress={(event: PressEvent) => {
            stopPress(event)
            setExpanded(false)
          }}
          hoverStyle={{ opacity: 0.85 }}
          pressStyle={{ opacity: 0.7 }}
        >
          <Text
            fontSize={14}
            fontWeight="600"
            color={ui.textMuted}
            hoverStyle={{ color: communityUi.brand, textDecorationLine: 'underline' }}
          >
            see less
          </Text>
        </XStack>
      ) : null}
    </YStack>
  )
}

function PostTextSegments({ segments }: { segments: PostTextSegment[] }) {
  const communityUi = useCommunityUi()

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <Text key={index}>{segment.value}</Text>
        }

        if (segment.type === 'hashtag') {
          return (
            <AppLink key={index} href={communityRoutes.hashtag(segment.tag)} asChild>
              <Text
                fontWeight="600"
                color={communityUi.brand}
                cursor="pointer"
                hoverStyle={{ textDecorationLine: 'underline' }}
              >
                {segment.value}
              </Text>
            </AppLink>
          )
        }

        return (
          <AppLink key={index} href={communityRoutes.userProfile(segment.handle)} asChild>
            <Text
              fontWeight="600"
              color={communityUi.brand}
              cursor="pointer"
              hoverStyle={{ textDecorationLine: 'underline' }}
            >
              {segment.value}
            </Text>
          </AppLink>
        )
      })}
    </>
  )
}
