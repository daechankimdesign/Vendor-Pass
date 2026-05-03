import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // GitHub Pages serves from /Vendor-Pass/ in production; use "/" locally
  base: mode === "production" ? "/Vendor-Pass/" : "/",
}));
