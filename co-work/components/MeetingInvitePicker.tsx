import { useCallback, useEffect, useMemo, useState } from 'react'
import { TextInput } from 'react-native'

import { AdaptiveTypeaheadPanel } from '~/components/search/AdaptiveTypeaheadPanel'
import { SuggestSectionHeader } from '~/components/search/SuggestSectionHeader'
import { Avatar, Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { CoWorkSectionLabel } from '~/co-work/components/CoWorkUi'
import {
  candidateToInvitee,
  emailToInvitee,
  formatInviteeLabel,
  inviteeKey,
  isValidInviteEmail,
  mergeInvitees,
  searchInviteCandidates,
} from '~/co-work/lib/invites'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import type { MeetingInviteCandidate, MeetingInvitee } from '~/co-work/lib/types'
import { useAppLayout } from '~/hooks/useAppLayout'

type MeetingInvitePickerProps = {
  hostId: string
  value: MeetingInvitee[]
  onChange: (invitees: MeetingInvitee[]) => void
  compact?: boolean
}

export function MeetingInvitePicker({ hostId, value, onChange, compact }: MeetingInvitePickerProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const toast = useAppToast()
  const { isDesktop } = useAppLayout()
  const [query, setQuery] = useState('')
  const [emailDraft, setEmailDraft] = useState('')
  const [candidates, setCandidates] = useState<MeetingInviteCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)

  const selectedKeys = useMemo(() => new Set(value.map(inviteeKey)), [value])

  const loadCandidates = useCallback(async () => {
    setLoading(true)
    try {
      setCandidates(await searchInviteCandidates(hostId, query))
    } catch (searchError) {
      toast.show('Could not search members', {
        tone: 'error',
        message: searchError instanceof Error ? searchError.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [hostId, query, toast])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCandidates()
    }, 250)
    return () => clearTimeout(timer)
  }, [loadCandidates])

  // --- Panel open/close logic (unchanged) ---
  function handleSearchFocus() {
    setPanelOpen(true)
  }

  function handleSearchBlur() {
    // no-op: panel closes via AdaptiveTypeaheadPanel dismiss
  }

  function handlePanelOpenChange(open: boolean) {
    setPanelOpen(open)
  }

  function handleQueryChange(next: string) {
    setQuery(next)
    if (!panelOpen) setPanelOpen(true)
  }

  // --- Selection handlers ---
  function toggleCandidate(candidate: MeetingInviteCandidate) {
    const invitee = candidateToInvitee(candidate)
    const key = inviteeKey(invitee)
    onChange(
      selectedKeys.has(key)
        ? value.filter((item) => inviteeKey(item) !== key)
        : mergeInvitees(value, [invitee])
    )
    // 🔁 Reset search field so user can search for another name immediately
    setQuery('')
    setCandidates([]) // clear the old results
    // Panel stays open – they can start typing again
  }

  function removeInvitee(invitee: MeetingInvitee) {
    const key = inviteeKey(invitee)
    onChange(value.filter((item) => inviteeKey(item) !== key))
  }

  function addEmailInvite() {
    if (!isValidInviteEmail(emailDraft)) {
      toast.show('Enter a valid email address', { tone: 'error' })
      return
    }
    onChange(mergeInvitees(value, [emailToInvitee(emailDraft)]))
    setEmailDraft('') // already resets, just confirming
  }

  return (
    <YStack gap={compact ? '$3' : '$4'}>
      {/* Email input (unchanged) */}
      <YStack gap="$2">
        <CoWorkSectionLabel>Add by email</CoWorkSectionLabel>
        <XStack gap="$2">
          <XStack
            flex={1}
            backgroundColor={coworkUi.surfaceMuted}
            borderColor={coworkUi.borderSoft}
            borderWidth={1}
            borderRadius={14}
            padding="$3"
          >
            <TextInput
              style={{ flex: 1, color: coworkUi.text, fontSize: 14 }}
              value={emailDraft}
              onChangeText={setEmailDraft}
              placeholder="name@company.com"
              placeholderTextColor={coworkUi.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              onSubmitEditing={addEmailInvite}
            />
          </XStack>
          <Button tone="outline" borderRadius={14} onPress={addEmailInvite}>
            Add
          </Button>
        </XStack>
      </YStack>

      {/* Search members with inline badges */}
      <YStack gap="$2" position="relative" zIndex={panelOpen && isDesktop ? 600 : undefined}>
        <CoWorkSectionLabel>Search members & connections</CoWorkSectionLabel>

        <XStack
          flexWrap="wrap"
          alignItems="center"
          gap="$2"
          backgroundColor={coworkUi.surfaceMuted}
          borderColor={coworkUi.borderSoft}
          borderWidth={1}
          borderRadius={14}
          padding="$3"
          minHeight={48}
        >
          {/* Render selected invitees as badges */}
          {value.map((invitee) => (
            <XStack
              key={inviteeKey(invitee)}
              alignItems="center"
              gap={4}
              backgroundColor={coworkUi.brandMuted}
              borderWidth={1}
              borderColor={coworkUi.borderAccent}
              borderRadius={999}
              paddingHorizontal="$2"
              paddingVertical={4}
            >
              {invitee.type === 'user' ? (
                <Avatar name={invitee.name} src={invitee.avatar ?? undefined} size="$1" />
              ) : (
                <Icons.Mail size={12} color={coworkUi.brandLight} />
              )}
              <Text fontSize={12} color={coworkUi.text} maxWidth={100} numberOfLines={1}>
                {formatInviteeLabel(invitee)}
              </Text>
              <Button
                tone="ghost"
                size="$1"
                padding={0}
                width={18}
                height={18}
                borderRadius={999}
                onPress={() => removeInvitee(invitee)}
                icon={<Icons.X size={10} color={coworkUi.textMuted} />}
              />
            </XStack>
          ))}

          {/* The actual search text field – grows to fill remaining space */}
          <TextInput
            style={{
              flex: 1,
              minWidth: 100,
              color: coworkUi.text,
              fontSize: 14,
              paddingVertical: 0,
            }}
            value={query}
            onChangeText={handleQueryChange}
            placeholder={value.length > 0 ? 'Add more...' : 'Name, username, or email'}
            placeholderTextColor={coworkUi.textMuted}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
          />
        </XStack>

        {loading && !panelOpen ? <Spinner size="small" color={coworkUi.brandLight} /> : null}

        <AdaptiveTypeaheadPanel
          open={panelOpen}
          onOpenChange={handlePanelOpenChange}
          title="Invite people"
          maxHeight={480}
          zIndex={600}
          searchValue={query}
          onSearchChange={handleQueryChange}
          searchPlaceholder="Search members"
        >
          <YStack gap="$1" width="100%" paddingBottom="$2" paddingTop="$2">
            <SuggestSectionHeader label="PEOPLE" />
            {loading && candidates.length === 0 ? (
              <YStack padding="$4" alignItems="center">
                <Spinner size="small" color={coworkUi.brandLight} />
              </YStack>
            ) : null}
            {candidates.map((candidate) => {
              const active = selectedKeys.has(inviteeKey(candidateToInvitee(candidate)))
              return (
                <XStack
                  key={candidate.user_id}
                  alignItems="center"
                  gap="$3"
                  padding="$3"
                  borderRadius={14}
                  borderWidth={1}
                  borderColor={active ? coworkUi.borderAccent : coworkUi.borderSoft}
                  backgroundColor={active ? coworkUi.brandMuted : coworkUi.surfaceMuted}
                  onPress={() => toggleCandidate(candidate)}
                  cursor="pointer"
                  pressStyle={{ opacity: 0.9 }}
                  userSelect="none"
                  pressable
                >
                  <Avatar name={candidate.full_name} src={candidate.avatar_url ?? undefined} size="$3" />
                  <YStack flex={1} gap={2}>
                    <Text fontWeight="700" color={coworkUi.text} numberOfLines={1}>
                      {candidate.full_name}
                    </Text>
                    <Text fontSize={12} color={coworkUi.textMuted} numberOfLines={1}>
                      {candidate.headline || candidate.username || candidate.email || candidate.source}
                    </Text>
                  </YStack>
                  {active ? <Icons.Check size={18} color={coworkUi.brandLight} /> : null}
                </XStack>
              )
            })}
            {!loading && candidates.length === 0 ? (
              <Text paddingHorizontal="$3" paddingVertical="$2" fontSize={13} color={coworkUi.textMuted}>
                No members match your search.
              </Text>
            ) : null}
          </YStack>
        </AdaptiveTypeaheadPanel>
      </YStack>
    </YStack>
  )
}