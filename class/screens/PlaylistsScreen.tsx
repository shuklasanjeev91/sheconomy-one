import { usePathname, useRouter } from 'one'
import { AppLink } from '~/components/navigation/AppLink'
import { useCallback, useEffect, useState } from 'react'

import { ClassShell } from '~/class/components/ClassShell'
import {
  createPlaylist,
  deletePlaylist,
  fetchMyPlaylists,
  fetchPlaylistWithPrograms,
  renamePlaylist,
  type ProgramPlaylist,
} from '~/class/lib/playlists'
import { getProgramSlug } from '~/class/lib/programs'
import { Button, Icons, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAuth } from '~/hooks/useAuth'
import { classRoutes, isClassAudioPath } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export function PlaylistsScreen() {
  const ui = useAppUi()
  const toast = useAppToast()
  const router = useRouter()
  const pathname = usePathname()
  const mediaType = isClassAudioPath(pathname) ? 'audio' : 'video'
  const { isAuthenticated, isLoading: authLoading, signIn } = useAuth()
  const [playlists, setPlaylists] = useState<ProgramPlaylist[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setPlaylists([])
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await fetchMyPlaylists()
    setPlaylists(result.playlists)
    setLoading(false)
  }, [isAuthenticated])

  useEffect(() => {
    void load()
  }, [load])

  async function handleCreate() {
    setCreating(true)
    const { playlist, error } = await createPlaylist(newTitle.trim() || 'My playlist', mediaType)
    setCreating(false)
    if (error || !playlist) {
      toast.show(error ?? 'Could not create playlist', { tone: 'danger' })
      return
    }
    setNewTitle('')
    toast.show('Playlist created', { tone: 'success' })
    void load()
  }

  async function handlePlay(playlist: ProgramPlaylist) {
    const { result, error } = await fetchPlaylistWithPrograms(playlist.id)
    if (error || !result?.programs.length) {
      toast.show(error ?? 'This playlist is empty', { tone: 'danger' })
      return
    }
    const first = result.programs[0]
    router.push(classRoutes.program(getProgramSlug(first), { playlist: playlist.id }) as never)
  }

  async function handleDelete(playlist: ProgramPlaylist) {
    const { error } = await deletePlaylist(playlist.id)
    if (error) {
      toast.show(error, { tone: 'danger' })
      return
    }
    toast.show('Playlist deleted', { tone: 'success' })
    void load()
  }

  async function handleRename(playlist: ProgramPlaylist) {
    const { error } = await renamePlaylist(playlist.id, renameValue)
    if (error) {
      toast.show(error, { tone: 'danger' })
      return
    }
    setRenamingId(null)
    setRenameValue('')
    toast.show('Playlist renamed', { tone: 'success' })
    void load()
  }

  return (
    <ClassShell>
      <YStack gap="$4" width="100%">
        <XStack alignItems="center" justifyContent="space-between" gap="$3">
          <Text fontSize={22} fontWeight="800" color={ui.text} letterSpacing={-0.3}>
            Playlists
          </Text>
          <AppLink href={classRoutes.home}>
            <Text fontSize={13} fontWeight="600" color={ui.brand}>
              Browse classes
            </Text>
          </AppLink>
        </XStack>

        {authLoading || loading ? (
          <YStack paddingVertical="$10" alignItems="center">
            <Spinner size="large" />
          </YStack>
        ) : !isAuthenticated ? (
          <YStack
            gap="$3"
            padding="$5"
            borderRadius={radius.card}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surface}
            style={getShadowStyle('sm')}
          >
            <Text fontSize={15} color={ui.textSecondary}>
              Sign in to create and manage Class playlists.
            </Text>
            <Button alignSelf="flex-start" onPress={() => signIn('/class/playlists')}>
              Sign in
            </Button>
          </YStack>
        ) : (
          <>
            <XStack gap="$2" alignItems="center" width="100%">
              <Input
                flex={1}
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="New playlist name"
              />
              <Button size="$3" onPress={() => void handleCreate()} disabled={creating}>
                Create
              </Button>
            </XStack>

            {playlists.length === 0 ? (
              <Text fontSize={14} color={ui.textMuted}>
                No playlists yet. Create one, then save programs from any program page.
              </Text>
            ) : (
              <YStack gap="$3">
                {playlists.map((playlist) => (
                  <YStack
                    key={playlist.id}
                    gap="$3"
                    padding="$4"
                    borderRadius={radius.card}
                    borderWidth={1}
                    borderColor={ui.borderSubtle}
                    backgroundColor={ui.surface}
                    style={getShadowStyle('sm')}
                  >
                    {renamingId === playlist.id ? (
                      <XStack gap="$2" alignItems="center">
                        <Input flex={1} value={renameValue} onChangeText={setRenameValue} />
                        <Button size="$2" onPress={() => void handleRename(playlist)}>
                          Save
                        </Button>
                        <Button
                          size="$2"
                          tone="ghost"
                          onPress={() => {
                            setRenamingId(null)
                            setRenameValue('')
                          }}
                        >
                          Cancel
                        </Button>
                      </XStack>
                    ) : (
                      <XStack
                        alignItems="center"
                        justifyContent="space-between"
                        gap="$3"
                        onPress={() => router.push(classRoutes.playlist(playlist.id) as never)}
                        pressStyle={{ opacity: 0.7 }}
                        cursor="pointer"
                        accessible
                        accessibilityRole="button"
                        accessibilityLabel={`Open playlist ${playlist.title}`}
                      >
                        <YStack flex={1} gap={2} minWidth={0}>
                          <Text fontSize={16} fontWeight="700" color={ui.text} numberOfLines={1}>
                            {playlist.title}
                          </Text>
                          <Text fontSize={12} color={ui.textMuted}>
                            {playlist.item_count} program{playlist.item_count === 1 ? '' : 's'} ·{' '}
                            {playlist.media_type}
                          </Text>
                        </YStack>
                        <Icons.List size={20} color={ui.brand} />
                      </XStack>
                    )}

                    <XStack gap="$2" flexWrap="wrap">
                      <Button size="$2" onPress={() => void handlePlay(playlist)}>
                        Play
                      </Button>
                      <Button
                        size="$2"
                        tone="ghost"
                        onPress={() => {
                          setRenamingId(playlist.id)
                          setRenameValue(playlist.title)
                        }}
                      >
                        Rename
                      </Button>
                      <Button size="$2" tone="ghost" onPress={() => void handleDelete(playlist)}>
                        Delete
                      </Button>
                    </XStack>
                  </YStack>
                ))}
              </YStack>
            )}
          </>
        )}
      </YStack>
    </ClassShell>
  )
}
