import { useRouter } from 'one'
import { useState } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityShell } from '~/community/components/CommunityShell'
import { createStory, deleteStoryMediaUrl } from '~/community/lib/stories'
import { refreshStories } from '~/community/lib/story-refresh'
import { useCommunityUi } from '~/community/lib/community-theme'
import {
  ActionProgress,
  Button,
  Spinner,
  Text,
  TextArea,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { ImageUploadField, preparePickedImagesForUpload } from '~/components/media/ImageUploadField'
import type { PickedImage } from '~/lib/media/pick-image'
import { clearFormDraft } from '~/lib/drafts/form-draft'
import { uploadPostImages, uploadPostVideos } from '~/lib/supabase/storage-upload'
import { useFormDraft } from '~/hooks/useFormDraft'
import { useUnsavedChangesGuard } from '~/hooks/useUnsavedChangesGuard'
import { useUploadProgress } from '~/hooks/useUploadProgress'
import { communityRoutes } from '~/lib/routes'
import { useSupabase } from '~/providers/SupabaseProvider'

const STORY_DRAFT_KEY = 'community-story-caption'

const BG_COLORS = ['#0a66c2', '#e41e3f', '#42b72a', '#8b5cf6', '#e67e22', '#111827']

export function StoryComposerScreen() {
  const communityUi = useCommunityUi()
  const router = useRouter()
  const toast = useAppToast()
  const { user } = useSupabase()
  const [content, setContent] = useState('')
  const [storyMedia, setStoryMedia] = useState<PickedImage[]>([])
  const [bgColor, setBgColor] = useState(BG_COLORS[0])
  const [mode, setMode] = useState<'text' | 'media'>('text')
  const [isPosting, setIsPosting] = useState(false)
  const { progress: uploadProgress, track: trackUpload, reset: resetUpload } = useUploadProgress()

  useFormDraft({
    key: user ? STORY_DRAFT_KEY : null,
    value: { content, bgColor, mode },
    isDirty: (value) => !!value.content.trim(),
    onRestored: (draft) => {
      if (typeof draft.content === 'string') setContent(draft.content)
      if (typeof draft.bgColor === 'string') setBgColor(draft.bgColor)
      if (draft.mode === 'text' || draft.mode === 'media') setMode(draft.mode)
    },
  })
  useUnsavedChangesGuard({ isDirty: !!content.trim() && !isPosting })

  const picked = storyMedia[0]
  const isVideoStory = picked?.mimeType?.startsWith('video/')

  async function handlePost() {
    if (!user) return
    if (mode === 'text' && !content.trim()) {
      toast.show('Add text', { tone: 'danger', message: 'Write something for your story.' })
      return
    }
    if (mode === 'media' && !picked) {
      toast.show('Add media', { tone: 'danger', message: 'Choose a photo or video for your story.' })
      return
    }

    setIsPosting(true)
    let mediaUrl: string | undefined
    let mediaType: 'text' | 'image' | 'video' = 'text'

    try {
      if (mode === 'media' && picked) {
        const files = await preparePickedImagesForUpload([picked])
        trackUpload(1)

        if (isVideoStory) {
          const { urls, error: uploadError } = await uploadPostVideos(user.id, files, {
            onProgress: trackUpload,
          })
          if (uploadError || !urls[0]) {
            toast.show('Could not upload video', {
              tone: 'danger',
              message: uploadError ?? 'Try again shortly.',
            })
            return
          }
          mediaUrl = urls[0]
          mediaType = 'video'
        } else {
          const { urls, error: uploadError } = await uploadPostImages(user.id, files, {
            onProgress: trackUpload,
          })
          if (uploadError || !urls[0]) {
            toast.show('Could not upload image', {
              tone: 'danger',
              message: uploadError ?? 'Try again shortly.',
            })
            return
          }
          mediaUrl = urls[0]
          mediaType = 'image'
        }
      }

      const result = await createStory(user.id, {
        mediaType,
        content: mode === 'text' ? content : content.trim() || undefined,
        mediaUrl,
        backgroundColor: bgColor,
      })

      if (result.error) {
        await deleteStoryMediaUrl(mediaUrl)
        toast.show('Could not post story', { tone: 'danger', message: result.error })
        return
      }

      await clearFormDraft(STORY_DRAFT_KEY)
      toast.show('Story posted', { tone: 'success' })
      refreshStories()
      router.replace(communityRoutes.home)
    } finally {
      setIsPosting(false)
      resetUpload()
    }
  }

  return (
    <CommunityShell wide>
      <CommunityCard padding={16} gap={16}>
        <Text fontSize={22} fontWeight="700" color={communityUi.text}>
          Create a story
        </Text>
        <Text fontSize={14} color={communityUi.textMuted}>
          Stories disappear after 24 hours. Share a text moment, photo, or video.
        </Text>

        {isPosting ? (
          <ActionProgress
            label={uploadProgress != null ? 'Uploading story media' : 'Posting story'}
            progress={uploadProgress}
          />
        ) : null}

        <XStack gap={8}>
          <Button
            size="$3"
            minHeight={44}
            backgroundColor={mode === 'text' ? communityUi.brand : communityUi.divider}
            onPress={() => setMode('text')}
            accessibilityState={{ selected: mode === 'text' }}
            accessibilityLabel="Text story"
          >
            Text
          </Button>
          <Button
            size="$3"
            minHeight={44}
            backgroundColor={mode === 'media' ? communityUi.brand : communityUi.divider}
            onPress={() => setMode('media')}
            accessibilityState={{ selected: mode === 'media' }}
            accessibilityLabel="Photo or video story"
          >
            Photo / Video
          </Button>
        </XStack>

        {mode === 'text' ? (
          <>
            <XStack gap={8} flexWrap="wrap">
              {BG_COLORS.map((color) => (
                <XStack
                  key={color}
                  width={44}
                  height={44}
                  borderRadius={999}
                  alignItems="center"
                  justifyContent="center"
                  cursor="pointer"
                  onPress={() => setBgColor(color)}
                  accessibilityRole="button"
                  accessibilityLabel={`Background color ${color}`}
                  accessibilityState={{ selected: bgColor === color }}
                >
                  <XStack
                    width={32}
                    height={32}
                    borderRadius={999}
                    backgroundColor={color}
                    borderWidth={bgColor === color ? 3 : 1}
                    borderColor={bgColor === color ? communityUi.text : communityUi.border}
                  />
                </XStack>
              ))}
            </XStack>
            <YStack padding={24} borderRadius={12} backgroundColor={bgColor} minHeight={200} justifyContent="center">
              <TextArea
                value={content}
                onChangeText={setContent}
                placeholder="Share a moment..."
                color="white"
                backgroundColor="transparent"
                borderWidth={0}
                fontSize={20}
                textAlign="center"
              />
            </YStack>
          </>
        ) : (
          <>
            <ImageUploadField
              label="Story media"
              hint="Upload a photo or video, or drag & drop on web."
              accept="media"
              value={storyMedia}
              onChange={setStoryMedia}
              uploadProgress={uploadProgress}
              uploadLabel={isVideoStory ? 'Uploading video…' : 'Uploading story…'}
            />
            <TextArea value={content} onChangeText={setContent} placeholder="Optional caption" />
          </>
        )}

        <Button
          backgroundColor={communityUi.brand}
          color="white"
          borderRadius={999}
          disabled={isPosting}
          onPress={handlePost}
          icon={isPosting ? <Spinner size="small" color="white" /> : undefined}
        >
          Share to story
        </Button>
      </CommunityCard>
    </CommunityShell>
  )
}
