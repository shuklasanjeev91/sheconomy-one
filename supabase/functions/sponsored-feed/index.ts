import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  audienceScore,
  type CampaignRow,
  requireSponsoredUser,
} from "../_shared/sponsored-ads.ts";

type FeedCampaign = CampaignRow & {
  objective: string;
  call_to_action: string;
  destination_url: string | null;
  audience: Record<string, unknown>;
  cost_per_impression: number | string;
};

function matchReason(
  audience: Record<string, unknown>,
  _profile: {
    country_code?: string | null;
    location?: string | null;
    industry?: string | null;
    interests?: string[] | null;
  },
): string {
  const values = (key: string) =>
    Array.isArray(audience[key]) ? (audience[key] as unknown[]) : [];
  const dimensions = [
    values("interests").length ? "interests" : null,
    values("industries").length ? "industry" : null,
    values("locations").length ? "location" : null,
    values("country_codes").length ? "country" : null,
  ].filter(Boolean);
  return dimensions.length
    ? `Based on your profile: ${dimensions.join(", ")}`
    : "The advertiser selected a broad audience";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  const context = await requireSponsoredUser(request);
  if (context instanceof Response) return context;
  const { admin, user } = context;
  let requestedLimit = 2;
  if (request.method === "POST") {
    try {
      const body = await request.json();
      requestedLimit = Math.min(Math.max(Number(body?.limit) || 2, 1), 3);
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }
  }
  const now = new Date();
  const nowIso = now.toISOString();
  const metricDate = nowIso.slice(0, 10);
  const dayStart = `${metricDate}T00:00:00.000Z`;

  const [
    { data: profile, error: profileError },
    { data: campaigns, error: campaignError },
    { data: preference },
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("country_code, location, industry, interests")
      .eq("id", user.id)
      .maybeSingle(),
    admin
      .from("sponsored_campaigns")
      .select(
        "id, advertiser_user_id, post_id, company_id, status, objective, call_to_action, destination_url, audience, total_budget, daily_budget, cost_per_impression, spent_amount, frequency_cap_per_day, starts_at, ends_at, paid_at",
      )
      .eq("status", "active")
      .lte("starts_at", nowIso)
      .gt("ends_at", nowIso)
      .neq("advertiser_user_id", user.id)
      .limit(500),
    admin
      .from("ad_privacy_preferences")
      .select("personalized_ads")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (profileError || !profile) {
    return jsonResponse({ error: "Could not load viewer profile" }, 500);
  }
  if (campaignError) {
    return jsonResponse({ error: "Could not load sponsored feed" }, 500);
  }

  const budgetEligible = ((campaigns ?? []) as FeedCampaign[]).filter(
    (campaign) =>
      Number(campaign.spent_amount) + Number(campaign.cost_per_impression) <=
        Number(campaign.total_budget) + 0.0001,
  );
  if (!budgetEligible.length) return jsonResponse({ campaigns: [] });
  const ids = budgetEligible.map((campaign) => campaign.id);
  const postIds = budgetEligible.map((campaign) => campaign.post_id);

  const [
    { data: metrics, error: metricsError },
    { data: events, error: eventsError },
    { data: posts, error: postsError },
    { data: hiddenPosts, error: hiddenError },
    { data: blockedUsers, error: blockedError },
  ] = await Promise.all([
    admin
      .from("sponsored_campaign_daily_metrics")
      .select("campaign_id, spend")
      .in("campaign_id", ids)
      .eq("metric_date", metricDate),
    admin
      .from("sponsored_campaign_events")
      .select("campaign_id, event_type")
      .in("campaign_id", ids)
      .eq("viewer_id", user.id)
      .gte("occurred_at", dayStart),
    admin
      .from("posts")
      .select("id, user_id, visibility, is_deleted")
      .in("id", postIds),
    admin
      .from("community_hidden_posts")
      .select("post_id")
      .eq("user_id", user.id)
      .in("post_id", postIds),
    admin
      .from("blocked_users")
      .select("blocked_id")
      .eq("blocker_id", user.id),
  ]);
  if (metricsError || eventsError || postsError || hiddenError || blockedError) {
    return jsonResponse({
      error: "Could not enforce sponsored delivery limits",
    }, 500);
  }

  const spendByCampaign = new Map<string, number>(
    (metrics ?? []).map(
      (row): [string, number] => [String(row.campaign_id), Number(row.spend)],
    ),
  );
  const impressionCount = new Map<string, number>();
  const excluded = new Set<string>();
  const hiddenPostIds = new Set((hiddenPosts ?? []).map((row) => String(row.post_id)));
  const blockedUserIds = new Set((blockedUsers ?? []).map((row) => String(row.blocked_id)));
  const eligiblePostIds = new Set(
    (posts ?? [])
      .filter((post) =>
        !post.is_deleted &&
        String(post.visibility).toLowerCase() === "public" &&
        !hiddenPostIds.has(String(post.id)) &&
        !blockedUserIds.has(String(post.user_id))
      )
      .map((post) => String(post.id)),
  );
  for (const event of events ?? []) {
    const campaignId = String(event.campaign_id);
    if (event.event_type === "impression") {
      impressionCount.set(
        campaignId,
        (impressionCount.get(campaignId) ?? 0) + 1,
      );
    } else if (event.event_type === "hide" || event.event_type === "report") {
      excluded.add(campaignId);
    }
  }

  const personalized = preference?.personalized_ads === true;
  const scoringProfile = personalized
    ? profile
    : {
      country_code: null,
      location: null,
      industry: null,
      interests: [] as string[],
    };

  const eligible = budgetEligible
    .map((campaign) => ({
      campaign,
      score: audienceScore(campaign.audience ?? {}, scoringProfile),
      random: crypto.getRandomValues(new Uint32Array(1))[0] / 0xffffffff,
    }))
    .filter(
      ({ campaign, score }) =>
        score != null &&
        eligiblePostIds.has(campaign.post_id) &&
        !excluded.has(campaign.id) &&
        (spendByCampaign.get(campaign.id) ?? 0) +
              Number(campaign.cost_per_impression) <=
          Number(campaign.daily_budget) + 0.0001 &&
        (impressionCount.get(campaign.id) ?? 0) <
          Number(campaign.frequency_cap_per_day),
    )
    .sort((a, b) => Number(b.score) - Number(a.score) || b.random - a.random)
    .slice(0, requestedLimit)
    .map(({ campaign }) => ({
      campaign_id: campaign.id,
      post_id: campaign.post_id,
      objective: campaign.objective,
      cta: campaign.call_to_action,
      destination_url: campaign.destination_url,
      match_reason: matchReason(campaign.audience ?? {}, scoringProfile),
    }));

  return jsonResponse({ campaigns: eligible });
});
