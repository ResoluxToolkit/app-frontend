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
        // Só dev: o motor recusa no WS a origem com ponto (ex.: o
        // MagicDNS do Tailscale, https://mac.tail17794.ts.net:3003). Quando
        // a origem é a própria página (Origin = Host), troca pelo localhost
        // para o handshake passar; origem de outro site segue intacta e o
        // motor continua recusando. Proposta para o motor em
        // docs/PAREAMENTO.md (a regra certa é Origin = Host lá).
        configure(proxy) {
          proxy.on("proxyReqWs", (proxyReq, req) => {
            const origem = req.headers.origin;
            if (!origem) return;
            try {
              if (new URL(origem).host === req.headers.host) {
                proxyReq.setHeader("origin", "http://localhost:3003");
              }
            } catch (_) {
              // Origin malformado: deixa o motor decidir.
            }
          });
        },
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
