import { defineConfig } from 'vite';
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                background: "scripts/background.ts",
                popup: "scripts/popup/main.tsx",
            },
            output: {
                entryFileNames: '[name].js'
            }
        }
    }
});