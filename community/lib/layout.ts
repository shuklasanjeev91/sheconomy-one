import { APP_LAYOUT } from '~/lib/layout/constants'

/** Community page layout dimensions */
export const COMMUNITY_LAYOUT = {
  leftSidebarWidth: 300,
  rightSidebarWidth: 320,
  columnGap: 20,
  stickyTop: APP_LAYOUT.desktopHeaderHeight + 20,
} as const
