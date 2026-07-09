import { ProfileLink } from '~/community/components/ProfileLink'
import {
  canLinkProgramAuthor,
  getProgramAuthorDisplay,
  type Program,
} from '~/class/lib/programs'
import { Avatar, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type ProgramAuthorProfileProps = {
  program: Program
  size?: 'compact' | 'large'
  subtitle?: string | null
}

export function ProgramAuthorAvatar({
  program,
  size,
}: {
  program: Program
  size: 'compact' | 'large'
}) {
  const displayName = getProgramAuthorDisplay(program)
  const canLink = canLinkProgramAuthor(program)
  const avatarSize = size === 'large' ? '$5' : '$3'

  const avatar = (
    <Avatar
      size={avatarSize}
      name={displayName}
      src={program.author?.avatar_url ?? undefined}
      cursor={canLink ? 'pointer' : undefined}
    />
  )

  if (!canLink) return avatar

  return (
    <ProfileLink userId={program.author_id} username={program.author?.username}>
      {avatar}
    </ProfileLink>
  )
}

export function ProgramAuthorName({
  program,
  size,
}: {
  program: Program
  size: 'compact' | 'large'
}) {
  const ui = useAppUi()
  const displayName = getProgramAuthorDisplay(program)
  const canLink = canLinkProgramAuthor(program)
  const nameSize = size === 'large' ? 16 : 12
  const nameColor = size === 'large' ? ui.text : ui.textSecondary
  const nameWeight = size === 'large' ? '600' : '500'

  const name = (
    <Text
      fontSize={nameSize}
      fontWeight={nameWeight}
      color={nameColor}
      numberOfLines={1}
      cursor={canLink ? 'pointer' : undefined}
      hoverStyle={canLink ? { color: ui.brand } : undefined}
    >
      {displayName}
    </Text>
  )

  if (!canLink) return name

  return (
    <ProfileLink userId={program.author_id} username={program.author?.username}>
      {name}
    </ProfileLink>
  )
}

export function ProgramAuthorProfile({
  program,
  size = 'compact',
  subtitle,
}: ProgramAuthorProfileProps) {
  const ui = useAppUi()
  const username = program.author?.username?.trim()
  const canLink = canLinkProgramAuthor(program)

  const handleLine =
    canLink && username ? (
      <Text fontSize={size === 'large' ? 14 : 12} color={ui.textMuted} numberOfLines={1}>
        @{username}
      </Text>
    ) : null

  return (
    <XStack gap={size === 'large' ? '$3' : '$2.5'} alignItems="flex-start" minWidth={0}>
      <ProgramAuthorAvatar program={program} size={size} />
      <YStack flex={1} gap={2} minWidth={0}>
        <ProgramAuthorName program={program} size={size} />
        {handleLine}
        {subtitle ? (
          <Text fontSize={size === 'large' ? 13 : 12} color={ui.textMuted} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </YStack>
    </XStack>
  )
}