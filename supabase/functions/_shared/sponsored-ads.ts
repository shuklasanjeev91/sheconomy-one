import {
  createClient,
  type SupabaseClient,
  type User,
} from "jsr:@supabase/supabase-js@2";

import { jsonResponse } from "./cors.ts";
import {
  collectPlatformPayuCredentialCandidates,
  mapPayuStatusToPaymentStatus,
  matchPlatformPayuCredentials,
} from "./platform-payu.ts";

export const CAMPAIGN_OBJECTIVES = new Set([
  "awareness",
  "engagement",
  "traffic",
]);
export const CAMPAIGN_CTAS = new Set([
  "learn_more",
  "shop_now",
  "sign_up",
  "contact_us",
  "visit_profile",
  "none",
]);
export const AUDIENCE_KEYS = new Set([
  "country_codes",
  "locations",
  "industries",
  "interests",
]);
export const STAFF_ROLES = new Set(["A"]);

export type SponsoredContext = {
  admin: SupabaseClient;
  user: User;
};

export type CampaignRow = {
  id: string;
  advertiser_user_id: string;
  post_id: string;
  company_id: string | null;
  status: string;
  total_budget: number | string;
  daily_budget: number | string;
  spent_amount: number | string;
  frequency_cap_per_day: number;
  starts_at: string;
  ends_at: string;
  paid_at: string | null;
  [key: string]: unknown;
};

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(
        value,
      )
  );
}

export function cleanString(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function getServerClients(): {
  supabaseUrl: string;
  anonKey: string;
  serviceRole: string;
  admin: SupabaseClient;
} | null {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim() ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
  if (!supabaseUrl || !anonKey || !serviceRole) return null;
  return {
    supabaseUrl,
    anonKey,
    serviceRole,
    admin: createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

export async function requireSponsoredUser(
  request: Request,
): Promise<SponsoredContext | Response> {
  const server = getServerClients();
  if (!server) return jsonResponse({ error: "Server is not configured" }, 503);
  const authorization = request.headers.get("Authorization");
  if (!authorization) return jsonResponse({ error: "Unauthorized" }, 401);

  const client = createClient(server.supabaseUrl, server.anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) return jsonResponse({ error: "Unauthorized" }, 401);
  return { admin: server.admin, user };
}

export async function optionalSponsoredUser(
  request: Request,
): Promise<{ admin: SupabaseClient; user: User | null } | Response> {
  const server = getServerClients();
  if (!server) return jsonResponse({ error: "Server is not configured" }, 503);
  const authorization = request.headers.get("Authorization");
  if (!authorization) return { admin: server.admin, user: null };

  const client = createClient(server.supabaseUrl, server.anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
  } = await client.auth.getUser();
  return { admin: server.admin, user: user ?? null };
}

export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown> | Response> {
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return jsonResponse({ error: "JSON object required" }, 400);
    }
    return value as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }
}

export function validateAudience(
  value: unknown,
): { value: Record<string, string[]> } | { error: string } {
  if (value == null) return { value: {} };
  if (typeof value !== "object" || Array.isArray(value)) {
    return { error: "audience must be an object" };
  }
  const source = value as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    if (!AUDIENCE_KEYS.has(key)) {
      return { error: `Unsupported audience field: ${key}` };
    }
  }

  const normalized: Record<string, string[]> = {};
  for (const key of AUDIENCE_KEYS) {
    const raw = source[key];
    if (raw == null) continue;
    if (!Array.isArray(raw) || raw.length > 50) {
      return {
        error: `audience.${key} must be an array of at most 50 strings`,
      };
    }
    const values = [
      ...new Set(
        raw
          .map((item) => cleanString(item, 100))
          .filter(Boolean)
          .map((item) => (key === "country_codes" ? item.toUpperCase() : item)),
      ),
    ];
    if (values.length !== raw.length) {
      return {
        error: `audience.${key} contains empty, duplicate, or invalid values`,
      };
    }
    if (
      key === "country_codes" && values.some((item) => !/^[A-Z]{2}$/.test(item))
    ) {
      return {
        error: "audience.country_codes must contain ISO two-letter codes",
      };
    }
    normalized[key] = values;
  }
  return { value: normalized };
}

