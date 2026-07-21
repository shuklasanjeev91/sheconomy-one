/**
 * Community Groups — pure helpers.
 */

import { Platform } from 'react-native'

import {
  GROUP_IMAGE_ACCEPTED_MIME,
  GROUP_IMAGE_MAX_BYTES,
  GROUP_TYPES,
  type Group,
  type GroupImageUploadFile,
  type GroupMemberRole,
} from './group.type'

/** URL-safe slug-ish name (groups use `name` as short label, not a unique slug). */
export function normalizeGroupName(name: string | null | undefined): string {
  if (!name) return ''
  return name.trim().replace(/\s+/g, ' ').substring(0, 100)
}

export function formatGroupType(type: string | null | undefined): string {
  switch (type) {
    case GROUP_TYPES.PUBLIC:
      return 'Public'
    case GROUP_TYPES.PRIVATE:
      return 'Private'
    case GROUP_TYPES.SECRET:
      return 'Secret'
    default:
      return type?.trim() || 'Public'
  }
}

export function formatGroupMemberRole(role: GroupMemberRole | string | null | undefined): string {
  switch (role) {
    case 'admin':
      return 'Admin'
    case 'member':
      return 'Member'
    default:
      return role || 'Member'
  }
}

export function getGroupSubtitle(
  group: Pick<Group, 'description' | 'location' | 'group_type'> | null | undefined,
): string {
  if (!group) return ''
  return (
    group.description?.trim() ||
    group.location?.trim() ||
    formatGroupType(group.group_type)
  )
}

export function parseIndustriesInput(value: string | string[] | null | undefined): string[] | null {
  if (value == null) return null
  if (Array.isArray(value)) {
    const cleaned = value.map((v) => v.trim()).filter(Boolean)
    return cleaned.length ? cleaned : null
  }
  const cleaned = value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  return cleaned.length ? cleaned : null
}

export function formatIndustriesLabel(industries: string[] | null | undefined): string {
  if (!industries?.length) return 'No industries'
  return industries.join(', ')
}

export function validateGroupImageFile(
  file: GroupImageUploadFile | null,
): { valid: boolean; error?: string } {
  if (!file) return { valid: false, error: 'No file selected' }

  if (!(GROUP_IMAGE_ACCEPTED_MIME as readonly string[]).includes(file.mimeType)) {
    return { valid: false, error: 'Only JPEG, PNG, or WebP images are accepted' }
  }

  if (file.fileSize > GROUP_IMAGE_MAX_BYTES) {
    const mb = (file.fileSize / 1024 / 1024).toFixed(1)
    return { valid: false, error: `File must be under 5 MB (got ${mb} MB)` }
  }

  if (Platform.OS === 'web' && file.fileSize <= 0) {
    return { valid: false, error: 'File appears empty' }
  }

  return { valid: true }
}

export function isGroupStorageUrl(url: string | null | undefined): boolean {
  if (!url) return false
  return (
    url.includes('/storage/v1/object/public/post-images/') &&
    (url.includes('/community-groups/') || url.includes('/group-avatars/') || url.includes('/group-covers/'))
  )
}

export function emptyGroupEngagementStats() {
  return {
    total_reactions: 0,
    total_comments: 0,
    total_views: 0,
    like_count: 0,
    love_count: 0,
    celebrate_count: 0,
    support_count: 0,
    insightful_count: 0,
    funny_count: 0,
  }
}
