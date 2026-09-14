import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { parsePayuFormBody } from "../_shared/platform-payu.ts";
import {
  applySponsoredPayuResult,
  getServerClients,
} from "../_shared/sponsored-ads.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  const server = getServerClients();
  if (!server) return jsonResponse({ error: "Server is not configured" }, 503);

  let form: Record<string, string>;
  try {
    form = await parsePayuFormBody(request);
  } catch {
    return jsonResponse({ error: "Invalid PayU payload" }, 400);
  }
  const result = await applySponsoredPayuResult(server.admin, form, "webhook");
  if (!result.ok) {
    return jsonResponse({ ok: false, error: result.error }, result.status);
  }
  return jsonResponse({
    ok: true,
    txnid: result.txnid,
    status: result.paymentStatus,
  });
});
