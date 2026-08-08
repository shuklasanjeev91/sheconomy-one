import { SpaRedirect } from '~/components/navigation/SpaRedirect'
import { blogRoutes } from '~/lib/routes'

/** Legacy `/blogs` URL from sheconomy_web → canonical `/blog`. */
export default function BlogsAliasPage() {
  return <SpaRedirect href={blogRoutes.home} />
}
