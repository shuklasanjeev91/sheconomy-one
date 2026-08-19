import { appRoutes } from '~/lib/routes'

export type ProfileCompletionRevisitCard = {
  percent: number
  headline: string
  detail: string
  href: string
}

export function buildProfileCompletionRevisitCard(
  percent: number | null | undefined,
): ProfileCompletionRevisitCard | null {
  if (percent == null || percent >= 100) return null

  const remaining = 100 - percent
  return {
    percent,
    headline: 'Strengthen your profile',
    detail:
      remaining >= 30
        ? 'Add experience, skills, and a headline so your network recognizes you faster.'
        : 'You are close — finish the last details to unlock stronger discovery.',
    href: String(appRoutes.settingsSection('account')),
  }
}
