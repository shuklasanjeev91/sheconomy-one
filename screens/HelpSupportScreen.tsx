import { useLocalSearchParams, useRouter } from 'one'
import { AppLink } from '~/components/navigation/AppLink'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AppPageHeader } from '~/components/layout/AppPageHeader'
import { FullWidthLayout, PageSection, SurfaceCard } from '~/components/layout'
import { ScreenSearchField } from '~/components/search'
import {
  Button,
  Icons,
  Input,
  ScrollView,
  Separator,
  Spinner,
  Text,
  TextArea,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { radius } from '~/config/tokens'
import { AI_NAME } from '~/config/brand'
import { sendAiMessage } from '~/lib/ai'
import { buildSignInUrl } from '~/lib/auth/redirect'
import { contactTemplatesFor } from '~/lib/help/faq-fallback'
import {
  closeSupportTicket,
  createSupportTicket,
  fetchHelpArticles,
  fetchMyTickets,
  markArticleHelpful,
  markArticleViewed,
} from '~/lib/help/support'
import {
  HELP_PRODUCT_FILTERS,
  helpHref,
  helpProductLabel,
  parseHelpProduct,
  type HelpArticle,
  type HelpAudience,
  type HelpProduct,
  type SupportTicket,
} from '~/lib/help/types'
import { useVendorShops } from '~/hooks/useVendorShops'
import { routes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

type HelpTab = 'faq' | 'contact' | 'tickets'

type SupportTopic = {
  id: string
  label: string
  hint: string
  product: HelpProduct
  query: string
}

const CUSTOMER_TOPICS: SupportTopic[] = [
  { id: 'orders', label: 'Your orders', hint: 'Tracking, delivery, and checkout', product: 'commerce', query: 'order' },
  { id: 'returns', label: 'Returns & refunds', hint: 'Start a return from an order', product: 'commerce', query: 'return' },
  { id: 'payments', label: 'Payments', hint: 'Cards, checkout, and declines', product: 'commerce', query: 'payment' },
  { id: 'account', label: 'Your account', hint: 'Sign in, profile, and alerts', product: '', query: 'account' },
  { id: 'community', label: 'Community', hint: 'Posts, network, and jobs', product: 'community', query: '' },
  { id: 'chat', label: 'Messages', hint: 'Chats, groups, and mute', product: 'chat', query: '' },
  { id: 'class', label: 'Classes', hint: 'Programs and playback', product: 'class', query: '' },
  { id: 'cowork', label: 'Co-Work', hint: 'Host, join, and schedule', product: 'cowork', query: '' },
]

const SELLER_TOPICS: SupportTopic[] = [
  { id: 'start', label: 'Get started', hint: 'Open and verify your shop', product: 'shop', query: 'create' },
  { id: 'listings', label: 'Listings', hint: 'Visibility, stock, and edits', product: 'shop', query: 'listing' },
  { id: 'orders', label: 'Orders', hint: 'Fulfill and manage orders', product: 'shop', query: 'order' },
  { id: 'payments', label: 'Payments', hint: 'Payouts and bank details', product: 'shop', query: 'payout' },
  { id: 'shipping', label: 'Shipping & returns', hint: 'Policies and delivery', product: 'shop', query: 'shipping' },
]

export function HelpSupportScreen({ audience = 'customer' }: { audience?: HelpAudience }) {
  const ui = useAppUi()
  const toast = useAppToast()
  const router = useRouter()
  const { user } = useSupabase()
  const { shops, isLoading: shopsLoading } = useVendorShops()
  const hasShop = Boolean(user && shops.length > 0)
  const topics = audience === 'seller' ? SELLER_TOPICS : CUSTOMER_TOPICS
  const pageHref = audience === 'seller' ? '/help/seller' : '/help'
  const params = useLocalSearchParams<{ product?: string; article?: string; tab?: string }>()
  const paramProduct = parseHelpProduct(
    typeof params.product === 'string' ? params.product : params.product?.[0],
  )
  /** Manage shop only for signed-in users who own at least one shop. */
  const productFilters = useMemo(
    () => HELP_PRODUCT_FILTERS.filter((filter) => filter.key !== 'shop' || hasShop),
    [hasShop],
  )
  const contactFilters = useMemo(
    () =>
      audience === 'seller'
        ? HELP_PRODUCT_FILTERS.filter((filter) => filter.key === 'shop')
        : productFilters.filter((filter) => filter.key && filter.key !== 'shop'),
    [audience, productFilters],
  )
  const articleSlug =
    typeof params.article === 'string' ? params.article : params.article?.[0] ?? null
  const paramTab = typeof params.tab === 'string' ? params.tab : params.tab?.[0]

  const [tab, setTab] = useState<HelpTab>(
    paramTab === 'contact' || paramTab === 'tickets' ? paramTab : 'faq',
  )
  const [product, setProduct] = useState<HelpProduct>(audience === 'seller' ? 'shop' : paramProduct === 'shop' ? '' : paramProduct)
  const [activeTopic, setActiveTopic] = useState<string | null>(null)
  const [ticketFilter, setTicketFilter] = useState<HelpProduct>(
    paramProduct === 'shop' ? '' : paramProduct,
  )
  const [query, setQuery] = useState('')
  const [articles, setArticles] = useState<HelpArticle[]>([])
  const [articlesLoading, setArticlesLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null)
  const viewedRef = useRef<Set<string>>(new Set())

  const [formProduct, setFormProduct] = useState<Exclude<HelpProduct, ''>>(
    audience === 'seller' ? 'shop' : paramProduct && paramProduct !== 'shop' ? paramProduct : 'commerce',
  )
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'normal' | 'high'>('normal')
  const [submitting, setSubmitting] = useState(false)
  const [sherpaAnswer, setSherpaAnswer] = useState<string | null>(null)
  const [sherpaLoading, setSherpaLoading] = useState(false)
  const signInHref = buildSignInUrl(pageHref)

  function selectTopic(topic: SupportTopic) {
    setActiveTopic(topic.id)
    setProduct(audience === 'seller' ? 'shop' : topic.product)
    setQuery(topic.query)
    setSherpaAnswer(null)
    setTab('faq')
    if (topic.product && topic.product !== 'shop') setFormProduct(topic.product)
  }

  useEffect(() => {
    if (audience === 'customer' && paramProduct === 'shop') {
      router.replace('/help/seller' as never)
      return
    }
    if (audience === 'seller') {
      setProduct('shop')
      setFormProduct('shop')
      setTicketFilter('shop')
      return
    }
    setProduct(paramProduct)
    if (paramProduct) {
      setFormProduct(paramProduct)
      setTicketFilter(paramProduct)
    }
  }, [audience, paramProduct, router])

  useEffect(() => {
    if (audience === 'seller') setFormProduct('shop')
  }, [audience])

  // Customer pages never stay on Manage shop. Seller Support keeps that filter.
  useEffect(() => {
    if (audience === 'seller' || shopsLoading || hasShop) return
    setProduct((current) => (current === 'shop' ? '' : current))
    setFormProduct((current) => (current === 'shop' ? 'commerce' : current))
    setTicketFilter((current) => (current === 'shop' ? '' : current))
  }, [audience, shopsLoading, hasShop])

  const loadArticles = useCallback(async () => {
    setArticlesLoading(true)
    const result = await fetchHelpArticles({ product, query, audience })
    setArticles(result.articles)
    setArticlesLoading(false)
  }, [product, query, audience])

  useEffect(() => {
    void loadArticles()
  }, [loadArticles])

  // Deep-link: expand article by slug once articles load.
  useEffect(() => {
    if (!articleSlug || !articles.length) return
    const match = articles.find((a) => a.slug === articleSlug || a.id === articleSlug)
    if (match) {
      setExpandedId(match.id)
      setTab('faq')
    }
  }, [articleSlug, articles])

  const popularArticles = useMemo(
    () => articles.filter((a) => !query.trim()).slice(0, 4),
    [articles, query],
  )

  const loadTickets = useCallback(async () => {
    if (!user?.id) {
      setTickets([])
      return
    }
    setTicketsLoading(true)
    const result = await fetchMyTickets(user.id, ticketFilter || undefined)
    setTickets(result.tickets)
    setTicketsLoading(false)
  }, [user?.id, ticketFilter])

  useEffect(() => {
    if (tab === 'tickets') void loadTickets()
  }, [tab, loadTickets])

  async function toggleArticle(article: HelpArticle) {
    const open = expandedId === article.id
    if (open) {
      setExpandedId(null)
      return
    }
    setExpandedId(article.id)
    if (article.source === 'kb' && !viewedRef.current.has(article.id)) {
      viewedRef.current.add(article.id)
      void markArticleViewed(article.id)
    }
    if (article.slug) {
      router.push(helpHref(product || article.category, article.slug) as never)
    }
  }

  function relatedFor(article: HelpArticle) {
    return articles
      .filter((a) => a.id !== article.id)
      .filter((a) => {
        const shared = (a.tags ?? []).some((t) => (article.tags ?? []).includes(t))
        return shared || a.category === article.category
      })
      .slice(0, 3)
  }

  async function askSherpa(prompt?: string) {
    const text = (prompt ?? query).trim()
    if (!text) return
    if (prompt) setQuery(prompt)
    setTab('faq')
    setSherpaLoading(true)
    try {
      const result = await sendAiMessage({
        product: audience === 'seller' ? 'shop' : product || 'account',
        message: text,
        contextPage: 'help',
        context: { support: true, audience },
      })
      setSherpaAnswer(result.answer)
      const answered = parseHelpProduct(result.product)
      if (audience === 'seller') setFormProduct('shop')
      else if (answered && answered !== 'shop') setFormProduct(answered)
    } catch {
      setSherpaAnswer("I don't have a help article for that. You can still contact support.")
    } finally {
      setSherpaLoading(false)
    }
  }

  function stillNeedHelp() {
    const question = query.trim() || 'Support request'
    setSubject(question.slice(0, 140))
    setDescription(sherpaAnswer ? `${question}\n\n${AI_NAME}:\n${sherpaAnswer}` : question)
    setFormProduct(audience === 'seller' ? 'shop' : formProduct === 'shop' ? 'commerce' : formProduct)
    setTab('contact')
  }

  async function handleSubmit() {
    if (!user?.id) return
    setSubmitting(true)
    const { error } = await createSupportTicket({
      userId: user.id,
      subject,
      description,
      product: formProduct,
      priority,
    })
    setSubmitting(false)
    if (error) {
      toast.show('Could not send request', { tone: 'danger', message: error })
      return
    }
    toast.show('Support request sent', { tone: 'success' })
    setSubject('')
    setDescription('')
    setPriority('normal')
    setTab('tickets')
    void loadTickets()
  }

  async function handleCloseTicket(ticket: SupportTicket) {
    if (!user?.id) return
    const { error } = await closeSupportTicket({ userId: user.id, ticketId: ticket.id })
    if (error) {
      toast.show('Could not close request', { tone: 'danger', message: error })
      return
    }
    toast.show('Request closed', { tone: 'success' })
    void loadTickets()
  }

  const templates = contactTemplatesFor(formProduct)

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$3">
        <YStack gap="$5" width="100%">
          <XStack alignItems="flex-start" justifyContent="space-between" gap="$3" flexWrap="wrap">
            <YStack flex={1} minWidth={200}>
              <AppPageHeader
                title={audience === 'seller' ? 'Seller Support' : 'Customer Service'}
                subtitle={
                  audience === 'seller'
                    ? 'Help for listings, orders, shipping, and payouts.'
                    : 'Help for orders, returns, payments, and your account.'
                }
              />
            </YStack>
            <AppLink href={(audience === 'seller' ? '/help' : '/help/seller') as never} asChild>
              <Button tone="outline" size="$3" borderRadius={999}>
                {audience === 'seller' ? 'Customer Service' : 'Seller Support'}
              </Button>
            </AppLink>
          </XStack>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <XStack gap="$2">
              {(
                [
                  { id: 'faq' as const, label: 'FAQ' },
                  { id: 'contact' as const, label: 'Contact' },
                  { id: 'tickets' as const, label: 'My requests' },
                ] as const
              ).map((item) => (
                <Chip
                  key={item.id}
                  label={item.label}
                  active={tab === item.id}
                  onPress={() => setTab(item.id)}
                />
              ))}
            </XStack>
          </ScrollView>

          {tab === 'faq' ? (
            <YStack gap="$4" width="100%">
              <Text fontSize={18} fontWeight="800" color={ui.text}>
                What can we help you with?
              </Text>
              <XStack flexWrap="wrap" gap="$3" width="100%">
                {topics.map((topic) => {
                  const active = activeTopic === topic.id
                  return (
                    <YStack
                      key={topic.id}
                      width="48%"
                      minWidth={160}
                      flexGrow={1}
                      padding="$3.5"
                      gap="$1"
                      borderRadius={radius.card}
                      borderWidth={1}
                      borderColor={active ? ui.brand : ui.borderSubtle}
                      backgroundColor={active ? ui.chip : ui.surface}
                      cursor="pointer"
                      hoverStyle={{ borderColor: ui.brand }}
                      onPress={() => selectTopic(topic)}
                    >
                      <Text fontSize={15} fontWeight="700" color={ui.text}>
                        {topic.label}
                      </Text>
                      <Text fontSize={13} color={ui.textMuted} lineHeight={18}>
                        {topic.hint}
                      </Text>
                    </YStack>
                  )
                })}
              </XStack>

              <ScreenSearchField
                value={query}
                onChangeText={(value) => {
                  setQuery(value)
                  if (!value.trim()) setSherpaAnswer(null)
                }}
                onSubmit={() => void askSherpa()}
                placeholder={
                  audience === 'seller' ? 'Ask about your shop' : 'Search help or describe a problem'
                }
              />

              {sherpaLoading ? (
                <XStack padding="$3" alignItems="center" gap="$2">
                  <Spinner size="small" />
                  <Text color={ui.textSecondary}>{AI_NAME} is checking help…</Text>
                </XStack>
              ) : sherpaAnswer ? (
                <SurfaceCard padding="$4" gap="$3" borderRadius={radius.card}>
                  <Text fontSize={12} fontWeight="800" color={ui.brand} letterSpacing={0.4}>
                    {AI_NAME}
                  </Text>
                  <Text fontSize={14} color={ui.textSecondary} lineHeight={21}>
                    {sherpaAnswer}
                  </Text>
                  {user ? (
                    <Button tone="primary" borderRadius={999} alignSelf="flex-start" onPress={stillNeedHelp}>
                      Still need help
                    </Button>
                  ) : null}
                </SurfaceCard>
              ) : null}

              {!query.trim() && popularArticles.length > 0 ? (
                <YStack gap="$2">
                  <Text fontSize={12} fontWeight="800" color={ui.textMuted} letterSpacing={0.6} textTransform="uppercase">
                    Popular
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <XStack gap="$2">
                      {popularArticles.map((article) => (
                        <XStack
                          key={`popular-${article.id}`}
                          paddingHorizontal={12}
                          paddingVertical={8}
                          borderRadius={999}
                          borderWidth={1}
                          borderColor={ui.borderSubtle}
                          backgroundColor={ui.chip}
                          cursor="pointer"
                          onPress={() => void toggleArticle(article)}
                        >
                          <Text fontSize={13} fontWeight="600" color={ui.text} numberOfLines={1}>
                            {article.title}
                          </Text>
                        </XStack>
                      ))}
                    </XStack>
                  </ScrollView>
                </YStack>
              ) : null}

              {articlesLoading ? (
                <XStack padding="$4" alignItems="center" gap="$2">
                  <Spinner size="small" />
                  <Text color={ui.textSecondary}>Loading articles…</Text>
                </XStack>
              ) : articles.length === 0 ? (
                <SurfaceCard padding="$4" borderRadius={radius.card}>
                  <Text color={ui.textMuted}>No articles match your search.</Text>
                </SurfaceCard>
              ) : (
                <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
                  {articles.map((article, index) => {
                    const open = expandedId === article.id
                    const related = open ? relatedFor(article) : []
                    return (
                      <YStack key={article.id}>
                        {index > 0 ? <Separator /> : null}
                        <YStack
                          paddingHorizontal="$4"
                          paddingVertical="$3.5"
                          gap="$2"
                          cursor="pointer"
                          hoverStyle={{ backgroundColor: ui.navHover }}
                          onPress={() => void toggleArticle(article)}
                        >
                          <XStack alignItems="center" gap="$2">
                            <YStack flex={1} gap={2} minWidth={0}>
                              <Text fontSize={12} color={ui.textMuted} fontWeight="600">
                                {helpProductLabel(article.category)}
                              </Text>
                              <Text fontSize={15} fontWeight="600" color={ui.text}>
                                {article.title}
                              </Text>
                            </YStack>
                            <Icons.ChevronDown
                              size={16}
                              color={ui.textMuted}
                              style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
                            />
                          </XStack>
                          {open ? (
                            <YStack gap="$3">
                              <Text fontSize={14} color={ui.textSecondary} lineHeight={21}>
                                {article.content}
                              </Text>
                              <XStack gap="$2" flexWrap="wrap">
                                {article.source === 'kb' ? (
                                  <Button
                                    size="$3"
                                    tone="outline"
                                    borderRadius={999}
                                    onPress={(e) => {
                                      e?.stopPropagation?.()
                                      void markArticleHelpful(article.id).then(({ error }) => {
                                        if (error) {
                                          toast.show('Could not save feedback', {
                                            tone: 'danger',
                                            message: error,
                                          })
                                          return
                                        }
                                        toast.show('Thanks for the feedback', { tone: 'success' })
                                        setArticles((current) =>
                                          current.map((row) =>
                                            row.id === article.id
                                              ? {
                                                  ...row,
                                                  helpful_count: (row.helpful_count ?? 0) + 1,
                                                }
                                              : row,
                                          ),
                                        )
                                      })
                                    }}
                                  >
                                    Helpful
                                  </Button>
                                ) : null}
                                <Button
                                  size="$3"
                                  tone="outline"
                                  borderRadius={999}
                                  icon={<Icons.Sparkles size={14} color={ui.brand} />}
                                  onPress={(e) => {
                                    e?.stopPropagation?.()
                                    void askSherpa(article.title)
                                  }}
                                >
                                  Ask {AI_NAME}
                                </Button>
                              </XStack>
                              {related.length ? (
                                <YStack gap="$2">
                                  <Text fontSize={12} fontWeight="700" color={ui.textMuted}>
                                    Related
                                  </Text>
                                  {related.map((rel) => (
                                    <Text
                                      key={rel.id}
                                      fontSize={13}
                                      color={ui.brand}
                                      fontWeight="600"
                                      cursor="pointer"
                                      onPress={(e) => {
                                        e?.stopPropagation?.()
                                        void toggleArticle(rel)
                                      }}
                                    >
                                      {rel.title}
                                    </Text>
                                  ))}
                                </YStack>
                              ) : null}
                            </YStack>
                          ) : null}
                        </YStack>
                      </YStack>
                    )
                  })}
                </SurfaceCard>
              )}
            </YStack>
          ) : null}

          {tab === 'contact' ? (
            <SurfaceCard padding="$4" gap="$4" borderRadius={radius.card}>
              {!user ? (
                <YStack gap="$3">
                  <Text color={ui.textSecondary} lineHeight={20}>
                    Sign in to contact support so we can update you when your request is resolved.
                  </Text>
                  <AppLink href={signInHref as never} asChild>
                    <Button tone="primary" borderRadius={999} alignSelf="flex-start">
                      Sign in to continue
                    </Button>
                  </AppLink>
                </YStack>
              ) : (
                <>
                  <YStack gap="$2">
                    <Text fontWeight="600" color={ui.text}>
                      Product
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <XStack gap="$2">
                        {contactFilters.map((filter) => (
                          <Chip
                            key={filter.key}
                            label={filter.label}
                            active={formProduct === filter.key}
                            onPress={() => setFormProduct(filter.key as Exclude<HelpProduct, ''>)}
                          />
                        ))}
                      </XStack>
                    </ScrollView>
                  </YStack>

                  {templates.length ? (
                    <YStack gap="$2">
                      <Text fontWeight="600" color={ui.text}>
                        Quick templates
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <XStack gap="$2">
                          {templates.map((template) => (
                            <Chip
                              key={template.label}
                              label={template.label}
                              onPress={() => {
                                setSubject(template.subject)
                                setDescription(template.description)
                              }}
                            />
                          ))}
                        </XStack>
                      </ScrollView>
                    </YStack>
                  ) : null}

                  <YStack gap="$2">
                    <Text fontWeight="600" color={ui.text}>
                      Priority
                    </Text>
                    <XStack gap="$2">
                      <Chip
                        label="Normal"
                        active={priority === 'normal'}
                        onPress={() => setPriority('normal')}
                      />
                      <Chip
                        label="High"
                        active={priority === 'high'}
                        onPress={() => setPriority('high')}
                      />
                    </XStack>
                  </YStack>

                  <YStack gap="$2">
                    <Text fontWeight="600" color={ui.text}>
                      Subject
                    </Text>
                    <Input
                      value={subject}
                      onChangeText={setSubject}
                      placeholder="Short summary of the issue"
                      borderRadius={radius.chip}
                    />
                  </YStack>

                  <YStack gap="$2">
                    <Text fontWeight="600" color={ui.text}>
                      Description
                    </Text>
                    <TextArea
                      value={description}
                      onChangeText={setDescription}
                      placeholder="What happened? Include order IDs, shop names, or meeting codes if relevant."
                      minHeight={120}
                      borderRadius={radius.chip}
                    />
                  </YStack>

                  <Button
                    tone="primary"
                    borderRadius={999}
                    disabled={submitting || !subject.trim() || !description.trim()}
                    icon={submitting ? <Spinner size="small" color="white" /> : undefined}
                    onPress={() => void handleSubmit()}
                  >
                    {submitting ? 'Sending…' : 'Send request'}
                  </Button>
                </>
              )}
            </SurfaceCard>
          ) : null}

          {tab === 'tickets' ? (
            <YStack gap="$3" width="100%">
              {!user ? (
                <SurfaceCard padding="$4" borderRadius={radius.card}>
                  <Text color={ui.textSecondary}>Sign in to see your support requests.</Text>
                  <AppLink href={signInHref as never} asChild>
                    <Button tone="primary" borderRadius={999} marginTop="$3" alignSelf="flex-start">
                      Sign in
                    </Button>
                  </AppLink>
                </SurfaceCard>
              ) : (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <XStack gap="$2">
                      {(audience === 'seller'
                        ? HELP_PRODUCT_FILTERS.filter((filter) => filter.key === 'shop' || filter.key === '')
                        : productFilters.filter((filter) => filter.key !== 'shop')
                      ).map((filter) => (
                        <Chip
                          key={`ticket-${filter.key || 'all'}`}
                          label={filter.label}
                          active={ticketFilter === filter.key}
                          onPress={() => setTicketFilter(filter.key)}
                        />
                      ))}
                    </XStack>
                  </ScrollView>

                  {ticketsLoading ? (
                    <XStack padding="$4" alignItems="center" gap="$2">
                      <Spinner size="small" />
                      <Text color={ui.textSecondary}>Loading requests…</Text>
                    </XStack>
                  ) : tickets.length === 0 ? (
                    <SurfaceCard padding="$4" borderRadius={radius.card}>
                      <Text color={ui.textMuted}>You have not sent any support requests yet.</Text>
                      <Button
                        tone="outline"
                        borderRadius={999}
                        marginTop="$3"
                        alignSelf="flex-start"
                        onPress={() => setTab('contact')}
                      >
                        Contact support
                      </Button>
                    </SurfaceCard>
                  ) : (
                    <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
                      {tickets.map((ticket, index) => {
                        const open = expandedTicketId === ticket.id
                        const canClose =
                          ticket.status !== 'closed' && ticket.status !== 'resolved'
                        return (
                          <YStack key={ticket.id}>
                            {index > 0 ? <Separator /> : null}
                            <YStack
                              paddingHorizontal="$4"
                              paddingVertical="$3.5"
                              gap="$2"
                              cursor="pointer"
                              onPress={() =>
                                setExpandedTicketId(open ? null : ticket.id)
                              }
                            >
                              <XStack alignItems="center" gap="$2" flexWrap="wrap">
                                <StatusBadge status={ticket.status} />
                                <Text fontSize={12} color={ui.textMuted}>
                                  {helpProductLabel(ticket.product)}
                                </Text>
                                {ticket.priority === 'high' ? (
                                  <Text fontSize={12} fontWeight="700" color={ui.danger}>
                                    High priority
                                  </Text>
                                ) : null}
                              </XStack>
                              <Text fontSize={15} fontWeight="600" color={ui.text}>
                                {ticket.subject}
                              </Text>
                              <Text
                                fontSize={13}
                                color={ui.textSecondary}
                                numberOfLines={open ? undefined : 3}
                              >
                                {ticket.description}
                              </Text>
                              <Text fontSize={11} color={ui.textMuted}>
                                {new Date(ticket.created_at).toLocaleString('en-IN')}
                              </Text>
                              {open ? (
                                <XStack gap="$2" flexWrap="wrap" paddingTop="$1">
                                  {canClose ? (
                                    <Button
                                      size="$3"
                                      tone="outline"
                                      borderRadius={999}
                                      onPress={(e) => {
                                        e?.stopPropagation?.()
                                        void handleCloseTicket(ticket)
                                      }}
                                    >
                                      Close request
                                    </Button>
                                  ) : null}
                                  <Button
                                    size="$3"
                                    tone="outline"
                                    borderRadius={999}
                                    icon={<Icons.Sparkles size={14} color={ui.brand} />}
                                    onPress={(e) => {
                                      e?.stopPropagation?.()
                                      void askSherpa(
                                        `Help me with my support request: ${ticket.subject}. ${ticket.description}`,
                                      )
                                    }}
                                  >
                                    Ask {AI_NAME} about this
                                  </Button>
                                </XStack>
                              ) : null}
                            </YStack>
                          </YStack>
                        )
                      })}
                    </SurfaceCard>
                  )}
                </>
              )}
            </YStack>
          ) : null}

          <SurfaceCard padding="$4" borderRadius={radius.card}>
            <XStack alignItems="center" gap="$2" flexWrap="wrap">
              <Icons.Settings size={16} color={ui.textMuted} />
              <AppLink href={routes.settings}>
                <Text color={ui.brand} fontWeight="600">
                  Open Settings
                </Text>
              </AppLink>
              <Text color={ui.textMuted}>for notification and account preferences.</Text>
            </XStack>
          </SurfaceCard>
        </YStack>
      </PageSection>
    </FullWidthLayout>
  )
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string
  active?: boolean
  onPress: () => void
}) {
  const ui = useAppUi()
  return (
    <XStack
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderRadius={999}
      borderWidth={1}
      borderColor={active ? ui.brand : ui.borderSubtle}
      backgroundColor={active ? ui.chip : ui.surface}
      cursor="pointer"
      onPress={onPress}
      hoverStyle={{ backgroundColor: ui.surfaceHover }}
    >
      <Text fontSize={13} fontWeight={active ? '700' : '500'} color={active ? ui.brand : ui.text}>
        {label}
      </Text>
    </XStack>
  )
}

function StatusBadge({ status }: { status: string }) {
  const ui = useAppUi()
  const normalized = status.toLowerCase()
  const tone =
    normalized === 'resolved' || normalized === 'closed'
      ? ui.success
      : normalized === 'in_progress'
        ? ui.brand
        : ui.textSecondary

  const label =
    normalized === 'in_progress'
      ? 'In progress'
      : normalized.charAt(0).toUpperCase() + normalized.slice(1)

  return (
    <XStack
      paddingHorizontal="$2"
      paddingVertical={3}
      borderRadius={999}
      backgroundColor={ui.surfaceMuted}
    >
      <Text fontSize={11} fontWeight="700" color={tone}>
        {label}
      </Text>
    </XStack>
  )
}
