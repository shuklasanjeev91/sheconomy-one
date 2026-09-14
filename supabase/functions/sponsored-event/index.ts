import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  cleanString,
  isUuid,
  readJsonObject,
  requireSponsoredUser,
} from "../_shared/sponsored-ads.ts";

const EVENT_TYPES = new Set(["impression", "click", "hide", "report"]);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  const context = await requireSponsoredUser(request);
  if (context instanceof Response) return context;
  const body = await readJsonObject(request);
  if (body instanceof Response) return body;

  const campaignId = cleanString(body.campaign_id, 80);
  const postId = cleanString(body.post_id, 80);
  const eventType = cleanString(body.event_type, 30).toLowerCase();
  const eventKey = cleanString(body.event_key, 200);
  const placement = cleanString(body.placement || "community_feed", 60);
  const sessionId = cleanString(body.session_id, 160) || null;
  if (!isUuid(campaignId) || !isUuid(postId)) {
    return jsonResponse(
      { error: "Valid campaign_id and post_id required" },
      400,
    );
  }
  if (!EVENT_TYPES.has(eventType)) {
    return jsonResponse({ error: "Invalid event_type" }, 400);
  }
  if (eventKey.length < 12 || !/^[A-Za-z0-9._:-]+$/.test(eventKey)) {
    return jsonResponse({
      error: "event_key must be a deterministic 12-200 character key",
    }, 400);
  }
  if (!placement || placement.length > 60) {
    return jsonResponse({ error: "Invalid placement" }, 400);
  }

  const { admin, user } = context;
  const { data: campaign, error } = await admin
    .from("sponsored_campaigns")
    .select(
      "id, post_id, advertiser_user_id, status, starts_at, ends_at, completed_at",
    )
    .eq("id", campaignId)
    .maybeSingle();
  if (error) return jsonResponse({ error: "Could not validate campaign" }, 500);
  if (!campaign || campaign.post_id !== postId) {
    return jsonResponse({ error: "Campaign and post do not match" }, 404);
  }
  if (campaign.advertiser_user_id === user.id) {
    return jsonResponse({
      error: "Advertisers cannot record events on their own campaign",
    }, 403);
  }

  const now = Date.now();
  const starts = new Date(campaign.starts_at).getTime();
  const ends = new Date(campaign.ends_at).getTime();
  const activeOrRecent = campaign.status === "active" && starts <= now &&
    ends >= now - 10 * 60 * 1000;
  const recentlyCompleted = eventType === "click" &&
    campaign.status === "completed" &&
    new Date(campaign.completed_at ?? campaign.ends_at).getTime() >=
      now - 7 * 24 * 60 * 60 * 1000;
  if (!activeOrRecent && !recentlyCompleted) {
    return jsonResponse({
      error: "Campaign is not eligible for event tracking",
    }, 409);
  }

  const metadata = body.metadata && typeof body.metadata === "object" &&
      !Array.isArray(body.metadata)
    ? { ...(body.metadata as Record<string, unknown>) }
    : {};
  delete metadata.viewer_id;
  delete metadata.user_id;
  const serializedMetadata = JSON.stringify(metadata);
  if (serializedMetadata.length > 4000) {
    return jsonResponse({ error: "metadata is too large" }, 400);
  }

  const { error: insertError } = await admin.from("sponsored_campaign_events")
    .insert({
      campaign_id: campaignId,
      post_id: postId,
      viewer_id: user.id,
      event_type: eventType,
      placement,
      session_id: sessionId,
      event_key: eventKey,
      metadata,
    });
  if (insertError && insertError.code !== "23505") {
    return jsonResponse({ error: "Could not record event" }, 500);
  }
  if (eventType === "report" && !insertError) {
    const { count } = await admin
      .from("sponsored_campaign_events")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("event_type", "report");
    if ((count ?? 0) >= 3) {
      const pausedAt = new Date().toISOString();
      const { data: paused } = await admin
        .from("sponsored_campaigns")
        .update({ status: "paused", updated_at: pausedAt })
        .eq("id", campaignId)
        .eq("status", "active")
        .select("id")
        .maybeSingle();
      if (paused) {
        await admin.from("sponsored_campaign_audit_log").insert({
          campaign_id: campaignId,
          actor_id: null,
          action: "auto_paused_reports",
          from_status: "active",
          to_status: "paused",
          note: "Automatically paused after three sponsored-post reports",
          metadata: { report_count: count },
        });
      }
    }
  }
  return jsonResponse({ ok: true, duplicate: insertError?.code === "23505" });
});
