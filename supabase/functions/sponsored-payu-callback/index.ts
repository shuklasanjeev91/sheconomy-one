import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { resolvePublicAppOrigin } from "../_shared/app-url.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { parsePayuFormBody } from "../_shared/platform-payu.ts";
import {
  applySponsoredPayuResult,
  cleanString,
  getServerClients,
} from "../_shared/sponsored-ads.ts";

function redirect(status: "success" | "failure", txnid: string): Response {
  const path = status === "success"
    ? "/community/ads/payment-success"
    : "/community/ads/payment-failure";
  const destination = new URL(path, resolvePublicAppOrigin());
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
  const server = getServerClients();
  if (!server) return redirect("failure", "");

  let form: Record<string, string>;
  try {
    form = await parsePayuFormBody(request);
  } catch {
    return redirect("failure", "");
  }
  const txnid = cleanString(form.txnid, 160);
  const result = await applySponsoredPayuResult(server.admin, form, "callback");
  return redirect(
    result.ok && result.paymentStatus === "completed" ? "success" : "failure",
    txnid,
  );
});
