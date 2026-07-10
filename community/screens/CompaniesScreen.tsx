import { Link, useRouter } from 'one'
import { useEffect, useState } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityPageHeader } from '~/community/components/CommunityPageHeader'
import { CommunityShell } from '~/community/components/CommunityShell'
import { fetchCompanies, fetchMyCompanies, type CompanyPage } from '~/community/lib/companies'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Avatar, Button, Icons, Input, Spinner, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'
import { radius } from '~/config/tokens'
import { useSupabase } from '~/providers/SupabaseProvider'

export function CompaniesScreen() {
  const communityUi = useCommunityUi()
  const router = useRouter()
  const { user } = useSupabase()
  const [search, setSearch] = useState('')
  const [mine, setMine] = useState<CompanyPage[]>([])
  const [discover, setDiscover] = useState<CompanyPage[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      const [myPages, pages] = await Promise.all([
        user ? fetchMyCompanies(user.id) : Promise.resolve([]),
        fetchCompanies(0, search),
      ])
      setMine(myPages)
      setDiscover(pages.items)
      setIsLoading(false)
    }
    load()
  }, [search, user])

  return (
    <CommunityShell wide>
      <CommunityCard padding={18} gap={12}>
        <CommunityPageHeader
          title="Pages"
          subtitle="Follow pages and see their updates."
          actions={
            user ? (
              <Button
                backgroundColor={communityUi.brand}
                color="white"
                borderRadius={999}
                onPress={() => router.push(communityRoutes.companyCreate)}
              >
                Create page
              </Button>
            ) : undefined
          }
        />
        <XStack gap={8} alignItems="center" padding={12} borderRadius={radius.chip} borderWidth={1} borderColor={communityUi.borderLight} backgroundColor={communityUi.inputBg}>
          <Icons.Search size={18} color={communityUi.textMuted} />
          <Input flex={1} value={search} onChangeText={setSearch} placeholder="Search pages" borderWidth={0} backgroundColor="transparent" />
        </XStack>
      </CommunityCard>

      {isLoading ? (
        <YStack alignItems="center" paddingVertical="$8">
          <Spinner size="large" color={communityUi.brand} />
        </YStack>
      ) : (
        <>
          {mine.length > 0 ? (
            <CompanySection title="Your pages" items={mine} />
          ) : null}
          <CompanySection title="Discover" items={discover} />
        </>
      )}
    </CommunityShell>
  )
}

function CompanySection({ title, items }: { title: string; items: CompanyPage[] }) {
  const communityUi = useCommunityUi()
  if (!items.length) return null
  return (
    <CommunityCard padding={12} gap={0}>
      <Text fontSize={16} fontWeight="700" color={communityUi.text} paddingBottom={12}>
        {title}
      </Text>
      {items.map((company) => (
        <Link key={company.id} href={communityRoutes.company(company.page_slug)}>
          <XStack gap={12} paddingVertical={12} borderBottomWidth={1} borderBottomColor={communityUi.borderLight} alignItems="center">
            <Avatar name={company.name} src={company.logo_url ?? undefined} size="$4" />
            <YStack flex={1} gap={2}>
              <Text fontSize={15} fontWeight="600" color={communityUi.text}>
                {company.name}
              </Text>
              <Text fontSize={13} color={communityUi.textMuted}>
                {company.industry}
                {company.location ? ` · ${company.location}` : ''}
              </Text>
            </YStack>
          </XStack>
        </Link>
      ))}
    </CommunityCard>
  )
}