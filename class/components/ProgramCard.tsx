import { type Href } from 'one'

import { AppLink } from '~/components/navigation/AppLink'
import { ProgramAuthorAvatar, ProgramAuthorName } from '~/class/components/ProgramAuthorProfile'
import {
  formatProgramDuration,
  formatProgramViews,
  getProgramSlug,
  getProgramThumbnailUrl,
  type Program,
} from '~/class/lib/programs'
import { AutoplayVideo } from '~/components/media/AutoplayVideo'
import { classRoutes } from '~/lib/routes'
import { Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { isVideoMediaUrl } from '~/community/lib/post-media'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useThemedShadowStyle } from '~/lib/theme/useThemedShadowStyle'

type ProgramCardProps = {
  program: Program
  /** Card width — use `'100%'` for vertical feed layouts. */
  width?: number | `${number}%` | '100%'
  /** Override default program detail link (e.g. playlist context). */
  href?: Href
}

function canAutoplayProgram(program: Program): boolean {
  const url = program.video_url?.trim()
  if (!url) return false
  // YouTube + direct files — linkedin-style muted autoplay in rails.
  return Boolean(url.includes('youtu') || isVideoMediaUrl(url))
}

export function ProgramCard({ program, width = '100%', href }: ProgramCardProps) {
  const ui = useAppUi()
  const cardShadow = useThemedShadowStyle('sm')
  const cardShadowMd = useThemedShadowStyle('md')
  const thumbnailUrl = getProgramThumbnailUrl(program)
  const autoplay = canAutoplayProgram(program)
  const programHref = href ?? classRoutes.program(getProgramSlug(program))
  const isFullWidth = width === '100%' || (typeof width === 'string' && width.endsWith('%'))

  return (
    <YStack width={width} gap="$2.5" flexShrink={isFullWidth ? undefined : 0} maxWidth="100%">
      <YStack
        width="100%"
        aspectRatio={16 / 9}
        borderRadius={radius.card}
        overflow="hidden"
        backgroundColor={ui.imagePlaceholder}
        position="relative"
        borderWidth={1}
        borderColor={ui.borderSubtle}
        animation="quick"
        hoverStyle={{ opacity: 0.98, y: -2, ...cardShadowMd }}
        style={cardShadow}
      >
        {autoplay && program.video_url ? (
          <AutoplayVideo
            src={program.video_url}
            posterUrl={thumbnailUrl}
            aspectRatio={16 / 9}
            objectFit="cover"
            autoplayInView
            borderRadius={0}
          />
        ) : (
          <AppLink href={programHref} asChild>
            <YStack
              width="100%"
              height="100%"
              cursor="pointer"
              pressStyle={{ scale: 0.985 }}
            >
              {thumbnailUrl ? (
                <Image
                  src={thumbnailUrl}
                  width="100%"
                  height="100%"
                  objectFit="cover"
                  alt={program.title}
                />
              ) : (
                <YStack
                  flex={1}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={ui.roseSurface}
                >
                  <Icons.Play size={36} color={ui.brand} opacity={0.75} />
                </YStack>
              )}
              {(program.video_url || program.media_type === 'video') && thumbnailUrl ? (
                <YStack
                  position="absolute"
                  top={0}
                  left={0}
                  right={0}
                  bottom={0}
                  alignItems="center"
                  justifyContent="center"
                  pointerEvents="none"
                >
                  <YStack
                    width={44}
                    height={44}
                    borderRadius={999}
                    alignItems="center"
                    justifyContent="center"
                    backgroundColor="rgba(0,0,0,0.55)"
                    borderWidth={1}
                    borderColor="rgba(255,255,255,0.35)"
                  >
                    <Icons.Play size={20} color="#fff" fill="#fff" />
                  </YStack>
                </YStack>
              ) : null}
            </YStack>
          </AppLink>
        )}

        {program.duration ? (
          <XStack
            position="absolute"
            bottom={8}
            left={8}
            paddingHorizontal="$2"
            paddingVertical={4}
            borderRadius={999}
            backgroundColor="rgba(0,0,0,0.78)"
            zIndex={5}
            pointerEvents="none"
          >
            <Text fontSize={11} fontWeight="600" color="#fff">
              {formatProgramDuration(program.duration)}
            </Text>
          </XStack>
        ) : null}
      </YStack>

      <XStack gap="$2.5" alignItems="flex-start">
        <ProgramAuthorAvatar program={program} size="compact" />
        <YStack flex={1} gap={2} minWidth={0}>
          <AppLink href={programHref} asChild>
            <Text
              fontSize={14}
              fontWeight="600"
              color={ui.text}
              numberOfLines={2}
              lineHeight={18}
              cursor="pointer"
              hoverStyle={{ color: ui.brand }}
            >
              {program.title}
            </Text>
          </AppLink>
          <ProgramAuthorName program={program} size="compact" />
          <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
            {formatProgramViews(program.view_count || program.listen_count)}
            {program.category ? ` · ${program.category}` : ''}
          </Text>
        </YStack>
      </XStack>
    </YStack>
  )
}
