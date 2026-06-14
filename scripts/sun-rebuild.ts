/**
 * Local-dev convenience: hit the cron route with the right Authorization
 * header so you can rebuild patio_sun_series without waiting for Vercel cron.
 *
 * Requires CRON_SECRET in .env.local and the dev server running on port 3000.
 *   $ npm run sun:rebuild
 *
 * Default hits incremental mode (drops yesterday, appends the new 7th day). To
 * force a full wipe-and-rebuild of all 7 days, point at the ?mode=full URL:
 *   $ SUN_BATCH_URL='http://localhost:3000/api/cron/sun-batch?mode=full' npm run sun:rebuild
 *
 * NOTE: the route now starts a Vercel Workflow and returns immediately with a
 * `{ runId }` rather than waiting for the rebuild to finish. Track progress in
 * the Vercel dashboard (Observability → Workflows) or the local dev logs.
 */

const SECRET = process.env.CRON_SECRET
if (!SECRET) {
  console.error('CRON_SECRET is not set in .env.local')
  process.exit(1)
}

const url = process.env.SUN_BATCH_URL ?? 'http://localhost:3000/api/cron/sun-batch'

async function main() {
  console.log(`CRON_SECRET set: ${!!SECRET}`)
  console.log(`Sending request to: ${url}`)
  const t0 = Date.now()
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${SECRET}` },
    signal: AbortSignal.timeout(600_000),
  })
  console.log(`Request sent, waiting for response…`)
  const body = await res.text()
  console.log(`HTTP ${res.status} (${Date.now() - t0} ms)`)
  console.log(body)
  if (!res.ok) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
