// SellerCRMPage.tsx
import { useMemo, useState } from 'react'
import {
    Avatar,
    Button,
    Card,
    H3,
    H4,
    Paragraph,
    ScrollView,
    Separator,
    Text,
    XStack,
    YStack,
    Input,
    Circle,
    Progress,
} from 'tamagui'

import {
    Search,
    Bell,
    Filter,
    Download,
    ChevronLeft,
    ChevronRight,
    Users,
    TrendingUp,
    Phone,
    DollarSign,
} from '@tamagui/lucide-icons'

const stats = [
    {
        title: 'Total Leads',
        value: '8,245',
        growth: '+12%',
        color: '#3B82F6',
        icon: Users,
    },
    {
        title: 'Qualified',
        value: '2,138',
        growth: '+8%',
        color: '#22C55E',
        icon: TrendingUp,
    },
    {
        title: 'Calls',
        value: '1,026',
        growth: '+16%',
        color: '#F59E0B',
        icon: Phone,
    },
    {
        title: 'Revenue',
        value: '$84,200',
        growth: '+21%',
        color: '#EC4899',
        icon: DollarSign,
    },
]

const funnel = [
    {
        title: 'New',
        value: 2400,
        percent: 92,
        color: '#3B82F6',
    },
    {
        title: 'Contacted',
        value: 1800,
        percent: 72,
        color: '#F59E0B',
    },
    {
        title: 'Qualified',
        value: 1400,
        percent: 56,
        color: '#10B981',
    },
    {
        title: 'Proposal',
        value: 920,
        percent: 40,
        color: '#8B5CF6',
    },
    {
        title: 'Won',
        value: 610,
        percent: 28,
        color: '#EC4899',
    },
]

const leads = Array.from({ length: 20 }).map((_, i) => ({
    id: i + 1,
    name: [
        'John Smith',
        'Emma Watson',
        'Sophia Brown',
        'Michael Lee',
        'Chris Evans',
        'Olivia Wilson',
        'Ava Johnson',
        'Daniel Carter',
    ][i % 8],
    company: [
        'Apple',
        'Google',
        'Amazon',
        'Microsoft',
        'Netflix',
        'Adobe',
        'Meta',
        'Tesla',
    ][i % 8],
    phone: '+91 9876543210',
    email: `lead${i + 1}@gmail.com`,
    amount: `$${(i + 1) * 450}`,
    stage: ['New', 'Contacted', 'Qualified', 'Proposal', 'Won'][i % 5],
}))

