import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      // AI Studio는 배포 시 이 값을 서버 측에서 자동으로 주입합니다.
      // 로컬 개발 시에는 .env.local 에 GEMINI_API_KEY=... 를 넣고 실행하세요.
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY || ''),
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.GEMINI_API_KEY || ''),
    },
  };
});
