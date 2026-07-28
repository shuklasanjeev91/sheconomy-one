import { usePathname } from 'one'

import { openNewChat } from '~/chat/lib/chat-actions-store'
import { useChatTheme } from '~/chat/lib/chat-theme'
import { Icons, Text, XStack } from '~/components/ui'
import {
  chatRoutes,
  isChatCallsPath,
  isChatGroupsPath,
} from '~/lib/routes'
import { replaceApp } from '~/lib/platform/navigate'

type SectionKey = 'chats' | 'groups' | 'calls'

const SECTIONS: { key: SectionKey; label: string; href: typeof chatRoutes.home; icon: typeof Icons.MessageCircle }[] = [
  { key: 'chats', label: 'Chats', href: chatRoutes.home, icon: Icons.MessageCircle },
  { key: 'groups', label: 'Groups', href: chatRoutes.groups, icon: Icons.Users },
  { key: 'calls', label: 'Calls', href: chatRoutes.calls, icon: Icons.Phone },
]

function activeSection(pathname: string): SectionKey {
  if (isChatGroupsPath(pathname)) return 'groups'
  if (isChatCallsPath(pathname)) return 'calls'
  return 'chats'
}

/** WhatsApp-Web-style header for the desktop chat pane: section switcher + new chat. */
export function ChatSectionTabs() {
  const theme = useChatTheme()
  const pathname = usePathname()
  const active = activeSection(pathname)

  return (
    <XStack
      alignItems="center"
      gap={6}
      paddingHorizontal={12}
      paddingVertical={10}
      borderBottomWidth={1}
      borderBottomColor={theme.divider}
      backgroundColor={theme.listBg}
    >
      {SECTIONS.map((section) => {
        const isActive = active === section.key
        const Icon = section.icon
        return (
          <XStack
            key={section.key}
            onPress={() => {
              if (!isActive) replaceApp(section.href)
            }}
            cursor="pointer"
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            alignItems="center"
            gap={6}
            paddingHorizontal={12}
            paddingVertical={7}
            borderRadius={999}
            backgroundColor={isActive ? `${theme.brand}18` : 'transparent'}
            hoverStyle={{ backgroundColor: isActive ? `${theme.brand}22` : theme.listItemHover }}
            pressStyle={{ opacity: 0.88 }}
            animation="quick"
          >
            <Icon size={16} color={isActive ? theme.brand : theme.textSecondary} />
            <Text fontSize={13.5} fontWeight={isActive ? '800' : '600'} color={isActive ? theme.brand : theme.textSecondary}>
              {section.label}
            </Text>
          </XStack>
        )
      })}

      <XStack flex={1} />

      <XStack
        onPress={openNewChat}
        cursor="pointer"
        width={36}
        height={36}
        borderRadius={999}
        alignItems="center"
        justifyContent="center"
        backgroundColor={theme.brand}
        hoverStyle={{ opacity: 0.92 }}
        pressStyle={{ scale: 0.93 }}
        animation="quick"
        aria-label="Start new chat"
      >
        <Icons.PenSquare size={18} color={theme.brandContrast} />
      </XStack>
    </XStack>
  )
}
