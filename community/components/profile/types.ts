export type ProfileDisplay = {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
  cover_url: string | null
  headline: string | null
  bio: string | null
  location: string | null
  industry: string | null
  occupation: string | null
  business_name: string | null
  is_verified: boolean
  follower_count: number | null
  following_count: number | null
  connections_count: number | null
  website_url: string | null
  portfolio_url?: string | null
  instagram_url?: string | null
  twitter_url?: string | null
  youtube_url?: string | null
  github_url?: string | null
  interests?: string[] | null
  profile_completion_percentage?: number | null
  email?: string | null
  date_of_birth?: string | null
  marriage_anniversary?: string | null
}
