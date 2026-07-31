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
import { Text, YStack } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

type PostContentTextProps = {
  content: string
  fontSize?: number
  lineHeight?: number
  collapsible?: boolean
}

export function PostContentText({
  content,
  fontSize = 15,
  lineHeight = 24,
  collapsible = true,
}: PostContentTextProps) {
  const communityUi = useCommunityUi()
  const ui = useAppUi()
  const [expanded, setExpanded] = useState(false)
  const plainContent = useMemo(() => htmlToPlainText(content), [content])
  const canCollapse = collapsible && shouldTruncatePost(plainContent)
  const visibleContent =
    canCollapse && !expanded ? truncatePost(plainContent) : plainContent

  return (
    <YStack width="100%" minWidth={0} gap={4}>
      <Text fontSize={fontSize} color={ui.text} lineHeight={lineHeight} whiteSpace="pre-wrap">
        <PostTextSegments segments={parsePostText(visibleContent)} />
      </Text>
      {canCollapse && !expanded ? (
        <Text
          fontSize={fontSize}
          fontWeight="600"
          color={ui.textMuted}
          cursor="pointer"
          alignSelf="flex-start"
          onPress={(e: { stopPropagation?: () => void }) => {
            e.stopPropagation?.()
            setExpanded(true)
          }}
          hoverStyle={{ color: communityUi.brand, textDecorationLine: 'underline' }}
        >
          see more
        </Text>
      ) : null}
      {canCollapse && expanded ? (
        <Text
          fontSize={14}
          fontWeight="600"
          color={ui.textMuted}
          cursor="pointer"
          alignSelf="flex-start"
          onPress={(e: { stopPropagation?: () => void }) => {
            e.stopPropagation?.()
            setExpanded(false)
          }}
          hoverStyle={{ color: communityUi.brand, textDecorationLine: 'underline' }}
        >
          see less
        </Text>
      ) : null}
    </YStack>
  )
}

function PostTextSegments({ segments }: { segments: PostTextSegment[] }) {
  const communityUi = useCommunityUi()
  const ui = useAppUi()

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
