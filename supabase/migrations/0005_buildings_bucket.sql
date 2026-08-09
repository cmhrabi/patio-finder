-- Storage bucket for the tiled Toronto 3D Massing buildings dataset.
--
-- Published by `npm run buildings:fetch` as:
--   buildings/manifest.json                     (small, cacheControl 60)
--   buildings/<version>/tiles/<x>_<y>.geojson.gz (immutable, cacheControl 1y)
--
-- Read at runtime by src/lib/buildings/loadNear.ts. Public because the data is
-- City of Toronto open data under the Open Government Licence and was already
-- served publicly from /public/buildings.geojson — a public bucket also means
-- the workflow steps can fetch it over the CDN with no key.
--
-- Writes still require the secret key: no insert/update/delete policy is
-- granted here, so only the service role (the publish script) can upload.
insert into storage.buckets (id, name, public)
values ('buildings', 'buildings', true)
on conflict (id) do update set public = excluded.public;
