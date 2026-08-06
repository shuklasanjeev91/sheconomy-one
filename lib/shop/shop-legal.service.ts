import { supabase } from '~/lib/supabase/client'

export type ShopLegalDocType = 'privacy' | 'terms' | 'refunds'

export type ShopLegalDocument = {
  id: string
  shop_id: string
  doc_type: ShopLegalDocType
  title: string
  body_markdown: string
  is_published: boolean
  updated_at: string
}

const DOC_TITLES: Record<ShopLegalDocType, string> = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
  refunds: 'Refund Policy',
}

export function defaultShopLegalTitle(docType: ShopLegalDocType): string {
  return DOC_TITLES[docType]
}

export async function fetchShopLegalDocument(
  shopId: string,
  docType: ShopLegalDocType,
): Promise<{ data: ShopLegalDocument | null; error: string | null }> {
  const { data, error } = await supabase
    .from('shop_legal_documents')
    .select('id, shop_id, doc_type, title, body_markdown, is_published, updated_at')
    .eq('shop_id', shopId)
    .eq('doc_type', docType)
    .eq('is_published', true)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  return { data: data as ShopLegalDocument | null, error: null }
}

export async function upsertShopLegalDocument(input: {
  shopId: string
  docType: ShopLegalDocType
  title: string
  bodyMarkdown: string
  isPublished?: boolean
}): Promise<{ data: ShopLegalDocument | null; error: string | null }> {
  const payload = {
    shop_id: input.shopId,
    doc_type: input.docType,
    title: input.title.trim() || defaultShopLegalTitle(input.docType),
    body_markdown: input.bodyMarkdown,
    is_published: input.isPublished ?? true,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('shop_legal_documents')
    .upsert(payload, { onConflict: 'shop_id,doc_type' })
    .select('id, shop_id, doc_type, title, body_markdown, is_published, updated_at')
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  return { data: data as ShopLegalDocument | null, error: null }
}
