import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  // Preserve Host so the API can enforce the same Origin check in development.
  server: {
    proxy: { "/api": { target: "http://127.0.0.1:8080", changeOrigin: false } },
  },
});
