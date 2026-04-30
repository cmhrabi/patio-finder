import { listVenuesFromDb } from '@/lib/patios/db';

// Always hit the DB — the response is small and the map fetches it once on mount.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const venues = await listVenuesFromDb();
    return Response.json(venues);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'failed to list venues';
    return Response.json({ error: message }, { status: 500 });
  }
}
