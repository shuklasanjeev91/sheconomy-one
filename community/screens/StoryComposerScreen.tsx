import { useRouter } from 'one'
import { useState } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityShell } from '~/community/components/CommunityShell'
import { createStory } from '~/community/lib/stories'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Button, Input, Spinner, Text, TextArea, XStack, YStack, useAppToast } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'
import { useSupabase } from '~/providers/SupabaseProvider'

const BG_COLORS = ['#0a66c2', '#e41e3f', '#42b72a', '#8b5cf6', '#e67e22', '#111827']

export function StoryComposerScreen() {
  const communityUi = useCommunityUi()
  const router = useRouter()
  const toast = useAppToast()
  const { user } = useSupabase()
  const [content, setContent] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [bgColor, setBgColor] = useState(BG_COLORS[0])
  const [mode, setMode] = useState<'text' | 'image'>('text')
  const [isPosting, setIsPosting] = useState(false)

  async function handlePost() {
    if (!user) return
    if (mode === 'text' && !content.trim()) {
      toast.show('Add text', { tone: 'danger', message: 'Write something for your story.' })
      return
    }
    if (mode === 'image' && !mediaUrl.trim()) {
      toast.show('Add image', { tone: 'danger', message: 'Paste an image URL.' })
      return
    }

    setIsPosting(true)
    const result = await createStory(user.id, {
      mediaType: mode,
      content: mode === 'text' ? content : undefined,
      mediaUrl: mode === 'image' ? mediaUrl : undefined,
      backgroundColor: bgColor,
    })
    setIsPosting(false)

    if (result.error) {
      toast.show('Could not post story', { tone: 'danger', message: result.error })
      return
    }

    toast.show('Story posted', { tone: 'success' })
    router.replace(communityRoutes.home)
  }

  return (
    <CommunityShell wide>
      <CommunityCard padding={16} gap={16}>
        <Text fontSize={22} fontWeight="700" color={communityUi.text}>
          Create a story
        </Text>
        <Text fontSize={14} color={communityUi.textMuted}>
          Stories disappear after 24 hours.
        </Text>

        <XStack gap={8}>
          <Button size="$3" backgroundColor={mode === 'text' ? communityUi.brand : communityUi.divider} onPress={() => setMode('text')}>
            Text
          </Button>
          <Button size="$3" backgroundColor={mode === 'image' ? communityUi.brand : communityUi.divider} onPress={() => setMode('image')}>
            Image
          </Button>
        </XStack>

        {mode === 'text' ? (
          <>
            <XStack gap={8} flexWrap="wrap">
              {BG_COLORS.map((color) => (
                <XStack
                  key={color}
                  width={32}
                  height={32}
                  borderRadius={999}
                  backgroundColor={color}
                  borderWidth={bgColor === color ? 3 : 0}
                  borderColor={communityUi.text}
                  cursor="pointer"
                  onPress={() => setBgColor(color)}
                />
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
            <Input value={mediaUrl} onChangeText={setMediaUrl} placeholder="Image URL" />
            {mediaUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <img src={mediaUrl} style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 12 }} />
            ) : null}
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