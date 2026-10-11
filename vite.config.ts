import { defineConfig } from 'vite';

export default defineConfig({
  // Percorsi relativi: lo stesso build funziona su GitHub Pages (servito in /<nome-repo>/)
  // e su Vercel (servito dalla radice).
  base: './',
});
