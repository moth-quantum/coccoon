// Server proxy for the Moth platform's blur-core-v1 engine.
//
// This is the tutorial's core: a coccoon game hands us a grid, and we run the
// quantum blur on Atlas (the Moth platform) rather than locally. The engine is
// asynchronous and a job can take a couple of minutes, so we DO NOT hold one
// request open for the whole job. Instead the browser drives two fast actions:
//
//   1. { action: "submit", values, strength, key }
//        POST /api/v1/engines/blur-core-v1/process
//        -> 202 { job_id, status: "queued" }
//      We return { jobId }.
//
//   2. { action: "poll", jobId, key }
//        GET /api/v1/jobs/{jobId}/status     -> { status, result?: { output } }
//      and return { status: "completed", output } once done. Otherwise { status }.
//
// IMPORTANT — poll /status, NOT /jobs/{id}. The platform exposes two reads of a
// job and they are NOT equivalent: GET /api/v1/jobs/{id} is an
// eventually-consistent record that can keep reporting "queued" for MINUTES
// after the job has actually finished, whereas GET /api/v1/jobs/{id}/status is
// the authoritative live status and embeds result.output inline on completion.
// Polling the former is what made jobs look like they "hang until you open the
// dashboard" (the dashboard reads live status). Verified against the live API
// on 2026-09-26: the two endpoints returned "queued" and "completed" for the
// same job at the same instant. /status also saves a round-trip since it
// carries the result; we fall back to GET /api/v1/jobs/{id}/result only if the
// inline output is ever absent.
//
// The key comes from the request (entered in the coccoon menu / game UI, like
// the original's coccoon.get_api_key()) or falls back to MOTH_API_KEY. It is
// used only as a Bearer token to the platform and is never persisted.
//
// Correctness notes for a polling proxy:
//   * Job status is live state, so EVERY upstream call is `cache: "no-store"`
//     and the route is pinned dynamic. A cached status snapshot would make the
//     job look stuck at "queued" forever while it actually finished upstream.
//   * Every upstream call is bounded by an AbortController timeout so a hung
//     socket returns promptly instead of eating the serverless budget.
//   * Errors are classified: 4xx (auth/validation) are terminal and reported so
//     the client stops immediately; network/timeout/5xx are marked retryable so
//     the client backs off and tries again.

const API_BASE = "https://api.mothquantum.com"

// Never cache anything in a polling proxy: each request must reflect live job
// state on the platform.
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

// Each call here is a single fast round-trip to the platform, so the default
// serverless budget is plenty; the long wait lives in the browser's poll loop.
export const maxDuration = 30

// Upstream calls must never hang a poll for the whole serverless budget.
const UPSTREAM_TIMEOUT_MS = 12_000

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  })
}

// A single uncached, time-bounded round-trip to the platform. Returns the
// parsed JSON body (or null) alongside the response so callers can classify the
// outcome. A timeout or network failure surfaces as { res: null }.
async function upstream(
  url: string,
  init: RequestInit,
): Promise<{ res: Response | null; body: Record<string, unknown> | null }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...init, cache: "no-store", signal: controller.signal })
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
    return { res, body }
  } catch {
    return { res: null, body: null }
  } finally {
    clearTimeout(timer)
  }
}

type Payload = {
  action?: "submit" | "poll"
  values?: number[][]
  strength?: number
  jobId?: string
  key?: string
}

export async function POST(req: Request) {
  let payload: Payload
  try {
    payload = (await req.json()) as Payload
  } catch {
    return json({ error: "invalid_json" }, 400)
  }

  const key = payload.key && payload.key.length > 0 ? payload.key : process.env.MOTH_API_KEY
  if (!key) return json({ error: "missing_key" }, 401)

  const auth = { Authorization: `Bearer ${key}` }

  if (payload.action === "submit") {
    const values = payload.values
    if (!Array.isArray(values) || values.length === 0) {
      return json({ error: "missing_values" }, 400)
    }
    const strength = typeof payload.strength === "number" ? payload.strength : 0.25

    const { res, body } = await upstream(`${API_BASE}/api/v1/engines/blur-core-v1/process`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ params: { values, strength } }),
    })
    // No response at all = timeout/network: retryable.
    if (!res) return json({ error: "submit_unreachable", retryable: true }, 504)
    // Auth/validation rejections are terminal — don't let the client spin.
    if (res.status === 401 || res.status === 403) return json({ error: "unauthorized", retryable: false }, 401)
    const jobId = body?.job_id
    if (!res.ok || typeof jobId !== "string") {
      return json({ error: "submit_failed", status: res.status, retryable: res.status >= 500 }, 502)
    }
    return json({ jobId, status: typeof body?.status === "string" ? body.status : "queued" })
  }

  if (payload.action === "poll") {
    const jobId = payload.jobId
    if (!jobId) return json({ error: "missing_job" }, 400)

    // Poll the authoritative live status, not the lagging /jobs/{id} record.
    const { res, body } = await upstream(`${API_BASE}/api/v1/jobs/${jobId}/status`, { headers: auth })
    if (!res) return json({ error: "poll_unreachable", retryable: true }, 504)
    if (res.status === 401 || res.status === 403) return json({ error: "unauthorized", retryable: false }, 401)
    const status = typeof body?.status === "string" ? body.status : null
    if (!res.ok || !status) {
      return json({ error: "poll_failed", status: res.status, retryable: true }, 502)
    }

    if (status === "completed") {
      // /status embeds the result inline; use it and avoid the extra round-trip.
      const inline = (body?.result as { output?: number[][] } | undefined)?.output
      if (Array.isArray(inline)) return json({ status, output: inline })

      // Fallback: fetch the dedicated result endpoint only if output is absent.
      const { res: rres, body: rbody } = await upstream(`${API_BASE}/api/v1/jobs/${jobId}/result`, { headers: auth })
      if (!rres) return json({ error: "result_unreachable", retryable: true }, 504)
      const result = rbody?.result as { output?: number[][] } | undefined
      const output = result?.output ?? null
      if (!rres.ok || !Array.isArray(output)) {
        return json({ error: "result_failed", status: rres.status, retryable: rres.status >= 500 }, 502)
      }
      return json({ status, output })
    }

    if (status === "failed" || status === "error" || status === "cancelled") {
      return json({ status, error: body?.error ?? "job_failed" })
    }

    // queued / running / anything else still in flight
    return json({ status })
  }

  return json({ error: "unknown_action" }, 400)
}
