import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // public/ es de la versión anterior; los archivos estáticos van en estatico/.
  publicDir: 'estatico',
  server: { port: 3000, strictPort: true, open: true },
});
