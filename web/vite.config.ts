import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves from /Vendor-Pass/ — set base to repo name
  base: "/Vendor-Pass/",
});
