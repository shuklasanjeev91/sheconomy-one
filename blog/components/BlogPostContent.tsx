import { CmsMarkdownBody } from '~/components/blog/CmsMarkdownBody'

/** Native: markdown/plain renderer (no HTML DOM). */
export function BlogPostContent({
  body,
  format = 'markdown',
}: {
  body: string | null | undefined
  format?: string | null
}) {
  return <CmsMarkdownBody source={body} format={format === 'html' ? 'html' : format} />
}
