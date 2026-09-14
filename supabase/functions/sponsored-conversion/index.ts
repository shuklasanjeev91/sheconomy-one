import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  insertAttributionTouch,
  isSponsoredPlacement,
  objectValue,
  stringValue,
} from "../_shared/sponsored-auction.ts";
import {
  cleanString,
  isUuid,
  readJsonObject,
  requireSponsoredUser,
} from "../_shared/sponsored-ads.ts";

const PURCHASE_ORDER_STATUSES = new Set([
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "completed",
]);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  const auth = await requireSponsoredUser(request);
  if (auth instanceof Response) return auth;
  const body = await readJsonObject(request);
  if (body instanceof Response) return body;
  const { admin, user } = auth;
  const action = cleanString(body.action || "conversion", 30).toLowerCase();

  if (action === "touch") {
    const touchType = cleanString(body.touch_type, 30).toLowerCase();
    if (!["cart", "checkout"].includes(touchType)) {
      return jsonResponse({
        error: "Only cart and checkout client touches are accepted",
      }, 400);
    }
    if (
      !isUuid(body.campaign_id) || !isUuid(body.creative_id) ||
      !isSponsoredPlacement(body.placement)
    ) {
      return jsonResponse({
        error: "Valid campaign, creative, and placement required",
      }, 400);
    }
    const { data: creative, error: creativeError } = await admin
      .from("ad_creatives")
      .select("id")
      .eq("id", body.creative_id)
      .maybeSingle();
    if (creativeError) {
      return jsonResponse({ error: "Could not validate sponsored touch" }, 500);
    }
    if (!creative) {
      return jsonResponse({ error: "Sponsored creative not found" }, 404);
    }
    const result = await insertAttributionTouch(admin, user.id, body);
    return result.error
      ? jsonResponse({ error: result.error }, 400)
      : jsonResponse({ ok: true, duplicate: result.duplicate });
  }

  if (action !== "conversion") {
    return jsonResponse({ error: "Unsupported action" }, 400);
  }
  const conversionType = cleanString(body.conversion_type, 30).toLowerCase();
  if (conversionType !== "purchase") {
    return jsonResponse({
      error: "Only server-verified purchase conversions are supported",
    }, 400);
  }
  const orderId = cleanString(body.order_id, 80);
  const conversionKey = cleanString(body.conversion_key, 200);
  if (!isUuid(orderId)) {
    return jsonResponse({ error: "Valid order_id required" }, 400);
  }
  if (
    conversionKey.length < 12 ||
    !/^[A-Za-z0-9._:-]+$/.test(conversionKey)
  ) {
    return jsonResponse({
      error: "conversion_key must be a deterministic 12-200 character key",
    }, 400);
  }

  const { data: order, error: orderError } = await admin.from("orders")
    .select(
      "id, user_id, order_status, payment_required, customer_total_amount, total_amount, customer_currency, currency, created_at",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) {
    return jsonResponse({ error: "Could not verify order" }, 500);
  }
  if (!order || order.user_id !== user.id) {
    return jsonResponse({ error: "Order not found" }, 404);
  }
  if (!PURCHASE_ORDER_STATUSES.has(String(order.order_status).toLowerCase())) {
    return jsonResponse({ error: "Order is not a completed purchase" }, 409);
  }

  const { data: payments, error: paymentError } = await admin
    .from("order_payments")
    .select("id, payment_status, amount")
    .eq("order_id", orderId);
  if (paymentError) {
    return jsonResponse({ error: "Could not verify payment" }, 500);
  }
  const completedPayment = (payments ?? []).find((row) =>
    row.payment_status === "completed"
  );
  if (order.payment_required !== false && !completedPayment) {
    return jsonResponse({ error: "Order payment is not complete" }, 409);
  }

  const touchKey = cleanString(body.touch_key, 200);
  if (!touchKey) {
    return jsonResponse({
      error: "An owned touch_key is required for purchase attribution",
    }, 400);
  }
  const { data: touch, error: touchError } = await admin
    .from("sponsored_campaign_events")
    .select("id, campaign_id, ad_set_id, creative_id, occurred_at, event_key")
    .eq("viewer_id", user.id)
    .eq("event_key", touchKey)
    .maybeSingle();
  if (touchError) {
    return jsonResponse({ error: "Could not validate attribution" }, 500);
  }
  if (!touch) {
    return jsonResponse({ error: "Attribution touch not found" }, 404);
  }
  const touchTime = new Date(touch.occurred_at).getTime();
  const orderTime = new Date(order.created_at).getTime();
  if (
    !Number.isFinite(touchTime) || !Number.isFinite(orderTime) ||
    touchTime > orderTime + 5 * 60 * 1000 ||
    orderTime - touchTime > 30 * 24 * 60 * 60 * 1000
  ) {
    return jsonResponse({ error: "Attribution touch is outside the window" }, 409);
  }
  const touchId = touch.id;
  const campaignId = String(touch.campaign_id);
  const adSetId = touch.ad_set_id;
  const creativeId = touch.creative_id;
  if (!isUuid(campaignId)) {
    return jsonResponse({ error: "Attribution touch is invalid" }, 409);
  }
  const { data: campaign, error: campaignError } = await admin
    .from("sponsored_campaigns")
    .select("id")
    .eq("id", campaignId)
    .maybeSingle();
  if (campaignError) {
    return jsonResponse({ error: "Could not validate campaign" }, 500);
  }
  if (!campaign) return jsonResponse({ error: "Campaign not found" }, 404);

  const metadata = objectValue(body.metadata);
  delete metadata.user_id;
  delete metadata.viewer_id;
  delete metadata.audience;
  delete metadata.value;
  delete metadata.amount;
  const verifiedValue = Number(
    order.customer_total_amount ?? order.total_amount ??
      completedPayment?.amount ?? 0,
  );
  const currency = String(order.customer_currency ?? order.currency ?? "INR")
    .slice(0, 3).toUpperCase();
  const serverConversionKey = `purchase:${order.id}:${campaignId}`;
  const { data: existing, error: existingError } = await admin
    .from("ad_conversions")
    .select("id")
    .eq("external_event_key", serverConversionKey)
    .maybeSingle();
  if (existingError) {
    return jsonResponse({ error: "Could not verify conversion" }, 500);
  }
  if (existing) return jsonResponse({ ok: true, duplicate: true });
  const { data: campaignAccount } = await admin
    .from("sponsored_campaigns")
    .select("account_id")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaignAccount?.account_id) {
    return jsonResponse({ error: "Campaign is not linked to an ad account" }, 409);
  }
  const { error: insertError } = await admin
    .from("ad_conversions")
    .insert({
      account_id: campaignAccount.account_id,
      campaign_id: campaignId,
      conversion_type: "purchase",
      external_event_key: serverConversionKey,
      value: Number.isFinite(verifiedValue) ? verifiedValue : 0,
      currency,
      occurred_at: order.created_at,
      metadata: {
        ...metadata,
        verification: "order_and_payment",
        client_conversion_key: conversionKey,
        order_id: order.id,
        touch_id: touchId,
        ad_set_id: adSetId,
        creative_id: creativeId,
      },
    });
  if (insertError?.code === "23505") {
    return jsonResponse({ ok: true, duplicate: true });
  }
  if (insertError) {
    console.error(
      "sponsored conversion insert failed",
      stringValue(objectValue(insertError), ["message"]),
    );
    return jsonResponse({ error: "Could not record conversion" }, 500);
  }
  return jsonResponse({ ok: true, duplicate: false });
});
