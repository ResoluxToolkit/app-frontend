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
        // Repassa o IP de quem chamou (X-Forwarded-For): sem isso, todo
        // celular chega ao motor como loopback e passa sem pareamento.
        xfwd: true,
      },
      "/monitor": {
        target: "http://127.0.0.1:1980",
        xfwd: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
