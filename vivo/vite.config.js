import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // In dev, proxy /api calls to Vercel dev server (run `vercel dev` separately)
    // or use the mock below by commenting out the proxy and using the mock API
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
