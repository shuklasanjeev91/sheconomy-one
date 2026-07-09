import { useRouter } from 'one'
import { useMemo, useState } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityShell } from '~/community/components/CommunityShell'
import { createGroup } from '~/community/lib/groups'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Button, Spinner, Text, ValidatedTextArea, ValidatedTextField, XStack, YStack, useAppToast } from '~/components/ui'
import { useFormValidation } from '~/hooks/useFormValidation'
import { communityRoutes } from '~/lib/routes'
import { maxLength, minLength, required } from '~/lib/validation'
import { useSupabase } from '~/providers/SupabaseProvider'

export function CreateGroupScreen() {
  const communityUi = useCommunityUi()
  const router = useRouter()
  const toast = useAppToast()
  const { user } = useSupabase()
  const [groupType, setGroupType] = useState<'public' | 'private'>('public')
  const [isSaving, setIsSaving] = useState(false)

  const form = useFormValidation(
    useMemo(
      () => ({
        name: {
          validators: [required('Internal name is required.'), minLength(2)],
        },
        title: {
          validators: [required('Display title is required.'), minLength(2)],
        },
        description: {
          validators: [maxLength(2000)],
        },
      }),
      [],
    ),
  )

  async function handleCreate() {
    if (!user) return
    if (!form.validateAll()) return

    setIsSaving(true)
    const { data, error } = await createGroup(user.id, {
      name: form.fields.name.value,
      title: form.fields.title.value,
      description: form.fields.description.value,
      groupType,
    })
    setIsSaving(false)
    if (error || !data) {
      toast.show('Could not create group', { tone: 'danger', message: error ?? 'Try again.' })
      return
    }
    router.replace(communityRoutes.group(data.id))
  }

  return (
    <CommunityShell wide>
      <CommunityCard padding={16} gap={16}>
        <Text fontSize={22} fontWeight="700" color={communityUi.text}>
          Create a group
        </Text>
        <ValidatedTextField label="Internal name" field={form.fields.name} required />
        <ValidatedTextField label="Display title" field={form.fields.title} required />
        <ValidatedTextArea
          label="Description"
          field={form.fields.description}
          minHeight={100}
          hint="Optional — up to 2,000 characters"
        />
        <XStack gap={8}>
          <Button size="$3" backgroundColor={groupType === 'public' ? communityUi.brand : communityUi.divider} onPress={() => setGroupType('public')}>
            Public
          </Button>
          <Button size="$3" backgroundColor={groupType === 'private' ? communityUi.brand : communityUi.divider} onPress={() => setGroupType('private')}>
            Private
          </Button>
        </XStack>
        <Button
          backgroundColor={communityUi.brand}
          color="white"
          borderRadius={999}
          disabled={isSaving || !form.isValid}
          onPress={handleCreate}
          icon={isSaving ? <Spinner size="small" color="white" /> : undefined}
        >
          Create group
        </Button>
      </CommunityCard>
    </CommunityShell>
  )
}