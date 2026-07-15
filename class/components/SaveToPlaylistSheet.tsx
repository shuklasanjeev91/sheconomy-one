import { useCallback, useEffect, useState } from 'react'

import {
  addProgramToPlaylist,
  createPlaylist,
  fetchMyPlaylists,
  type ProgramPlaylist,
} from '~/class/lib/playlists'
import type { Program } from '~/class/lib/programs'
import { useAuth } from '~/hooks/useAuth'
import { AppBottomSheet, Button, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type SaveToPlaylistSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  program: Program
}

export function SaveToPlaylistSheet({ open, onOpenChange, program }: SaveToPlaylistSheetProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const { isAuthenticated, signIn } = useAuth()
  const [playlists, setPlaylists] = useState<ProgramPlaylist[]>([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)

  const mediaType = program.media_type === 'audio' ? 'audio' : 'video'

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
    if (open) void load()
  }, [load, open])

  async function handleAdd(playlist: ProgramPlaylist) {
    setSavingId(playlist.id)
    const { error } = await addProgramToPlaylist(playlist.id, program.id)
    setSavingId(null)
    if (error) {
      toast.show(error, { tone: 'danger' })
      return
    }
    toast.show(`Saved to ${playlist.title}`, { tone: 'success' })
    onOpenChange(false)
  }

  async function handleCreate() {
    const title = newTitle.trim() || 'My playlist'
    setCreating(true)
    const { playlist, error } = await createPlaylist(title, mediaType)
    if (error || !playlist) {
      setCreating(false)
      toast.show(error ?? 'Could not create playlist', { tone: 'danger' })
      return
    }
    const addResult = await addProgramToPlaylist(playlist.id, program.id)
    setCreating(false)
    if (addResult.error) {
      toast.show(addResult.error, { tone: 'danger' })
      return
    }
    toast.show(`Saved to ${playlist.title}`, { tone: 'success' })
    setNewTitle('')
    onOpenChange(false)
  }

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Save to playlist"
      scrollable
    >
      <YStack gap="$3" paddingHorizontal="$4" paddingBottom="$4">
        {!isAuthenticated ? (
          <YStack gap="$3">
            <Text fontSize={14} color={ui.textSecondary}>
              Sign in to create playlists and save programs.
            </Text>
            <Button
              onPress={() => {
                onOpenChange(false)
                signIn(`/class/${encodeURIComponent(program.seo_slug || program.id)}`)
              }}
            >
              Sign in
            </Button>
          </YStack>
        ) : (
          <>
            <YStack gap="$2">
              <Text fontSize={13} fontWeight="600" color={ui.text}>
                New playlist
              </Text>
              <XStack gap="$2" alignItems="center">
                <Input
                  flex={1}
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder="Playlist name"
                />
                <Button size="$3" onPress={() => void handleCreate()} disabled={creating}>
                  {creating ? '…' : 'Create'}
                </Button>
              </XStack>
            </YStack>

            <Text fontSize={13} fontWeight="600" color={ui.text}>
              Your playlists
            </Text>

            {loading ? (
              <YStack paddingVertical="$4" alignItems="center">
                <Spinner size="small" />
              </YStack>
            ) : playlists.length === 0 ? (
              <Text fontSize={13} color={ui.textMuted}>
                No playlists yet. Create one above.
              </Text>
            ) : (
              <YStack gap="$2">
                {playlists.map((playlist) => (
                  <Button
                    key={playlist.id}
                    tone="ghost"
                    justifyContent="flex-start"
                    onPress={() => void handleAdd(playlist)}
                    disabled={savingId === playlist.id}
                  >
                    <YStack alignItems="flex-start" gap={2}>
                      <Text fontSize={14} fontWeight="650" color={ui.text}>
                        {playlist.title}
                      </Text>
                      <Text fontSize={12} color={ui.textMuted}>
                        {playlist.item_count} program{playlist.item_count === 1 ? '' : 's'}
                      </Text>
                    </YStack>
                  </Button>
                ))}
              </YStack>
            )}
          </>
        )}
      </YStack>
    </AppBottomSheet>
  )
}
