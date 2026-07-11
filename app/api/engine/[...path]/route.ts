// A transparent proxy to the engine. The browser talks only to the web origin (/api/engine/*), which
// forwards to the engine over the server-side network. This keeps everything same-origin — no CORS —
// and, crucially, streams the response body straight through, so Server-Sent Events (provisioning
// progress) are delivered incrementally rather than buffered by an intermediary.

const ENGINE_URL = process.env.ENGINE_URL ?? "http://localhost:4000";

// Streaming responses (SSE) must not be statically optimized or buffered.
export const dynamic = "force-dynamic";

async function proxy(request: Request, path: string[]): Promise<Response> {
  const target = new URL(request.url);
  const suffix = path.map(encodeURIComponent).join("/");
  const url = `${ENGINE_URL}/${suffix}${target.search}`;

  // Forward the method, body, and the headers that matter; strip hop-by-hop and host headers so the
  // upstream sees a clean request.
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");

  const init: RequestInit = {
    method: request.method,
    headers,
    // Only methods with a body carry one; GET/HEAD must not.
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    // Required by the fetch spec when streaming a request body.
    // @ts-expect-error duplex is valid at runtime but missing from the lib types.
    duplex: "half",
    redirect: "manual",
  };

  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch {
    return new Response(JSON.stringify({ error: "engine unreachable" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  // Pass the upstream body straight through. For SSE this preserves incremental delivery; the
  // content-type (text/event-stream) is carried by copying the upstream headers.
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, ctx: Ctx): Promise<Response> {
  return proxy(request, (await ctx.params).path);
}
export async function POST(request: Request, ctx: Ctx): Promise<Response> {
  return proxy(request, (await ctx.params).path);
}
export async function DELETE(request: Request, ctx: Ctx): Promise<Response> {
  return proxy(request, (await ctx.params).path);
}
