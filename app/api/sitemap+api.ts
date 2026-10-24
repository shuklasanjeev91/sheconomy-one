import { buildSitemapXml } from '~/lib/seo/sitemap'
import { loadPublicSitemapEntries } from '~/lib/seo/sitemap-data'

export async function GET() {
  const entries = await loadPublicSitemapEntries()
  const xml = buildSitemapXml(entries)
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
