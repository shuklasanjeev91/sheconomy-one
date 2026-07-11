import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'one'

import { GifPicker } from '~/community/components/GifPicker'
import { CommunityCard } from '~/community/components/CommunityCard'
import { PostContentText } from '~/community/components/PostContentText'
import { createCommunityPost } from '~/community/lib/community'
import { fetchMyCompanies } from '~/community/lib/companies'
import { fetchMyGroups } from '~/community/lib/groups'
import { isGifUrl } from '~/community/lib/giphy'
import { useCommunityUi } from '~/community/lib/community-theme'
import {
  Avatar,
  Button,
  Field,
  Icons,
  Spinner,
  Text,
  TextArea,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { useFormValidation } from '~/hooks/useFormValidation'
import { useQueryParam } from '~/hooks/useQueryParams'
import { useProfile } from '~/hooks/useProfile'
import { communityRoutes, routes } from '~/lib/routes'
import { maxLength, optionalUrl } from '~/lib/validation'

const MAX_POST_LENGTH = 3000

type PostContext = 'profile' | 'company' | 'group'

type CreatePostFormProps = {
  onSuccess?: () => void
  initialGroupId?: string
  initialCompanyId?: string
}

export function CreatePostForm({ onSuccess, initialGroupId, initialCompanyId }: CreatePostFormProps) {
  const communityUi = useCommunityUi()
  const router = useRouter()
  const toast = useAppToast()
  const { profile, user, isAuthenticated } = useProfile()
  const form = useFormValidation(
    useMemo(
      () => ({
        content: { validators: [maxLength(MAX_POST_LENGTH)] },
        imageUrl: { validators: [optionalUrl()] },
      }),
      [],
    ),
  )
  const [isPosting, setIsPosting] = useState(false)
  const [gifOpen, setGifOpen] = useState(false)
  const [postContext, setPostContext] = useState<PostContext>('profile')
  const [companyId, setCompanyId] = useState<string | null>(initialCompanyId ?? null)
  const [groupId, setGroupId] = useState<string | null>(initialGroupId ?? null)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [groups, setGroups] = useState<{ id: string; title: string }[]>([])

  const displayName = profile?.full_name || profile?.username || 'You'
  const content = form.fields.content.value
  const imageUrl = form.fields.imageUrl.value
  const remaining = MAX_POST_LENGTH - content.length
  const isOverLimit = remaining < 0
  const contentError = form.fields.content.showError ? form.fields.content.error : null
  const canPost =
    (content.trim() || imageUrl.trim()) && !isOverLimit && form.fields.imageUrl.isValid

  const gifParam = useQueryParam('gif')
  const groupParam = useQueryParam('groupId')
  const companyParam = useQueryParam('companyId')

  useEffect(() => {
    if (gifParam) form.fields.imageUrl.setValue(decodeURIComponent(gifParam))
    if (groupParam) {
      setGroupId(groupParam)
      setPostContext('group')
    }
    if (companyParam) {
      setCompanyId(companyParam)
      setPostContext('company')
    }
  }, [companyParam, gifParam, groupParam])

  useEffect(() => {
    if (!user) return
    fetchMyCompanies(user.id).then((rows) => setCompanies(rows.map((c) => ({ id: c.id, name: c.name }))))
    fetchMyGroups(user.id).then((rows) => setGroups(rows.map((g) => ({ id: g.id, title: g.title }))))
  }, [user])

  if (!isAuthenticated || !user) {
    return (
      <CommunityCard padding={24} gap={16} alignItems="center">
        <Icons.User size={40} color={communityUi.brand} />
        <Text fontSize={18} fontWeight="600" color={communityUi.text} textAlign="center">
          Sign in to share with your network
        </Text>
        <Button backgroundColor={communityUi.brand} color="white" borderRadius={999} onPress={() => router.push(routes.signIn)}>
          Sign in
        </Button>
      </CommunityCard>
    )
  }

  async function handlePost() {
    if (!user || !canPost) return
    form.fields.content.touch()
    form.fields.imageUrl.touch()
    if (!form.validateAll()) return
    if (!content.trim() && !imageUrl.trim()) return

    setIsPosting(true)
    const { id, error } = await createCommunityPost(user.id, {
      content,
      imageUrl: imageUrl || null,
      companyId: postContext === 'company' ? companyId : null,
      groupId: postContext === 'group' ? groupId : null,
    })
    setIsPosting(false)

    if (error || !id) {
      toast.show('Could not post', { tone: 'danger', message: error ?? 'Try again shortly.' })
      return
    }

    toast.show('Posted', { tone: 'success', message: 'Your update is live.' })
    form.resetAll()
    onSuccess?.()
    router.replace(communityRoutes.home)
  }

  return (
    <>
      <CommunityCard gap={0}>
        <YStack padding={16} gap={12} borderBottomWidth={1} borderBottomColor={communityUi.borderLight}>
          <Text fontSize={18} fontWeight="600" color={communityUi.text}>
            Create a post
          </Text>
          <XStack gap={12} alignItems="center">
            <Avatar name={displayName} src={profile?.avatar_url ?? undefined} size="$4" />
            <YStack gap={4} flex={1}>
              <Text fontSize={14} fontWeight="600" color={communityUi.text}>
                {displayName}
              </Text>
              <XStack gap={8} flexWrap="wrap">
                <ContextChip label="Your profile" active={postContext === 'profile'} onPress={() => setPostContext('profile')} />
                {companies.length > 0 ? (
                  <ContextChip label="Page" active={postContext === 'company'} onPress={() => setPostContext('company')} />
                ) : null}
                {groups.length > 0 ? (
                  <ContextChip label="Group" active={postContext === 'group'} onPress={() => setPostContext('group')} />
                ) : null}
              </XStack>
            </YStack>
          </XStack>

          {postContext === 'company' && companies.length > 0 ? (
            <XStack gap={8} flexWrap="wrap">
              {companies.map((company) => (
                <ContextChip
                  key={company.id}
                  label={company.name}
                  active={companyId === company.id}
                  onPress={() => setCompanyId(company.id)}
                />
              ))}
            </XStack>
          ) : null}

          {postContext === 'group' && groups.length > 0 ? (
            <XStack gap={8} flexWrap="wrap">
              {groups.map((group) => (
                <ContextChip
                  key={group.id}
                  label={group.title}
                  active={groupId === group.id}
                  onPress={() => setGroupId(group.id)}
                />
              ))}
            </XStack>
          ) : null}
        </YStack>

        <YStack padding={16} gap={12}>
          <Field label="What's on your mind?" error={contentError ?? undefined}>
            <TextArea
              value={content}
              onChangeText={(value) => form.fields.content.onChange(value.slice(0, MAX_POST_LENGTH + 50))}
              onBlur={form.fields.content.onBlur}
              invalid={!!contentError}
              placeholder="What do you want to talk about?"
              minHeight={140}
              fontSize={16}
              lineHeight={24}
              borderWidth={0}
              backgroundColor="transparent"
              padding={0}
            />
          </Field>

          <XStack justifyContent="flex-end">
            <Text fontSize={12} color={isOverLimit ? '#cc1010' : communityUi.textMuted}>
              {remaining}
            </Text>
          </XStack>

          {content.trim() ? (
            <YStack padding={12} borderRadius={8} backgroundColor={communityUi.pageBg} gap={8}>
              <PostContentText content={content} collapsible={false} />
            </YStack>
          ) : null}

          {imageUrl ? (
            <YStack borderRadius={8} overflow="hidden" backgroundColor={communityUi.pageBg}>
              {isGifUrl(imageUrl) ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <img src={imageUrl} style={{ width: '100%', maxHeight: 280, objectFit: 'contain' }} />
              ) : null}
            </YStack>
          ) : null}
        </YStack>

        <XStack
          padding={16}
          borderTopWidth={1}
          borderTopColor={communityUi.borderLight}
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
          gap={12}
        >
          <XStack gap={16} alignItems="center">
            <XStack gap={6} alignItems="center" cursor="pointer" onPress={() => setGifOpen(true)}>
              <Icons.Film size={20} color="#7fc15e" />
            </XStack>
          </XStack>
          <Button
            backgroundColor={canPost ? communityUi.brand : communityUi.border}
            color={canPost ? 'white' : communityUi.textMuted}
            borderRadius={999}
            paddingHorizontal="$5"
            disabled={!canPost || isPosting}
            onPress={handlePost}
            icon={isPosting ? <Spinner size="small" color="white" /> : undefined}
          >
            {isPosting ? 'Posting…' : 'Post'}
          </Button>
        </XStack>
      </CommunityCard>

      <GifPicker open={gifOpen} onOpenChange={setGifOpen} onSelect={form.fields.imageUrl.setValue} />
    </>
  )
}

function ContextChip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  const communityUi = useCommunityUi()
  return (
    <XStack
      paddingHorizontal={10}
      paddingVertical={5}
      borderRadius={999}
      borderWidth={1}
      borderColor={active ? communityUi.brand : communityUi.border}
      backgroundColor={active ? 'rgba(10,102,194,0.08)' : communityUi.cardBg}
      cursor="pointer"
      onPress={onPress}
    >
      <Text fontSize={12} fontWeight="600" color={active ? communityUi.brand : communityUi.textMuted}>
        {label}
      </Text>
    </XStack>
  )
}