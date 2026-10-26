import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/public': 'http://localhost:8080',
      '/journal': 'http://localhost:8080',
      '/user': 'http://localhost:8080',
    },
  },
});
