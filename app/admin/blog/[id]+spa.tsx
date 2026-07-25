import { useLocalSearchParams } from 'one'

import { AdminBlogDetail } from '~/app/admin/components/AdminBlogDetail'

export default function AdminBlogDetailPage() {
  const params = useLocalSearchParams<{ id?: string | string[] }>()
  const rawId = params.id
  const contentId = Array.isArray(rawId) ? rawId[0] : rawId

  if (!contentId) {
    return null
  }

  return <AdminBlogDetail contentId={contentId} />
}
