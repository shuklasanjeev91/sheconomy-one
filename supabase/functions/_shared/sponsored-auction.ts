import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const SPONSORED_PLACEMENTS = [
  "community_feed",
  "commerce_home",
  "commerce_search",
  "commerce_browse",
  "listing_detail",
  "shop_discovery",
] as const;

export type SponsoredPlacement = (typeof SPONSORED_PLACEMENTS)[number];
export type JsonObject = Record<string, unknown>;

export type AuctionCandidate = {
  campaign: JsonObject;
  adSet: JsonObject;
  creative: JsonObject;
  advertiserVerified: boolean;
  spentTotal: number;
  spentToday: number;
  impressionsToday: number;
  personalizedMatch: number | null;
};

export type RankedCandidate = AuctionCandidate & {
  effectiveBid: number;
  pacingFactor: number;
  predictedActionRate: number;
  qualityScore: number;
  exploration: number;
  score: number;
};

const SAFE_REASON_LABELS = new Set([
  "Sponsored recommendation",
  "Relevant to this content",
  "Relevant to your interests",
  "Popular in this placement",
  "Exploration selection",
]);

export function isSponsoredPlacement(
  value: unknown,
): value is SponsoredPlacement {
  return typeof value === "string" &&
    (SPONSORED_PLACEMENTS as readonly string[]).includes(value);
}

export function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

export function stringValue(
  row: JsonObject,
  keys: string[],
  fallback = "",
): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

