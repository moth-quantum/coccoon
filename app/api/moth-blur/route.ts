// Moth platform proxy — calls the blur-core-v1 engine on Atlas.
//
// This is the server-side half of Quantum Caverns' "── API" tutorial. The
// browser cannot call api.mothquantum.com directly (CORS + it must not see
// other users' keys), so this route forwards a single blur job and streams
// back the result. The async job model is preserved exactly as documented in
// the original GDScript:
//
//   1. POST /api/v1/engines/blur-core-v1/process  -> 202 Accepted + { job_id }
//   2. GET  /api/v1/jobs/{job_id}                 -> poll until completed
//   3. result inline, or download outputs[0].url  -> the blurred grid
//
// The Bearer token is either supplied per-request by the caller (entered in
// the menu or game UI, mirroring coccoon's engine-level API key) or read from
// the MOTH_API_KEY environment variable. Quantum Caverns has no local
// fallback: when no key is present this route returns 401 and the game asks
// the player for one; when the platform errors it returns 5xx and the game
// offers a retry.

const API_BASE = "https://api.mothquantum.com"
const POLL_INTERVAL_MS = 500
const MAX_POLLS = 60

// Quantum jobs can queue; give the function room to poll.
export const maxDuration = 60

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(request: Request) {
  let payload: { values?: unknown; strength?: number; key?: string }
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 })
  }

  const key = (payload.key && payload.key.length > 0 ? payload.key : process.env.MOTH_API_KEY) ?? ""
  if (!key) {
    // No credential available — the game shows its "add a key" prompt.
    return Response.json({ error: "no API key" }, { status: 401 })
  }

  if (!Array.isArray(payload.values)) {
    return Response.json({ error: "values must be a 2D array" }, { status: 400 })
  }

  const authHeaders = { Authorization: `Bearer ${key}` }

  try {
    // 1. Submit the job.
    const submit = await fetch(`${API_BASE}/api/v1/engines/blur-core-v1/process`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        params: {
          values: payload.values,
          strength: typeof payload.strength === "number" ? payload.strength : 0.25,
        },
      }),
    })

    if (submit.status !== 202) {
      return Response.json(
        { error: `submit failed (${submit.status})` },
        { status: 502 },
      )
    }

    const submitBody = (await submit.json()) as { job_id?: string }
    if (!submitBody.job_id) {
      return Response.json({ error: "no job_id in response" }, { status: 502 })
    }

    // 2. Poll until the job resolves.
    for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
      await sleep(POLL_INTERVAL_MS)
      const poll = await fetch(`${API_BASE}/api/v1/jobs/${submitBody.job_id}`, {
        headers: authHeaders,
      })
      if (!poll.ok) {
        return Response.json({ error: `poll failed (${poll.status})` }, { status: 502 })
      }
      const job = (await poll.json()) as {
        status?: string
        result?: unknown
        outputs?: Array<{ url?: string }>
      }
      const status = String(job.status ?? "")

      if (["completed", "succeeded", "done"].includes(status)) {
        if (job.result != null) {
          return Response.json({ result: job.result })
        }
        // 3. Result delivered as a presigned download URL (no auth header).
        const url = job.outputs?.[0]?.url
        if (url) {
          const dl = await fetch(url)
          if (!dl.ok) return Response.json({ error: "download failed" }, { status: 502 })
          return Response.json({ result: await dl.json() })
        }
        return Response.json({ error: "completed with no result" }, { status: 502 })
      }

      if (["failed", "error", "cancelled"].includes(status)) {
        return Response.json({ error: `job ${status}` }, { status: 502 })
      }
    }

    return Response.json({ error: "job timed out" }, { status: 504 })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "unknown error reaching Moth platform" },
      { status: 502 },
    )
  }
}
