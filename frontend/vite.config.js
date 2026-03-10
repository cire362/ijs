import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const elementPlusResolver = ElementPlusResolver({ importStyle: "css" });

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      imports: ["vue", "vue-router", "pinia"],
      dts: false,
      resolvers: [elementPlusResolver],
    }),
    Components({
      dts: false,
      resolvers: [elementPlusResolver],
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("element-plus") || id.includes("@element-plus")) {
            return "ui-element-plus";
          }

          if (
            id.includes("vue-router") ||
            id.includes("pinia") ||
            id.includes("vue")
          ) {
            return "framework-vue";
          }

          if (id.includes("axios") || id.includes("socket.io-client")) {
            return "networking";
          }

          return "vendor";
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/uploads": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
