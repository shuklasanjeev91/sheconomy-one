import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  CAMPAIGN_CTAS,
  CAMPAIGN_OBJECTIVES,
  type CampaignRow,
  cleanString,
  insertCampaignAudit,
  isUuid,
  readJsonObject,
  requireSponsoredUser,
  validateAudience,
  validateHttpsUrl,
  validateOwnedPublicPost,
} from "../_shared/sponsored-ads.ts";

const CAMPAIGN_SELECT =
  "id, advertiser_user_id, post_id, company_id, name, objective, status, audience, destination_url, call_to_action, currency, total_budget, daily_budget, spent_amount, impression_count, click_count, frequency_cap_per_day, starts_at, ends_at, paid_at, reviewed_at, rejection_reason, cancelled_at, completed_at, created_at, updated_at";

function campaignPayload(body: Record<string, unknown>):
  | { value: Record<string, unknown>; postId: string }
  | { error: string } {
  const postId = cleanString(body.post_id, 80);
  const name = cleanString(body.name, 100);
  const objective = cleanString(body.objective || "awareness", 40)
    .toLowerCase();
  const cta = cleanString(body.call_to_action || "learn_more", 40)
    .toLowerCase();
  const totalBudget = Number(body.total_budget);
  const dailyBudget = Number(body.daily_budget);
  const frequencyCap = body.frequency_cap_per_day == null
    ? 3
    : Number(body.frequency_cap_per_day);
  const startsAt = new Date(String(body.starts_at ?? ""));
  const endsAt = new Date(String(body.ends_at ?? ""));
  const audience = validateAudience(body.audience);
  const destination = validateHttpsUrl(body.destination_url);

  if (!isUuid(postId)) return { error: "A valid post_id is required" };
  if (!name) {
    return { error: "name is required and must be at most 100 characters" };
  }
  if (!CAMPAIGN_OBJECTIVES.has(objective)) {
    return { error: "Invalid objective" };
  }
  if (!CAMPAIGN_CTAS.has(cta)) return { error: "Invalid call_to_action" };
  if ("error" in audience) return audience;
  if ("error" in destination) return destination;
  if (!Number.isFinite(totalBudget) || totalBudget < 100) {
    return { error: "total_budget must be at least INR 100" };
  }
  if (
    !Number.isFinite(dailyBudget) || dailyBudget < 50 ||
    dailyBudget > totalBudget
  ) {
    return {
      error:
        "daily_budget must be at least INR 50 and no more than total_budget",
    };
  }
  if (
    !Number.isInteger(frequencyCap) ||
    frequencyCap < 1 ||
    frequencyCap > 10
  ) {
    return { error: "frequency_cap_per_day must be between 1 and 10" };
  }
  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    endsAt <= startsAt ||
    endsAt <= new Date()
  ) {
    return {
      error: "starts_at and ends_at must define a valid future delivery window",
    };
  }
  if (objective === "traffic" && !destination.value) {
    return { error: "destination_url is required for traffic campaigns" };
  }

  return {
    postId,
    value: {
      post_id: postId,
      name,
      objective,
      audience: audience.value,
      destination_url: destination.value,
      call_to_action: cta,
      currency: "INR",
      total_budget: Math.round(totalBudget * 100) / 100,
      daily_budget: Math.round(dailyBudget * 100) / 100,
      frequency_cap_per_day: frequencyCap,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    },
  };
}

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
  const action = cleanString(body.action || "list", 40).toLowerCase();
  const { admin, user } = context;

  if (action === "list") {
    const limit = Math.min(Math.max(Number(body.limit) || 30, 1), 100);
    const { data, error } = await admin
      .from("sponsored_campaigns")
      .select(CAMPAIGN_SELECT)
      .eq("advertiser_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    return error
      ? jsonResponse({ error: "Could not load campaigns" }, 500)
      : jsonResponse({ campaigns: data ?? [] });
  }

  if (action === "get") {
    const campaignId = cleanString(body.campaign_id, 80);
    if (!isUuid(campaignId)) {
      return jsonResponse({ error: "Valid campaign_id required" }, 400);
    }
    const { data, error } = await admin
      .from("sponsored_campaigns")
      .select(CAMPAIGN_SELECT)
      .eq("id", campaignId)
      .eq("advertiser_user_id", user.id)
      .maybeSingle();
    if (error) return jsonResponse({ error: "Could not load campaign" }, 500);
    return data
      ? jsonResponse({ campaign: data })
      : jsonResponse({ error: "Campaign not found" }, 404);
  }

  if (action === "create") {
    const parsed = campaignPayload(body);
    if ("error" in parsed) return jsonResponse({ error: parsed.error }, 400);
    const ownership = await validateOwnedPublicPost(
      admin,
      user.id,
      parsed.postId,
    );
    if ("error" in ownership) {
      return jsonResponse({ error: ownership.error }, ownership.status);
    }

    const { data: existing } = await admin
      .from("sponsored_campaigns")
      .select("id, status")
      .eq("advertiser_user_id", user.id)
      .eq("post_id", parsed.postId)
      .in("status", ["draft", "pending_payment", "pending_review", "rejected"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      return jsonResponse({
        error: "This post already has an unfinished campaign",
        campaign_id: existing.id,
      }, 409);
    }

    const { data, error } = await admin
      .from("sponsored_campaigns")
      .insert({
        ...parsed.value,
        advertiser_user_id: user.id,
        company_id: ownership.companyId,
        status: "pending_payment",
      })
      .select(CAMPAIGN_SELECT)
      .single();
    if (error || !data) {
      return jsonResponse({ error: "Could not create campaign" }, 500);
    }
    await insertCampaignAudit(
      admin,
      data.id,
      user.id,
      "created",
      null,
      "pending_payment",
    );
    return jsonResponse({ campaign: data }, 201);
  }

  const campaignId = cleanString(body.campaign_id, 80);
  if (!isUuid(campaignId)) {
    return jsonResponse({ error: "Valid campaign_id required" }, 400);
  }
  const { data: campaign, error: campaignError } = await admin
    .from("sponsored_campaigns")
    .select(CAMPAIGN_SELECT)
    .eq("id", campaignId)
    .eq("advertiser_user_id", user.id)
    .maybeSingle();
  if (campaignError) {
    return jsonResponse({ error: "Could not load campaign" }, 500);
  }
  if (!campaign) return jsonResponse({ error: "Campaign not found" }, 404);
  const current = campaign as CampaignRow;

  if (action === "update") {
    if (!["draft", "pending_payment", "rejected"].includes(current.status)) {
      return jsonResponse({
        error: `Campaign cannot be updated from ${current.status}`,
      }, 409);
    }
    const parsed = campaignPayload({ ...current, ...body });
    if ("error" in parsed) return jsonResponse({ error: parsed.error }, 400);
    const ownership = await validateOwnedPublicPost(
      admin,
      user.id,
      parsed.postId,
    );
    if ("error" in ownership) {
      return jsonResponse({ error: ownership.error }, ownership.status);
    }

    const { data: completedPayment } = await admin
      .from("sponsored_campaign_payments")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("status", "completed")
      .limit(1)
      .maybeSingle();
    const paid = Boolean(completedPayment || current.paid_at);
    if (
      paid &&
      (Number(parsed.value.total_budget) !== Number(current.total_budget) ||
        parsed.value.currency !== "INR")
    ) {
      return jsonResponse(
        { error: "Budget cannot be changed after payment" },
        409,
      );
    }

    const nextStatus = paid ? "pending_review" : "pending_payment";
    const { data, error } = await admin
      .from("sponsored_campaigns")
      .update({
        ...parsed.value,
        company_id: ownership.companyId,
        status: nextStatus,
        rejection_reason: null,
        reviewed_at: null,
        reviewed_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId)
      .eq("status", current.status)
      .select(CAMPAIGN_SELECT)
      .maybeSingle();
    if (error) return jsonResponse({ error: "Could not update campaign" }, 500);
    if (!data) {
      return jsonResponse(
        { error: "Campaign changed; retry the request" },
        409,
      );
    }
    await insertCampaignAudit(
      admin,
      campaignId,
      user.id,
      "updated",
      current.status,
      nextStatus,
    );
    return jsonResponse({ campaign: data });
  }

  if (action === "pay_with_wallet") {
    if (!["draft", "pending_payment", "rejected"].includes(current.status)) {
      return jsonResponse({
        error: `Campaign cannot be paid from ${current.status}`,
      }, 409);
    }
    const budget = Number(current.total_budget);
    if (!Number.isFinite(budget) || budget < 100 || current.currency !== "INR") {
      return jsonResponse({ error: "Campaign budget is invalid" }, 409);
    }
    const { data: completed } = await admin
      .from("sponsored_campaign_payments")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("status", "completed")
      .limit(1)
      .maybeSingle();
    if (completed || current.paid_at) {
      return jsonResponse({ error: "Campaign is already paid" }, 409);
    }

    const shopId = cleanString(body.shop_id, 80);
    let ownerType: "shop" | "user" = "user";
    let ownerId = user.id;
    if (shopId && isUuid(shopId)) {
      const { data: shop } = await admin
        .from("shops")
        .select("id, user_id")
        .eq("id", shopId)
        .maybeSingle();
      if (!shop || shop.user_id !== user.id) {
        return jsonResponse({ error: "Forbidden shop wallet" }, 403);
      }
      ownerType = "shop";
      ownerId = shopId;
    }

    const debitKey = `spend_ads:${campaignId}:${ownerType}:${ownerId}`;
    const { data: debit, error: debitError } = await admin.rpc(
      "platform_wallet_debit",
      {
        p_owner_type: ownerType,
        p_owner_id: ownerId,
        p_amount: budget,
        p_entry_type: "spend_ads",
        p_idempotency_key: debitKey,
        p_currency: "INR",
        p_description: `Sponsored campaign ${current.name}`,
        p_metadata: { campaign_id: campaignId },
        p_order_id: null,
        p_shop_id: ownerType === "shop" ? ownerId : null,
        p_campaign_id: campaignId,
      },
    );
    if (debitError) {
      return jsonResponse({ error: debitError.message }, 500);
    }
    const debitJson = (debit ?? {}) as Record<string, unknown>;
    if (debitJson.ok === false) {
      if (debitJson.error === "insufficient_credit") {
        return jsonResponse({
          error: "Insufficient wallet balance",
          balance: debitJson.balance,
          required: budget,
        }, 402);
      }
      return jsonResponse({ error: "Wallet debit failed" }, 400);
    }

    const now = new Date().toISOString();
    const txnid = `WALLET_${campaignId.replaceAll("-", "").slice(0, 8)}_${Date.now()
      .toString(36)
      .toUpperCase()}`;
    const { data: payment, error: paymentError } = await admin
      .from("sponsored_campaign_payments")
      .insert({
        campaign_id: campaignId,
        advertiser_user_id: user.id,
        status: "completed",
        amount: budget,
        currency: "INR",
        transaction_id: txnid,
        processed_at: now,
        provider_response: {
          source: "platform_wallet",
          owner_type: ownerType,
          owner_id: ownerId,
          ledger_id: debitJson.ledger_id ?? null,
        },
      })
      .select("id")
      .single();
    if (paymentError || !payment) {
      return jsonResponse({ error: "Could not record wallet payment" }, 500);
    }

    const { data: transitioned, error: transitionError } = await admin
      .from("sponsored_campaigns")
      .update({
        status: "pending_review",
        paid_at: now,
        rejection_reason: null,
        updated_at: now,
      })
      .eq("id", campaignId)
      .eq("advertiser_user_id", user.id)
      .in("status", ["draft", "pending_payment", "rejected"])
      .select(CAMPAIGN_SELECT)
      .maybeSingle();
    if (transitionError || !transitioned) {
      return jsonResponse({ error: "Could not update campaign" }, 500);
    }
    await insertCampaignAudit(
      admin,
      campaignId,
      user.id,
      "payment_completed",
      current.status,
      "pending_review",
      null,
      {
        payment_id: payment.id,
        transaction_id: txnid,
        source: "platform_wallet",
      },
    );
    return jsonResponse({ campaign: transitioned, payment_id: payment.id });
  }

  const transitions: Record<string, { from: string[]; to: string }> = {
    pause: { from: ["active"], to: "paused" },
    resume: { from: ["paused"], to: "active" },
    cancel: {
      from: [
        "draft",
        "pending_payment",
        "pending_review",
        "active",
        "paused",
        "rejected",
      ],
      to: "cancelled",
    },
    request_refund: {
      from: [
        "pending_review",
        "active",
        "paused",
        "completed",
        "cancelled",
        "rejected",
      ],
      to: "refund_requested",
    },
  };
  const transition = transitions[action];
  if (!transition) return jsonResponse({ error: "Unsupported action" }, 400);
  if (!transition.from.includes(current.status)) {
    return jsonResponse({
      error: `Cannot ${action} a ${current.status} campaign`,
    }, 409);
  }
  if (action === "resume") {
    const now = Date.now();
    if (!current.paid_at || new Date(current.ends_at).getTime() <= now) {
      return jsonResponse({
        error: "Only paid campaigns within their schedule can resume",
      }, 409);
    }
  }
  if (action === "request_refund") {
    const { data: payment } = await admin
      .from("sponsored_campaign_payments")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("status", "completed")
      .limit(1)
      .maybeSingle();
    if (!payment) {
      return jsonResponse({ error: "No completed payment is refundable" }, 409);
    }
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: transition.to,
    updated_at: now,
  };
  if (action === "cancel") patch.cancelled_at = now;
  const { data, error } = await admin
    .from("sponsored_campaigns")
    .update(patch)
    .eq("id", campaignId)
    .eq("status", current.status)
    .select(CAMPAIGN_SELECT)
    .maybeSingle();
  if (error) {
    return jsonResponse({ error: `Could not ${action} campaign` }, 500);
  }
  if (!data) {
    return jsonResponse({ error: "Campaign changed; retry the request" }, 409);
  }
  await insertCampaignAudit(
    admin,
    campaignId,
    user.id,
    action,
    current.status,
    transition.to,
  );
  return jsonResponse({ campaign: data });
});
