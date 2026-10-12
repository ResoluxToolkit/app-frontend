import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    host: true,
    port: 3003,
    allowedHosts: ["mac", "mac.tail17794.ts.net"],
    proxy: {
      "/api/v1": {
        target: "http://127.0.0.1:1980",
        ws: true,
      },
      "/monitor": {
        target: "http://127.0.0.1:8091",
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
