/**
 * POST /functions/v1/wallet-payu-topup
 * Authenticated: initiate PayU top-up for a user or shop platform wallet.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  buildPlatformPayuPaymentFields,
  formatPlatformPayuAmount,
  resolvePlatformPayuCredentials,
} from "../_shared/platform-payu.ts";

const MIN_TOPUP = 100;

function walletTxnId(ownerType: string, ownerId: string): string {
  const owner = ownerId.replaceAll("-", "").slice(0, 8).toUpperCase();
  const time = Date.now().toString(36).toUpperCase();
  const random = crypto.randomUUID().replaceAll("-", "").slice(0, 4)
    .toUpperCase();
  return `WLT_${ownerType.slice(0, 1).toUpperCase()}${owner}_${time}_${random}`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim() ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
  if (!supabaseUrl || !anonKey || !serviceRole) {
    return jsonResponse({ error: "Not configured" }, 503);
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const body = await request.json().catch(() => ({})) as Record<
    string,
    unknown
  >;
  if (String(body.client_platform ?? "").toLowerCase() !== "web") {
    return jsonResponse({
      error: "Wallet top-up is available on web only",
    }, 403);
  }

  const ownerType = String(body.owner_type ?? "").trim().toLowerCase();
  const ownerId = String(body.owner_id ?? "").trim();
  const amount = Math.round(Number(body.amount) * 100) / 100;
  if (ownerType !== "user" && ownerType !== "shop") {
    return jsonResponse({ error: "owner_type must be user or shop" }, 400);
  }
  if (!ownerId) return jsonResponse({ error: "owner_id required" }, 400);
  if (!(amount >= MIN_TOPUP)) {
    return jsonResponse({
      error: `Minimum top-up is INR ${MIN_TOPUP}`,
    }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (ownerType === "user") {
    if (ownerId !== userData.user.id) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
  } else {
    const { data: shop } = await admin
      .from("shops")
      .select("id, user_id")
      .eq("id", ownerId)
      .maybeSingle();
    if (!shop || shop.user_id !== userData.user.id) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
  }

  const creds = resolvePlatformPayuCredentials();
  if (!creds) {
    return jsonResponse({ error: "Platform PayU is not configured" }, 503);
  }

  const { data: walletRow, error: walletError } = await admin.rpc(
    "platform_wallet_get_or_create",
    {
      p_owner_type: ownerType,
      p_owner_id: ownerId,
      p_currency: "INR",
    },
  );
  if (walletError || !walletRow?.id) {
    return jsonResponse({ error: "Could not open wallet" }, 500);
  }

  const txnid = walletTxnId(ownerType, ownerId);
  const formattedAmount = formatPlatformPayuAmount(amount);
  const now = new Date().toISOString();

  const { data: topup, error: topupError } = await admin
    .from("platform_wallet_topups")
    .insert({
      wallet_id: walletRow.id,
      owner_type: ownerType,
      owner_id: ownerId,
      initiated_by: userData.user.id,
      amount,
      currency: "INR",
      status: "pending",
      provider: "payu",
      txnid,
      metadata: { initiated_at: now },
    })
    .select("id")
    .single();
  if (topupError || !topup) {
    return jsonResponse({ error: "Could not create top-up" }, 500);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, username, email, phone")
    .eq("id", userData.user.id)
    .maybeSingle();
  const firstname =
    String(profile?.full_name || profile?.username || "Member")
      .split(/\s+/)[0] || "Member";
  const email = String(
    profile?.email || userData.user.email || "member@sheconomy.in",
  );
  const phone =
    String(profile?.phone || userData.user.phone || "")
      .replace(/\D/g, "")
      .slice(-15) || "9999999999";

  const fields = await buildPlatformPayuPaymentFields({
    creds,
    txnid,
    amount: formattedAmount,
    productinfo: `Wallet top-up ${ownerType}`,
    firstname,
    email,
    phone,
    udf1: userData.user.id,
    udf2: topup.id,
    udf3: ownerId,
    udf4: "platform_wallet",
    udf5: ownerType,
    supabaseUrl,
  });

  const callback =
    `${supabaseUrl.replace(/\/$/, "")}/functions/v1/wallet-payu-callback`;
  fields.surl = `${callback}?status=success`;
  fields.furl = `${callback}?status=failure`;

  const payuUrl = `${creds.baseUrl.replace(/\/$/, "")}/_payment`;
  await admin
    .from("platform_wallet_topups")
    .update({
      checkout_url: payuUrl,
      status: "processing",
      updated_at: now,
    })
    .eq("id", topup.id);

  return jsonResponse({
    ok: true,
    topupId: topup.id,
    txnid,
    payuUrl,
    params: fields,
  });
});
