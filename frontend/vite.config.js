import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const rootDir = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
    root: rootDir,
    plugins: [tailwindcss(), react()],
    server: {
        proxy: {
            '/api': {
                // 与 backend 默认 PORT=3002 一致（见 vault-os1.1/backend/src/index.ts）
                target: 'http://localhost:3002',
                changeOrigin: true,
            },
        },
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        globals: true,
        exclude: ['node_modules/**', 'dist/**'],
    },
});
