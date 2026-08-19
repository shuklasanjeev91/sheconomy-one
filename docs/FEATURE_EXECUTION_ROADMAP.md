# SHEconomy Feature Execution Roadmap

## Priority Themes
This roadmap narrows the broader feature plan to the three themes with the best near-term leverage on GMV, trust, and seller retention.

### 1. Community-to-Commerce Loop
Why this comes first:
- It compounds both engagement and revenue.
- The app already has recommendation rails, feed composer surfaces, and listing CTAs.
- It creates reusable primitives for later creator storefronts, shop follows, and social proof.

Primary code touchpoints:
- `community/components/CreatePostForm.tsx`
- `community/components/FeedPostCard.tsx`
- `community/lib/community-personalization.ts`
- `community/hooks/useCommunitySuggestions.ts`
- `commerce/components/ListingCard.tsx`
- `commerce/screens/ListingScreen.tsx`

### 2. Best-in-Class Returns and Exchanges
Why this comes second:
- Returns are a trust-critical moment for buyers.
- Recent SQL work already added auto return pickup, reverse delivery legs, and richer lifecycle states.
- Better return UX reduces support load and increases repeat purchase confidence.

Primary code touchpoints:
- `commerce/screens/OrderDetailScreen.tsx`
- `commerce/lib/customer-order-lifecycle.ts`
- `lib/orders/delivery.service.ts`
- `supabase/migrations/20260819100000_vendor_return_lifecycle_ux.sql`
- `supabase/migrations/20260819110000_auto_return_pickup.sql`

### 3. Vendor Operating System
Why this comes third:
- Better vendor workflows improve SLA adherence, lower operational mistakes, and protect buyer trust.
- The vendor dashboard already has order, issue, and analytics surfaces that can be upgraded instead of rebuilt.
- This theme pairs naturally with returns improvements.

Primary code touchpoints:
- `commerce/screens/vendor/VendorOrdersScreen.tsx`
- `commerce/screens/vendor/VendorOrderListPanel.tsx`
- `commerce/screens/vendor/VendorOrderIssuesPanel.tsx`
- `commerce/screens/vendor/VendorSalesAnalyticsScreen.tsx`
- `lib/orders/vendor-orders.service.ts`

## Q1 Epics

### Epic 1. Shoppable Posts
Outcome:
- Turn high-intent community content into listing views, add-to-cart actions, and assisted checkout.

Scope:
- Add listing attach/tag flow to post composer.
- Render tagged listings inside feed cards.
- Support direct listing open, add to cart, and buy now from the feed.
- Track clicks, add-to-cart, and conversion from tagged posts.

Success metrics:
- At least 10% of new product-oriented posts include a tagged listing.
- Tagged-post CTR to listing is 2x higher than generic feed outbound CTR.
- Tagged-post viewers add to cart at a higher rate than non-tagged post viewers.

Dependencies:
- A post-to-listing metadata model.
- Feed card UI that supports embedded product blocks.
- Analytics events in a shared naming convention.

### Epic 2. Follow Shops + Shop-Aware Suggestions
Outcome:
- Make marketplace discovery feel personal and recurring.

Scope:
- Add follow/unfollow to shop surfaces.
- Add a "From shops you follow" suggestions section.
- Use shop follows as a ranking signal in `useCommunitySuggestions`.
- Surface follow counts and recency in personalization scoring.

Success metrics:
- Shop follow rate from listing/shop pages.
- Repeat visits to followed shops.
- Higher CTR on listing recommendations where a follow signal exists.

Dependencies:
- Shop follow graph storage and APIs.
- Suggestion scoring updates.
- Shop/profile UI to expose follow actions.

### Epic 3. Buyer Return Hub
Outcome:
- Replace opaque return states with a buyer-facing timeline and next-step clarity.

Scope:
- Show request submitted, approved/rejected, pickup arranged, in transit, received, refund/exchange completed.
- Expose pickup ETA, courier tracking, and refund stage.
- Add guided reason/evidence capture for new return requests.
- Clearly separate return lifecycle from outbound order delivery lifecycle.

Success metrics:
- Lower support tickets per return.
- Higher buyer completion rate for requested evidence.
- Shorter time from approved return to buyer understanding next step.

Dependencies:
- Existing reverse leg data and return issue statuses.
- Order detail screen redesign.
- Notification payload completeness for return states.

### Epic 4. Vendor SLA Inbox
Outcome:
- Give vendors a single, action-oriented queue instead of forcing them to infer risk from raw lists.

Scope:
- Add filters for overdue shipment, return approval pending, pickup exceptions, exchange stock blocked, and unresolved issues.
- Add badge counts and severity ordering.
- Add daily manifest export and batch actions where safe.
- Add internal notes and operational tags for orders/issues.

Success metrics:
- Faster first action on new vendor issues.
- Lower number of breached SLAs.
- Reduced manual back-and-forth for common return cases.

Dependencies:
- Derived SLA fields or server-side aggregation.
- Vendor-facing status taxonomy and sorting rules.
- Policy decisions around batch actions and notes visibility.

## Suggested Q1 Build Order
1. Shoppable Posts
2. Buyer Return Hub
3. Vendor SLA Inbox
4. Follow Shops + Shop-Aware Suggestions

This order creates a good sequence:
- Start with the highest GMV unlock.
- Reinforce trust with better returns.
- Improve seller operations that support the trust promise.
- Then deepen personalization using newly collected behavior.

## Shared Platform Work For Q1
These should be built once and reused across the epics:
- Event taxonomy for community-to-commerce conversion.
- Shared product preview card primitive usable in feed, sidebar, and chat.
- Notification templates/preferences for return and vendor ops alerts.
- A small policy/config layer for ranking boosts, eligibility rules, and SLA thresholds.

## Q1 Risks
- Shoppable posts can create feed clutter if product attachments are too visually heavy.
- Return hub UX can drift from backend truth if states are duplicated on the client.
- SLA inbox value drops quickly if the prioritization logic is noisy or incomplete.
- Follow-shop features will underperform if recommendation quality is not improved at the same time.

## Definition Of Success For The Quarter
By the end of Q1, SHEconomy should have:
- A measurable path from community content to commerce conversion.
- A buyer-visible return experience that feels trustworthy and self-serve.
- A vendor dashboard that reduces operational misses instead of just reflecting them.
