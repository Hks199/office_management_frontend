import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    // The Excel reader is loaded by a worker after file selection. Prebundle it so
    // Vite does not reload the page and discard the open form on its first use.
    optimizeDeps: { include: ['xlsx'] },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: env.API_PROXY_TARGET || 'http://127.0.0.1:3000',
          changeOrigin: false,
          configure(proxy) {
            proxy.on('proxyReq', (proxyRequest, incoming) => {
              // Browsers omit Origin on same-origin GETs; this endpoint explicitly requires it.
              // The development server is loopback-only, with a fixed trusted frontend origin.
              if (
                incoming.method === 'GET' &&
                incoming.url?.split('?')[0] === '/api/v1/auth/csrf' &&
                !incoming.headers.origin
              ) {
                proxyRequest.setHeader('Origin', 'http://localhost:5173');
              }
            });
          },
        },
      },
      headers: { 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' },
    },
    build: { sourcemap: false, chunkSizeWarningLimit: 600 },
  };
});
