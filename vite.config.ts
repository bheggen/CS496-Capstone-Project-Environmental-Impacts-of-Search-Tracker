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
                "content/google": "scripts/content/google.ts",
                "content/chatgpt": "scripts/content/chatgpt.ts"
            },
            output: { entryFileNames: "[name].js" }
        }
    }
});