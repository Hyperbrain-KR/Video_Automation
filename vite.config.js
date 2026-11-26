import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // 스토리보드는 영상 제작 화면과 독립된 페이지로 빌드한다
    rollupOptions: {
      input: {
        main: 'index.html',
        storyboard: 'storyboard.html',
      },
    },
  },
})