export default function SellerCRMPage() {
    const [search, setSearch] = useState('')
    const [activeFilter, setActiveFilter] = useState('All')
    const [currentPage, setCurrentPage] = useState(1)

    const filtered = useMemo(() => {
        let result = leads.filter((x) =>
            x.name.toLowerCase().includes(search.toLowerCase())
        )
        
        if (activeFilter !== 'All') {
            result = result.filter((x) => x.stage === activeFilter)
        }
        
        return result
    }, [search, activeFilter])

    const handleFilterClick = (filter: string) => {
        setActiveFilter(filter)
        setCurrentPage(1)
    }

    const getStageColor = (stage: string) => {
        switch (stage) {
            case 'Won':
                return { bg: '#DCFCE7', color: '#15803D' }
            case 'Proposal':
                return { bg: '#F3E8FF', color: '#7E22CE' }
            case 'Qualified':
                return { bg: '#DBEAFE', color: '#2563EB' }
            case 'Contacted':
                return { bg: '#FEF3C7', color: '#D97706' }
            default:
                return { bg: '#F3F4F6', color: '#374151' }
        }
    }

    return (
        <ScrollView
            flex={1}
            backgroundColor="#F7F8FC"
            contentContainerStyle={{
                padding: 24,
                paddingBottom: 40,
            }}
        >
            {/* HEADER */}
            <XStack
                justifyContent="space-between"
                alignItems="center"
                marginBottom="$6"
                flexWrap="wrap"
                gap="$4"
            >
                <YStack>
                    <H3>CRM Dashboard</H3>
                    <Paragraph color="#6B7280">
                        Welcome back 👋 Here's today's overview.
                    </Paragraph>
                </YStack>

                <XStack gap="$3" alignItems="center" flexWrap="wrap">
                    <Input
                        value={search}
                        onChangeText={setSearch}
                        width={260}
                        placeholder="Search leads..."
                        icon={Search}
                        backgroundColor="white"
                        borderColor="#E5E7EB"
                    />

                    <Button circular icon={Bell} backgroundColor="white" />

                    <Button
                        backgroundColor="#2563EB"
                        color="white"
                        icon={Download}
                        hoverStyle={{
                            backgroundColor: '#1D4ED8',
                        }}
                    >
                        Export
                    </Button>
                </XStack>
            </XStack>

            {/* STATS */}
            <XStack gap="$4" flexWrap="wrap" marginBottom="$6">
                {stats.map((item, index) => {
                    const Icon = item.icon

                    return (
                        <Card
                            key={index}
                            elevate
                            bordered
                            width={270}
                            backgroundColor="white"
                            borderRadius={20}
                            padding="$5"
                            flex={1}
                            minWidth={200}
                        >
                            <XStack justifyContent="space-between" alignItems="center">
                                <YStack gap="$2">
                                    <Paragraph color="#6B7280" fontSize="$3">
                                        {item.title}
                                    </Paragraph>
                                    <H3>{item.value}</H3>
                                    <Text color="#22C55E" fontWeight="700">
                                        {item.growth}
                                    </Text>
                                </YStack>

                                <Circle size={58} backgroundColor={item.color}>
                                    <Icon color="white" size={28} />
                                </Circle>
                            </XStack>
                        </Card>
                    )
                })}
            </XStack>

            <Separator marginVertical="$6" />

            {/* FUNNEL */}
            <Card
                bordered
                elevate
                borderRadius={22}
                backgroundColor="white"
                padding="$5"
                marginBottom="$6"
            >
                <H4 marginBottom="$4">Sales Funnel</H4>

                <YStack gap="$4">
                    {funnel.map((item) => (
                        <YStack key={item.title}>
                            <XStack justifyContent="space-between">
                                <Paragraph fontWeight="500">{item.title}</Paragraph>
                                <Paragraph fontWeight="500">{item.value}</Paragraph>
                            </XStack>

                            <Progress
                                marginTop="$2"
                                value={item.percent}
                                backgroundColor="#ECECEC"
                                height={8}
                            >
                                <Progress.Indicator
                                    animation="bouncy"
                                    backgroundColor={item.color}
                                />
                            </Progress>
                        </YStack>
                    ))}
                </YStack>
            </Card>

            <Separator marginVertical="$6" />

            {/* LEADS SECTION */}
            <XStack justifyContent="space-between" marginBottom="$4" flexWrap="wrap" gap="$2">
                <H4>Recent Leads</H4>
                <Button icon={Filter} backgroundColor="white" borderColor="#E5E7EB">
                    Filters
                </Button>
            </XStack>

            {/* FILTER CHIPS */}
            <XStack gap="$3" marginBottom="$5" flexWrap="wrap">
                {['All', 'New', 'Contacted', 'Qualified', 'Proposal', 'Won'].map((item) => (
                    <Button
                        key={item}
                        size="$3"
                        backgroundColor={activeFilter === item ? '#2563EB' : 'white'}
                        color={activeFilter === item ? 'white' : '#374151'}
                        borderColor="#E5E7EB"
                        borderWidth={1}
                        borderRadius={999}
                        onPress={() => handleFilterClick(item)}
                        hoverStyle={{
                            backgroundColor: activeFilter === item ? '#1D4ED8' : '#F3F4F6',
                        }}
                    >
                        {item}
                    </Button>
                ))}
            </XStack>

            {/* TABLE */}
            <Card
                elevate
                bordered
                borderRadius={20}
                backgroundColor="white"
                overflow="hidden"
                marginBottom="$6"
            >
                {/* TABLE HEADER */}
                <XStack
                    padding="$4"
                    backgroundColor="#F9FAFB"
                    borderBottomWidth={1}
                    borderColor="#ECECEC"
                    alignItems="center"
                >
                    <Text flex={2} fontWeight="700" fontSize="$3">
                        Lead
                    </Text>
                    <Text flex={2} fontWeight="700" fontSize="$3">
                        Company
                    </Text>
                    <Text flex={2} fontWeight="700" fontSize="$3">
                        Email
                    </Text>
                    <Text flex={1.5} fontWeight="700" fontSize="$3">
                        Phone
                    </Text>
                    <Text flex={1} fontWeight="700" fontSize="$3">
                        Stage
                    </Text>
                    <Text flex={1} fontWeight="700" fontSize="$3">
                        Revenue
                    </Text>
                    <Text flex={1} fontWeight="700" fontSize="$3">
                        Action
                    </Text>
                </XStack>

                {filtered.length > 0 ? (
                    filtered.map((lead, index) => {
                        const stageColors = getStageColor(lead.stage)
                        return (
                            <XStack
                                key={lead.id}
                                padding="$4"
                                alignItems="center"
                                borderBottomWidth={index === filtered.length - 1 ? 0 : 1}
                                borderColor="#F0F0F0"
                                hoverStyle={{
                                    backgroundColor: '#FAFAFA',
                                }}
                            >
                                {/* Lead */}
                                <XStack flex={2} alignItems="center" gap="$3">
                                    <Avatar circular size="$4">
                                        <Avatar.Image
                                            src={`https://i.pravatar.cc/150?img=${lead.id}`}
                                        />
                                        <Avatar.Fallback backgroundColor="#2563EB">
                                            <Text color="white" fontWeight="700">
                                                {lead.name.charAt(0)}
                                            </Text>
                                        </Avatar.Fallback>
                                    </Avatar>

                                    <YStack>
                                        <Text fontWeight="700">{lead.name}</Text>
                                        <Paragraph size="$2" color="#6B7280">
                                            #{lead.id}
                                        </Paragraph>
                                    </YStack>
                                </XStack>

                                {/* Company */}
                                <Text flex={2}>{lead.company}</Text>

                                {/* Email */}
                                <Text flex={2} fontSize="$2">
                                    {lead.email}
                                </Text>

                                {/* Phone */}
                                <Text flex={1.5} fontSize="$2">
                                    {lead.phone}
                                </Text>

                                {/* Stage */}
                                <XStack flex={1}>
                                    <Button
                                        size="$2"
                                        borderRadius={999}
                                        backgroundColor={stageColors.bg}
                                        color={stageColors.color}
                                        chromeless
                                        paddingHorizontal="$3"
                                        fontSize="$2"
                                    >
                                        {lead.stage}
                                    </Button>
                                </XStack>

                                {/* Revenue */}
                                <Text flex={1} fontWeight="700" color="#16A34A">
                                    {lead.amount}
                                </Text>

                                {/* Action */}
                                <XStack flex={1}>
                                    <Button
                                        size="$2"
                                        backgroundColor="#2563EB"
                                        color="white"
                                        hoverStyle={{
                                            backgroundColor: '#1D4ED8',
                                        }}
                                    >
                                        View
                                    </Button>
                                </XStack>
                            </XStack>
                        )
                    })
                ) : (
                    <YStack padding="$6" alignItems="center">
                        <Text color="#6B7280">No leads found</Text>
                    </YStack>
                )}
            </Card>

            <Separator marginVertical="$6" />

            {/* PAGINATION */}
            <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$4">
                <Paragraph color="#6B7280">
                    Showing 1–{Math.min(20, filtered.length)} of {filtered.length} leads
                </Paragraph>

                <XStack gap="$2">
                    <Button
                        icon={ChevronLeft}
                        circular
                        backgroundColor="white"
                        borderColor="#E5E7EB"
                        onPress={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                    />

                    {[1, 2, 3, 4].map((page) => (
                        <Button
                            key={page}
                            circular
                            backgroundColor={currentPage === page ? '#2563EB' : 'white'}
                            color={currentPage === page ? 'white' : '#374151'}
                            borderColor="#E5E7EB"
                            borderWidth={1}
                            onPress={() => setCurrentPage(page)}
                            hoverStyle={{
                                backgroundColor: currentPage === page ? '#1D4ED8' : '#F3F4F6',
                            }}
                        >
                            {page}
                        </Button>
                    ))}

                    <Button
                        icon={ChevronRight}
                        circular
                        backgroundColor="white"
                        borderColor="#E5E7EB"
                        onPress={() => setCurrentPage(Math.min(4, currentPage + 1))}
                        disabled={currentPage === 4}
                    />
                </XStack>
            </XStack>
        </ScrollView>
    )
}