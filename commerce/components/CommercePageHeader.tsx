import { AppPageHeader } from '~/components/layout/AppPageHeader'

type CommercePageHeaderProps = {
  title: string
  subtitle?: string
}

/** Commerce page title with brand accent rail. */
export function CommercePageHeader({ title, subtitle }: CommercePageHeaderProps) {
  return <AppPageHeader title={title} subtitle={subtitle} />
}
