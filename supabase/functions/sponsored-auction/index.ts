import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  type AuctionCandidate,
  booleanValue,
  disclosedAdPayload,
  insertAttributionTouch,
  isCandidateEligible,
  isSponsoredPlacement,
  type JsonObject,
  matchesContext,
  numberValue,
  objectValue,
  personalizedAudienceScore,
  rankCandidate,
  stringValue,
  sumLedger,
} from "../_shared/sponsored-auction.ts";
import {
  cleanString,
  isUuid,
  optionalSponsoredUser,
  readJsonObject,
} from "../_shared/sponsored-ads.ts";

function missingRelation(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return error.code === "42P01" ||
    /does not exist|could not find the table/i.test(error.message ?? "");
}

function emptyRead() {
  return Promise.resolve({ data: [] as unknown[], error: null });
}

function emptyRow() {
  return Promise.resolve({ data: null, error: null });
}

const MAX_CANDIDATES = 750;

function rows(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.map(objectValue) : [];
}

function enabledFlag(flags: JsonObject[], key: string): boolean {
  const row = flags.find((flag) =>
    stringValue(flag, ["key", "flag_key", "name"]) === key
  );
  return !row || booleanValue(row, ["enabled", "is_enabled"], true);
}

function belongsToCampaign(row: JsonObject, campaignId: string): boolean {
  return String(row.campaign_id ?? "") === campaignId;
}

