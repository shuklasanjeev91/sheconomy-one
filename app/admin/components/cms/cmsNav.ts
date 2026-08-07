import type { Href } from 'one'

import { Icons } from '~/components/ui'

type IconType = (typeof Icons)[keyof typeof Icons]

export type CmsSectionId =
  | 'all'
  | 'new'
  | 'categories'
  | 'tags'
  | 'media'
  | 'comments'
  | 'redirects'

export type CmsNavItem = {
  id: CmsSectionId
  label: string
  description: string
  href: Href
  icon: IconType
}

export const CMS_NAV_ITEMS: CmsNavItem[] = [
  {
    id: 'all',
    label: 'All Content',
    description: 'Browse, filter, and manage editorial content.',
    href: '/admin/cms' as Href,
    icon: Icons.FileText,
  },
  {
    id: 'new',
    label: 'New Content',
    description: 'Create a post, page, or announcement.',
    href: '/admin/cms/new' as Href,
    icon: Icons.Plus,
  },
  {
    id: 'categories',
    label: 'Categories',
    description: 'Organize content with categories.',
    href: '/admin/cms/categories' as Href,
    icon: Icons.Folder,
  },
  {
    id: 'tags',
    label: 'Tags',
    description: 'Manage reusable content tags.',
    href: '/admin/cms/tags' as Href,
    icon: Icons.Tags,
  },
  {
    id: 'media',
    label: 'Media',
    description: 'Upload and manage media assets.',
    href: '/admin/cms/media' as Href,
    icon: Icons.Image,
  },
  {
    id: 'comments',
    label: 'Comments',
    description: 'Moderate blog comments.',
    href: '/admin/cms/comments' as Href,
    icon: Icons.MessageSquare,
  },
  {
    id: 'redirects',
    label: 'Redirects',
    description: 'Manage SEO redirect rules.',
    href: '/admin/cms/redirects' as Href,
    icon: Icons.ArrowRight,
  },
]

export function getCmsSectionFromPath(pathname: string): CmsSectionId {
  const path = pathname.replace(/\/+$/, '') || '/admin/cms'
  if (path === '/admin/cms/new' || path.endsWith('/cms/new')) return 'new'
  if (path.includes('/cms/categories')) return 'categories'
  if (path.includes('/cms/tags')) return 'tags'
  if (path.includes('/cms/media')) return 'media'
  if (path.includes('/cms/comments')) return 'comments'
  if (path.includes('/cms/redirects')) return 'redirects'
  if (/\/admin\/cms\/[^/]+$/.test(path) && path !== '/admin/cms') return 'all'
  return 'all'
}
