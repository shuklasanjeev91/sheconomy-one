import type { CompanyPage } from '~/community/lib/companies'
import { communityRoutes } from '~/lib/routes'

export type CompaniesRevisitCard = {
  companyId: string
  title: string
  subtitle: string | null
  memberCount: number
  logoUrl: string | null
  href: string
}

export function buildCompaniesRevisitCards(companies: CompanyPage[], limit = 6): CompaniesRevisitCard[] {
  return companies
    .slice()
    .sort((a, b) => (b.community_members ?? 0) - (a.community_members ?? 0))
    .slice(0, limit)
    .map((company) => ({
      companyId: company.id,
      title: company.name,
      subtitle:
        [company.industry, company.location].filter(Boolean).join(' · ') ||
        company.tagline?.trim() ||
        null,
      memberCount: company.community_members ?? 0,
      logoUrl: company.logo_url,
      href: communityRoutes.company(company.id),
    }))
}