function belongsToAdSet(row: JsonObject, adSetId: string): boolean {
  const value = String(row.ad_set_id ?? "");
  return !value || value === adSetId;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const auth = await optionalSponsoredUser(request);
  if (auth instanceof Response) return auth;
  const body = await readJsonObject(request);
  if (body instanceof Response) return body;
  const { admin, user } = auth;
  const action = cleanString(body.action || "fetch", 30).toLowerCase();

  if (action === "consent") {
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    if (typeof body.personalized_ads !== "boolean") {
      return jsonResponse({ error: "personalized_ads must be boolean" }, 400);
    }
    const now = new Date().toISOString();
    const { error } = await admin.from("ad_privacy_preferences").upsert({
      user_id: user.id,
      personalized_ads: body.personalized_ads,
      updated_at: now,
    }, { onConflict: "user_id" });
    return error
      ? jsonResponse({ error: "Could not update ad preference" }, 500)
      : jsonResponse({
        preference: {
          personalized_ads: body.personalized_ads,
          updated_at: now,
        },
      });
  }

  if (action === "get_consent") {
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    const { data, error } = await admin.from("ad_privacy_preferences")
      .select("personalized_ads, updated_at, consented_at")
      .eq("user_id", user.id)
      .maybeSingle();
    return error
      ? jsonResponse({ error: "Could not load ad preference" }, 500)
      : jsonResponse({
        preference: {
          personalized_ads: data?.personalized_ads === true,
          updated_at: data?.consented_at ?? data?.updated_at ?? null,
        },
      });
  }

  if (action === "track") {
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    const placement = body.placement;
    if (!isSponsoredPlacement(placement)) {
      return jsonResponse({ error: "Invalid placement" }, 400);
    }
    if (!isUuid(body.campaign_id) || !isUuid(body.creative_id)) {
      return jsonResponse({
        error: "Valid campaign_id and creative_id required",
      }, 400);
    }
    const [campaignResult, creativeResult, linkResult] = await Promise.all([
      admin.from("sponsored_campaigns")
        .select("id, advertiser_user_id, status")
        .eq("id", body.campaign_id)
        .maybeSingle(),
      admin.from("ad_creatives")
        .select("id, status")
        .eq("id", body.creative_id)
        .maybeSingle(),
      admin.from("ad_set_creatives")
        .select("ad_set_id, creative_id")
        .eq("creative_id", body.creative_id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle(),
    ]);
    if (
      missingRelation(creativeResult.error) ||
      missingRelation(linkResult.error)
    ) {
      return jsonResponse({ error: "Sponsored creative not found" }, 404);
    }
    if (campaignResult.error || creativeResult.error || linkResult.error) {
      return jsonResponse({ error: "Could not validate sponsored event" }, 500);
    }
    const campaign = campaignResult.data;
    const creative = creativeResult.data;
    if (
      !campaign || !creative || !linkResult.data ||
      campaign.advertiser_user_id === user.id ||
      !["active", "completed"].includes(String(campaign.status))
    ) {
      return jsonResponse({ error: "Sponsored event is not eligible" }, 409);
    }
    const result = await insertAttributionTouch(admin, user.id, {
      ...body,
      touch_type: body.event_type ?? body.touch_type,
    });
    return result.error
      ? jsonResponse({ error: result.error }, 400)
      : jsonResponse({ ok: true, duplicate: result.duplicate });
  }

  if (action !== "fetch") {
    return jsonResponse({ error: "Unsupported action" }, 400);
  }
  const placement = body.placement;
  if (!isSponsoredPlacement(placement)) {
    return jsonResponse({ error: "Invalid placement" }, 400);
  }
  const limit = Math.min(Math.max(Number(body.limit) || 1, 1), 10);
  const context = objectValue(body.context);
  const now = new Date();
  const nowIso = now.toISOString();
  const day = nowIso.slice(0, 10);
  const dayStart = `${day}T00:00:00.000Z`;

  const viewerId = user?.id ?? null;
  const [
    campaignsResult,
    adSetsResult,
    creativesResult,
    placementsResult,
    preferencesResult,
    ledgerResult,
    flagsResult,
    impressionsResult,
    setCreativesResult,
    setPlacementsResult,
  ] = await Promise.all([
    admin.from("sponsored_campaigns").select("*").eq("status", "active")
      .lte("starts_at", nowIso).gt("ends_at", nowIso).limit(MAX_CANDIDATES),
    admin.from("ad_sets").select("*").eq("status", "active").limit(MAX_CANDIDATES),
    admin.from("ad_creatives").select("*").limit(MAX_CANDIDATES),
    admin.from("ad_placements").select("*").limit(100),
    viewerId
      ? admin.from("ad_privacy_preferences").select("*").eq("user_id", viewerId)
        .maybeSingle()
      : emptyRow(),
    admin.from("ad_budget_ledger").select(
      "campaign_id, amount, entry_type, occurred_at",
    ).limit(2000),
    admin.from("ad_feature_flags").select("flag_key, enabled").limit(100),
    viewerId
      ? admin.from("sponsored_campaign_events")
        .select("campaign_id, event_type, occurred_at")
        .eq("viewer_id", viewerId)
        .eq("event_type", "impression")
        .gte("occurred_at", dayStart)
        .limit(1000)
      : emptyRead(),
    admin.from("ad_set_creatives").select("*").eq("status", "active")
      .limit(MAX_CANDIDATES),
    admin.from("ad_set_placements").select("ad_set_id, placement_id, is_active")
      .eq("is_active", true)
      .limit(MAX_CANDIDATES),
  ]);
  const schemaReads = [
    adSetsResult,
    creativesResult,
    placementsResult,
    preferencesResult,
    ledgerResult,
    flagsResult,
    setCreativesResult,
    setPlacementsResult,
  ];
  if (schemaReads.every((result) => missingRelation(result.error))) {
    return jsonResponse({ ads: [], personalized: false });
  }
  const requiredError = campaignsResult.error || impressionsResult.error ||
    schemaReads.find((result) => result.error && !missingRelation(result.error))
      ?.error;
  if (requiredError) {
    console.error("sponsored auction read failed", requiredError.message);
    return jsonResponse({ error: "Could not run sponsored auction" }, 500);
  }

  const placementRows = rows(placementsResult.data);
  const placementConfig = placementRows.find((row) =>
    stringValue(row, ["placement_key", "key", "name"]) === placement
  );
  if (
    !placementConfig ||
    !booleanValue(placementConfig, ["is_active", "enabled"], true)
  ) {
    return jsonResponse({ ads: [], personalized: false });
  }
  const flags = rows(flagsResult.data);
  if (
    !enabledFlag(flags, "sponsored_ads") ||
    !enabledFlag(flags, `placement:${placement}`)
  ) {
    return jsonResponse({ ads: [], personalized: false });
  }

  const preference = objectValue(preferencesResult.data);
  const personalized = Boolean(viewerId) && preference.personalized_ads === true;
  let profile: JsonObject = {};
  if (personalized && viewerId) {
    const { data, error } = await admin.from("profiles")
      .select("country_code, location, industry, interests")
      .eq("id", viewerId)
      .maybeSingle();
    if (error) {
      console.error("sponsored profile read failed", error.message);
      return jsonResponse({ error: "Could not run sponsored auction" }, 500);
    }
    profile = objectValue(data);
  }

  const campaigns = rows(campaignsResult.data).filter((campaign) =>
    !viewerId || campaign.advertiser_user_id !== viewerId
  );
  const advertiserIds = [
    ...new Set(campaigns.map((row) => String(row.advertiser_user_id ?? ""))
      .filter(Boolean)),
  ];
  const { data: advertisers, error: advertiserError } = advertiserIds.length
    ? await admin.from("profiles").select("id, is_verified").in(
      "id",
      advertiserIds,
    )
    : { data: [], error: null };
  if (advertiserError) {
    return jsonResponse({ error: "Could not verify advertisers" }, 500);
  }
  const verifiedAdvertisers = new Set(
    rows(advertisers).filter((row) => row.is_verified === true).map((row) =>
      String(row.id)
    ),
  );
  const ledger = rows(ledgerResult.data);
  const impressions = rows(impressionsResult.data);
  const placementById = new Map(
    rows(placementsResult.data).map((row) => [String(row.id), row]),
  );
  const placementKeysByAdSet = new Map<string, string[]>();
  for (const row of rows(setPlacementsResult.data)) {
    const adSetId = String(row.ad_set_id ?? "");
    const key = stringValue(
      objectValue(placementById.get(String(row.placement_id))),
      ["placement_key"],
    );
    if (!adSetId || !key) continue;
    const current = placementKeysByAdSet.get(adSetId) ?? [];
    current.push(key);
    placementKeysByAdSet.set(adSetId, current);
  }
  const adSets = rows(adSetsResult.data).map((adSet) => ({
    ...adSet,
    placement_keys: placementKeysByAdSet.get(String(adSet.id ?? "")) ?? [],
  }));
  const creativeById = new Map(
    rows(creativesResult.data).map((row) => [String(row.id), row]),
  );
  const creatives = rows(setCreativesResult.data).flatMap((link) => {
    const creative = creativeById.get(String(link.creative_id));
    const adSet = adSets.find((row) => String(row.id) === String(link.ad_set_id));
    if (!creative || !adSet) return [];
    return [{
      ...creative,
      campaign_id: adSet.campaign_id,
      ad_set_id: adSet.id,
      placement_keys: adSet.placement_keys,
    }];
  });
  const candidates: AuctionCandidate[] = [];

  for (const campaign of campaigns) {
    const campaignId = String(campaign.id ?? "");
    for (const adSet of adSets.filter((row) =>
      belongsToCampaign(row, campaignId)
    )) {
      const targeting = objectValue(adSet.targeting ?? adSet.audience);
      const contextual = matchesContext(targeting, context);
      if (!contextual) continue;
      const personalizedMatch = personalized
        ? personalizedAudienceScore(targeting, profile)
        : 0;
      if (personalized && personalizedMatch == null) continue;
      const adSetId = String(adSet.id ?? "");
      for (
        const creative of creatives.filter((row) =>
          belongsToCampaign(row, campaignId) &&
          belongsToAdSet(row, adSetId)
        )
      ) {
        candidates.push({
          campaign,
          adSet,
          creative,
          advertiserVerified: verifiedAdvertisers.has(
            String(campaign.advertiser_user_id),
          ),
          spentTotal: sumLedger(ledger, campaignId),
          spentToday: sumLedger(ledger, campaignId, day),
          impressionsToday: impressions.filter((row) =>
            String(row.campaign_id) === campaignId &&
            stringValue(row, ["event_type", "touch_type"]) === "impression"
          ).length,
          personalizedMatch,
        });
      }
    }
  }

  const ranked = candidates
    .filter((candidate) => isCandidateEligible(candidate, placement, now))
    .map((candidate) =>
      rankCandidate(
        candidate,
        `${viewerId ?? "anonymous"}:${candidate.campaign.id}:${candidate.creative.id}:${placement}:${day}`,
        now,
      )
    )
    .filter((candidate) =>
      candidate.effectiveBid >=
        numberValue(placementConfig, ["floor_bid", "minimum_bid", "floor_cpm"], 0)
    )
    .sort((left, right) =>
      right.score - left.score ||
      String(left.creative.id).localeCompare(String(right.creative.id))
    )
    .slice(0, Math.min(
      limit,
      numberValue(placementConfig, ["max_ads", "max_results", "max_ads_per_request"], limit),
    ));

  return jsonResponse({
    ads: ranked.map((candidate) =>
      disclosedAdPayload(
        candidate,
        placement,
        personalized && (candidate.personalizedMatch ?? 0) > 0,
        matchesContext(
          objectValue(candidate.adSet.targeting ?? candidate.adSet.audience),
          context,
        ),
      )
    ),
    personalized,
  });
});
