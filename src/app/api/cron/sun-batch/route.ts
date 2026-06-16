import { NextResponse, type NextRequest } from 'next/server'
import { start } from 'workflow/api'
import { sunBatchWorkflow } from '@/workflows/sun-batch'

// Thin trigger. The heavy per-patio geometry runs inside the workflow's steps
// (see src/workflows/sun-batch.ts), so this request just authorizes, kicks off
// the run, and returns the runId in milliseconds — no long-running compute here.
// Vercel cron can't send query params, so the nightly run is always incremental.
// The GitHub Action (and the local sun:rebuild script) pass `?mode=full` to force
// a full wipe-and-recompute, or `?mode=missing` to compute only patios that have
// no rows yet (e.g. after adding a venue).

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const header = req.headers.get('authorization')
  return header === `Bearer ${expected}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const raw = req.nextUrl.searchParams.get('mode')
  const mode = raw === 'full' || raw === 'missing' ? raw : 'incremental'
  const run = await start(sunBatchWorkflow, [{ mode }])

  return NextResponse.json({ runId: run.runId, mode })
}
