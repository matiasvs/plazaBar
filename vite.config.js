import { defineConfig } from 'vite';

export default defineConfig({
    base: '/plazaBar/',
    optimizeDeps: {
        esbuildOptions: { target: 'esnext' }
    },
    build: {
        outDir: 'dist',
        target: 'esnext'
    },
});
