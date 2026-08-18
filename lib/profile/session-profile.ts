import type { Tables } from '~/lib/supabase'

/**
 * The signed-in member's `profiles` row as the app consumes it.
 *
 * Lives here (not in `hooks/useProfile`) so the cache and the store can share
 * the type without importing React.
 */
export type SessionProfile = Pick<
  Tables<'profiles'>,
  | 'id'
  | 'role'
  | 'full_name'
  | 'username'
  | 'email'
  | 'avatar_url'
  | 'cover_url'
  | 'headline'
  | 'bio'
  | 'is_verified'
  | 'follower_count'
  | 'following_count'
  | 'connections_count'
  | 'location'
  | 'industry'
  | 'occupation'
  | 'business_name'
  | 'website_url'
  | 'portfolio_url'
  | 'interests'
  | 'member_intents'
  | 'profile_completion_percentage'
  | 'gender'
  | 'phone'
  | 'phone_verified'
>

/** Columns fetched for the session profile — keep in sync with `SessionProfile`. */
export const SESSION_PROFILE_COLUMNS =
  'id, role, full_name, username, email, phone, phone_verified, avatar_url, cover_url, headline, bio, is_verified, follower_count, following_count, connections_count, location, industry, occupation, business_name, website_url, portfolio_url, interests, member_intents, profile_completion_percentage, gender, date_of_birth, marriage_anniversary'
