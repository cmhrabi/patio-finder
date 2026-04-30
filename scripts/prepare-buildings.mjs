#!/usr/bin/env node
// Prepare a clipped + simplified GeoJSON of building footprints + heights for the
// sun-prediction feature, sourced from the City of Toronto 3D Massing dataset.
//
// Usage:
//   node scripts/prepare-buildings.mjs                    # uses defaults (Ladybug Tavern area)
//   node scripts/prepare-buildings.mjs --lon -79.4275 --lat 43.6535 --radius 800
//
// Requires: ogr2ogr (GDAL) on PATH.
// See scripts/README.md for the full pipeline + the EleZ caveat.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const CACHE = join(__dirname, '.cache');
const DATASET_URL =
  'https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/387b2e3b-2a76-4199-8b3b-0b7d22e2ec10/resource/667237d6-4d3c-4cf3-8cb7-e91c48d59375/download/3dmassingshapefile_2025_wgs84.zip';

const args = parseArgs(process.argv.slice(2));
const LON = Number(args.lon ?? -79.4275);
const LAT = Number(args.lat ?? 43.6535);
const RADIUS_M = Number(args.radius ?? 800);
const OUT = resolve(args.out ?? join(ROOT, 'public/buildings.geojson'));

mkdirSync(CACHE, { recursive: true });

const ZIP_PATH = join(CACHE, '3dmassing.zip');
const SHP_DIR = join(CACHE, '3dmassing');
const RAW_GEOJSON = join(CACHE, '3dmassing.raw.geojson');

if (!existsSync(ZIP_PATH)) {
  console.log(`> downloading ${DATASET_URL}`);
  run('curl', ['-L', '--fail', '--max-time', '300', '-o', ZIP_PATH, DATASET_URL]);
}

if (!existsSync(SHP_DIR) || readdirSync(SHP_DIR).length === 0) {
  mkdirSync(SHP_DIR, { recursive: true });
  console.log(`> unzipping into ${SHP_DIR}`);
  run('unzip', ['-o', '-q', ZIP_PATH, '-d', SHP_DIR]);
}

const shp = findShp(SHP_DIR);
if (!shp) throw new Error(`No .shp found under ${SHP_DIR}`);
console.log(`> source shapefile: ${shp}`);

// Compute clip bbox in WGS84 around (LON, LAT) with RADIUS_M metres.
const mPerDegLat = 110_540;
const mPerDegLon = 111_320 * Math.cos((LAT * Math.PI) / 180);
const dLat = RADIUS_M / mPerDegLat;
const dLon = RADIUS_M / mPerDegLon;
const minLon = LON - dLon;
const maxLon = LON + dLon;
const minLat = LAT - dLat;
const maxLat = LAT + dLat;

console.log(`> filtering to bbox [${minLon}, ${minLat}, ${maxLon}, ${maxLat}] via -spat`);
// GeoJSON driver doesn't support DeleteLayer, so just remove any previous file.
if (existsSync(RAW_GEOJSON)) rmSync(RAW_GEOJSON);
// Use -spat (bbox filter) rather than -clipsrc/-simplify, which require GEOS-enabled GDAL.
run(
  'ogr2ogr',
  [
    '-f', 'GeoJSON',
    '-t_srs', 'EPSG:4326',
    '-spat', String(minLon), String(minLat), String(maxLon), String(maxLat),
    '-spat_srs', 'EPSG:4326',
    '-skipfailures',
    RAW_GEOJSON,
    shp,
  ],
);

console.log('> post-processing (deriving heightM from EleZ)');
const raw = JSON.parse(readFileSync(RAW_GEOJSON, 'utf-8'));
if (raw.type !== 'FeatureCollection') throw new Error('expected FeatureCollection');

// Detect available height fields. The 2025 Toronto 3D Massing shapefile typically has:
//   EleZ        - top-of-roof elevation above sea level (orthometric, metres)
//   AVG_HT_M    - average height above ground in some recent vintages
//   MAX_HT_M    - maximum height above ground in some recent vintages
//   ground_z    - sometimes present
// We prefer explicit *height* fields; otherwise compute height = EleZ - localGroundEleZ
// where localGroundEleZ is the 5th-percentile EleZ across the clipped tile (a coarse proxy
// for ground level — adequate on the relatively flat Toronto plain; documented in README).
const features = raw.features.filter((f) => f && f.geometry && f.properties);
if (features.length === 0) throw new Error('no features after clip — check coordinates');

