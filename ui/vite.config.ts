import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';

// 根据运行环境设置后端地址
// 开发环境：如果后端在本地运行，使用 localhost:8080
// 生产环境或服务器开发：使用实际的服务器地址
const serverBaseUrl = process.env.VITE_SERVER_URL || 'http://172.31.73.223:8080';

export default defineConfig((mode) => ({
  plugins: [
    react(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      crypto: 'crypto-browserify',
    },
  },
  css: {preprocessorOptions: {less: {javascriptEnabled: true},},},
  server: {
    // 修改为监听所有接口，而不是特定主机名
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/web': {
        target: serverBaseUrl,
        changeOrigin: true,
      },
      '/api': {
        target: serverBaseUrl,
        changeOrigin: true,
      },
      '/admin': {
        target: serverBaseUrl,
        changeOrigin: true,
      },
    },
  },
  define: {
    // 在服务器环境中，即使开发模式也需要使用完整URL
    // 如果在本地运行，使用空字符串让Vite代理处理
    SERVICE_BASE_URL: JSON.stringify(serverBaseUrl),
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser' as const,
    rollupOptions: {output: {inlineDynamicImports: true},},
    cssCodeSplit: false,
  },
}));
