import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AdaptiveTypeaheadPanel } from '~/components/search/AdaptiveTypeaheadPanel'
import { SuggestSectionHeader } from '~/components/search/SuggestSectionHeader'
import { Avatar, Button, Icons, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
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
  const [searchFocused, setSearchFocused] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const blurCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Desktop: keep the anchored dropdown tied to input focus + results.
  // Mobile: the bottom sheet owns open/close — opening it blurs the field, so
  // we must not auto-close on blur (that caused open→close flicker).
  useEffect(() => {
    if (!isDesktop) return
    if (!searchFocused) {
      setPanelOpen(false)
      return
    }
    setPanelOpen(true)
  }, [isDesktop, searchFocused])

  useEffect(() => {
    return () => {
      if (blurCloseRef.current) clearTimeout(blurCloseRef.current)
    }
  }, [])

  function handleSearchFocus() {
    if (blurCloseRef.current) clearTimeout(blurCloseRef.current)
    setSearchFocused(true)
    setPanelOpen(true)
  }

  function handleSearchBlur() {
    setSearchFocused(false)
    // Mobile sheet stays open until the user dismisses it or picks people.
    if (!isDesktop) return
    blurCloseRef.current = setTimeout(() => setPanelOpen(false), 180)
  }

  function handlePanelOpenChange(open: boolean) {
    setPanelOpen(open)
    if (!open) setSearchFocused(false)
  }

  function handleQueryChange(next: string) {
    setQuery(next)
    if (!panelOpen) setPanelOpen(true)
  }

  function toggleCandidate(candidate: MeetingInviteCandidate) {
    const invitee = candidateToInvitee(candidate)
    const key = inviteeKey(invitee)
    onChange(
      selectedKeys.has(key)
        ? value.filter((item) => inviteeKey(item) !== key)
        : mergeInvitees(value, [invitee]),
    )
  }

  function addEmailInvite() {
    if (!isValidInviteEmail(emailDraft)) {
      toast.show('Enter a valid email address', { tone: 'error' })
      return
    }
    onChange(mergeInvitees(value, [emailToInvitee(emailDraft)]))
    setEmailDraft('')
  }

  function removeInvitee(invitee: MeetingInvitee) {
    const key = inviteeKey(invitee)
    onChange(value.filter((item) => inviteeKey(item) !== key))
  }

  return (
    <YStack gap={compact ? '$3' : '$4'}>
      <YStack gap="$2">
        <CoWorkSectionLabel>Add by email</CoWorkSectionLabel>
        <XStack gap="$2">
          <Input
            flex={1}
            value={emailDraft}
            onChangeText={setEmailDraft}
            placeholder="name@company.com"
            autoCapitalize="none"
            keyboardType="email-address"
            backgroundColor="rgba(255,255,255,0.05)"
            borderColor={coworkUi.borderSoft}
            color={coworkUi.text}
            borderRadius={14}
            onSubmitEditing={addEmailInvite}
          />
          <Button tone="outline" borderRadius={14} onPress={addEmailInvite}>
            Add
          </Button>
        </XStack>
      </YStack>

      <YStack gap="$2" position="relative" zIndex={panelOpen && isDesktop ? 600 : undefined}>
        <CoWorkSectionLabel>Search members & connections</CoWorkSectionLabel>
        <Input
          value={query}
          onChangeText={handleQueryChange}
          placeholder="Name, username, or email"
          backgroundColor="rgba(255,255,255,0.05)"
          borderColor={coworkUi.borderSoft}
          color={coworkUi.text}
          borderRadius={14}
          onFocus={handleSearchFocus}
          onBlur={handleSearchBlur}
        />
        {loading && !panelOpen ? <Spinner size="small" color={coworkUi.brand} /> : null}

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
                <Spinner size="small" color={coworkUi.brand} />
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
                  backgroundColor={active ? coworkUi.brandMuted : 'rgba(255,255,255,0.04)'}
                  onPress={() => toggleCandidate(candidate)}
                  cursor="pointer"
                  pressStyle={{ opacity: 0.9 }}
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

      {value.length > 0 ? (
        <YStack gap="$2">
          <CoWorkSectionLabel>Selected ({value.length})</CoWorkSectionLabel>
          <XStack gap="$2" flexWrap="wrap">
            {value.map((invitee) => (
              <XStack
                key={inviteeKey(invitee)}
                alignItems="center"
                gap={6}
                paddingHorizontal="$2"
                paddingVertical={6}
                borderRadius={999}
                backgroundColor={coworkUi.brandMuted}
                borderWidth={1}
                borderColor={coworkUi.borderAccent}
              >
                {invitee.type === 'user' ? (
                  <Avatar name={invitee.name} src={invitee.avatar ?? undefined} size="$1" />
                ) : (
                  <Icons.Mail size={14} color={coworkUi.brandLight} />
                )}
                <Text fontSize={12} color={coworkUi.text} maxWidth={140} numberOfLines={1}>
                  {formatInviteeLabel(invitee)}
                </Text>
                <Button
                  tone="ghost"
                  size="$1"
                  padding={0}
                  width={22}
                  height={22}
                  borderRadius={999}
                  onPress={() => removeInvitee(invitee)}
                  icon={<Icons.X size={12} color={coworkUi.textMuted} />}
                />
              </XStack>
            ))}
          </XStack>
        </YStack>
      ) : null}
    </YStack>
  )
}