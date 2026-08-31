import { defineConfig } from "vite";

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        entryFileNames: "assets/app.js",
        chunkFileNames: "assets/[name].js",
        manualChunks: { mammoth: ["mammoth"] },
        assetFileNames: (assetInfo) => assetInfo.names?.some((name) => name.endsWith(".css"))
          ? "assets/app.css"
          : "assets/[name][extname]"
      }
    }
  }
});