export function validateHttpsUrl(
  value: unknown,
): { value: string | null } | { error: string } {
  if (value == null || value === "") return { value: null };
  const raw = cleanString(value, 2048);
  try {
    const url = new URL(raw);
    if (
      url.protocol !== "https:" || !url.hostname || url.username || url.password
    ) {
      return { error: "destination_url must be an HTTPS URL" };
    }
    return { value: url.toString() };
  } catch {
    return { error: "destination_url must be an HTTPS URL" };
  }
}

export async function validateOwnedPublicPost(
  admin: SupabaseClient,
  userId: string,
  postId: string,
): Promise<{ companyId: string | null } | { error: string; status: number }> {
  const { data: post, error } = await admin
    .from("posts")
    .select("id, user_id, company_id, visibility, is_deleted")
    .eq("id", postId)
    .maybeSingle();
  if (error) return { error: "Could not validate post", status: 500 };
  if (
    !post || post.is_deleted === true ||
    String(post.visibility ?? "").toLowerCase() !== "public"
  ) {
    return { error: "Post must exist and be public", status: 400 };
  }
  if (!post.company_id) {
    return post.user_id === userId
      ? { companyId: null }
      : { error: "You do not own this post", status: 403 };
  }
  const { data: membership } = await admin
    .from("company_members")
    .select("id")
    .eq("company_id", post.company_id)
    .eq("user_id", userId)
    .in("role", ["owner", "admin"])
    .maybeSingle();
  if (!membership) {
    return { error: "You do not manage this company post", status: 403 };
  }
  return { companyId: post.company_id };
}

export async function insertCampaignAudit(
  admin: SupabaseClient,
  campaignId: string,
  actorId: string | null,
  action: string,
  fromStatus: string | null,
  toStatus: string | null,
  note?: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await admin.from("sponsored_campaign_audit_log").insert({
    campaign_id: campaignId,
    actor_id: actorId,
    action,
    from_status: fromStatus,
    to_status: toStatus,
    note: note?.slice(0, 1000) || null,
    metadata,
  });
}

function sanitizedProviderResponse(
  form: Record<string, string>,
): Record<string, string> {
  const safe = { ...form };
  delete safe.hash;
  return safe;
}

export async function applySponsoredPayuResult(
  admin: SupabaseClient,
  form: Record<string, string>,
  source: "callback" | "webhook",
): Promise<
  | { ok: true; txnid: string; paymentStatus: string }
  | { ok: false; status: number; error: string; txnid: string }
