export type {
  AiAssistAction,
  AiAssistActionType,
  AiAssistMessage,
  AiContext,
  AiDeepLink,
  AiFeedbackParams,
  AiProduct,
  AiRouteContext,
  AiSuggestion,
  CommentDraftParams,
  CommentDraftResult,
  CommentSuggestionParams,
  FetchAiSuggestionsParams,
  MeetingDraftParams,
  MeetingDraftResult,
  PostDraftParams,
  PostDraftResult,
  PostSuggestionChip,
  WritingIssue,
  SendAiMessageParams,
  SendAiMessageResult,
  ShopDraftParams,
  ShopDraftResult,
} from '~/lib/ai/types'
export type { ListingAssistHandlers } from '~/lib/ai/assist-actions'
export { parseAiAssistActions } from '~/lib/ai/assist-actions'

export {
  draftCommentWithAi,
  draftMeetingWithAi,
  draftPostWithAi,
  draftShopWithAi,
  fetchAiSuggestions,
  fetchChatSuggestions,
  fetchCommentSuggestions,
  fetchPostSuggestions,
  fetchWritingIssues,
  sendAiMessage,
  sendAiSuggestionFeedback,
} from '~/lib/ai/client'
export { aiProductLabel, resolveAiRouteContext } from '~/lib/ai/context'
export { localAiSuggestionChips, productQuickTools } from '~/lib/ai/product-quick-tools'
export type { ProductQuickTool } from '~/lib/ai/product-quick-tools'
