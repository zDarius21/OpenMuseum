import { itITLocale } from '@sanity/locale-it-it';
import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { schemaTypes } from './schemaTypes';

export default defineConfig({
  name: 'default',
  title: 'OpenMuseum',
  projectId: 'e0nf18h9',
  dataset: 'production',
  plugins: [structureTool(), itITLocale()],
  schema: { types: schemaTypes },
});
