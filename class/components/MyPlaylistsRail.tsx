import { useCallback, useEffect, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import { fetchMyPlaylists, type ProgramPlaylist } from '~/class/lib/playlists'
import { HorizontalScrollRow } from '~/components/layout'
import { Button, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAuth } from '~/hooks/useAuth'
import { classRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

type MyPlaylistsRailProps = {
  mediaType: 'video' | 'audio'
}

export function MyPlaylistsRail({ mediaType }: MyPlaylistsRailProps) {
  const ui = useAppUi()
  const { isAuthenticated, isLoading: authLoading, signIn } = useAuth()
  const [playlists, setPlaylists] = useState<ProgramPlaylist[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setPlaylists([])
      return
    }
    setLoading(true)
    const result = await fetchMyPlaylists(mediaType)
    setPlaylists(result.playlists)
    setLoading(false)
  }, [isAuthenticated, mediaType])

  useEffect(() => {
    void load()
  }, [load])

  if (authLoading) return null

  if (!isAuthenticated) {
    return (
      <YStack
        gap="$2"
        padding="$4"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
        style={getShadowStyle('sm')}
        width="100%"
      >
        <Text fontSize={16} fontWeight="700" color={ui.text}>
          Playlists
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Sign in to save programs into playlists and play them in order.
        </Text>
        <Button size="$3" alignSelf="flex-start" onPress={() => signIn('/class')}>
          Sign in
        </Button>
      </YStack>
    )
  }

  if (!loading && playlists.length === 0) {
    return (
      <YStack gap="$2" width="100%">
        <XStack alignItems="center" justifyContent="space-between">
          <Text fontSize={16} fontWeight="700" color={ui.text}>
            Playlists
          </Text>
          <AppLink href={classRoutes.playlists}>
            <Text fontSize={13} fontWeight="600" color={ui.brand}>
              Manage
            </Text>
          </AppLink>
        </XStack>
        <Text fontSize={13} color={ui.textMuted}>
          Save programs to a playlist from any program page.
        </Text>
      </YStack>
    )
  }

  return (
    <YStack gap="$3" width="100%">
      <XStack alignItems="center" justifyContent="space-between">
        <Text fontSize={16} fontWeight="700" color={ui.text}>
          Playlists
        </Text>
        <AppLink href={classRoutes.playlists}>
          <Text fontSize={13} fontWeight="600" color={ui.brand}>
            See all
          </Text>
        </AppLink>
      </XStack>
      {loading && playlists.length === 0 ? (
        <Spinner size="small" color={ui.brand} />
      ) : (
        <HorizontalScrollRow gap="$3">
          {playlists.map((playlist) => (
            <AppLink key={playlist.id} href={classRoutes.playlist(playlist.id)}>
              <YStack
                width={200}
                gap="$2"
                padding="$3"
                borderRadius={radius.card}
                borderWidth={1}
                borderColor={ui.borderSubtle}
                backgroundColor={ui.surface}
                style={getShadowStyle('sm')}
                hoverStyle={{ borderColor: ui.brand }}
                pressStyle={{ opacity: 0.94 }}
                cursor="pointer"
              >
                <XStack alignItems="center" gap="$2">
                  <Icons.List size={18} color={ui.brand} />
                  <Text fontSize={14} fontWeight="700" color={ui.text} numberOfLines={1} flex={1}>
                    {playlist.title}
                  </Text>
                </XStack>
                <Text fontSize={12} color={ui.textMuted}>
                  {playlist.item_count} program{playlist.item_count === 1 ? '' : 's'}
                </Text>
              </YStack>
            </AppLink>
          ))}
        </HorizontalScrollRow>
      )}
    </YStack>
  )
}