> {
  const txnid = cleanString(form.txnid, 160);
  if (!txnid || !txnid.startsWith("AD_")) {
    return { ok: false, status: 400, error: "Invalid transaction", txnid };
  }
  const matched = await matchPlatformPayuCredentials(
    form,
    collectPlatformPayuCredentialCandidates(),
  );
  if (!matched || cleanString(form.key, 200) !== matched.key) {
    return { ok: false, status: 401, error: "Invalid PayU hash", txnid };
  }
  if (form.udf4 !== "sponsored_ads") {
    return { ok: false, status: 400, error: "Invalid payment marker", txnid };
  }

  const paymentId = cleanString(form.udf2, 80);
  const campaignId = cleanString(form.udf3, 80);
  const viewerId = cleanString(form.udf1, 80);
  if (!isUuid(paymentId) || !isUuid(campaignId) || !isUuid(viewerId)) {
    return {
      ok: false,
      status: 400,
      error: "Invalid payment references",
      txnid,
    };
  }

  const { data: payment, error: paymentError } = await admin
    .from("sponsored_campaign_payments")
    .select(
      "id, campaign_id, advertiser_user_id, amount, currency, status, transaction_id",
    )
    .eq("id", paymentId)
    .eq("transaction_id", txnid)
    .maybeSingle();
  if (paymentError || !payment) {
    return { ok: false, status: 404, error: "Payment not found", txnid };
  }
  const amount = Number(form.amount);
  if (
    payment.campaign_id !== campaignId ||
    payment.advertiser_user_id !== viewerId ||
    payment.currency !== "INR" ||
    !Number.isFinite(amount) ||
    Math.abs(Number(payment.amount) - amount) > 0.01
  ) {
    return {
      ok: false,
      status: 400,
      error: "Payment details do not match",
      txnid,
    };
  }

  const gatewayStatus = mapPayuStatusToPaymentStatus(
    cleanString(form.status, 40),
  );
  const now = new Date().toISOString();
  const gatewayId =
    cleanString(form.mihpayid ?? form.payuId ?? form.payu_id, 200) || null;
  const reason =
    cleanString(form.error_Message ?? form.error_message ?? form.field9, 500) ||
    null;
  const updates: Record<string, unknown> = {
    status: gatewayStatus,
    gateway_transaction_id: gatewayId,
    provider_response: {
      source,
      received_at: now,
      response: sanitizedProviderResponse(form),
    },
    updated_at: now,
  };
  if (gatewayStatus === "completed") {
    updates.processed_at = now;
    updates.failure_code = null;
    updates.failure_reason = null;
  } else if (gatewayStatus === "failed" || gatewayStatus === "cancelled") {
    updates.failure_code = cleanString(form.error ?? form.status, 100) ||
      gatewayStatus;
    updates.failure_reason = reason || `Payment ${gatewayStatus}`;
  }

  // Never let a delayed failure downgrade an already completed payment.
  if (payment.status !== "completed") {
    const { error } = await admin
      .from("sponsored_campaign_payments")
      .update(updates)
      .eq("id", payment.id)
      .neq("status", "completed");
    if (error) {
      return {
        ok: false,
        status: 500,
        error: "Could not update payment",
        txnid,
      };
    }
  }

  if (gatewayStatus === "completed") {
    const { data: campaignBefore } = await admin
      .from("sponsored_campaigns")
      .select("status")
      .eq("id", campaignId)
      .eq("advertiser_user_id", viewerId)
      .maybeSingle();
    const fromStatus = cleanString(campaignBefore?.status, 40);
    if (!["draft", "pending_payment"].includes(fromStatus)) {
      return { ok: true, txnid, paymentStatus: gatewayStatus };
    }
    const { data: transitioned, error } = await admin
      .from("sponsored_campaigns")
      .update({ status: "pending_review", paid_at: now, updated_at: now })
      .eq("id", campaignId)
      .eq("advertiser_user_id", viewerId)
      .eq("status", fromStatus)
      .select("id")
      .maybeSingle();
    if (error) {
      return {
        ok: false,
        status: 500,
        error: "Could not update campaign",
        txnid,
      };
    }
    if (transitioned) {
      await insertCampaignAudit(
        admin,
        campaignId,
        viewerId,
        "payment_completed",
        fromStatus,
        "pending_review",
        null,
        { payment_id: payment.id, transaction_id: txnid, source },
      );
    }
  }

  return { ok: true, txnid, paymentStatus: gatewayStatus };
}

export function normalizeTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanString(item, 100).toLowerCase()).filter(
    Boolean,
  );
}

export function audienceScore(
  audience: Record<string, unknown>,
  profile: {
    country_code?: string | null;
    location?: string | null;
    industry?: string | null;
    interests?: string[] | null;
  },
): number | null {
  const dimensions: Array<[string, string[], "exact" | "contains"]> = [
    [
      "country_codes",
      profile.country_code ? [profile.country_code.toLowerCase()] : [],
      "exact",
    ],
    ["locations", profile.location ? [profile.location.toLowerCase()] : [], "contains"],
    ["industries", profile.industry ? [profile.industry.toLowerCase()] : [], "exact"],
    ["interests", normalizeTextArray(profile.interests), "exact"],
  ];
  let score = 0;
  let targeted = 0;
  for (const [key, viewerValues, mode] of dimensions) {
    const wanted = normalizeTextArray(audience[key]);
    if (!wanted.length) continue;
    targeted += 1;
    if (
      !viewerValues.some((viewer) =>
        wanted.some((item) =>
          mode === "contains"
            ? viewer.includes(item) || item.includes(viewer)
            : viewer === item
        )
      )
    ) return null;
    score += key === "interests" ? 2 : 1;
  }
  return targeted ? score : 0;
}
