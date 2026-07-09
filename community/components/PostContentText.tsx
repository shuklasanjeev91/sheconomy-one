import { useState } from 'react'
import { Link } from 'one'

import {
  parsePostText,
  shouldTruncatePost,
  truncatePost,
  type PostTextSegment,
} from '~/community/lib/post-text'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Text, XStack } from '~/components/ui'
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
  const canCollapse = collapsible && shouldTruncatePost(content)
  const visibleContent =
    canCollapse && !expanded ? truncatePost(content) : content

  return (
    <Text fontSize={fontSize} color={ui.text} lineHeight={lineHeight} whiteSpace="pre-wrap">
      <PostTextSegments segments={parsePostText(visibleContent)} />
      {canCollapse && !expanded ? (
        <>
          {' '}
          <Text
            fontSize={fontSize}
            fontWeight="600"
            color={ui.textMuted}
            cursor="pointer"
            onPress={() => setExpanded(true)}
            hoverStyle={{ color: communityUi.brand, textDecorationLine: 'underline' }}
          >
            see more
          </Text>
        </>
      ) : null}
      {canCollapse && expanded ? (
        <XStack marginTop={4}>
          <Text
            fontSize={14}
            fontWeight="600"
            color={ui.textMuted}
            cursor="pointer"
            onPress={() => setExpanded(false)}
            hoverStyle={{ color: communityUi.brand, textDecorationLine: 'underline' }}
          >
            see less
          </Text>
        </XStack>
      ) : null}
    </Text>
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
            <Link key={index} href={communityRoutes.hashtag(segment.tag)}>
              <Text
                fontWeight="600"
                color={communityUi.brand}
                cursor="pointer"
                hoverStyle={{ textDecorationLine: 'underline' }}
              >
                {segment.value}
              </Text>
            </Link>
          )
        }

        return (
          <Link key={index} href={communityRoutes.userProfile(segment.handle)}>
            <Text
              fontWeight="600"
              color={communityUi.brand}
              cursor="pointer"
              hoverStyle={{ textDecorationLine: 'underline' }}
            >
              {segment.value}
            </Text>
          </Link>
        )
      })}
    </>
  )
}