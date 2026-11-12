import { MarketplacePageTitle } from '~/commerce/components/marketplace-shell'
import { useAppLayout } from '~/hooks/useAppLayout'

type CommercePageHeaderProps = {
  title: string
  subtitle?: string
}

/** Commerce page title — marketplace storefront typography. */
export function CommercePageHeader({ title, subtitle }: CommercePageHeaderProps) {
  const { hasSideRails } = useAppLayout()
  return <MarketplacePageTitle title={title} subtitle={subtitle} hasSideRails={hasSideRails} />
}
