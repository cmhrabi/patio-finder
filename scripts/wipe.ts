/**
 * Wipe every venue (and, by cascade, every patio / tap / venue_photo) from the
 * connected Supabase project. Uses the secret-key admin client so RLS doesn't
 * get in the way.
 *
 * Usage:
 *   npm run db:wipe                    # dry run — print row counts only
 *   npm run db:wipe -- --confirm       # actually delete
 *
 * The schema has ON DELETE CASCADE on every venue-referencing FK, so deleting
 * the `venues` table is enough — we still print the counts of the related
 * tables so it's obvious that the cascade fired.
 */
import { createSupabaseAdminClient } from '../src/lib/supabase/admin'

const TABLES = ['venues', 'patios', 'taps', 'venue_photos'] as const

type CountMap = Record<(typeof TABLES)[number], number>

async function counts(): Promise<CountMap> {
  const supabase = createSupabaseAdminClient()
  const out = {} as CountMap
  for (const t of TABLES) {
    const { count, error } = await supabase
      .from(t)
      .select('*', { count: 'exact', head: true })
    if (error) {
      console.error(`! failed to count ${t}: ${error.message}`)
      out[t] = -1
      continue
    }
    out[t] = count ?? 0
  }
  return out
}

function printCounts(label: string, c: CountMap) {
  console.log(label)
  for (const t of TABLES) {
    const n = c[t]
    const display = n < 0 ? 'error' : String(n)
    console.log(`  ${t.padEnd(14)} ${display}`)
  }
}

async function deleteAllVenues(): Promise<number> {
  const supabase = createSupabaseAdminClient()
  // Supabase requires a filter on .delete(); use a tautology that matches
  // every UUID. The literal string is unreachable as a real id.
  const { error, count } = await supabase
    .from('venues')
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) {
    console.error('! delete failed:', error.message)
    process.exit(1)
  }
  return count ?? 0
}

async function main() {
  const before = await counts()
  printCounts('Before:', before)

  const confirm = process.argv.includes('--confirm')
  if (!confirm) {
    console.log('\nDry run. Pass --confirm to delete every venue (cascades to patios/taps/photos).')
    return
  }

  if (before.venues === 0) {
    console.log('\nNothing to delete.')
    return
  }

  console.log('\nDeleting…')
  const deleted = await deleteAllVenues()
  console.log(`Deleted ${deleted} venue${deleted === 1 ? '' : 's'}. Cascading to patios / taps / venue_photos.`)

  const after = await counts()
  printCounts('\nAfter:', after)
}

void main()
