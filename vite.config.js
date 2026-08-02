import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          visuals: ['canvas-confetti', 'html-to-image', 'qrcode'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
})