const sampleProps = features[0].properties;
const fields = Object.keys(sampleProps);
const hasField = (name) => fields.some((k) => k.toLowerCase() === name.toLowerCase());
const get = (props, name) => {
  for (const k of Object.keys(props)) {
    if (k.toLowerCase() === name.toLowerCase()) return props[k];
  }
  return undefined;
};

// Field name strategies in order of preference. Each entry returns a height-above-ground in metres.
let strategy;
if (hasField('MAX_HEIGHT')) strategy = 'MAX_HEIGHT';
else if (hasField('AVG_HEIGHT')) strategy = 'AVG_HEIGHT';
else if (hasField('AVG_HT_M')) strategy = 'AVG_HT_M';
else if (hasField('MAX_HT_M')) strategy = 'MAX_HT_M';
else if (hasField('HEIGHT_MSL') && hasField('SURF_ELEV')) strategy = 'HEIGHT_MSL-SURF_ELEV';
else if (hasField('EleZ') && hasField('ground_z')) strategy = 'EleZ-ground_z';
else if (hasField('EleZ')) strategy = 'EleZ-localGround';
else throw new Error(`no recognized height field; available: ${fields.join(', ')}`);
console.log(`> height strategy: ${strategy}`);

let localGroundEleZ = 0;
if (strategy === 'EleZ-localGround') {
  const elev = features.map((f) => Number(get(f.properties, 'EleZ'))).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  localGroundEleZ = elev[Math.max(0, Math.floor(elev.length * 0.05))];
  console.log(`>   local ground proxy (P5 of EleZ): ${localGroundEleZ.toFixed(2)} m`);
}

const out = {
  type: 'FeatureCollection',
  features: features
    .map((f) => {
      let heightM = NaN;
      const p = f.properties;
      switch (strategy) {
        case 'MAX_HEIGHT': heightM = Number(get(p, 'MAX_HEIGHT')); break;
        case 'AVG_HEIGHT': heightM = Number(get(p, 'AVG_HEIGHT')); break;
        case 'AVG_HT_M': heightM = Number(get(p, 'AVG_HT_M')); break;
        case 'MAX_HT_M': heightM = Number(get(p, 'MAX_HT_M')); break;
        case 'HEIGHT_MSL-SURF_ELEV': heightM = Number(get(p, 'HEIGHT_MSL')) - Number(get(p, 'SURF_ELEV')); break;
        case 'EleZ-ground_z': heightM = Number(get(p, 'EleZ')) - Number(get(p, 'ground_z')); break;
        case 'EleZ-localGround': heightM = Number(get(p, 'EleZ')) - localGroundEleZ; break;
      }
      if (!Number.isFinite(heightM)) heightM = 3;
      heightM = Math.max(3, Math.min(heightM, 300));
      return {
        type: 'Feature',
        geometry: stripZ(f.geometry),
        properties: { heightM: Math.round(heightM * 10) / 10 },
      };
    })
    .filter((f) => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')),
};

function stripZ(geom) {
  if (!geom) return geom;
  if (geom.type === 'Polygon') {
    return { type: 'Polygon', coordinates: geom.coordinates.map((ring) => ring.map((p) => [p[0], p[1]])) };
  }
  if (geom.type === 'MultiPolygon') {
    return { type: 'MultiPolygon', coordinates: geom.coordinates.map((poly) => poly.map((ring) => ring.map((p) => [p[0], p[1]]))) };
  }
  return geom;
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
const bytes = statSync(OUT).size;
console.log(`> wrote ${OUT} (${(bytes / 1024).toFixed(1)} kB, ${out.features.length} features)`);
console.log('> Attribution required: "Contains information licensed under the Open Government Licence – Toronto."');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      out[k] = v;
    }
  }
  return out;
}

function findShp(dir) {
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const s = statSync(p);
      if (s.isDirectory()) stack.push(p);
      else if (s.isFile() && /\.shp$/i.test(name)) return p;
    }
  }
  return null;
}

function run(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { stdio: 'inherit', ...opts });
}
