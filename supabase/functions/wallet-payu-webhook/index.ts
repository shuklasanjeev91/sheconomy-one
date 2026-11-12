/**
 * POST /functions/v1/wallet-payu-webhook
 * PayU server callback — credits platform wallet on success.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  mapPayuStatusToPaymentStatus,
  matchPlatformPayuCredentials,
  parsePayuFormBody,
} from "../_shared/platform-payu.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
  if (!supabaseUrl || !serviceRole) {
    return jsonResponse({ error: "Not configured" }, 503);
  }

  let form: Record<string, string>;
  try {
    form = await parsePayuFormBody(request);
  } catch {
    return jsonResponse({ error: "Invalid PayU payload" }, 400);
  }

  const txnid = String(form.txnid ?? "").trim();
  if (!txnid.startsWith("WLT_")) {
    return jsonResponse({ ok: false, error: "Invalid transaction" }, 400);
  }
  if (form.udf4 !== "platform_wallet") {
    return jsonResponse({ ok: false, error: "Invalid payment marker" }, 400);
  }

  const matched = await matchPlatformPayuCredentials(form);
  if (!matched || String(form.key ?? "").trim() !== matched.key) {
    return jsonResponse({ ok: false, error: "Invalid PayU hash" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const gatewayStatus = mapPayuStatusToPaymentStatus(
    String(form.status ?? ""),
  );
  const gatewayId = String(
    form.mihpayid ?? form.payuId ?? form.payu_id ?? "",
  ).trim() || null;

  if (gatewayStatus === "completed") {
    const { data, error } = await admin.rpc("platform_wallet_complete_topup", {
      p_txnid: txnid,
      p_gateway_transaction_id: gatewayId,
      p_provider_response: {
        source: "webhook",
        status: form.status,
        amount: form.amount,
      },
    });
    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 500);
    }
    return jsonResponse({ ok: true, txnid, status: "completed", result: data });
  }

  await admin
    .from("platform_wallet_topups")
    .update({
      status: gatewayStatus === "cancelled" ? "cancelled" : "failed",
      gateway_transaction_id: gatewayId,
      failure_reason: String(
        form.error_Message ?? form.error_message ?? form.status ?? "failed",
      ).slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("txnid", txnid)
    .neq("status", "completed");

  return jsonResponse({ ok: true, txnid, status: gatewayStatus });
});
