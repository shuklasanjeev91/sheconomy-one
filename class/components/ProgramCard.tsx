import { Link } from 'one'

import { ProgramAuthorAvatar, ProgramAuthorName } from '~/class/components/ProgramAuthorProfile'
import {
  formatProgramDuration,
  formatProgramViews,
  getProgramSlug,
  type Program,
} from '~/class/lib/programs'
import { classRoutes } from '~/lib/routes'
import { Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useThemedShadowStyle } from '~/lib/theme/useThemedShadowStyle'

type ProgramCardProps = {
  program: Program
  width?: number
}

export function ProgramCard({ program, width = 280 }: ProgramCardProps) {
  const ui = useAppUi()
  const cardShadow = useThemedShadowStyle('sm')
  const cardShadowMd = useThemedShadowStyle('md')

  return (
    <YStack width={width} gap="$2.5" flexShrink={0}>
      <Link href={classRoutes.program(getProgramSlug(program))} asChild>
        <YStack
          width="100%"
          aspectRatio={16 / 9}
          borderRadius={radius.card}
          overflow="hidden"
          backgroundColor={ui.imagePlaceholder}
          cursor="pointer"
          position="relative"
          borderWidth={1}
          borderColor={ui.borderSubtle}
          animation="quick"
          hoverStyle={{ opacity: 0.96, y: -3, ...cardShadowMd }}
          pressStyle={{ scale: 0.985, y: 0 }}
          style={cardShadow}
        >
          {program.image_url ? (
            <Image src={program.image_url} width="100%" height="100%" objectFit="cover" />
          ) : (
            <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor={ui.roseSurface}>
              <Icons.Play size={36} color={ui.brand} opacity={0.75} />
            </YStack>
          )}
          {program.duration ? (
            <XStack
              position="absolute"
              bottom={8}
              right={8}
              paddingHorizontal="$2"
              paddingVertical={4}
              borderRadius={999}
              backgroundColor="rgba(0,0,0,0.78)"
            >
              <Text fontSize={11} fontWeight="600" color="#fff">
                {formatProgramDuration(program.duration)}
              </Text>
            </XStack>
          ) : null}
        </YStack>
      </Link>

      <XStack gap="$2.5" alignItems="flex-start">
        <ProgramAuthorAvatar program={program} size="compact" />
        <YStack flex={1} gap={2} minWidth={0}>
          <Link href={classRoutes.program(getProgramSlug(program))} asChild>
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
          </Link>
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