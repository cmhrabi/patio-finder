import { fetchTorontoWeather } from '@/lib/weather/openMeteo';

// Open-Meteo updates roughly every 15 minutes. 10-min cache is plenty.
export const revalidate = 600;

export async function GET() {
  try {
    const snapshot = await fetchTorontoWeather();
    return Response.json(snapshot);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'failed to fetch weather';
    return Response.json({ error: message }, { status: 502 });
  }
}
