import { defineConfig } from "vite";

const toInt = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const devPort = toInt(process.env.VITE_PORT, 5173);
const hmrHost = process.env.VITE_HMR_HOST || "localhost";
const hmrPort = toInt(process.env.VITE_HMR_PORT, devPort);

export default defineConfig({
  server: {
    host: true,
    port: devPort,
    strictPort: false,
    hmr: {
      protocol: "ws",
      host: hmrHost,
      port: hmrPort,
      clientPort: hmrPort
    }
  }
});
