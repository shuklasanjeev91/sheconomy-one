import { Link } from 'one'

import { ProgramAuthorAvatar, ProgramAuthorName } from '~/class/components/ProgramAuthorProfile'
import {
  formatProgramDuration,
  formatProgramViews,
  getProgramSlug,
  type Program,
} from '~/class/lib/programs'
import { classRoutes } from '~/lib/routes'
import { Avatar, Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type ProgramCardProps = {
  program: Program
  width?: number
}

export function ProgramCard({ program, width = 280 }: ProgramCardProps) {
  const ui = useAppUi()

  return (
    <YStack width={width} gap="$2" flexShrink={0}>
      <Link href={classRoutes.program(getProgramSlug(program))} asChild>
        <YStack
          width="100%"
          aspectRatio={16 / 9}
          borderRadius={12}
          overflow="hidden"
          backgroundColor={ui.imagePlaceholder}
          cursor="pointer"
          position="relative"
          hoverStyle={{ opacity: 0.92 }}
          pressStyle={{ scale: 0.99 }}
        >
          {program.image_url ? (
            <Image src={program.image_url} width="100%" height="100%" objectFit="cover" />
          ) : (
            <YStack flex={1} alignItems="center" justifyContent="center">
              <Icons.Play size={36} color={ui.icon} />
            </YStack>
          )}
          {program.duration ? (
            <XStack
              position="absolute"
              bottom={8}
              right={8}
              paddingHorizontal="$2"
              paddingVertical={3}
              borderRadius={6}
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