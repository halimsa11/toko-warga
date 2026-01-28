import {defineConfig} from 'drizzle-kit';

// load env otomatis
process.loadEnvFile();

export default defineConfig({
    schema: './src/db/schema.js',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL,
    },
})