export function numberValue(
  row: JsonObject,
  keys: string[],
  fallback = 0,
): number {
  for (const key of keys) {
    const value = Number(row[key]);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}

export function booleanValue(
  row: JsonObject,
  keys: string[],
  fallback = false,
): boolean {
  for (const key of keys) {
    if (typeof row[key] === "boolean") return row[key] as boolean;
  }
  return fallback;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function includesPlacement(row: JsonObject, placement: SponsoredPlacement) {
  const values = row.placements ?? row.placement_keys ?? row.placement;
  if (typeof values === "string") return values === placement;
  const placements = stringArray(values);
  return placements.length === 0 || placements.includes(placement);
}

export function matchesContext(
  targeting: JsonObject,
  context: JsonObject,
): boolean {
  const dimensions: Array<[string[], string[]]> = [
    [
      stringArray(targeting.keywords),
      [
        ...stringArray(context.keywords),
        String(context.query ?? "").toLowerCase(),
      ].filter(Boolean),
    ],
    [
      stringArray(targeting.category_ids ?? targeting.categories),
      [String(context.category_id ?? "").toLowerCase()].filter(Boolean),
    ],
    [
      stringArray(targeting.listing_ids),
      [String(context.listing_id ?? "").toLowerCase()].filter(Boolean),
    ],
    [
      stringArray(targeting.shop_ids),
      [String(context.shop_id ?? "").toLowerCase()].filter(Boolean),
    ],
  ];
  return dimensions.every(([wanted, actual]) =>
    !wanted.length ||
    actual.some((value) =>
      wanted.some((target) => value.includes(target) || target.includes(value))
    )
  );
}

export function personalizedAudienceScore(
  targeting: JsonObject,
  profile: JsonObject,
): number | null {
  const dimensions: Array<[string[], string[], number]> = [
    [
      stringArray(targeting.country_codes),
      stringArray([profile.country_code]),
      0.15,
    ],
    [
      stringArray(targeting.locations),
      stringArray([profile.location]),
      0.1,
    ],
    [
      stringArray(targeting.industries),
      stringArray([profile.industry]),
      0.15,
    ],
    [stringArray(targeting.interests), stringArray(profile.interests), 0.2],
  ];
  let targeted = false;
  let score = 0;
  for (const [wanted, actual, weight] of dimensions) {
    if (!wanted.length) continue;
    targeted = true;
    if (!actual.some((value) => wanted.includes(value))) return null;
    score += weight;
  }
  return targeted ? score : 0;
}

export function deterministicUnitInterval(seed: string): number {
  // FNV-1a is stable across Deno and React Native and is not used for security.
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0xffffffff;
}

function normalizedRate(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.min(value > 1 ? value / 100 : value, 1);
}

export function rankCandidate(
  candidate: AuctionCandidate,
  seed: string,
  now = new Date(),
): RankedCandidate {
  const { campaign, adSet, creative } = candidate;
  const buyingModel = stringValue(campaign, ["buying_model"], "cpm")
    .toLowerCase();
  const rawBid = numberValue(
    adSet,
    ["bid_amount", "bid"],
    numberValue(campaign, ["bid_amount", "bid", "cost_per_impression"], 0),
  );
  const effectiveBid = buyingModel === "cpm" ? rawBid / 1000 : rawBid;
  const predictedActionRate = normalizedRate(
    numberValue(creative, ["predicted_action_rate"], numberValue(adSet, [
      "predicted_action_rate",
    ], 0.02)),
    0.02,
  );
  const qualityScore = normalizedRate(
    numberValue(creative, ["quality_score"], numberValue(campaign, [
      "quality_score",
    ], 0.7)),
    0.7,
  );
  const dailyBudget = numberValue(
    adSet,
    ["daily_budget"],
    numberValue(campaign, ["daily_budget"], 0),
  );
  const elapsedDay = (now.getUTCHours() * 60 + now.getUTCMinutes()) / 1440;
  const expectedSpend = dailyBudget * Math.max(elapsedDay, 0.05);
  const pacingFactor = expectedSpend > 0
    ? Math.max(0.15, Math.min(1.25, expectedSpend / Math.max(
      candidate.spentToday,
      expectedSpend * 0.15,
    )))
    : 1;
  const exploration = deterministicUnitInterval(seed) * 0.08;
  const objective = stringValue(campaign, ["objective"], "awareness");
  const actionMultiplier = objective === "awareness"
    ? 0.55 + qualityScore * 0.45
    : objective === "conversion" || objective === "sales"
    ? 0.2 + predictedActionRate * 0.8
    : 0.35 + predictedActionRate * 0.65;
  const score = effectiveBid * actionMultiplier * (0.5 + qualityScore * 0.5) *
    pacingFactor * (1 + (candidate.personalizedMatch ?? 0)) + exploration;
  return {
    ...candidate,
    effectiveBid,
    pacingFactor,
    predictedActionRate,
    qualityScore,
    exploration,
    score,
  };
}

export function isCandidateEligible(
  candidate: AuctionCandidate,
  placement: SponsoredPlacement,
  now = new Date(),
): boolean {
  const { campaign, adSet, creative } = candidate;
  const startsAt = new Date(
    stringValue(adSet, ["starts_at"], stringValue(campaign, ["starts_at"])),
  ).getTime();
  const endsAt = new Date(
    stringValue(adSet, ["ends_at"], stringValue(campaign, ["ends_at"])),
  ).getTime();
  const totalBudget = numberValue(campaign, ["total_budget", "budget"], 0);
  const dailyBudget = numberValue(
    adSet,
    ["daily_budget"],
    numberValue(campaign, ["daily_budget"], 0),
  );
  const frequencyCap = numberValue(
    adSet,
    ["frequency_cap_per_day", "frequency_cap"],
    numberValue(campaign, ["frequency_cap_per_day"], 3),
  );
  const campaignReview = stringValue(campaign, [
    "review_status",
    "moderation_status",
  ]);
  const creativeReview = stringValue(creative, [
    "review_status",
    "moderation_status",
    "status",
  ]);
  const campaignActive = stringValue(campaign, ["status"]) === "active";
  const campaignReviewApproved = campaignActive ||
    campaignReview === "approved" ||
    Boolean(campaign.reviewed_at);
  const creativeApproved = ["approved", "active"].includes(creativeReview);
  const timestamp = now.getTime();
  return campaignActive &&
    ["active", "approved"].includes(stringValue(adSet, ["status"], "active")) &&
    creativeApproved &&
    campaignReviewApproved &&
    Number.isFinite(startsAt) && startsAt <= timestamp &&
    Number.isFinite(endsAt) && endsAt > timestamp &&
    totalBudget > candidate.spentTotal &&
    dailyBudget > candidate.spentToday &&
    candidate.impressionsToday < frequencyCap &&
    includesPlacement(adSet, placement) &&
    includesPlacement(creative, placement);
}

export function privacySafeReason(input: {
  personalized: boolean;
  contextual: boolean;
  exploration: number;
}): string {
  const reason = input.contextual
    ? "Relevant to this content"
    : input.personalized
    ? "Relevant to your interests"
    : input.exploration >= 0.075
    ? "Exploration selection"
    : "Sponsored recommendation";
  return SAFE_REASON_LABELS.has(reason) ? reason : "Sponsored recommendation";
}

function publicCreative(creative: JsonObject): JsonObject {
  const payload = objectValue(creative.payload);
  return {
    id: creative.id,
    format: creative.format ?? creative.creative_type ?? "native",
    headline: creative.headline ?? payload.headline ?? null,
    body: creative.body ?? payload.body ?? null,
    media_url: creative.media_url ?? payload.media_url ?? null,
    thumbnail_url: creative.thumbnail_url ?? payload.thumbnail_url ?? null,
    destination_url: creative.destination_url ?? payload.destination_url ?? null,
    call_to_action: creative.call_to_action ?? creative.cta ??
      payload.call_to_action ?? null,
    disclosure: "Sponsored",
  };
}

function publicEntityPayload(source: JsonObject): JsonObject {
  const allowed = [
    "title",
    "name",
    "slug",
    "description",
    "image_url",
    "thumbnail_url",
    "price",
    "sale_price",
    "currency",
    "shop_id",
  ];
  return Object.fromEntries(
    allowed.filter((key) => source[key] != null).map((key) => [
      key,
      source[key],
    ]),
  );
}

export function disclosedAdPayload(
  ranked: RankedCandidate,
  placement: SponsoredPlacement,
  personalized: boolean,
  contextual: boolean,
): JsonObject {
  const entityType = stringValue(ranked.creative, [
    "promoted_entity_type",
    "entity_type",
  ], stringValue(ranked.campaign, ["promoted_entity_type"], "post"));
  const entityId = stringValue(ranked.creative, [
    "promoted_entity_id",
    "entity_id",
  ], stringValue(ranked.campaign, [
    "promoted_entity_id",
    `${entityType}_id`,
    "post_id",
  ]));
  const entityPayload = objectValue(
    ranked.creative.promoted_entity_payload ??
      ranked.creative.entity_payload ??
      ranked.campaign.promoted_entity_payload ??
      ranked.campaign.entity_payload,
  );
  return {
    campaign_id: ranked.campaign.id,
    ad_set_id: ranked.adSet.id,
    creative_id: ranked.creative.id,
    placement,
    promoted_entity: {
      type: entityType,
      id: entityId,
      payload: publicEntityPayload(entityPayload),
    },
    creative: publicCreative(ranked.creative),
    reason_label: privacySafeReason({
      personalized,
      contextual,
      exploration: ranked.exploration,
    }),
  };
}

export function sumLedger(
  rows: JsonObject[],
  campaignId: string,
  day?: string,
): number {
  return rows.reduce((total, row) => {
    if (String(row.campaign_id ?? "") !== campaignId) return total;
    const occurred = stringValue(row, ["occurred_at", "created_at"]);
    if (day && occurred.slice(0, 10) !== day) return total;
    const kind = stringValue(row, ["entry_type", "type"], "spend").toLowerCase();
    if (["credit", "refund", "release"].includes(kind)) return total;
    return total + Math.max(0, numberValue(row, ["amount", "spend_amount"], 0));
  }, 0);
}

export async function insertAttributionTouch(
  admin: SupabaseClient,
  userId: string,
  body: JsonObject,
): Promise<{ duplicate: boolean; error?: string }> {
  const touchKey = stringValue(body, ["touch_key", "event_key"]).slice(0, 200);
  const touchType = stringValue(body, ["touch_type"], "click").toLowerCase();
  if (touchKey.length < 12 || !/^[A-Za-z0-9._:-]+$/.test(touchKey)) {
    return { duplicate: false, error: "Invalid touch_key" };
  }
  if (!["impression", "click", "cart", "checkout"].includes(touchType)) {
    return { duplicate: false, error: "Invalid touch_type" };
  }
  const metadata = objectValue(body.metadata);
  delete metadata.user_id;
  delete metadata.viewer_id;
  delete metadata.audience;
  if (!["impression", "click"].includes(touchType)) {
    return { duplicate: false };
  }
  const { data: campaign, error: campaignError } = await admin
    .from("sponsored_campaigns")
    .select("id, post_id")
    .eq("id", body.campaign_id)
    .maybeSingle();
  if (campaignError || !campaign) {
    return { duplicate: false, error: "Could not record attribution touch" };
  }
  const { error } = await admin.from("sponsored_campaign_events").insert({
    campaign_id: body.campaign_id,
    post_id: campaign.post_id ?? null,
    viewer_id: userId,
    event_type: touchType,
    placement: body.placement ?? "community_feed",
    ad_set_id: body.ad_set_id ?? null,
    creative_id: body.creative_id ?? null,
    session_id: typeof body.session_id === "string"
      ? body.session_id.slice(0, 160)
      : null,
    event_key: touchKey,
    metadata,
  });
  if (error?.code === "23505") return { duplicate: true };
  return error
    ? { duplicate: false, error: "Could not record attribution touch" }
    : { duplicate: false };
}
