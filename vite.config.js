import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 3003,
    allowedHosts: ['mac'],
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
