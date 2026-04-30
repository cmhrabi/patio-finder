import SunCalc from 'suncalc';

export function getSunPosition(date: Date, lat: number, lon: number) {
  const p = SunCalc.getPosition(date, lat, lon);
  const azimuthDeg = (((p.azimuth * 180) / Math.PI) + 180 + 360) % 360;
  const altitudeDeg = (p.altitude * 180) / Math.PI;
  return { azimuthDeg, altitudeDeg };
}

export function getDayTimes(date: Date, lat: number, lon: number) {
  return SunCalc.getTimes(date, lat, lon);
}
