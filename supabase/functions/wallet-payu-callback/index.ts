/**
 * POST /functions/v1/wallet-payu-callback
 * Browser return from PayU — settle top-up then redirect to app wallet.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { resolvePublicAppOrigin } from "../_shared/app-url.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  mapPayuStatusToPaymentStatus,
  matchPlatformPayuCredentials,
  parsePayuFormBody,
} from "../_shared/platform-payu.ts";

function redirect(
  status: "success" | "failure",
  txnid: string,
  ownerType: string,
): Response {
  const path = ownerType === "shop" ? "/vendor/wallet" : "/wallet";
  const destination = new URL(path, resolvePublicAppOrigin());
  destination.searchParams.set("topup", status);
  if (txnid) destination.searchParams.set("txn", txnid);
  return new Response(null, {
    status: 303,
    headers: {
      ...corsHeaders,
      Location: destination.toString(),
      "Cache-Control": "no-store",
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
  if (!supabaseUrl || !serviceRole) return redirect("failure", "", "user");

  let form: Record<string, string>;
  try {
    form = await parsePayuFormBody(request);
  } catch {
    return redirect("failure", "", "user");
  }

  const txnid = String(form.txnid ?? "").trim();
  const ownerType = String(form.udf5 ?? "user").trim().toLowerCase() === "shop"
    ? "shop"
    : "user";

  const matched = await matchPlatformPayuCredentials(form);
  if (!matched || form.udf4 !== "platform_wallet") {
    return redirect("failure", txnid, ownerType);
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
    await admin.rpc("platform_wallet_complete_topup", {
      p_txnid: txnid,
      p_gateway_transaction_id: gatewayId,
      p_provider_response: {
        source: "callback",
        status: form.status,
        amount: form.amount,
      },
    });
    return redirect("success", txnid, ownerType);
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

  return redirect("failure", txnid, ownerType);
});
