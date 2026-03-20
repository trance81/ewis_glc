import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Vercel은 보통 프로젝트가 도메인 루트(`/`)에서 제공됩니다.
  // GitHub Pages처럼 하위 경로(`/my-repo/`)가 아니라면 base를 `/`로 두는 것이 안전합니다.
  base: '/',
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
