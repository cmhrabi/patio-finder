import { listPatiosFromDb } from '@/lib/patios/db';

// Always hit the DB — the response is small and the map fetches it once on mount.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const patios = await listPatiosFromDb();
    return Response.json(patios);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'failed to list patios';
    return Response.json({ error: message }, { status: 500 });
  }
}
