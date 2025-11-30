import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiOrigin = env.VITE_API_BASE_URL || "http://localhost:8000";

  return {
    plugins: [tailwindcss(), react()],
    server: {
      port: 5173,
      proxy: {
        "/v1": {
          target: apiOrigin,
          changeOrigin: true,
        },
        "/generated-images": {
          target: apiOrigin,
          changeOrigin: true,
        },
      },
    },
  };
});
