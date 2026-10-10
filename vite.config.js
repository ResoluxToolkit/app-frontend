import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 3003,
    proxy: {
      '/api/v1': {
        target: 'http://127.0.0.1:1980',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
