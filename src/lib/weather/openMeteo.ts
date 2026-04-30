/**
 * Tiny wrapper around Open-Meteo's free / key-less current-weather endpoint.
 * https://open-meteo.com/en/docs
 *
 * Returns the bits we actually display: temperature, feels-like, and the WMO
 * weather code (which we map to an icon in the UI).
 */

export type WeatherSnapshot = {
  /** Air temperature in °C. */
  temp: number;
  /** Apparent / feels-like temperature in °C. */
  feelsLike: number;
  /** WMO weather code — see codeToCondition() for the mapping. */
  weatherCode: number;
  /** ISO timestamp of the observation. */
  observedAt: string;
};

export type WeatherCondition =
  | 'clear'
  | 'partly-cloudy'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'unknown';

/** Map a WMO weather code (0..99) to a coarse condition the UI cares about. */
export function codeToCondition(code: number): WeatherCondition {
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly-cloudy';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snow';
  if (code >= 95) return 'storm';
  return 'unknown';
}

const TORONTO: { lat: number; lon: number } = { lat: 43.6532, lon: -79.3832 };

export async function fetchTorontoWeather(): Promise<WeatherSnapshot> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(TORONTO.lat));
  url.searchParams.set('longitude', String(TORONTO.lon));
  url.searchParams.set('current', 'temperature_2m,apparent_temperature,weather_code');
  url.searchParams.set('temperature_unit', 'celsius');
  url.searchParams.set('timezone', 'America/Toronto');

  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) {
    throw new Error(`open-meteo ${res.status}`);
  }
  const data = (await res.json()) as {
    current: {
      time: string;
      temperature_2m: number;
      apparent_temperature: number;
      weather_code: number;
    };
  };

  return {
    temp: data.current.temperature_2m,
    feelsLike: data.current.apparent_temperature,
    weatherCode: data.current.weather_code,
    observedAt: data.current.time,
  };
}
