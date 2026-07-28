import { usePathname } from 'one'

import { AppLink } from '~/components/navigation/AppLink'
import { Icons, Text, XStack } from '~/components/ui'
import { classRoutes, isClassAudioPath } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

const TABS = [
  { id: 'video' as const, label: 'Video', href: classRoutes.video, icon: Icons.Play },
  { id: 'audio' as const, label: 'Audio', href: classRoutes.audio, icon: Icons.Radio },
  { id: 'playlists' as const, label: 'Playlists', href: classRoutes.playlists, icon: Icons.List },
]

export function ClassMediaTabs() {
  const ui = useAppUi()
  const pathname = usePathname()
  // In-page media chips: Home (`/class`) and `/class/video` share the video catalogue.
  const activeTab = pathname.includes('/class/playlists')
    ? 'playlists'
    : isClassAudioPath(pathname)
      ? 'audio'
      : 'video'

  return (
    <XStack
      gap="$1"
      padding="$1"
      borderRadius={999}
      backgroundColor={ui.surfaceMuted}
      alignSelf="flex-start"
      flexWrap="wrap"
    >
      {TABS.map((tab) => {
        const active = tab.id === activeTab
        const Icon = tab.icon

        return (
          <AppLink key={tab.id} href={tab.href} asChild>
            <XStack
              gap="$2"
              paddingHorizontal="$4"
              paddingVertical={9}
              borderRadius={999}
              backgroundColor={active ? ui.surface : 'transparent'}
              borderWidth={active ? 1 : 0}
              borderColor={ui.borderSubtle}
              alignItems="center"
              cursor="pointer"
              hoverStyle={{ opacity: 0.9 }}
              pressStyle={{ opacity: 0.85 }}
            >
              <Icon size={16} color={active ? ui.text : ui.textSecondary} />
              <Text
                fontSize={14}
                fontWeight={active ? '700' : '500'}
                color={active ? ui.text : ui.textSecondary}
              >
                {tab.label}
              </Text>
            </XStack>
          </AppLink>
        )
      })}
    </XStack>
  )
}
