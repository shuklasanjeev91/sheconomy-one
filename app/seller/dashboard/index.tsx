import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Platform } from 'react-native'
import type { ComponentType } from 'react'

import { RequireAdmin } from '~/components/auth/RouteGuard'
import { PageScroll } from '~/components/layout'
import {
  Avatar,
  Button,
  DateTimeField,
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogTitle,
  Icons,
  ScrollView,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectViewport,
  Spinner,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { openExternalUrl } from '~/lib/platform/openUrl'
import { supabase } from '~/lib/supabase'
import { USER_ROLES } from '~/lib/profile/profile.type'

import {
  AUTO_REFRESH_SECONDS,
  buildSellerLeadsCsv,
  DATE_PRESET_OPTIONS,
  formatDateTime,
  getDateRangeBounds,
  getEffectiveCampaign,
  getEffectiveMedium,
  getEffectiveSource,
  getLeadEventTimestamp,
  getValidTimestamp,
  isDateWithinRange,
  PAGE_SIZE,
  parseDeviceInfo,
  resolveJourneyStatus,
  STATUS_CONFIG,
  STATUS_FILTERS,
  type DateRangePreset,
  type JourneyStatus,
  type LeadStats,
  type LeadWithJourney,
  type ShopRow,
} from './crm-helpers'

type IconComp = ComponentType<{ size?: number; color?: string }>

function sourceIcon(source: string | null | undefined): { Icon: IconComp; color: string } {
  switch (source?.toLowerCase()) {
    case 'facebook':
      return { Icon: Icons.Facebook, color: '#2563EB' }
    case 'instagram':
      return { Icon: Icons.Instagram, color: '#EC4899' }
    case 'twitter':
      return { Icon: Icons.Twitter, color: '#38BDF8' }
    case 'linkedin':
      return { Icon: Icons.Linkedin, color: '#1D4ED8' }
    case 'google':
      return { Icon: Icons.Globe, color: '#3B82F6' }
    case 'youtube':
      return { Icon: Icons.Youtube, color: '#DC2626' }
    default:
      return { Icon: Icons.Globe, color: '#94A3B8' }
  }
}

function StatusBadge({ status }: { status: JourneyStatus }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.otp_only
  const Icon =
    status === 'seller'
      ? Icons.Store
      : status === 'face_verified'
        ? Icons.ShieldCheck
        : status === 'verified'
          ? Icons.CheckCircle
          : Icons.Clock

  return (
    <XStack
      alignItems="center"
      gap={6}
      paddingHorizontal={10}
      paddingVertical={4}
      borderRadius={999}
      backgroundColor={cfg.bg}
      borderWidth={1}
      borderColor={cfg.border}
      alignSelf="flex-start"
    >
      <Icon size={12} color={cfg.color} />
      <Text fontSize={11} fontWeight="600" color={cfg.color}>
        {cfg.label}
      </Text>
    </XStack>
  )
}

function FunnelBar({ rate, color }: { rate: number; color: string }) {
  return (
    <YStack height={8} backgroundColor="#F1F5F9" borderRadius={999} overflow="hidden">
      <YStack height="100%" width={`${Math.max(0, Math.min(100, rate))}%`} backgroundColor={color} borderRadius={999} />
    </YStack>
  )
}

function FilterChip({
  active,
  label,
  onPress,
  activeBg = '#7C3AED',
  count,
  icon,
}: {
  active: boolean
  label: string
  onPress: () => void
  activeBg?: string
  count?: number
  icon?: ReactNode
}) {
  return (
    <Button
      size="$2"
      borderRadius={999}
      backgroundColor={active ? activeBg : 'white'}
      borderWidth={1}
      borderColor={active ? activeBg : '#E2E8F0'}
      onPress={onPress}
      hoverStyle={{ backgroundColor: active ? activeBg : '#F8FAFC' }}
      paddingHorizontal="$3"
      height={32}
    >
      <XStack alignItems="center" gap={6}>
        {icon}
        <Text fontSize={12} fontWeight="600" color={active ? 'white' : '#475569'} textTransform="capitalize">
          {label}
        </Text>
        {count != null ? (
          <YStack
            paddingHorizontal={6}
            paddingVertical={1}
            borderRadius={999}
            backgroundColor={active ? 'rgba(255,255,255,0.2)' : '#F1F5F9'}
          >
            <Text fontSize={10} color={active ? 'white' : '#475569'}>
              {count}
            </Text>
          </YStack>
        ) : null}
      </XStack>
    </Button>
  )
}

function SellerLeadsCRM() {
  const [loading, setLoading] = useState(true)
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('30days')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [pendingCustomStartDate, setPendingCustomStartDate] = useState('')
  const [pendingCustomEndDate, setPendingCustomEndDate] = useState('')
  const [leads, setLeads] = useState<LeadWithJourney[]>([])
  const [stats, setStats] = useState<LeadStats>({
    total: 0,
    completed: 0,
    otpOnly: 0,
    faceVerified: 0,
    sources: {},
  })
  const [sourceFilter, setSourceFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(AUTO_REFRESH_SECONDS)
  const [selectedLead, setSelectedLead] = useState<LeadWithJourney | null>(null)
  const [shopData, setShopData] = useState<ShopRow | null>(null)
  const [shopLoading, setShopLoading] = useState(false)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchSellerLeads = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(
          'role.eq.V,' +
            'device_info->>verification_source.ilike.%sellerlanding%,' +
            'device_info->>landing_url.ilike.%sellerlanding%,' +
            'device_info->>source.ilike.%sellerlanding%,' +
            'utm_source.not.is.null,' +
            'device_info->>landing_url.ilike.%gclid%,' +
            'device_info->>landing_url.ilike.%gad_source%',
        )
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Query error:', error)
        if (!silent) {
          setLeads([])
          setStats({ total: 0, completed: 0, otpOnly: 0, faceVerified: 0, sources: {} })
        }
        return
      }

      const leadsWithStatus: LeadWithJourney[] = (data || []).map((lead) => ({
        ...lead,
        journeyStatus: resolveJourneyStatus(lead),
      }))

      const sourceCount: Record<string, number> = {}
      let completed = 0
      let otpOnly = 0
      let faceVerified = 0

      leadsWithStatus.forEach((lead) => {
        const source = getEffectiveSource(lead)
        sourceCount[source] = (sourceCount[source] || 0) + 1
        if (lead.role === USER_ROLES.VENDOR) completed++
        else if (lead.is_verified && lead.gender) faceVerified++
        else otpOnly++
      })

      setLeads(leadsWithStatus)
      setStats({
        total: leadsWithStatus.length,
        completed,
        otpOnly,
        faceVerified,
        sources: sourceCount,
      })
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchShopData = async (userId: string) => {
    setShopLoading(true)
    setShopData(null)
    try {
      const { data, error } = await supabase.from('shops').select('*').eq('user_id', userId).maybeSingle()
      if (!error) setShopData(data)
    } catch (e) {
      console.error('Shop fetch error:', e)
    } finally {
      setShopLoading(false)
    }
  }

  const resetCountdown = useCallback(() => {
    setCountdown(AUTO_REFRESH_SECONDS)
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? AUTO_REFRESH_SECONDS : prev - 1))
    }, 1000)
  }, [])

  useEffect(() => {
    void fetchSellerLeads()
    resetCountdown()
    refreshRef.current = setInterval(() => {
      void fetchSellerLeads(true)
      resetCountdown()
    }, AUTO_REFRESH_SECONDS * 1000)
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [fetchSellerLeads, resetCountdown])

  useEffect(() => {
    setCurrentPage(1)
  }, [sourceFilter, statusFilter, dateRangePreset, customStartDate, customEndDate])

  const activeDateRange = useMemo(
    () => getDateRangeBounds(dateRangePreset, customStartDate, customEndDate),
    [dateRangePreset, customStartDate, customEndDate],
  )

  const filteredLeads = useMemo(() => {
    return leads
      .filter((lead) => {
        const { from, to } = activeDateRange
        const eventTimestamp = getLeadEventTimestamp(lead)
        if (!isDateWithinRange(eventTimestamp, from, to)) return false
        const src = getEffectiveSource(lead)
        if (sourceFilter !== 'all' && src !== sourceFilter) return false
        if (statusFilter !== 'all' && lead.journeyStatus !== statusFilter) return false
        return true
      })
      .sort((a, b) => {
        const aTs = getValidTimestamp(getLeadEventTimestamp(a))?.getTime() || 0
        const bTs = getValidTimestamp(getLeadEventTimestamp(b))?.getTime() || 0
        return bTs - aTs
      })
  }, [leads, activeDateRange, sourceFilter, statusFilter])

  const filteredStats = useMemo(() => {
    return filteredLeads.reduce(
      (acc, lead) => {
        acc.total += 1
        if (lead.journeyStatus === 'seller') acc.completed += 1
        else if (lead.journeyStatus === 'face_verified') acc.faceVerified += 1
        else acc.otpOnly += 1
        return acc
      },
      { total: 0, completed: 0, otpOnly: 0, faceVerified: 0 },
    )
  }, [filteredLeads])

  const hasPendingCustomRangeChanges =
    pendingCustomStartDate !== customStartDate || pendingCustomEndDate !== customEndDate

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE))
  const pagedLeads = filteredLeads.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const exportCSV = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return
    const csv = buildSellerLeadsCsv(filteredLeads)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'seller_leads.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const openModal = (lead: LeadWithJourney) => {
    setSelectedLead(lead)
    if (lead.role === USER_ROLES.VENDOR) void fetchShopData(lead.id)
    else setShopData(null)
  }

  const closeModal = () => {
    setSelectedLead(null)
    setShopData(null)
  }

  const step12Rate =
    filteredStats.total > 0
      ? Math.round(((filteredStats.faceVerified + filteredStats.completed) / filteredStats.total) * 100)
      : 0
  const step23Denom = filteredStats.faceVerified + filteredStats.completed
  const step23Rate = step23Denom > 0 ? Math.round((filteredStats.completed / step23Denom) * 100) : 0
  const overallRate =
    filteredStats.total > 0 ? Math.round((filteredStats.completed / filteredStats.total) * 100) : 0

  const pageButtons = useMemo(() => {
    const pages: number[] = []
    const maxShow = Math.min(totalPages, 7)
    for (let i = 0; i < maxShow; i++) {
      let page: number
      if (totalPages <= 7) page = i + 1
      else if (currentPage <= 4) page = i + 1
      else if (currentPage >= totalPages - 3) page = totalPages - 6 + i
      else page = currentPage - 3 + i
      pages.push(page)
    }
    return pages
  }, [currentPage, totalPages])

  if (loading) {
    return (
      <PageScroll>
        <YStack width="100%" backgroundColor="#F8FAFC" padding={24} gap="$5" minHeight={400}>
          <XStack justifyContent="center" alignItems="center" paddingVertical="$10" gap="$3">
            <Spinner size="large" color="#7C3AED" />
            <Text color="#64748B">Loading seller leads…</Text>
          </XStack>
        </YStack>
      </PageScroll>
    )
  }

  return (
    <PageScroll>
      <YStack width="100%" backgroundColor="#F8FAFC" padding={24} paddingBottom={40} gap="$5">
        {/* Header */}
        <XStack justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap="$4">
          <YStack>
            <XStack alignItems="center" gap="$2">
              <YStack
                width={32}
                height={32}
                borderRadius={8}
                backgroundColor="#7C3AED"
                alignItems="center"
                justifyContent="center"
              >
                <Icons.TrendingUp size={16} color="white" />
              </YStack>
              <Text fontSize={20} fontWeight="700" color="#0F172A">
                Seller Leads CRM
              </Text>
            </XStack>
            <Text fontSize={12} color="#64748B" marginTop={4} marginLeft={40}>
              Real-time funnel tracking · {filteredLeads.length} leads shown
            </Text>
          </YStack>

          <XStack flexWrap="wrap" alignItems="center" gap="$2">
            <XStack
              alignItems="center"
              gap={6}
              paddingHorizontal={12}
              paddingVertical={8}
              backgroundColor="white"
              borderWidth={1}
              borderColor="#E2E8F0"
              borderRadius={8}
            >
              <Icons.Zap size={14} color="#8B5CF6" />
              <Text fontSize={12} color="#64748B">
                Auto-refresh in{' '}
                <Text fontWeight="700" color="#7C3AED">
                  {countdown}s
                </Text>
              </Text>
            </XStack>

            <Select
              value={dateRangePreset}
              onValueChange={(v) => {
                const next = v as DateRangePreset
                setDateRangePreset(next)
                if (next === 'custom') {
                  setPendingCustomStartDate(customStartDate)
                  setPendingCustomEndDate(customEndDate)
                }
              }}
            >
              <SelectTrigger width={160} backgroundColor="white" borderColor="#E2E8F0">
                <Select.Value placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectViewport>
                  {DATE_PRESET_OPTIONS.map((opt, index) => (
                    <SelectItem key={opt.value} value={opt.value} index={index}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectViewport>
              </SelectContent>
            </Select>

            {dateRangePreset === 'custom' ? (
              <>
                <DateTimeField
                  mode="date"
                  value={pendingCustomStartDate}
                  onChange={setPendingCustomStartDate}
                  placeholder="Start date"
                  minWidth={140}
                />
                <DateTimeField
                  mode="date"
                  value={pendingCustomEndDate}
                  onChange={setPendingCustomEndDate}
                  placeholder="End date"
                  minWidth={140}
                />
                <Button
                  size="$3"
                  backgroundColor={hasPendingCustomRangeChanges ? '#1E293B' : '#CBD5E1'}
                  color="white"
                  disabled={!hasPendingCustomRangeChanges}
                  onPress={() => {
                    setCustomStartDate(pendingCustomStartDate)
                    setCustomEndDate(pendingCustomEndDate)
                  }}
                >
                  Apply
                </Button>
              </>
            ) : null}

            <Button
              size="$3"
              circular
              backgroundColor="white"
              borderWidth={1}
              borderColor="#E2E8F0"
              icon={Icons.RefreshCw}
              onPress={() => {
                void fetchSellerLeads()
                resetCountdown()
              }}
            />

            <Button
              size="$3"
              backgroundColor="#7C3AED"
              color="white"
              icon={Icons.Download}
              hoverStyle={{ backgroundColor: '#6D28D9' }}
              onPress={exportCSV}
            >
              Export CSV
            </Button>
          </XStack>
        </XStack>

        {/* Stat cards */}
        <XStack flexWrap="wrap" gap="$3">
          {[
            {
              label: 'Total Leads',
              value: filteredStats.total,
              sub: 'From seller landing',
              iconBg: '#F1F5F9',
              iconColor: '#475569',
              Icon: Icons.Users,
            },
            {
              label: 'OTP Only',
              value: filteredStats.otpOnly,
              sub: "Didn't proceed further",
              iconBg: '#FFFBEB',
              iconColor: '#F59E0B',
              Icon: Icons.Clock,
            },
            {
              label: 'Face Verified',
              value: filteredStats.faceVerified,
              sub: 'Completed step 2',
              iconBg: '#EFF6FF',
              iconColor: '#3B82F6',
              Icon: Icons.ShieldCheck,
            },
            {
              label: 'Converted',
              value: filteredStats.completed,
              sub: 'Active sellers',
              iconBg: '#ECFDF5',
              iconColor: '#10B981',
              Icon: Icons.Store,
            },
          ].map((card) => {
            const Icon = card.Icon
            return (
              <YStack
                key={card.label}
                flex={1}
                minWidth={200}
                backgroundColor="white"
                borderRadius={12}
                paddingHorizontal="$4"
                paddingVertical="$3.5"
                borderWidth={1}
                borderColor="#F1F5F9"
                flexDirection="row"
                alignItems="center"
                gap="$3"
              >
                <YStack
                  width={44}
                  height={44}
                  borderRadius={12}
                  backgroundColor={card.iconBg}
                  alignItems="center"
                  justifyContent="center"
                  flexShrink={0}
                >
                  <Icon size={20} color={card.iconColor} />
                </YStack>
                <YStack flex={1} minWidth={0}>
                  <Text fontSize={22} fontWeight="700" color="#1E293B">
                    {card.value}
                  </Text>
                  <Text fontSize={13} fontWeight="600" color="#334155" marginTop={2}>
                    {card.label}
                  </Text>
                  <Text fontSize={11} color="#94A3B8" numberOfLines={1}>
                    {card.sub}
                  </Text>
                </YStack>
              </YStack>
            )
          })}
        </XStack>

        {/* Funnel insights */}
        <YStack backgroundColor="white" borderRadius={16} borderWidth={1} borderColor="#F1F5F9" padding="$4" gap="$3">
          <XStack alignItems="center" gap="$2">
            <Icons.BarChart2 size={16} color="#8B5CF6" />
            <Text fontWeight="600" color="#1E293B" fontSize={13}>
              Funnel Insights
            </Text>
          </XStack>
          <XStack flexWrap="wrap" gap="$5">
            {[
              {
                label: 'Step 1 → 2',
                rate: step12Rate,
                desc: `${filteredStats.faceVerified + filteredStats.completed} of ${filteredStats.total} proceeded`,
                color: '#3B82F6',
              },
              {
                label: 'Step 2 → 3',
                rate: step23Rate,
                desc: `${filteredStats.completed} of ${step23Denom} converted`,
                color: '#10B981',
              },
              {
                label: 'Overall',
                rate: overallRate,
                desc: `${filteredStats.completed} of ${filteredStats.total} became sellers`,
                color: '#8B5CF6',
              },
            ].map((f) => (
              <YStack key={f.label} flex={1} minWidth={180} gap="$1.5">
                <XStack justifyContent="space-between">
                  <Text fontSize={12} fontWeight="500" color="#475569">
                    {f.label}
                  </Text>
                  <Text fontSize={12} fontWeight="700" color="#1E293B">
                    {f.rate}%
                  </Text>
                </XStack>
                <FunnelBar rate={f.rate} color={f.color} />
                <Text fontSize={11} color="#94A3B8">
                  {f.desc}
                </Text>
              </YStack>
            ))}
          </XStack>
        </YStack>

        {/* Filters */}
        <YStack backgroundColor="white" borderRadius={16} borderWidth={1} borderColor="#F1F5F9" padding="$4" gap="$3">
          <XStack flexWrap="wrap" alignItems="center" gap="$2">
            <XStack alignItems="center" gap={6} marginRight="$1">
              <Icons.Filter size={14} color="#64748B" />
              <Text fontSize={11} fontWeight="700" color="#64748B" textTransform="uppercase" letterSpacing={0.6}>
                Source
              </Text>
            </XStack>
            <FilterChip active={sourceFilter === 'all'} label="All" onPress={() => setSourceFilter('all')} />
            {Object.keys(stats.sources).map((key) => {
              const { Icon, color } = sourceIcon(key)
              return (
                <FilterChip
                  key={key}
                  active={sourceFilter === key}
                  label={key}
                  count={stats.sources[key] || 0}
                  onPress={() => setSourceFilter(key)}
                  icon={<Icon size={12} color={sourceFilter === key ? 'white' : color} />}
                />
              )
            })}
          </XStack>

          <XStack flexWrap="wrap" alignItems="center" gap="$2">
            <XStack alignItems="center" gap={6} marginRight="$1">
              <Icons.Activity size={14} color="#64748B" />
              <Text fontSize={11} fontWeight="700" color="#64748B" textTransform="uppercase" letterSpacing={0.6}>
                Stage
              </Text>
            </XStack>
            {STATUS_FILTERS.map(({ key, label }) => {
              const cfg = STATUS_CONFIG[key as JourneyStatus]
              return (
                <FilterChip
                  key={key}
                  active={statusFilter === key}
                  label={label}
                  activeBg="#1E293B"
                  onPress={() => setStatusFilter(key)}
                  icon={
                    cfg ? (
                      <YStack width={8} height={8} borderRadius={999} backgroundColor={cfg.dot} />
                    ) : undefined
                  }
                />
              )
            })}
          </XStack>
        </YStack>

        {/* Leads table */}
        <YStack
          backgroundColor="white"
          borderRadius={16}
          borderWidth={1}
          borderColor="#F1F5F9"
          overflow="hidden"
        >
          <XStack
            paddingHorizontal="$4"
            paddingVertical="$3.5"
            borderBottomWidth={1}
            borderColor="#F1F5F9"
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            gap="$2"
          >
            <Text fontWeight="600" color="#1E293B" fontSize={13}>
              All Leads{' '}
              <Text fontWeight="400" color="#94A3B8" fontSize={12}>
                ({filteredLeads.length} results)
              </Text>
            </Text>
            {lastUpdated ? (
              <XStack alignItems="center" gap={4}>
                <Icons.Clock size={12} color="#94A3B8" />
                <Text fontSize={11} color="#94A3B8">
                  Updated{' '}
                  {lastUpdated.toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true,
                  })}
                </Text>
              </XStack>
            ) : null}
          </XStack>

          <ScrollView horizontal showsHorizontalScrollIndicator>
            <YStack minWidth={980}>
              <XStack
                paddingHorizontal="$4"
                paddingVertical="$3"
                backgroundColor="#F8FAFC"
                borderBottomWidth={1}
                borderColor="#F1F5F9"
              >
                {['User', 'Contact', 'Source', 'Campaign', 'Stage', 'Lead Date', 'Action'].map((h, i) => (
                  <Text
                    key={h}
                    flex={i === 0 ? 2.2 : i === 6 ? 1 : i === 4 || i === 5 ? 1.3 : 1.5}
                    fontSize={11}
                    fontWeight="700"
                    color="#64748B"
                    textTransform="uppercase"
                    letterSpacing={0.4}
                    textAlign={i === 6 ? 'center' : 'left'}
                  >
                    {h}
                  </Text>
                ))}
              </XStack>

              {pagedLeads.map((lead) => {
                const dt = formatDateTime(getLeadEventTimestamp(lead) || lead.created_at)
                const src = getEffectiveSource(lead)
                const med = getEffectiveMedium(lead)
                const { Icon: SrcIcon, color: srcColor } = sourceIcon(src)
                const isAd = !lead.utm_source && src === 'google' && med === 'cpc'
                const initial = (lead.full_name || lead.username || 'A')[0]?.toUpperCase() || 'A'

                return (
                  <XStack
                    key={lead.id}
                    paddingHorizontal="$4"
                    paddingVertical="$3.5"
                    borderBottomWidth={1}
                    borderColor="#F8FAFC"
                    alignItems="center"
                    hoverStyle={{ backgroundColor: '#F8FAFC' }}
                  >
                    <XStack flex={2.2} alignItems="center" gap="$3" minWidth={0}>
                      <YStack position="relative">
                        <Avatar
                          src={lead.avatar_url}
                          name={lead.full_name || lead.username || initial}
                          size="$4"
                        />
                        <YStack
                          position="absolute"
                          bottom={-1}
                          right={-1}
                          width={10}
                          height={10}
                          borderRadius={999}
                          borderWidth={2}
                          borderColor="white"
                          backgroundColor={lead.is_online ? '#10B981' : '#CBD5E1'}
                        />
                      </YStack>
                      <YStack flex={1} minWidth={0}>
                        <Text fontWeight="700" color="#1E293B" fontSize={13} numberOfLines={1}>
                          {lead.full_name || lead.username || 'Anonymous'}
                        </Text>
                        <Text fontSize={11} color="#94A3B8" numberOfLines={1}>
                          @{lead.username}
                        </Text>
                        {lead.business_name ? (
                          <XStack alignItems="center" gap={4} marginTop={2}>
                            <Icons.Briefcase size={11} color="#7C3AED" />
                            <Text fontSize={11} color="#7C3AED" numberOfLines={1}>
                              {lead.business_name}
                            </Text>
                          </XStack>
                        ) : null}
                      </YStack>
                    </XStack>

                    <YStack flex={1.5} gap={4} minWidth={0}>
                      {lead.email ? (
                        <XStack alignItems="center" gap={6}>
                          <Icons.Mail size={12} color="#94A3B8" />
                          <Text fontSize={11} color="#64748B" numberOfLines={1}>
                            {lead.email}
                          </Text>
                        </XStack>
                      ) : null}
                      {lead.phone ? (
                        <XStack alignItems="center" gap={6}>
                          <Icons.Phone size={12} color="#94A3B8" />
                          <Text fontSize={11} color="#64748B">
                            {lead.phone}
                          </Text>
                        </XStack>
                      ) : null}
                    </YStack>

                    <YStack flex={1.5} minWidth={0}>
                      <XStack alignItems="center" gap={6}>
                        <SrcIcon size={14} color={srcColor} />
                        <Text fontSize={12} fontWeight="500" color="#334155" textTransform="capitalize">
                          {src}
                        </Text>
                        {isAd ? (
                          <YStack
                            paddingHorizontal={6}
                            paddingVertical={2}
                            borderRadius={999}
                            backgroundColor="#FEF3C7"
                          >
                            <Text fontSize={9} fontWeight="700" color="#A16207">
                              Ad
                            </Text>
                          </YStack>
                        ) : null}
                      </XStack>
                      {med ? (
                        <Text fontSize={11} color="#94A3B8" marginTop={2}>
                          {med}
                        </Text>
                      ) : null}
                    </YStack>

                    <Text flex={1.5} fontSize={12} color="#475569" numberOfLines={1}>
                      {lead.utm_campaign || '—'}
                    </Text>

                    <YStack flex={1.3}>
                      <StatusBadge status={lead.journeyStatus} />
                    </YStack>

                    <YStack flex={1.3}>
                      <Text fontSize={12} fontWeight="500" color="#334155">
                        {dt.date}
                      </Text>
                      <Text fontSize={11} color="#94A3B8" marginTop={2}>
                        {dt.time}
                      </Text>
                    </YStack>

                    <XStack flex={1} justifyContent="center">
                      <Button
                        size="$2"
                        backgroundColor="#F1F5F9"
                        color="#475569"
                        icon={Icons.Eye}
                        borderRadius={8}
                        hoverStyle={{ backgroundColor: '#EDE9FE', color: '#6D28D9' }}
                        onPress={() => openModal(lead)}
                      >
                        View
                      </Button>
                    </XStack>
                  </XStack>
                )
              })}

              {filteredLeads.length === 0 ? (
                <YStack alignItems="center" paddingVertical="$10" gap="$2">
                  <YStack
                    width={56}
                    height={56}
                    borderRadius={16}
                    backgroundColor="#F1F5F9"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Icons.Users size={28} color="#CBD5E1" />
                  </YStack>
                  <Text fontSize={13} fontWeight="600" color="#64748B">
                    No leads found
                  </Text>
                  <Text fontSize={11} color="#94A3B8">
                    Try adjusting the filters or date range
                  </Text>
                </YStack>
              ) : null}
            </YStack>
          </ScrollView>

          {filteredLeads.length > PAGE_SIZE ? (
            <XStack
              paddingHorizontal="$4"
              paddingVertical="$3"
              borderTopWidth={1}
              borderColor="#F1F5F9"
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
              gap="$3"
            >
              <Text fontSize={12} color="#64748B">
                Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, filteredLeads.length)}–
                {Math.min(currentPage * PAGE_SIZE, filteredLeads.length)} of {filteredLeads.length}
              </Text>
              <XStack alignItems="center" gap={4}>
                <Button
                  size="$2"
                  circular
                  backgroundColor="white"
                  borderWidth={1}
                  borderColor="#E2E8F0"
                  icon={Icons.ChevronLeft}
                  disabled={currentPage === 1}
                  opacity={currentPage === 1 ? 0.4 : 1}
                  onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                />
                {pageButtons.map((page) => (
                  <Button
                    key={page}
                    size="$2"
                    width={28}
                    height={28}
                    padding={0}
                    borderRadius={8}
                    backgroundColor={currentPage === page ? '#7C3AED' : 'white'}
                    color={currentPage === page ? 'white' : '#475569'}
                    borderWidth={1}
                    borderColor={currentPage === page ? '#7C3AED' : '#E2E8F0'}
                    onPress={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  size="$2"
                  circular
                  backgroundColor="white"
                  borderWidth={1}
                  borderColor="#E2E8F0"
                  icon={Icons.ChevronRight}
                  disabled={currentPage === totalPages}
                  opacity={currentPage === totalPages ? 0.4 : 1}
                  onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                />
              </XStack>
            </XStack>
          ) : null}

          <XStack
            paddingHorizontal="$4"
            paddingVertical="$2.5"
            backgroundColor="#F8FAFC"
            borderTopWidth={1}
            borderColor="#F1F5F9"
            justifyContent="space-between"
            flexWrap="wrap"
            gap="$1"
          >
            <Text fontSize={11} color="#94A3B8">
              OTP: {filteredStats.otpOnly} · Face Verified: {filteredStats.faceVerified} · Converted:{' '}
              {filteredStats.completed} · Total: {filteredStats.total}
            </Text>
            {lastUpdated ? (
              <Text fontSize={11} color="#94A3B8">
                Last sync: {lastUpdated.toLocaleString('en-IN')}
              </Text>
            ) : null}
          </XStack>
        </YStack>

        {/* Lead detail modal */}
        <Dialog open={Boolean(selectedLead)} onOpenChange={(open) => !open && closeModal()}>
          <DialogOverlay key="overlay" />
          <DialogContent key="content" maxWidth={640} width="94%" maxHeight="90%" padding="$0" showClose>
            <DialogTitle paddingHorizontal="$5" paddingTop="$4" paddingBottom="$3" borderBottomWidth={1} borderColor="#F1F5F9">
              Lead Profile
            </DialogTitle>
            {selectedLead ? (
              <ScrollView maxHeight={560}>
                <YStack padding="$5" gap="$4">
                  <XStack alignItems="center" gap="$4">
                    <YStack position="relative">
                      <Avatar
                        src={selectedLead.avatar_url}
                        name={selectedLead.full_name || selectedLead.username || 'A'}
                        size="$6"
                      />
                      <YStack
                        position="absolute"
                        bottom={-2}
                        right={-2}
                        width={14}
                        height={14}
                        borderRadius={999}
                        borderWidth={2}
                        borderColor="white"
                        backgroundColor={selectedLead.is_online ? '#10B981' : '#CBD5E1'}
                      />
                    </YStack>
                    <YStack flex={1} minWidth={0} gap="$1">
                      <Text fontSize={18} fontWeight="700" color="#0F172A" numberOfLines={1}>
                        {selectedLead.full_name || 'N/A'}
                      </Text>
                      <Text fontSize={13} color="#64748B">
                        @{selectedLead.username}
                      </Text>
                      {selectedLead.business_name ? (
                        <XStack alignItems="center" gap={4}>
                          <Icons.Briefcase size={12} color="#7C3AED" />
                          <Text fontSize={12} color="#7C3AED">
                            {selectedLead.business_name}
                          </Text>
                        </XStack>
                      ) : null}
                      <StatusBadge status={selectedLead.journeyStatus} />
                    </YStack>
                    <YStack alignItems="flex-end" gap={4}>
                      <YStack
                        paddingHorizontal={10}
                        paddingVertical={4}
                        borderRadius={999}
                        backgroundColor={
                          selectedLead.account_status === 'active'
                            ? '#D1FAE5'
                            : selectedLead.account_status === 'pending'
                              ? '#FEF3C7'
                              : '#FEE2E2'
                        }
                      >
                        <Text
                          fontSize={11}
                          fontWeight="600"
                          color={
                            selectedLead.account_status === 'active'
                              ? '#047857'
                              : selectedLead.account_status === 'pending'
                                ? '#B45309'
                                : '#B91C1C'
                          }
                        >
                          {selectedLead.account_status}
                        </Text>
                      </YStack>
                      {selectedLead.is_banned ? (
                        <YStack paddingHorizontal={8} paddingVertical={2} borderRadius={999} backgroundColor="#FEE2E2">
                          <Text fontSize={11} color="#DC2626">
                            Banned
                          </Text>
                        </YStack>
                      ) : null}
                    </YStack>
                  </XStack>

                  {selectedLead.bio ? (
                    <YStack backgroundColor="#F8FAFC" borderRadius={12} padding="$3">
                      <Text fontSize={12} color="#475569" lineHeight={18}>
                        {selectedLead.bio}
                      </Text>
                    </YStack>
                  ) : null}

                  <XStack flexWrap="wrap" gap="$3">
                    {(
                      [
                        { label: 'Email', value: selectedLead.email, Icon: Icons.Mail },
                        { label: 'Phone', value: selectedLead.phone, Icon: Icons.Phone },
                        { label: 'Location', value: selectedLead.location, Icon: Icons.MapPin },
                        { label: 'Occupation', value: selectedLead.occupation, Icon: Icons.Briefcase },
                        { label: 'Industry', value: selectedLead.industry, Icon: Icons.Building2 },
                        { label: 'Headline', value: selectedLead.headline, Icon: Icons.Hash },
                        { label: 'Website', value: selectedLead.website_url, Icon: Icons.Link, link: true },
                        { label: 'Referral Code', value: selectedLead.referral_code, Icon: Icons.Star },
                        {
                          label: 'Profile %',
                          value:
                            selectedLead.profile_completion_percentage != null
                              ? `${selectedLead.profile_completion_percentage}%`
                              : null,
                          Icon: Icons.Activity,
                        },
                        { label: 'Login Count', value: selectedLead.login_count, Icon: Icons.Eye },
                      ] as const
                    )
                      .filter((f) => f.value != null && f.value !== '')
                      .map(({ label, value, Icon, ...rest }) => (
                        <XStack
                          key={label}
                          width="47%"
                          minWidth={160}
                          flexGrow={1}
                          gap="$2"
                          backgroundColor="#F8FAFC"
                          borderRadius={12}
                          padding="$3"
                          alignItems="flex-start"
                        >
                          <YStack
                            width={24}
                            height={24}
                            borderRadius={8}
                            backgroundColor="#E2E8F0"
                            alignItems="center"
                            justifyContent="center"
                            flexShrink={0}
                            marginTop={2}
                          >
                            <Icon size={12} color="#475569" />
                          </YStack>
                          <YStack flex={1} minWidth={0}>
                            <Text fontSize={11} fontWeight="500" color="#64748B">
                              {label}
                            </Text>
                            {'link' in rest && rest.link ? (
                              <Text
                                fontSize={12}
                                color="#7C3AED"
                                numberOfLines={1}
                                cursor="pointer"
                                onPress={() => void openExternalUrl(String(value))}
                              >
                                {String(value)}
                              </Text>
                            ) : (
                              <Text fontSize={12} fontWeight="600" color="#1E293B" numberOfLines={2}>
                                {String(value)}
                              </Text>
                            )}
                          </YStack>
                        </XStack>
                      ))}
                  </XStack>

                  {/* Traffic attribution */}
                  <YStack borderWidth={1} borderStyle="dashed" borderColor="#E2E8F0" borderRadius={12} padding="$4" gap="$3">
                    <XStack alignItems="center" gap={6}>
                      <Icons.Activity size={14} color="#64748B" />
                      <Text fontSize={11} fontWeight="700" color="#64748B" textTransform="uppercase" letterSpacing={0.5}>
                        Traffic Attribution
                      </Text>
                    </XStack>
                    {(() => {
                      const effSrc = getEffectiveSource(selectedLead)
                      const effMed = getEffectiveMedium(selectedLead)
                      const effCamp = getEffectiveCampaign(selectedLead)
                      const di = parseDeviceInfo(selectedLead)
                      const landingUrl = typeof di.landing_url === 'string' ? di.landing_url : ''
                      const referrer = typeof di.referrer === 'string' ? di.referrer : ''
                      const { Icon: SrcIcon, color: srcColor } = sourceIcon(effSrc)
                      return (
                        <YStack gap="$3">
                          <XStack flexWrap="wrap" gap="$4">
                            {[
                              { label: 'Source', value: effSrc, showIcon: true },
                              { label: 'Medium', value: effMed },
                              { label: 'Campaign', value: effCamp },
                            ].map(({ label, value, showIcon }) => (
                              <YStack key={label} minWidth={100} flex={1}>
                                <Text fontSize={11} color="#94A3B8">
                                  {label}
                                </Text>
                                <XStack alignItems="center" gap={4} marginTop={2}>
                                  {showIcon ? <SrcIcon size={12} color={srcColor} /> : null}
                                  <Text fontSize={12} fontWeight="700" color="#334155" textTransform="capitalize">
                                    {value || '—'}
                                  </Text>
                                </XStack>
                              </YStack>
                            ))}
                          </XStack>
                          {!selectedLead.utm_source && (landingUrl || referrer) ? (
                            <YStack borderTopWidth={1} borderColor="#F1F5F9" paddingTop="$3" gap="$2">
                              {landingUrl ? (
                                <YStack>
                                  <Text fontSize={11} color="#94A3B8" marginBottom={2}>
                                    Landing URL
                                  </Text>
                                  <Text
                                    fontSize={11}
                                    color="#7C3AED"
                                    onPress={() => void openExternalUrl(landingUrl)}
                                    cursor="pointer"
                                  >
                                    {landingUrl}
                                  </Text>
                                </YStack>
                              ) : null}
                              {referrer ? (
                                <YStack>
                                  <Text fontSize={11} color="#94A3B8" marginBottom={2}>
                                    Referrer
                                  </Text>
                                  <Text fontSize={11} color="#475569">
                                    {referrer}
                                  </Text>
                                </YStack>
                              ) : null}
                            </YStack>
                          ) : null}
                        </YStack>
                      )
                    })()}
                  </YStack>

                  <XStack gap="$3">
                    {[
                      { label: 'Followers', value: selectedLead.follower_count || 0 },
                      { label: 'Following', value: selectedLead.following_count || 0 },
                      { label: 'Connections', value: selectedLead.connections_count || 0 },
                    ].map(({ label, value }) => (
                      <YStack key={label} flex={1} backgroundColor="#F8FAFC" borderRadius={12} paddingVertical="$3" alignItems="center">
                        <Text fontSize={18} fontWeight="700" color="#1E293B">
                          {value}
                        </Text>
                        <Text fontSize={11} color="#94A3B8">
                          {label}
                        </Text>
                      </YStack>
                    ))}
                  </XStack>

                  <XStack gap="$3" flexWrap="wrap">
                    <YStack flex={1} minWidth={140} backgroundColor="#F8FAFC" borderRadius={12} padding="$3">
                      <Text fontSize={12} fontWeight="600" color="#475569">
                        Joined
                      </Text>
                      <Text fontSize={11} color="#64748B">
                        {formatDateTime(selectedLead.created_at).date} · {formatDateTime(selectedLead.created_at).time}
                      </Text>
                    </YStack>
                    <YStack flex={1} minWidth={140} backgroundColor="#F8FAFC" borderRadius={12} padding="$3">
                      <Text fontSize={12} fontWeight="600" color="#475569">
                        Last Seen
                      </Text>
                      <Text fontSize={11} color="#64748B">
                        {selectedLead.last_seen
                          ? `${formatDateTime(selectedLead.last_seen).date} · ${formatDateTime(selectedLead.last_seen).time}`
                          : '—'}
                      </Text>
                    </YStack>
                  </XStack>

                  {selectedLead.role === USER_ROLES.VENDOR ? (
                    <YStack gap="$3">
                      <XStack alignItems="center" gap={6}>
                        <Icons.Store size={14} color="#10B981" />
                        <Text fontSize={11} fontWeight="700" color="#64748B" textTransform="uppercase" letterSpacing={0.5}>
                          Shop Information
                        </Text>
                      </XStack>
                      {shopLoading ? (
                        <YStack alignItems="center" padding="$4">
                          <Spinner />
                        </YStack>
                      ) : shopData ? (
                        <YStack
                          borderWidth={1}
                          borderColor="#D1FAE5"
                          backgroundColor="#ECFDF5"
                          borderRadius={12}
                          padding="$4"
                          gap="$3"
                        >
                          <XStack alignItems="center" gap="$3">
                            <Avatar src={shopData.logo_url} name={shopData.shop_name} size="$5" />
                            <YStack flex={1} minWidth={0}>
                              <Text fontWeight="700" color="#1E293B" numberOfLines={1}>
                                {shopData.shop_name}
                              </Text>
                              <XStack gap="$2" flexWrap="wrap" marginTop={4}>
                                <YStack
                                  paddingHorizontal={8}
                                  paddingVertical={2}
                                  borderRadius={999}
                                  backgroundColor={shopData.is_active ? '#D1FAE5' : '#F1F5F9'}
                                >
                                  <Text fontSize={11} fontWeight="600" color={shopData.is_active ? '#047857' : '#475569'}>
                                    {shopData.is_active ? 'Active' : 'Inactive'}
                                  </Text>
                                </YStack>
                                {shopData.verified ? (
                                  <XStack
                                    alignItems="center"
                                    gap={4}
                                    paddingHorizontal={8}
                                    paddingVertical={2}
                                    borderRadius={999}
                                    backgroundColor="#DBEAFE"
                                  >
                                    <Icons.ShieldCheck size={11} color="#1D4ED8" />
                                    <Text fontSize={11} fontWeight="600" color="#1D4ED8">
                                      Verified
                                    </Text>
                                  </XStack>
                                ) : null}
                              </XStack>
                            </YStack>
                          </XStack>
                          {shopData.shop_description ? (
                            <Text fontSize={12} color="#475569" numberOfLines={3}>
                              {shopData.shop_description}
                            </Text>
                          ) : null}
                          <YStack gap="$1.5">
                            {shopData.shop_email ? (
                              <XStack alignItems="center" gap={6}>
                                <Icons.Mail size={12} color="#94A3B8" />
                                <Text fontSize={12} color="#475569">
                                  {shopData.shop_email}
                                </Text>
                              </XStack>
                            ) : null}
                            {shopData.shop_phone_number ? (
                              <XStack alignItems="center" gap={6}>
                                <Icons.Phone size={12} color="#94A3B8" />
                                <Text fontSize={12} color="#475569">
                                  {shopData.shop_phone_number}
                                </Text>
                              </XStack>
                            ) : null}
                            <XStack alignItems="center" gap={6}>
                              <Icons.Calendar size={12} color="#94A3B8" />
                              <Text fontSize={12} color="#64748B">
                                Created: {formatDateTime(shopData.created_at).date}
                              </Text>
                            </XStack>
                          </YStack>
                        </YStack>
                      ) : (
                        <YStack alignItems="center" padding="$5" backgroundColor="#F8FAFC" borderRadius={12}>
                          <Text fontSize={12} color="#94A3B8">
                            No shop record found for this seller.
                          </Text>
                        </YStack>
                      )}
                    </YStack>
                  ) : null}
                </YStack>
              </ScrollView>
            ) : null}
          </DialogContent>
        </Dialog>
      </YStack>
    </PageScroll>
  )
}

export default function SellerCRMPage() {
  return (
    <RequireAdmin>
      <SellerLeadsCRM />
    </RequireAdmin>
  )
}
