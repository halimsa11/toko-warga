import {drizzle} from "drizzle-orm/postgres-js";
import postgres from 'postgres';
import {userss, categorise} from './schema.js';
import bcrypt from "bcryptjs";

//load env
process.loadEnvFile();

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

async function seed() {
    console.log('sedding dimulai....')

    // 1 buat admin 
const hash = await bcrypt.hash('123456', 10);
await db.insert(userss).values({
    username: 'admin123',
    password: hash,
    role: 'admin',
}).onConflictDoNothing();

// 2 buat kategori 
await db.insert(categorise).values([
    {name: 'Makanan'}, {name: 'Minuman'}, {name: 'Pakaian'}
]);

console.log('sedding selesai....')
process.exit(0);

}


seed();
