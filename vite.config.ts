import { defineConfig } from 'vite';
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    publicDir: "public",
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        copyPublicDir: true,
        rollupOptions: {
            input: {
                background: "scripts/background.ts",
                popup: "scripts/popup/main.tsx",
                "content/main": "scripts/content/main.ts"
            },
            output: { entryFileNames: "[name].js" }
        }
    }
});