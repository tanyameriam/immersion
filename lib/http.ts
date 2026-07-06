import { NextResponse } from "next/server";

/**
 * CORS headers so the Chrome extension (origin `chrome-extension://<id>`) can
 * call our API. We reflect the request Origin because extension IDs vary
 * between dev (unpacked) and the published build; only same-Firebase-user
 * requests succeed anyway since every call is Bearer-token authenticated.
 */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function jsonWithCors(
  req: Request,
  body: unknown,
  status = 200,
): NextResponse {
  return NextResponse.json(body, { status, headers: corsHeaders(req) });
}

export function preflight(req: Request): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}
