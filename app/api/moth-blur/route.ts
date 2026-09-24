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
//        GET /api/v1/jobs/{jobId}            -> { status: "queued"|"running"|"completed"|"failed" }
//      When status is "completed" we fetch the result from a SEPARATE endpoint:
//        GET /api/v1/jobs/{jobId}/result     -> { result: { output: number[][] } }
//      and return { status: "completed", output }. Otherwise { status }.
//
// The key comes from the request (entered in the coccoon menu / game UI, like
// the original's coccoon.get_api_key()) or falls back to MOTH_API_KEY. It is
// used only as a Bearer token to the platform and is never persisted.

const API_BASE = "https://api.mothquantum.com"

// Each call here is a single fast round-trip to the platform, so the default
// serverless budget is plenty; the long wait lives in the browser's poll loop.
export const maxDuration = 30

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
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

  try {
    if (payload.action === "submit") {
      const values = payload.values
      if (!Array.isArray(values) || values.length === 0) {
        return json({ error: "missing_values" }, 400)
      }
      const strength = typeof payload.strength === "number" ? payload.strength : 0.25

      const res = await fetch(`${API_BASE}/api/v1/engines/blur-core-v1/process`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ params: { values, strength } }),
      })
      const body = (await res.json().catch(() => null)) as { job_id?: string; status?: string } | null
      if (!res.ok || !body?.job_id) {
        return json({ error: "submit_failed", status: res.status, body }, 502)
      }
      return json({ jobId: body.job_id, status: body.status ?? "queued" })
    }

    if (payload.action === "poll") {
      const jobId = payload.jobId
      if (!jobId) return json({ error: "missing_job" }, 400)

      const res = await fetch(`${API_BASE}/api/v1/jobs/${jobId}`, { headers: auth })
      const body = (await res.json().catch(() => null)) as { status?: string; error?: unknown } | null
      if (!res.ok || !body?.status) {
        return json({ error: "poll_failed", status: res.status }, 502)
      }

      const status = body.status
      if (status === "completed") {
        const rres = await fetch(`${API_BASE}/api/v1/jobs/${jobId}/result`, { headers: auth })
        const rbody = (await rres.json().catch(() => null)) as { result?: { output?: number[][] } } | null
        const output = rbody?.result?.output ?? null
        if (!rres.ok || !Array.isArray(output)) {
          return json({ error: "result_failed", status: rres.status }, 502)
        }
        return json({ status, output })
      }

      if (status === "failed" || status === "error" || status === "cancelled") {
        return json({ status, error: body.error ?? "job_failed" })
      }

      // queued / running / anything else still in flight
      return json({ status })
    }

    return json({ error: "unknown_action" }, 400)
  } catch (err) {
    return json({ error: "proxy_exception", message: String(err) }, 502)
  }
}
