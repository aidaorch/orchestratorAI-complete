/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_OPENAI_API_KEY: string;
    readonly VITE_ADMIN_USER: string;
    readonly VITE_ADMIN_PASS: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
