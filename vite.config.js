import { defineConfig } from 'vite';
import { VitePluginEnvironment } from 'vite-plugin-environment';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  plugins: [
    VitePluginEnvironment({
      VITE_CANISTER_ID_BACKEND: process.env.CANISTER_ID_BACKEND,
      VITE_DFX_NETWORK: process.env.DFX_NETWORK,
    }),
  ],
  build: {
    outDir: '../dist',
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});