import { supabase } from '~/lib/supabase/client'

import { filterFallbackArticles } from './faq-fallback'
import type {
  HelpArticle,
  HelpProduct,
  HelpTicketPriority,
  SupportTicket,
} from './types'

type KbRow = {
  id: string
  title: string
  content: string
  category: string
  tags: string[] | null
  helpful_count: number | null
  view_count: number | null
  slug?: string | null
}

function mapArticle(row: KbRow): HelpArticle {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    tags: row.tags,
    helpful_count: row.helpful_count,
    view_count: row.view_count,
    source: 'kb',
    slug: row.slug ?? null,
  }
}

/** Load active FAQ articles for a product filter, with static fallback. */
export async function fetchHelpArticles(input: {
  product?: HelpProduct
  query?: string
}): Promise<{ articles: HelpArticle[]; error: string | null }> {
  const product = input.product ?? ''
  const queryText = input.query?.trim() ?? ''

  let request = supabase
    .from('support_knowledge_base')
    .select('id, title, content, category, tags, helpful_count, view_count, slug')
    .eq('is_active', true)
    .order('helpful_count', { ascending: false })
    .limit(100)

  if (product) request = request.eq('category', product)

  const { data, error } = await request
  if (error) {
    // Older schema without slug — retry without it.
    if (error.message.toLowerCase().includes('slug')) {
      return fetchHelpArticlesWithoutSlug(input)
    }
    return {
      articles: filterFallbackArticles(product, queryText),
      error: error.message,
    }
  }

  let articles = (data ?? []).map((row) => mapArticle(row as KbRow))
  if (queryText) {
    const q = queryText.toLowerCase()
    articles = articles.filter(
      (article) =>
        article.title.toLowerCase().includes(q) ||
        article.content.toLowerCase().includes(q) ||
        (article.slug ?? '').toLowerCase().includes(q) ||
        (article.tags ?? []).some((tag) => tag.toLowerCase().includes(q)),
    )
  }

  if (!articles.length) {
    return { articles: filterFallbackArticles(product, queryText), error: null }
  }

  return { articles, error: null }
}

async function fetchHelpArticlesWithoutSlug(input: {
  product?: HelpProduct
  query?: string
}): Promise<{ articles: HelpArticle[]; error: string | null }> {
  const product = input.product ?? ''
  const queryText = input.query?.trim() ?? ''
  let request = supabase
    .from('support_knowledge_base')
    .select('id, title, content, category, tags, helpful_count, view_count')
    .eq('is_active', true)
    .order('helpful_count', { ascending: false })
    .limit(100)
  if (product) request = request.eq('category', product)
  const { data, error } = await request
  if (error) {
    return { articles: filterFallbackArticles(product, queryText), error: error.message }
  }
  let articles = (data ?? []).map((row) => mapArticle(row as KbRow))
  if (queryText) {
    const q = queryText.toLowerCase()
    articles = articles.filter(
      (article) =>
        article.title.toLowerCase().includes(q) ||
        article.content.toLowerCase().includes(q) ||
        (article.tags ?? []).some((tag) => tag.toLowerCase().includes(q)),
    )
  }
  if (!articles.length) {
    return { articles: filterFallbackArticles(product, queryText), error: null }
  }
  return { articles, error: null }
}

export async function markArticleHelpful(articleId: string): Promise<{ error: string | null }> {
  if (articleId.startsWith('fallback-')) return { error: null }

  const { data, error } = await supabase
    .from('support_knowledge_base')
    .select('helpful_count')
    .eq('id', articleId)
    .maybeSingle()

  if (error) return { error: error.message }

  const next = (data?.helpful_count ?? 0) + 1
  const { error: updateError } = await supabase
    .from('support_knowledge_base')
    .update({ helpful_count: next, updated_at: new Date().toISOString() })
    .eq('id', articleId)

  return { error: updateError?.message ?? null }
}

/** Increment view_count when a KB article is expanded. */
export async function markArticleViewed(articleId: string): Promise<void> {
  if (articleId.startsWith('fallback-')) return
  const { data } = await supabase
    .from('support_knowledge_base')
    .select('view_count')
    .eq('id', articleId)
    .maybeSingle()
  if (!data) return
  await supabase
    .from('support_knowledge_base')
    .update({
      view_count: (data.view_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', articleId)
}

export async function fetchMyTickets(
  userId: string,
  product?: HelpProduct,
): Promise<{
  tickets: SupportTicket[]
  error: string | null
}> {
  let request = supabase
    .from('support_tickets')
    .select('id, subject, description, status, product, priority, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (product) request = request.eq('product', product)

  const { data, error } = await request
  if (error) return { tickets: [], error: error.message }
  return { tickets: (data ?? []) as SupportTicket[], error: null }
}

export async function closeSupportTicket(input: {
  userId: string
  ticketId: string
}): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('support_tickets')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', input.ticketId)
    .eq('user_id', input.userId)

  return { error: error?.message ?? null }
}

export async function createSupportTicket(input: {
  userId: string
  subject: string
  description: string
  product: Exclude<HelpProduct, ''>
  priority?: HelpTicketPriority
}): Promise<{ ticketId: string | null; error: string | null }> {
  const subject = input.subject.trim()
  const description = input.description.trim()
  if (!subject || !description) {
    return { ticketId: null, error: 'Subject and description are required.' }
  }

  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      user_id: input.userId,
      subject,
      description,
      product: input.product,
      priority: input.priority ?? 'normal',
      status: 'open',
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .maybeSingle()

  if (error) return { ticketId: null, error: error.message }
  return { ticketId: data?.id ?? null, error: null }
}
