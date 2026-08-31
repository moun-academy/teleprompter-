import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    define: {
      __SUPABASE_URL__: JSON.stringify(env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || ""),
      __SUPABASE_PUBLISHABLE_KEY__: JSON.stringify(
        env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
          || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          || env.SUPABASE_PUBLISHABLE_KEY
          || env.SUPABASE_ANON_KEY
          || ""
      )
    },
    build: {
      chunkSizeWarningLimit: 550,
      rollupOptions: {
        output: {
          entryFileNames: "assets/app.js",
          chunkFileNames: "assets/[name].js",
          manualChunks: {
            mammoth: ["mammoth"],
            supabase: ["@supabase/supabase-js"]
          },
          assetFileNames: (assetInfo) => assetInfo.names?.some((name) => name.endsWith(".css"))
            ? "assets/app.css"
            : "assets/[name][extname]"
        }
      }
    }
  };
});
