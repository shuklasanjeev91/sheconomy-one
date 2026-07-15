import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

import type { ProfileDisplay } from '~/community/components/profile/types'
import { endorseSkill, hasEndorsedSkill } from '~/community/lib/endorsements'
import type { ProfileDetails, ProfileEducation, ProfileExperience, ProfileLanguage, ProfileSkill } from '~/community/lib/profile-details'
import {
  formatDurationMonths,
  formatEducationYearRange,
  formatExperienceDateRange,
  parseSkillTags,
} from '~/community/lib/profile-format'
import {
  EMPTY_EDUCATION_INPUT,
  EMPTY_EXPERIENCE_INPUT,
  EMPTY_LANGUAGE_INPUT,
  EMPTY_SKILL_INPUT,
  EMPLOYMENT_TYPE_OPTIONS,
  LANGUAGE_PROFICIENCY_OPTIONS,
  LOCATION_TYPE_OPTIONS,
  SKILL_PROFICIENCY_OPTIONS,
  createEducation,
  createExperience,
  createLanguage,
  createSkill,
  deleteEducation,
  deleteExperience,
  deleteLanguage,
  deleteSkill,
  educationInputFromRow,
  experienceInputFromRow,
  languageInputFromRow,
  parseInterestsInput,
  skillInputFromRow,
  updateEducation,
  updateExperience,
  updateLanguage,
  updateProfileAbout,
  updateProfileInterests,
  updateSkill,
  type AboutInput,
  type EducationInput,
  type ExperienceInput,
  type LanguageInput,
  type SkillInput,
} from '~/community/lib/profile-sections'
import { BRAND_BLUE } from '~/community/lib/constants'
import {
  AppBottomSheet,
  Button,
  Field,
  Icons,
  Image,
  Input,
  Paragraph,
  Separator,
  Switch,
  Text,
  TextArea,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { LocationPickerField } from '~/components/geo'
import { MonthYearField } from '~/components/forms/MonthYearField'
import { SearchSelectField } from '~/components/forms/SearchSelectField'
import { suggestCompanyNames } from '~/community/lib/companies'
import { INDUSTRY_OPTIONS } from '~/lib/datasets/industries'
import { JOB_TITLE_OPTIONS } from '~/lib/datasets/job-titles'
import { getShadowStyle, radius } from '~/config/tokens'
import { refreshProfiles } from '~/lib/profile/refresh'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

type SheetKind = 'about' | 'experience' | 'education' | 'skill' | 'language' | 'interests'

type ProfileBackgroundSectionsProps = {
  profile: ProfileDisplay
  details: ProfileDetails | null
  interests: string[]
  isOwnProfile: boolean
  onRefresh: () => void
}

export function ProfileBackgroundSections({
  profile,
  details,
  interests,
  isOwnProfile,
  onRefresh,
}: ProfileBackgroundSectionsProps) {
  const toast = useAppToast()
  const [sheetKind, setSheetKind] = useState<SheetKind | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [experienceForm, setExperienceForm] = useState<ExperienceInput>(EMPTY_EXPERIENCE_INPUT)
  const [educationForm, setEducationForm] = useState<EducationInput>(EMPTY_EDUCATION_INPUT)
  const [skillForm, setSkillForm] = useState<SkillInput>(EMPTY_SKILL_INPUT)
  const [languageForm, setLanguageForm] = useState<LanguageInput>(EMPTY_LANGUAGE_INPUT)
  const [aboutForm, setAboutForm] = useState<AboutInput>({})
  const [interestsForm, setInterestsForm] = useState('')

  function closeSheet() {
    setSheetKind(null)
    setEditingId(null)
    setIsSaving(false)
  }

  function openAbout() {
    setAboutForm({
      full_name: profile.full_name ?? '',
      headline: profile.headline ?? '',
      bio: profile.bio ?? '',
      occupation: profile.occupation ?? '',
      industry: profile.industry ?? '',
      business_name: profile.business_name ?? '',
      location: profile.location ?? '',
    })
    setEditingId(null)
    setSheetKind('about')
  }

  function openExperience(row?: ProfileExperience) {
    setExperienceForm(row ? experienceInputFromRow(row) : EMPTY_EXPERIENCE_INPUT)
    setEditingId(row?.id ?? null)
    setSheetKind('experience')
  }

  function openEducation(row?: ProfileEducation) {
    setEducationForm(row ? educationInputFromRow(row) : EMPTY_EDUCATION_INPUT)
    setEditingId(row?.id ?? null)
    setSheetKind('education')
  }

  function openSkill(row?: ProfileSkill) {
    setSkillForm(row ? skillInputFromRow(row) : EMPTY_SKILL_INPUT)
    setEditingId(row?.id ?? null)
    setSheetKind('skill')
  }

  function openLanguage(row?: ProfileLanguage) {
    setLanguageForm(row ? languageInputFromRow(row) : EMPTY_LANGUAGE_INPUT)
    setEditingId(row?.id ?? null)
    setSheetKind('language')
  }

  function openInterests() {
    setInterestsForm(interests.join(', '))
    setEditingId(null)
    setSheetKind('interests')
  }

  async function handleSave() {
    if (!profile.id) return
    setIsSaving(true)

    let error: string | null = null

    if (sheetKind === 'about') {
      ;({ error } = await updateProfileAbout(profile.id, aboutForm))
      if (!error) refreshProfiles()
    } else if (sheetKind === 'experience') {
      ;({ error } = editingId
        ? await updateExperience(profile.id, editingId, experienceForm)
        : await createExperience(profile.id, experienceForm))
    } else if (sheetKind === 'education') {
      ;({ error } = editingId
        ? await updateEducation(profile.id, editingId, educationForm)
        : await createEducation(profile.id, educationForm))
    } else if (sheetKind === 'skill') {
      ;({ error } = editingId
        ? await updateSkill(profile.id, editingId, skillForm)
        : await createSkill(profile.id, skillForm))
    } else if (sheetKind === 'language') {
      ;({ error } = editingId
        ? await updateLanguage(profile.id, editingId, languageForm)
        : await createLanguage(profile.id, languageForm))
    } else if (sheetKind === 'interests') {
      ;({ error } = await updateProfileInterests(profile.id, parseInterestsInput(interestsForm)))
      if (!error) refreshProfiles()
    }

    setIsSaving(false)

    if (error) {
      toast.show('Could not save', { tone: 'danger', message: error })
      return
    }

    toast.show(editingId ? 'Updated' : 'Added', { tone: 'success' })
    closeSheet()
    onRefresh()
  }

  async function handleDelete() {
    if (!profile.id || !editingId || !sheetKind) return
    if (sheetKind === 'about' || sheetKind === 'interests') return

    setIsSaving(true)
    let error: string | null = null

    if (sheetKind === 'experience') {
      ;({ error } = await deleteExperience(profile.id, editingId))
    } else if (sheetKind === 'education') {
      ;({ error } = await deleteEducation(profile.id, editingId))
    } else if (sheetKind === 'skill') {
      ;({ error } = await deleteSkill(profile.id, editingId))
    } else if (sheetKind === 'language') {
      ;({ error } = await deleteLanguage(profile.id, editingId))
    }

    setIsSaving(false)

    if (error) {
      toast.show('Could not delete', { tone: 'danger', message: error })
      return
    }

    toast.show('Removed', { tone: 'success' })
    closeSheet()
    onRefresh()
  }

  const sheetTitle =
    sheetKind === 'about'
      ? 'About'
      : sheetKind === 'experience'
        ? editingId
          ? 'Edit experience'
          : 'Add experience'
        : sheetKind === 'education'
          ? editingId
            ? 'Edit education'
            : 'Add education'
          : sheetKind === 'skill'
            ? editingId
              ? 'Edit skill'
              : 'Add skill'
            : sheetKind === 'language'
              ? editingId
                ? 'Edit language'
                : 'Add language'
              : sheetKind === 'interests'
                ? 'Interests'
                : ''

  const canDelete =
    editingId != null &&
    sheetKind != null &&
    sheetKind !== 'about' &&
    sheetKind !== 'interests'

  return (
    <>
      <AboutSection profile={profile} isOwnProfile={isOwnProfile} onEdit={openAbout} />
      <ExperienceSection
        items={details?.experiences ?? []}
        isOwnProfile={isOwnProfile}
        onAdd={() => openExperience()}
        onEdit={openExperience}
      />
      <EducationSection
        items={details?.education ?? []}
        isOwnProfile={isOwnProfile}
        onAdd={() => openEducation()}
        onEdit={openEducation}
      />
      <SkillsSection
        items={details?.skills ?? []}
        isOwnProfile={isOwnProfile}
        profileOwnerId={profile.id}
        onAdd={() => openSkill()}
        onEdit={openSkill}
        onRefresh={onRefresh}
      />
      <LanguagesSection
        items={details?.languages ?? []}
        isOwnProfile={isOwnProfile}
        onAdd={() => openLanguage()}
        onEdit={openLanguage}
      />
      <InterestsSection
        items={interests}
        isOwnProfile={isOwnProfile}
        onEdit={openInterests}
      />

      <AppBottomSheet
        open={sheetKind != null}
        onOpenChange={(open) => {
          if (!open) closeSheet()
        }}
        title={sheetTitle}
        footer={
          <SheetFooter
            canDelete={canDelete}
            isSaving={isSaving}
            onCancel={closeSheet}
            onDelete={handleDelete}
            onSave={handleSave}
            saveLabel={editingId ? 'Save' : 'Add'}
          />
        }
      >
        {sheetKind === 'about' ? (
          <AboutForm value={aboutForm} onChange={setAboutForm} />
        ) : sheetKind === 'experience' ? (
          <ExperienceForm value={experienceForm} onChange={setExperienceForm} />
        ) : sheetKind === 'education' ? (
          <EducationForm value={educationForm} onChange={setEducationForm} />
        ) : sheetKind === 'skill' ? (
          <SkillForm value={skillForm} onChange={setSkillForm} />
        ) : sheetKind === 'language' ? (
          <LanguageForm value={languageForm} onChange={setLanguageForm} />
        ) : sheetKind === 'interests' ? (
          <InterestsForm value={interestsForm} onChange={setInterestsForm} />
        ) : null}
      </AppBottomSheet>
    </>
  )
}

function SheetFooter({
  canDelete,
  isSaving,
  onCancel,
  onDelete,
  onSave,
  saveLabel,
}: {
  canDelete: boolean
  isSaving: boolean
  onCancel: () => void
  onDelete: () => void
  onSave: () => void
  saveLabel: string
}) {
  return (
    <XStack
      gap="$2"
      paddingHorizontal="$4"
      paddingVertical="$3"
      borderTopWidth={1}
      borderTopColor="$borderColor"
      justifyContent="space-between"
      flexWrap="wrap"
    >
      {canDelete ? (
        <Button tone="destructive" size="$3" disabled={isSaving} onPress={onDelete}>
          Delete
        </Button>
      ) : (
        <YStack />
      )}
      <XStack gap="$2" marginLeft="auto">
        <Button tone="outline" size="$3" disabled={isSaving} onPress={onCancel}>
          Cancel
        </Button>
        <Button tone="primary" size="$3" disabled={isSaving} onPress={onSave}>
          {isSaving ? 'Saving…' : saveLabel}
        </Button>
      </XStack>
    </XStack>
  )
}

function AboutSection({
  profile,
  isOwnProfile,
  onEdit,
}: {
  profile: ProfileDisplay
  isOwnProfile: boolean
  onEdit: () => void
}) {
  const ui = useAppUi()
  const hasContent =
    profile.bio || profile.occupation || profile.business_name || profile.industry || profile.headline

  if (!hasContent && !isOwnProfile) return null

  return (
    <SectionCard
      title="About"
      icon={Icons.User}
      isOwnProfile={isOwnProfile}
      onAdd={onEdit}
      emptyMessage={
        isOwnProfile ? 'Write a short summary about your background, mission, or business.' : undefined
      }
      emptyAction={
        isOwnProfile ? (
          <Text fontSize={14} fontWeight="600" color={BRAND_BLUE} cursor="pointer" onPress={onEdit}>
            Add about section
          </Text>
        ) : undefined
      }
    >
      {hasContent ? (
        <YStack gap="$2">
          {profile.headline ? (
            <Text fontSize={15} fontWeight="600" color={ui.text}>
              {profile.headline}
            </Text>
          ) : null}
          {profile.business_name ? (
            <Text fontSize={16} fontWeight="700" color={ui.text}>
              {profile.business_name}
            </Text>
          ) : null}
          {profile.occupation ? (
            <Text fontSize={15} color={ui.textSecondary} fontWeight="500">
              {profile.occupation}
            </Text>
          ) : null}
          {profile.industry ? (
            <Text fontSize={14} color={ui.textMuted}>
              {profile.industry}
            </Text>
          ) : null}
          {profile.bio ? (
            <Paragraph fontSize={15} color={ui.text} lineHeight={24} whiteSpace="pre-wrap">
              {profile.bio}
            </Paragraph>
          ) : null}
          {isOwnProfile ? (
            <Text
              fontSize={14}
              fontWeight="600"
              color={BRAND_BLUE}
              cursor="pointer"
              marginTop="$1"
              onPress={onEdit}
            >
              Edit about
            </Text>
          ) : null}
        </YStack>
      ) : null}
    </SectionCard>
  )
}

function ExperienceSection({
  items,
  isOwnProfile,
  onAdd,
  onEdit,
}: {
  items: ProfileExperience[]
  isOwnProfile: boolean
  onAdd: () => void
  onEdit: (row: ProfileExperience) => void
}) {
  if (items.length === 0 && !isOwnProfile) return null

  return (
    <SectionCard
      title="Experience"
      icon={Icons.Briefcase}
      isOwnProfile={isOwnProfile}
      onAdd={onAdd}
      emptyMessage={
        isOwnProfile ? 'Share your work history so others can learn about your career.' : undefined
      }
      emptyAction={
        isOwnProfile ? (
          <Text fontSize={14} fontWeight="600" color={BRAND_BLUE} cursor="pointer" onPress={onAdd}>
            Add experience
          </Text>
        ) : undefined
      }
    >
      {items.length > 0 ? (
        <YStack gap="$0">
          {items.map((item, index) => (
            <YStack key={item.id}>
              <ExperienceRow item={item} isOwnProfile={isOwnProfile} onEdit={() => onEdit(item)} />
              {index < items.length - 1 ? <Separator marginVertical="$4" /> : null}
            </YStack>
          ))}
        </YStack>
      ) : null}
    </SectionCard>
  )
}

function ExperienceRow({
  item,
  isOwnProfile,
  onEdit,
}: {
  item: ProfileExperience
  isOwnProfile: boolean
  onEdit: () => void
}) {
  const ui = useAppUi()
  const dateRange = formatExperienceDateRange(item.start_date, item.end_date, item.is_current)
  const duration = formatDurationMonths(item.start_date, item.end_date, item.is_current)
  const skillTags = parseSkillTags(item.skills)

  return (
    <XStack gap="$3" alignItems="flex-start">
      <OrgAvatar name={item.company_name || 'Company'} />
      <YStack flex={1} gap="$1.5" minWidth={0}>
        <XStack justifyContent="space-between" alignItems="flex-start" gap="$2">
          <YStack flex={1} gap="$1.5" minWidth={0}>
            <Text fontSize={16} fontWeight="700" color={ui.text}>
              {item.title || 'Role'}
            </Text>
            <Text fontSize={15} color={ui.text} fontWeight="500">
              {item.company_name || 'Company'}
              {item.employment_type ? ` · ${item.employment_type}` : ''}
            </Text>
          </YStack>
          {isOwnProfile ? <RowActions onEdit={onEdit} /> : null}
        </XStack>
        {dateRange ? (
          <Text fontSize={13} color={ui.textMuted}>
            {dateRange}
            {duration ? ` · ${duration}` : ''}
          </Text>
        ) : null}
        {item.location ? (
          <XStack gap={4} alignItems="center">
            <Icons.MapPin size={13} color={ui.textMuted} />
            <Text fontSize={13} color={ui.textMuted}>
              {item.location}
              {item.location_type ? ` (${item.location_type})` : ''}
            </Text>
          </XStack>
        ) : null}
        {item.description ? (
          <Paragraph fontSize={14} color={ui.textSecondary} lineHeight={22} marginTop="$1">
            {item.description}
          </Paragraph>
        ) : null}
        {skillTags.length > 0 ? (
          <XStack gap="$2" flexWrap="wrap" marginTop="$2">
            {skillTags.map((tag) => (
              <SkillChip key={tag} label={tag} />
            ))}
          </XStack>
        ) : null}
      </YStack>
    </XStack>
  )
}

function EducationSection({
  items,
  isOwnProfile,
  onAdd,
  onEdit,
}: {
  items: ProfileEducation[]
  isOwnProfile: boolean
  onAdd: () => void
  onEdit: (row: ProfileEducation) => void
}) {
  if (items.length === 0 && !isOwnProfile) return null

  return (
    <SectionCard
      title="Education"
      icon={Icons.GraduationCap}
      isOwnProfile={isOwnProfile}
      onAdd={onAdd}
      emptyMessage={isOwnProfile ? 'Add schools, degrees, and fields of study.' : undefined}
      emptyAction={
        isOwnProfile ? (
          <Text fontSize={14} fontWeight="600" color={BRAND_BLUE} cursor="pointer" onPress={onAdd}>
            Add education
          </Text>
        ) : undefined
      }
    >
      {items.length > 0 ? (
        <YStack gap="$0">
          {items.map((item, index) => (
            <YStack key={item.id}>
              <EducationRow item={item} isOwnProfile={isOwnProfile} onEdit={() => onEdit(item)} />
              {index < items.length - 1 ? <Separator marginVertical="$4" /> : null}
            </YStack>
          ))}
        </YStack>
      ) : null}
    </SectionCard>
  )
}

function EducationRow({
  item,
  isOwnProfile,
  onEdit,
}: {
  item: ProfileEducation
  isOwnProfile: boolean
  onEdit: () => void
}) {
  const ui = useAppUi()
  const dateRange = formatEducationYearRange(item.start_year, item.end_year)
  const subtitle = [item.degree, item.field_of_study].filter(Boolean).join(', ')
  const skillTags = parseSkillTags(item.skills)

  return (
    <XStack gap="$3" alignItems="flex-start">
      {item.school_logo_url ? (
        <YStack
          width={48}
          height={48}
          borderRadius={radius.chip}
          overflow="hidden"
          backgroundColor={ui.surfaceMuted}
        >
          <Image src={item.school_logo_url} width={48} height={48} objectFit="cover" alt="" />
        </YStack>
      ) : (
        <OrgAvatar name={item.school} />
      )}
      <YStack flex={1} gap="$1.5" minWidth={0}>
        <XStack justifyContent="space-between" alignItems="flex-start" gap="$2">
          <YStack flex={1} gap="$1.5" minWidth={0}>
            <Text fontSize={16} fontWeight="700" color={ui.text}>
              {item.school}
            </Text>
            {subtitle ? (
              <Text fontSize={15} color={ui.text} fontWeight="500">
                {subtitle}
              </Text>
            ) : null}
          </YStack>
          {isOwnProfile ? <RowActions onEdit={onEdit} /> : null}
        </XStack>
        {dateRange ? (
          <Text fontSize={13} color={ui.textMuted}>
            {dateRange}
          </Text>
        ) : null}
        {item.grade ? (
          <Text fontSize={13} color={ui.textMuted}>
            Grade: {item.grade}
          </Text>
        ) : null}
        {item.activities ? (
          <Text fontSize={14} color={ui.textSecondary} lineHeight={20}>
            {item.activities}
          </Text>
        ) : null}
        {item.description ? (
          <Paragraph fontSize={14} color={ui.textSecondary} lineHeight={22}>
            {item.description}
          </Paragraph>
        ) : null}
        {skillTags.length > 0 ? (
          <XStack gap="$2" flexWrap="wrap" marginTop="$2">
            {skillTags.map((tag) => (
              <SkillChip key={tag} label={tag} />
            ))}
          </XStack>
        ) : null}
      </YStack>
    </XStack>
  )
}

function SkillsSection({
  items,
  isOwnProfile,
  profileOwnerId,
  onAdd,
  onEdit,
  onRefresh,
}: {
  items: ProfileSkill[]
  isOwnProfile: boolean
  profileOwnerId: string
  onAdd: () => void
  onEdit: (row: ProfileSkill) => void
  onRefresh: () => void
}) {
  if (items.length === 0 && !isOwnProfile) return null

  return (
    <SectionCard
      title="Skills"
      icon={Icons.Sparkles}
      isOwnProfile={isOwnProfile}
      onAdd={onAdd}
      emptyMessage={isOwnProfile ? 'Highlight skills you want to be known for.' : undefined}
      emptyAction={
        isOwnProfile ? (
          <Text fontSize={14} fontWeight="600" color={BRAND_BLUE} cursor="pointer" onPress={onAdd}>
            Add skills
          </Text>
        ) : undefined
      }
    >
      {items.length > 0 ? (
        <YStack gap="$3">
          {items.map((skill) => (
            <SkillRow
              key={skill.id}
              skill={skill}
              isOwnProfile={isOwnProfile}
              profileOwnerId={profileOwnerId}
              onEdit={() => onEdit(skill)}
              onRefresh={onRefresh}
            />
          ))}
        </YStack>
      ) : null}
    </SectionCard>
  )
}

function SkillRow({
  skill,
  isOwnProfile,
  profileOwnerId,
  onEdit,
  onRefresh,
}: {
  skill: ProfileSkill
  isOwnProfile: boolean
  profileOwnerId: string
  onEdit: () => void
  onRefresh: () => void
}) {
  const ui = useAppUi()
  const toast = useAppToast()
  const { user } = useSupabase()
  const [endorsed, setEndorsed] = useState(false)
  const [endorsementCount, setEndorsementCount] = useState(skill.endorsements_count ?? 0)
  const [isEndorsing, setIsEndorsing] = useState(false)

  useEffect(() => {
    setEndorsementCount(skill.endorsements_count ?? 0)
  }, [skill.endorsements_count, skill.id])

  useEffect(() => {
    if (!user?.id || isOwnProfile || !skill.skill_name) {
      setEndorsed(false)
      return
    }
    let active = true
    void hasEndorsedSkill(profileOwnerId, skill.skill_name, user.id).then((value) => {
      if (active) setEndorsed(value)
    })
    return () => {
      active = false
    }
  }, [isOwnProfile, profileOwnerId, skill.skill_name, user?.id])

  async function handleEndorse() {
    if (!user?.id || isOwnProfile || isEndorsing) return
    setIsEndorsing(true)
    const result = await endorseSkill({
      skillOwnerId: profileOwnerId,
      skillName: skill.skill_name,
      endorserId: user.id,
    })
    setIsEndorsing(false)
    if (result.error) {
      toast.show('Could not update endorsement', { tone: 'danger', message: result.error })
      return
    }
    setEndorsed(result.endorsed)
    setEndorsementCount((count) => Math.max(0, count + (result.endorsed ? 1 : -1)))
    onRefresh()
  }

  const meta = [
    skill.proficiency_level,
    skill.years_of_experience != null ? `${skill.years_of_experience}+ yrs` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <XStack justifyContent="space-between" alignItems="center" gap="$2">
      <YStack flex={1} gap="$1">
        <Text fontSize={15} fontWeight="600" color={ui.text}>
          {skill.skill_name}
        </Text>
        {meta ? (
          <Text fontSize={13} color={ui.textMuted}>
            {meta}
          </Text>
        ) : null}
        {endorsementCount > 0 ? (
          <Text fontSize={13} color={ui.textMuted}>
            {endorsementCount} endorsement{endorsementCount === 1 ? '' : 's'}
          </Text>
        ) : null}
      </YStack>
      {isOwnProfile ? (
        <RowActions onEdit={onEdit} />
      ) : user ? (
        <Button
          size="$2"
          tone={endorsed ? 'outline' : 'primary'}
          borderRadius={999}
          disabled={isEndorsing}
          onPress={() => void handleEndorse()}
        >
          {isEndorsing ? '…' : endorsed ? 'Endorsed' : 'Endorse'}
        </Button>
      ) : null}
    </XStack>
  )
}

function LanguagesSection({
  items,
  isOwnProfile,
  onAdd,
  onEdit,
}: {
  items: ProfileLanguage[]
  isOwnProfile: boolean
  onAdd: () => void
  onEdit: (row: ProfileLanguage) => void
}) {
  if (items.length === 0 && !isOwnProfile) return null

  return (
    <SectionCard
      title="Languages"
      icon={Icons.Globe}
      isOwnProfile={isOwnProfile}
      onAdd={onAdd}
      emptyMessage={isOwnProfile ? 'Add languages you speak or write.' : undefined}
      emptyAction={
        isOwnProfile ? (
          <Text fontSize={14} fontWeight="600" color={BRAND_BLUE} cursor="pointer" onPress={onAdd}>
            Add languages
          </Text>
        ) : undefined
      }
    >
      {items.length > 0 ? (
        <YStack gap="$3">
          {items.map((language) => (
            <LanguageRow
              key={language.id}
              language={language}
              isOwnProfile={isOwnProfile}
              onEdit={() => onEdit(language)}
            />
          ))}
        </YStack>
      ) : null}
    </SectionCard>
  )
}

function LanguageRow({
  language,
  isOwnProfile,
  onEdit,
}: {
  language: ProfileLanguage
  isOwnProfile: boolean
  onEdit: () => void
}) {
  const ui = useAppUi()

  return (
    <XStack justifyContent="space-between" alignItems="center" gap="$3">
      <YStack flex={1}>
        <Text fontSize={15} fontWeight="600" color={ui.text}>
          {language.language_name}
        </Text>
        {language.proficiency ? (
          <Text fontSize={13} color={ui.textMuted}>
            {language.proficiency}
          </Text>
        ) : null}
      </YStack>
      {isOwnProfile ? <RowActions onEdit={onEdit} /> : null}
    </XStack>
  )
}

function InterestsSection({
  items,
  isOwnProfile,
  onEdit,
}: {
  items: string[]
  isOwnProfile: boolean
  onEdit: () => void
}) {
  if (items.length === 0 && !isOwnProfile) return null

  return (
    <SectionCard
      title="Interests"
      icon={Icons.Heart}
      isOwnProfile={isOwnProfile}
      onAdd={onEdit}
      emptyMessage={isOwnProfile ? 'Add topics you care about to personalize your feed.' : undefined}
      emptyAction={
        isOwnProfile ? (
          <Text fontSize={14} fontWeight="600" color={BRAND_BLUE} cursor="pointer" onPress={onEdit}>
            Add interests
          </Text>
        ) : undefined
      }
    >
      {items.length > 0 ? (
        <YStack gap="$2">
          <XStack gap="$2" flexWrap="wrap">
            {items.map((interest) => (
              <InterestChip key={interest} label={interest} />
            ))}
          </XStack>
          {isOwnProfile ? (
            <Text fontSize={14} fontWeight="600" color={BRAND_BLUE} cursor="pointer" onPress={onEdit}>
              Edit interests
            </Text>
          ) : null}
        </YStack>
      ) : null}
    </SectionCard>
  )
}

function RowActions({ onEdit }: { onEdit: () => void }) {
  const ui = useAppUi()

  return (
    <XStack
      width={36}
      height={36}
      alignItems="center"
      justifyContent="center"
      borderRadius={radius.pill}
      cursor="pointer"
      hoverStyle={{ backgroundColor: ui.surfaceHover }}
      onPress={onEdit}
      accessibilityLabel="Edit"
    >
      <Icons.Pencil size={16} color={ui.textMuted} />
    </XStack>
  )
}

function SectionCard({
  title,
  icon: Icon,
  children,
  emptyMessage,
  emptyAction,
  isOwnProfile,
  onAdd,
}: {
  title: string
  icon?: typeof Icons.User
  children?: ReactNode
  emptyMessage?: string
  emptyAction?: ReactNode
  isOwnProfile?: boolean
  onAdd?: () => void
}) {
  const ui = useAppUi()
  const showEmpty = !children && emptyMessage

  return (
    <YStack
      backgroundColor={ui.surface}
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      padding="$4"
      gap="$3"
      style={getShadowStyle('sm')}
    >
      <XStack gap="$2.5" alignItems="center" justifyContent="space-between">
        <XStack gap="$2.5" alignItems="center" flex={1}>
          <YStack width={3} height={20} borderRadius={999} backgroundColor={ui.brand} opacity={0.85} />
          {Icon ? <Icon size={18} color={BRAND_BLUE} /> : null}
          <Text fontSize={18} fontWeight="700" color={ui.text} letterSpacing={-0.25}>
            {title}
          </Text>
        </XStack>
        {isOwnProfile && onAdd && !showEmpty ? (
          <XStack
            width={36}
            height={36}
            alignItems="center"
            justifyContent="center"
            borderRadius={radius.pill}
            cursor="pointer"
            hoverStyle={{ backgroundColor: ui.surfaceHover }}
            onPress={onAdd}
            accessibilityLabel={`Add ${title.toLowerCase()}`}
          >
            <Icons.Plus size={20} color={BRAND_BLUE} />
          </XStack>
        ) : null}
      </XStack>
      {showEmpty ? (
        <YStack gap="$2">
          <Text fontSize={14} color={ui.textMuted} lineHeight={20}>
            {emptyMessage}
          </Text>
          {emptyAction}
        </YStack>
      ) : (
        children
      )}
    </YStack>
  )
}

function AboutForm({ value, onChange }: { value: AboutInput; onChange: (value: AboutInput) => void }) {
  const ui = useAppUi()

  function patch(partial: Partial<AboutInput>) {
    onChange({ ...value, ...partial })
  }

  return (
    <YStack gap="$3" paddingHorizontal="$4" paddingBottom="$4">
      <Field label="Name" required>
        <Input
          value={value.full_name ?? ''}
          onChangeText={(text) => patch({ full_name: text })}
          placeholder="Your full name"
          backgroundColor={ui.surface}
        />
      </Field>
      <Field label="Headline">
        <Input
          value={value.headline ?? ''}
          onChangeText={(text) => patch({ headline: text })}
          placeholder="e.g. Founder at Acme · Product leader"
          backgroundColor={ui.surface}
        />
      </Field>
      <SearchSelectField
        label="Occupation"
        value={value.occupation ?? ''}
        onChange={(occupation) => patch({ occupation })}
        options={JOB_TITLE_OPTIONS}
        allowCustom
        placeholder="Your role or title"
        searchPlaceholder="Search or type a title"
        sheetTitle="Occupation"
      />
      <SearchSelectField
        label="Business name"
        value={value.business_name ?? ''}
        onChange={(business_name) => patch({ business_name })}
        loadOptions={suggestCompanyNames}
        allowCustom
        placeholder="Shop or company name"
        searchPlaceholder="Search or type a name"
        sheetTitle="Business name"
      />
      <SearchSelectField
        label="Industry"
        value={value.industry ?? ''}
        onChange={(industry) => patch({ industry })}
        options={INDUSTRY_OPTIONS}
        allowCustom
        placeholder="e.g. Retail, Technology"
        searchPlaceholder="Search industries"
        sheetTitle="Industry"
      />
      <LocationPickerField
        value={value.location ?? ''}
        onChange={(text) => patch({ location: text })}
        label="Location"
      />
      <Field label="About">
        <TextArea
          value={value.bio ?? ''}
          onChangeText={(text) => patch({ bio: text })}
          placeholder="Tell your network about your background and what you do."
          backgroundColor={ui.surface}
          minHeight={120}
        />
      </Field>
    </YStack>
  )
}

function ExperienceForm({
  value,
  onChange,
}: {
  value: ExperienceInput
  onChange: (value: ExperienceInput) => void
}) {
  const ui = useAppUi()

  function patch(partial: Partial<ExperienceInput>) {
    onChange({ ...value, ...partial })
  }

  return (
    <YStack gap="$3" paddingHorizontal="$4" paddingBottom="$4">
      <SearchSelectField
        label="Title"
        required
        value={value.title}
        onChange={(title) => patch({ title })}
        options={JOB_TITLE_OPTIONS}
        allowCustom
        placeholder="e.g. Product Manager"
        searchPlaceholder="Search or type a title"
        sheetTitle="Title"
      />
      <SearchSelectField
        label="Company"
        required
        value={value.company_name}
        onChange={(company_name) => patch({ company_name })}
        loadOptions={suggestCompanyNames}
        allowCustom
        placeholder="Organization name"
        searchPlaceholder="Search or type a name"
        sheetTitle="Company"
      />
      <Field label="Employment type">
        <OptionChips
          options={EMPLOYMENT_TYPE_OPTIONS}
          value={value.employment_type ?? ''}
          onChange={(employment_type) => patch({ employment_type })}
        />
      </Field>
      <LocationPickerField
        value={value.location ?? ''}
        onChange={(text) => patch({ location: text })}
        label="Location"
      />
      <Field label="Location type">
        <OptionChips
          options={LOCATION_TYPE_OPTIONS}
          value={value.location_type ?? ''}
          onChange={(location_type) => patch({ location_type })}
        />
      </Field>
      <MonthYearField
        label="Start date"
        value={value.start_date ?? ''}
        onChange={(start_date) => patch({ start_date })}
      />
      <MonthYearField
        label="End date"
        value={value.end_date ?? ''}
        onChange={(end_date) => patch({ end_date })}
        disabled={value.is_current}
      />
      <XStack alignItems="center" justifyContent="space-between">
        <Text fontSize={15} color={ui.text}>
          I currently work here
        </Text>
        <Switch
          checked={value.is_current}
          onCheckedChange={(checked) => patch({ is_current: checked, end_date: checked ? '' : value.end_date })}
        />
      </XStack>
      <SearchSelectField
        label="Industry"
        value={value.industry ?? ''}
        onChange={(industry) => patch({ industry })}
        options={INDUSTRY_OPTIONS}
        allowCustom
        placeholder="e.g. Retail, Technology"
        searchPlaceholder="Search industries"
        sheetTitle="Industry"
      />
      <Field label="Description">
        <TextArea
          value={value.description ?? ''}
          onChangeText={(text) => patch({ description: text })}
          backgroundColor={ui.surface}
          minHeight={100}
        />
      </Field>
      <Field label="Skills (comma-separated)">
        <Input
          value={value.skills ?? ''}
          onChangeText={(text) => patch({ skills: text })}
          placeholder="Leadership, Marketing"
          backgroundColor={ui.surface}
        />
      </Field>
    </YStack>
  )
}

function EducationForm({
  value,
  onChange,
}: {
  value: EducationInput
  onChange: (value: EducationInput) => void
}) {
  const ui = useAppUi()

  function patch(partial: Partial<EducationInput>) {
    onChange({ ...value, ...partial })
  }

  return (
    <YStack gap="$3" paddingHorizontal="$4" paddingBottom="$4">
      <Field label="School" required>
        <Input
          value={value.school}
          onChangeText={(text) => patch({ school: text })}
          placeholder="University or school name"
          backgroundColor={ui.surface}
        />
      </Field>
      <Field label="Degree">
        <Input
          value={value.degree ?? ''}
          onChangeText={(text) => patch({ degree: text })}
          placeholder="e.g. Bachelor of Science"
          backgroundColor={ui.surface}
        />
      </Field>
      <Field label="Field of study">
        <Input
          value={value.field_of_study ?? ''}
          onChangeText={(text) => patch({ field_of_study: text })}
          placeholder="e.g. Computer Science"
          backgroundColor={ui.surface}
        />
      </Field>
      <XStack gap="$3" flexWrap="wrap">
        <YStack flex={1} minWidth={120}>
          <MonthYearField
            label="Start year"
            yearOnly
            value={value.start_year ?? ''}
            onChange={(start_year) => patch({ start_year })}
          />
        </YStack>
        <YStack flex={1} minWidth={120}>
          <MonthYearField
            label="End year"
            yearOnly
            value={value.end_year ?? ''}
            onChange={(end_year) => patch({ end_year })}
          />
        </YStack>
      </XStack>
      <Field label="Grade">
        <Input
          value={value.grade ?? ''}
          onChangeText={(text) => patch({ grade: text })}
          backgroundColor={ui.surface}
        />
      </Field>
      <LocationPickerField
        value={value.location ?? ''}
        onChange={(text) => patch({ location: text })}
        label="Location"
        showPostal={false}
      />
      <Field label="Activities">
        <Input
          value={value.activities ?? ''}
          onChangeText={(text) => patch({ activities: text })}
          backgroundColor={ui.surface}
        />
      </Field>
      <Field label="Description">
        <TextArea
          value={value.description ?? ''}
          onChangeText={(text) => patch({ description: text })}
          backgroundColor={ui.surface}
          minHeight={80}
        />
      </Field>
      <Field label="Skills (comma-separated)">
        <Input
          value={value.skills ?? ''}
          onChangeText={(text) => patch({ skills: text })}
          backgroundColor={ui.surface}
        />
      </Field>
    </YStack>
  )
}

function SkillForm({ value, onChange }: { value: SkillInput; onChange: (value: SkillInput) => void }) {
  const ui = useAppUi()

  function patch(partial: Partial<SkillInput>) {
    onChange({ ...value, ...partial })
  }

  return (
    <YStack gap="$3" paddingHorizontal="$4" paddingBottom="$4">
      <Field label="Skill" required>
        <Input
          value={value.skill_name}
          onChangeText={(text) => patch({ skill_name: text })}
          placeholder="e.g. Product strategy"
          backgroundColor={ui.surface}
        />
      </Field>
      <Field label="Proficiency">
        <OptionChips
          options={SKILL_PROFICIENCY_OPTIONS}
          value={value.proficiency_level ?? ''}
          onChange={(proficiency_level) => patch({ proficiency_level })}
        />
      </Field>
      <Field label="Years of experience">
        <Input
          value={value.years_of_experience ?? ''}
          onChangeText={(text) => patch({ years_of_experience: text })}
          placeholder="e.g. 5"
          backgroundColor={ui.surface}
          keyboardType="number-pad"
        />
      </Field>
    </YStack>
  )
}

function LanguageForm({
  value,
  onChange,
}: {
  value: LanguageInput
  onChange: (value: LanguageInput) => void
}) {
  const ui = useAppUi()

  function patch(partial: Partial<LanguageInput>) {
    onChange({ ...value, ...partial })
  }

  return (
    <YStack gap="$3" paddingHorizontal="$4" paddingBottom="$4">
      <Field label="Language" required>
        <Input
          value={value.language_name}
          onChangeText={(text) => patch({ language_name: text })}
          placeholder="e.g. English"
          backgroundColor={ui.surface}
        />
      </Field>
      <Field label="Proficiency">
        <OptionChips
          options={LANGUAGE_PROFICIENCY_OPTIONS}
          value={value.proficiency ?? ''}
          onChange={(proficiency) => patch({ proficiency })}
        />
      </Field>
    </YStack>
  )
}

function InterestsForm({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const ui = useAppUi()

  return (
    <YStack gap="$3" paddingHorizontal="$4" paddingBottom="$4">
      <Field label="Interests" hint="Separate topics with commas">
        <TextArea
          value={value}
          onChangeText={onChange}
          placeholder="Entrepreneurship, Fashion, Wellness"
          backgroundColor={ui.surface}
          minHeight={100}
        />
      </Field>
    </YStack>
  )
}

function OptionChips({
  options,
  value,
  onChange,
}: {
  options: readonly string[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <XStack gap="$2" flexWrap="wrap">
      {options.map((option) => (
        <Button
          key={option}
          tone={value === option ? 'primary' : 'outline'}
          size="$2.5"
          borderRadius={999}
          onPress={() => onChange(value === option ? '' : option)}
        >
          {option}
        </Button>
      ))}
    </XStack>
  )
}

function OrgAvatar({ name }: { name: string }) {
  const ui = useAppUi()

  return (
    <YStack
      width={48}
      height={48}
      borderRadius={radius.chip}
      backgroundColor={ui.surfaceMuted}
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
      borderWidth={1}
      borderColor={ui.border}
    >
      <Text fontSize={18} fontWeight="700" color={ui.textSecondary}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </YStack>
  )
}

function SkillChip({ label }: { label: string }) {
  const ui = useAppUi()

  return (
    <XStack
      paddingHorizontal="$2.5"
      paddingVertical={4}
      borderRadius={999}
      backgroundColor={ui.surfaceMuted}
      borderWidth={1}
      borderColor={ui.border}
    >
      <Text fontSize={12} fontWeight="600" color={ui.textSecondary}>
        {label}
      </Text>
    </XStack>
  )
}

function InterestChip({ label }: { label: string }) {
  return (
    <XStack
      paddingHorizontal="$3"
      paddingVertical={6}
      borderRadius={999}
      backgroundColor="rgba(10, 102, 194, 0.08)"
      borderWidth={1}
      borderColor="rgba(10, 102, 194, 0.2)"
    >
      <Text fontSize={13} fontWeight="600" color={BRAND_BLUE}>
        {label}
      </Text>
    </XStack>
  )
}
