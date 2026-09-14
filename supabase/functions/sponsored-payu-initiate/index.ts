import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  buildPlatformPayuPaymentFields,
  formatPlatformPayuAmount,
  resolvePlatformPayuCredentials,
} from "../_shared/platform-payu.ts";
import {
  cleanString,
  insertCampaignAudit,
  isUuid,
  readJsonObject,
  requireSponsoredUser,
} from "../_shared/sponsored-ads.ts";

function adTransactionId(campaignId: string): string {
  const campaign = campaignId.replaceAll("-", "").slice(0, 8).toUpperCase();
  const time = Date.now().toString(36).toUpperCase();
  const random = crypto.randomUUID().replaceAll("-", "").slice(0, 4)
    .toUpperCase();
  return `AD_${campaign}_${time}_${random}`;
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
  if (cleanString(body.client_platform, 20).toLowerCase() !== "web") {
    return jsonResponse({
      error: "Sponsored campaign payment is available on web only",
    }, 403);
  }

  const campaignId = cleanString(body.campaign_id, 80);
  if (!isUuid(campaignId)) {
    return jsonResponse({ error: "Valid campaign_id required" }, 400);
  }
  const creds = resolvePlatformPayuCredentials();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  if (!creds || !supabaseUrl) {
    return jsonResponse({ error: "Platform PayU is not configured" }, 503);
  }

  const { admin, user } = context;
  const { data: campaign, error: campaignError } = await admin
    .from("sponsored_campaigns")
    .select("id, advertiser_user_id, name, status, total_budget, currency")
    .eq("id", campaignId)
    .maybeSingle();
  if (campaignError) {
    return jsonResponse({ error: "Could not load campaign" }, 500);
  }
  if (!campaign) return jsonResponse({ error: "Campaign not found" }, 404);
  if (campaign.advertiser_user_id !== user.id) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }
  if (!["draft", "pending_payment", "rejected"].includes(campaign.status)) {
    return jsonResponse({
      error: `Campaign cannot be paid from ${campaign.status}`,
    }, 409);
  }

  const amount = Number(campaign.total_budget);
  if (!Number.isFinite(amount) || amount < 100 || campaign.currency !== "INR") {
    return jsonResponse(
      { error: "Campaign has an invalid server-side budget" },
      409,
    );
  }
  const formattedAmount = formatPlatformPayuAmount(amount);

  const { data: completed } = await admin
    .from("sponsored_campaign_payments")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("status", "completed")
    .limit(1)
    .maybeSingle();
  if (completed) {
    return jsonResponse({ error: "Campaign is already paid" }, 409);
  }

  const { data: reusable } = await admin
    .from("sponsored_campaign_payments")
    .select("id, transaction_id, amount, status")
    .eq("campaign_id", campaignId)
    .eq("advertiser_user_id", user.id)
    .in("status", ["pending", "processing", "failed", "cancelled"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let paymentId = reusable?.id as string | undefined;
  let txnid = reusable &&
      ["pending", "processing"].includes(reusable.status) &&
      Math.abs(Number(reusable.amount) - amount) <= 0.01
    ? String(reusable.transaction_id)
    : adTransactionId(campaignId);
  const now = new Date().toISOString();

  if (paymentId) {
    const { error } = await admin
      .from("sponsored_campaign_payments")
      .update({
        status: "pending",
        amount,
        transaction_id: txnid,
        gateway_transaction_id: null,
        failure_code: null,
        failure_reason: null,
        provider_response: { initiated_at: now },
        processed_at: null,
        updated_at: now,
      })
      .eq("id", paymentId)
      .neq("status", "completed");
    if (error) return jsonResponse({ error: "Could not prepare payment" }, 500);
  } else {
    const { data: inserted, error } = await admin
      .from("sponsored_campaign_payments")
      .insert({
        campaign_id: campaignId,
        advertiser_user_id: user.id,
        status: "pending",
        amount,
        currency: "INR",
        transaction_id: txnid,
        provider_response: { initiated_at: now },
      })
      .select("id")
      .single();
    if (error || !inserted) {
      return jsonResponse({ error: "Could not create payment" }, 500);
    }
    paymentId = inserted.id;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, username, email, phone")
    .eq("id", user.id)
    .maybeSingle();
  const firstname =
    cleanString(profile?.full_name || profile?.username || "Advertiser", 60)
      .split(/\s+/)[0] ||
    "Advertiser";
  const email = cleanString(
    profile?.email || user.email || "advertiser@sheconomy.in",
    200,
  );
  const phone =
    cleanString(profile?.phone || user.phone, 30).replace(/\D/g, "").slice(
      -15,
    ) || "9999999999";
  const productinfo = `Sponsored campaign: ${cleanString(campaign.name, 80)}`;
  const fields = await buildPlatformPayuPaymentFields({
    creds,
    txnid,
    amount: formattedAmount,
    productinfo,
    firstname,
    email,
    phone,
    udf1: user.id,
    udf2: paymentId!,
    udf3: campaignId,
    udf4: "sponsored_ads",
    udf5: "",
    supabaseUrl,
  });
  const callback = `${
    supabaseUrl.replace(/\/$/, "")
  }/functions/v1/sponsored-payu-callback`;
  fields.surl = `${callback}?status=success`;
  fields.furl = `${callback}?status=failure`;

  if (campaign.status !== "pending_payment") {
    const { data: transitioned } = await admin
      .from("sponsored_campaigns")
      .update({
        status: "pending_payment",
        rejection_reason: null,
        updated_at: now,
      })
      .eq("id", campaignId)
      .eq("status", campaign.status)
      .select("id")
      .maybeSingle();
    if (transitioned) {
      await insertCampaignAudit(
        admin,
        campaignId,
        user.id,
        "payment_initiated",
        campaign.status,
        "pending_payment",
        null,
        { payment_id: paymentId, transaction_id: txnid },
      );
    }
  }

  return jsonResponse({
    payuUrl: `${creds.baseUrl}/_payment`,
    params: fields,
    txnid,
    payment_id: paymentId,
  });
});
