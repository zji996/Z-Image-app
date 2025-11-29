import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiHost = env.VITE_API_HOST || "localhost";
  const apiPort = env.VITE_API_PORT || "8000";
  const apiOrigin = `http://${apiHost}:${apiPort}`;

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
