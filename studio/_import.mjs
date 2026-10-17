// Script temporaneo: carica su Sanity le opere di un file JSON (IMPORT_FILE), con immagine e visita guidata.
// Le opere già presenti prima di oggi non vengono toccate. Uso: IMPORT_FILE=... npx sanity exec _import.mjs --with-user-token
import fs from 'node:fs';
import { getCliClient } from 'sanity/cli';

const client = getCliClient({ apiVersion: '2025-02-19' });
const records = JSON.parse(fs.readFileSync(process.env.IMPORT_FILE, 'utf8'));
const TODAY = '2026-10-16';

for (const record of records) {
  const id = `artwork-${record.slug}`;
  const existing = await client.getDocument(id);
  if (existing && existing._createdAt < TODAY) {
    console.log(`${record.slug}: esiste già da prima, saltata`);
    continue;
  }
  let image = existing?.image;
  if (!image) {
    const asset = await client.assets.upload('image', fs.createReadStream(record.image), { filename: `${record.slug}.jpg` });
    image = { _type: 'image', asset: { _type: 'reference', _ref: asset._id } };
  }
  const { slug, image: _path, tour, ...fields } = record;
  await client.createOrReplace({
    _id: id,
    _type: 'artwork',
    ...fields,
    slug: { _type: 'slug', current: slug },
    image,
    tour: tour.map(({ x, y, zoom, radius, text, textEn }, index) => ({
      _key: `stop${index + 1}`,
      _type: 'tourStop',
      text,
      textEn,
      x,
      y,
      zoom,
      ...(radius !== undefined ? { radius } : {}),
    })),
  });
  console.log(`${slug}: ok`);
}
