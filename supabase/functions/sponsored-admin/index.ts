import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  cancelRefundTransaction,
  resolvePlatformPayuCredentials,
} from "../_shared/platform-payu.ts";
import {
  cleanString,
  insertCampaignAudit,
  isUuid,
  readJsonObject,
  requireSponsoredUser,
  STAFF_ROLES,
} from "../_shared/sponsored-ads.ts";

const ADMIN_SELECT =
  "id, advertiser_user_id, post_id, company_id, name, objective, status, audience, destination_url, call_to_action, currency, total_budget, daily_budget, spent_amount, impression_count, click_count, frequency_cap_per_day, starts_at, ends_at, paid_at, reviewed_at, reviewed_by, rejection_reason, cancelled_at, completed_at, created_at, updated_at";

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
  const { admin, user } = context;

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return jsonResponse({ error: "Could not verify staff access" }, 500);
  }
  const staffRole = cleanString(profile?.role, 10).toUpperCase();
  if (!STAFF_ROLES.has(staffRole)) {
    return jsonResponse({ error: "Staff access required" }, 403);
  }

  const action = cleanString(body.action || "list_pending", 40).toLowerCase();
  if (action === "list_pending" || action === "list_all") {
    const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 100);
    const offset = Math.max(Number(body.offset) || 0, 0);
    let query = admin
      .from("sponsored_campaigns")
      .select(ADMIN_SELECT)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (action === "list_pending") query = query.eq("status", "pending_review");
    const { data: campaigns, error } = await query;
    if (error) return jsonResponse({ error: "Could not load campaigns" }, 500);
    const ids = (campaigns ?? []).map((campaign) => campaign.id);
    const { data: payments, error: paymentError } = ids.length
      ? await admin
        .from("sponsored_campaign_payments")
        .select(
          "id, campaign_id, status, amount, currency, transaction_id, gateway_transaction_id, processed_at, refunded_at, created_at",
        )
        .in("campaign_id", ids)
        .order("created_at", { ascending: false })
      : { data: [], error: null };
    if (paymentError) {
      return jsonResponse({ error: "Could not load campaign payments" }, 500);
    }
    const paymentByCampaign = new Map<string, unknown[]>();
    for (const payment of payments ?? []) {
      const list = paymentByCampaign.get(payment.campaign_id) ?? [];
      list.push(payment);
      paymentByCampaign.set(payment.campaign_id, list);
    }
    return jsonResponse({
      campaigns: (campaigns ?? []).map((campaign) => ({
        ...campaign,
        payments: paymentByCampaign.get(campaign.id) ?? [],
      })),
    });
  }

  const campaignId = cleanString(body.campaign_id, 80);
  if (!isUuid(campaignId)) {
    return jsonResponse({ error: "Valid campaign_id required" }, 400);
  }
  const { data: campaign, error: campaignError } = await admin
    .from("sponsored_campaigns")
    .select(ADMIN_SELECT)
    .eq("id", campaignId)
    .maybeSingle();
  if (campaignError) {
    return jsonResponse({ error: "Could not load campaign" }, 500);
  }
  if (!campaign) return jsonResponse({ error: "Campaign not found" }, 404);
  const now = new Date().toISOString();

  if (action === "approve") {
    if (campaign.status !== "pending_review") {
      return jsonResponse({
        error: `Cannot approve a ${campaign.status} campaign`,
      }, 409);
    }
    if (new Date(campaign.ends_at).getTime() <= Date.now()) {
      return jsonResponse({ error: "Campaign delivery window has ended" }, 409);
    }
    const { data: payment } = await admin
      .from("sponsored_campaign_payments")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("status", "completed")
      .limit(1)
      .maybeSingle();
    if (!payment || !campaign.paid_at) {
      return jsonResponse(
        { error: "Campaign must have a completed payment" },
        409,
      );
    }
    const { data, error } = await admin
      .from("sponsored_campaigns")
      .update({
        status: "active",
        reviewed_at: now,
        reviewed_by: user.id,
        rejection_reason: null,
        updated_at: now,
      })
      .eq("id", campaignId)
      .eq("status", "pending_review")
      .select(ADMIN_SELECT)
      .maybeSingle();
    if (error) {
      return jsonResponse({ error: "Could not approve campaign" }, 500);
    }
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
      "approved",
      "pending_review",
      "active",
    );
    return jsonResponse({ campaign: data });
  }

  if (action === "reject") {
    const reason = cleanString(body.reason, 1000);
    if (!reason) {
      return jsonResponse({ error: "Rejection reason is required" }, 400);
    }
    if (campaign.status !== "pending_review") {
      return jsonResponse({
        error: `Cannot reject a ${campaign.status} campaign`,
      }, 409);
    }
    const { data, error } = await admin
      .from("sponsored_campaigns")
      .update({
        status: "rejected",
        rejection_reason: reason,
        reviewed_at: now,
        reviewed_by: user.id,
        updated_at: now,
      })
      .eq("id", campaignId)
      .eq("status", "pending_review")
      .select(ADMIN_SELECT)
      .maybeSingle();
    if (error) return jsonResponse({ error: "Could not reject campaign" }, 500);
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
      "rejected",
      "pending_review",
      "rejected",
      reason,
    );
    return jsonResponse({ campaign: data });
  }

  if (action === "pause") {
    if (campaign.status !== "active") {
      return jsonResponse({
        error: `Cannot pause a ${campaign.status} campaign`,
      }, 409);
    }
    const reason = cleanString(body.reason, 1000) || "Paused by staff";
    const { data, error } = await admin
      .from("sponsored_campaigns")
      .update({ status: "paused", updated_at: now })
      .eq("id", campaignId)
      .eq("status", "active")
      .select(ADMIN_SELECT)
      .maybeSingle();
    if (error) return jsonResponse({ error: "Could not pause campaign" }, 500);
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
      "staff_paused",
      "active",
      "paused",
      reason,
    );
    return jsonResponse({ campaign: data });
  }

  if (action === "refund" || action === "refund_marked") {
    if (!["refund_requested", "refunded"].includes(campaign.status)) {
      return jsonResponse({
        error: `Cannot mark refund from ${campaign.status}`,
      }, 409);
    }
    const note = cleanString(body.note, 1000) ||
      (action === "refund" ? "Refund submitted to PayU" : "Refund marked by staff");
    const reference = cleanString(body.refund_reference, 200) || null;
    const { data: payment } = await admin
      .from("sponsored_campaign_payments")
      .select("id, status, amount, gateway_transaction_id, provider_response")
      .eq("campaign_id", campaignId)
      .in("status", ["completed", "refunded"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!payment) {
      return jsonResponse({ error: "No refundable payment found" }, 409);
    }

    let refundResult: {
      requestId: string | null;
      message: string;
      raw: unknown;
    } | null = null;
    if (action === "refund" && payment.status === "completed") {
      const refundable = Math.max(
        0,
        Math.round((Number(campaign.total_budget) - Number(campaign.spent_amount)) * 100) / 100,
      );
      const credentials = resolvePlatformPayuCredentials();
      if (!credentials || !payment.gateway_transaction_id || refundable <= 0) {
        return jsonResponse({
          error: refundable <= 0
            ? "No unspent campaign budget remains"
            : "PayU refund details are unavailable",
        }, 409);
      }
      const gatewayRefund = await cancelRefundTransaction({
        creds: credentials,
        mihpayid: payment.gateway_transaction_id,
        tokenId: `ADREF_${campaignId.replaceAll("-", "").slice(0, 12)}_${payment.id.replaceAll("-", "").slice(0, 8)}`,
        amount: refundable,
      });
      if (!gatewayRefund.ok) {
        await insertCampaignAudit(
          admin,
          campaignId,
          user.id,
          "refund_failed",
          campaign.status,
          campaign.status,
          gatewayRefund.message,
          { response: gatewayRefund.raw },
        );
        return jsonResponse({ error: gatewayRefund.message || "PayU refund failed" }, 502);
      }
      refundResult = {
        requestId: gatewayRefund.requestId,
        message: gatewayRefund.message,
        raw: gatewayRefund.raw,
      };
    }

    const prior = payment.provider_response &&
        typeof payment.provider_response === "object" &&
        !Array.isArray(payment.provider_response)
      ? payment.provider_response
      : {};
    if (payment.status === "completed") {
      const { error: paymentUpdateError } = await admin
        .from("sponsored_campaign_payments")
        .update({
          status: "refunded",
          refunded_at: now,
          updated_at: now,
          provider_response: {
            ...prior,
            refund: {
              marked_at: now,
              marked_by: user.id,
              reference,
              note,
              payu_api_called: action === "refund",
              payu_refund_request_id: refundResult?.requestId ?? null,
              payu_response: refundResult?.raw ?? null,
            },
          },
        })
        .eq("id", payment.id)
        .eq("status", "completed");
      if (paymentUpdateError) {
        return jsonResponse({ error: "Could not mark payment refunded" }, 500);
      }
    }

    let updatedCampaign = campaign;
    if (campaign.status === "refund_requested") {
      const { data, error } = await admin
        .from("sponsored_campaigns")
        .update({ status: "refunded", updated_at: now })
        .eq("id", campaignId)
        .eq("status", "refund_requested")
        .select(ADMIN_SELECT)
        .maybeSingle();
      if (error) {
        return jsonResponse({ error: "Could not mark campaign refunded" }, 500);
      }
      if (!data) {
        return jsonResponse(
          { error: "Campaign changed; retry the request" },
          409,
        );
      }
      updatedCampaign = data;
      await insertCampaignAudit(
        admin,
        campaignId,
        user.id,
        "refund_marked",
        "refund_requested",
        "refunded",
        note,
        {
          payment_id: payment.id,
          refund_reference: reference,
          payu_api_called: action === "refund",
          payu_refund_request_id: refundResult?.requestId ?? null,
        },
      );
    }

    return jsonResponse({
      campaign: updatedCampaign,
      refund_api_called: action === "refund",
      refund_request_id: refundResult?.requestId ?? reference,
    });
  }

  return jsonResponse({ error: "Unsupported action" }, 400);
});
