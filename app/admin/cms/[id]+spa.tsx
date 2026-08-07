import { useParams } from 'one'

import { AdminCmsContentForm } from '~/app/admin/components/cms/AdminCmsContentForm'

export default function AdminCmsEditPage() {
  const { id } = useParams<{ id: string }>()
  return <AdminCmsContentForm contentId={id ?? null} />
}
