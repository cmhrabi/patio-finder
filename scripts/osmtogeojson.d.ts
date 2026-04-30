// `osmtogeojson` ships no types and is only used by scripts/buildings-fetch.ts.
// A loose shim is enough to keep the project's typecheck green without
// pulling in @types/osmtogeojson (which doesn't exist).
declare module 'osmtogeojson' {
  const osmtogeojson: (data: unknown, options?: unknown) => GeoJSON.FeatureCollection;
  export default osmtogeojson;
}
