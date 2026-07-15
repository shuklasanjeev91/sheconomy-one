import { useParams, useRouter } from 'one'
import { AppLink } from '~/components/navigation/AppLink'
import { useEffect, useState } from 'react'

import { ClassShell } from '~/class/components/ClassShell'
import { ProgramCard } from '~/class/components/ProgramCard'
import {
  fetchPlaylistWithPrograms,
  removeProgramFromPlaylist,
  type PlaylistWithPrograms,
} from '~/class/lib/playlists'
import { getProgramSlug } from '~/class/lib/programs'
import { FullWidthLayout, PageCenter } from '~/components/layout'
import { Button, Spinner, Text, XStack, YStack, useAppToast, useMedia } from '~/components/ui'
import { classRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export function PlaylistDetailScreen() {
  const ui = useAppUi()
  const toast = useAppToast()
  const router = useRouter()
  const media = useMedia()
  const { id } = useParams<{ id: string }>()
  const playlistId = id ?? ''
  const [data, setData] = useState<PlaylistWithPrograms | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const cardWidth = media.gtLg ? 280 : 240

  useEffect(() => {
    if (!playlistId) return
    let active = true
    setLoading(true)
    void fetchPlaylistWithPrograms(playlistId).then(({ result, error: fetchError }) => {
      if (!active) return
      setData(result)
      setError(fetchError)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [playlistId])

  if (loading) {
    return (
      <FullWidthLayout>
        <PageCenter>
          <Spinner size="large" />
        </PageCenter>
      </FullWidthLayout>
    )
  }

  if (!data) {
    return (
      <ClassShell>
        <YStack gap="$3">
          <Text fontSize={20} fontWeight="700" color={ui.text}>
            Playlist not found
          </Text>
          <Text color={ui.textSecondary}>{error ?? 'This playlist could not be loaded.'}</Text>
          <AppLink href={classRoutes.playlists}>
            <Text fontWeight="600" color={ui.brand}>
              Back to playlists
            </Text>
          </AppLink>
        </YStack>
      </ClassShell>
    )
  }

  const first = data.programs[0]

  return (
    <ClassShell>
      <YStack gap="$4" width="100%">
        <XStack alignItems="flex-start" justifyContent="space-between" gap="$3">
          <YStack gap="$1" flex={1}>
            <Text fontSize={22} fontWeight="800" color={ui.text}>
              {data.playlist.title}
            </Text>
            <Text fontSize={13} color={ui.textMuted}>
              {data.programs.length} program{data.programs.length === 1 ? '' : 's'}
            </Text>
          </YStack>
          {first ? (
            <Button
              size="$3"
              onPress={() =>
                router.push(
                  classRoutes.program(getProgramSlug(first), { playlist: data.playlist.id }) as never,
                )
              }
            >
              Play all
            </Button>
          ) : null}
        </XStack>

        {data.programs.length === 0 ? (
          <Text fontSize={14} color={ui.textMuted}>
            This playlist is empty. Save programs from any Class program page.
          </Text>
        ) : (
          <YStack gap="$3">
            {data.programs.map((program, index) => (
              <XStack key={program.id} gap="$3" alignItems="flex-start" flexWrap="wrap">
                <Text fontSize={13} fontWeight="700" color={ui.textMuted} width={24} paddingTop="$4">
                  {index + 1}
                </Text>
                <YStack flex={1} minWidth={220}>
                  <ProgramCard
                    program={program}
                    width={cardWidth}
                    href={classRoutes.program(getProgramSlug(program), {
                      playlist: data.playlist.id,
                    })}
                  />
                </YStack>
                <Button
                  size="$2"
                  tone="ghost"
                  onPress={() => {
                    void removeProgramFromPlaylist(data.playlist.id, program.id).then(({ error: removeError }) => {
                      if (removeError) {
                        toast.show(removeError, { tone: 'danger' })
                        return
                      }
                      setData({
                        ...data,
                        programs: data.programs.filter((item) => item.id !== program.id),
                        playlist: {
                          ...data.playlist,
                          item_count: Math.max(0, data.playlist.item_count - 1),
                        },
                      })
                      toast.show('Removed from playlist', { tone: 'success' })
                    })
                  }}
                >
                  Remove
                </Button>
              </XStack>
            ))}
          </YStack>
        )}
      </YStack>
    </ClassShell>
  )
}
