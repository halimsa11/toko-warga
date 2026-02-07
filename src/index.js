import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './db/schema.js';
import { eq, desc } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { serveStatic } from '@hono/node-server/serve-static';

// 1. Load env
process.loadEnvFile();

// 2. Setup koneksi
const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client, { schema });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const app = new Hono();
app.use('/*', cors());

// -- API LOGIN --
app.post('/api/login', async (c) => {
    try {
        const body = await c.req.json();
        const { username, password } = body;

        const user = await db.query.userss.findFirst({
            where: eq(schema.userss.username, username)
        });

        if (!user) {
            return c.json({ success: false, message: 'username atau password salah' }, 401);
        }

        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch) {
            return c.json({ success: false, message: 'username atau password salah' }, 401);
        }

        const token = jwt.sign(
            { id: user.id, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1d' }
        );

        return c.json({ success: true, token });
    } catch (e) {
        return c.json({ success: false, message: e.message }, 500);
    }
});

// Middleware Auth
const authMiddleware = async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) return c.json({ message: 'unauthorized' }, 401);
    
    try {
        const token = authHeader.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        c.set('user', payload);
        await next();
    } catch (e) {
        return c.json({ message: 'invalid token' }, 403);
    }
};

// -- API REGISTER PRODUCT (ADMIN) --
app.post('/api/register', authMiddleware, async (c) => {
    try {
        const body = await c.req.parseBody();
        const imageFile = body['image'];

        if (!imageFile || !(imageFile instanceof File)) {
            return c.json({ success: false, message: 'gambar wajib!' }, 400);
        }

        const fileName = `prod_${Date.now()}_${imageFile.name.replace(/\s/g, '_')}`;
        const arrayBuffer = await imageFile.arrayBuffer();

        const { error: uploadError } = await supabase.storage
            .from('products')
            .upload(fileName, arrayBuffer, { contentType: imageFile.type });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('products').getPublicUrl(fileName);
        const imageUrl = data.publicUrl;

        await db.insert(schema.products).values({
            name: body['name'],
            description: body['description'],
            price: body['price'],
            stock: body['stock'], // Pastikan di schema.js ini bertipe text sesuai definisimu
            categoryId: parseInt(body['categoryId']),
            // imageUrl: imageUrl // Pastikan kolom ini ada di schema.js
        });

        return c.json({ success: true, message: 'product berhasil ditambahkan', imageUrl });
    } catch (e) {
        return c.json({ success: false, message: e.message }, 500);
    }
});

// -- API GET PRODUCTS --
app.get('/api/products', async (c) => {
    try {
        const data = await db.select().from(schema.products).orderBy(desc(schema.products.id));
        return c.json({ success: true, data });
    } catch (e) {
        return c.json({ success: false, message: e.message }, 500);
    }
});

// -- API ORDERS (CUSTOMER) --
app.post('/api/orders', async (c) => {
    try {
        const body = await c.req.json();
        
        // Ambil data dengan fallback jika ada perbedaan penamaan di frontend
        const customerName = body.customerName || body.customersName; 
        const address = body.address || body.addres;
        const items = body.items;

        // Logging untuk memastikan data tidak undefined
        console.log("Payload diterima:", { customerName, address, items });

        if (!customerName || !address || !items) {
            return c.json({ success: false, message: "Data customerName atau address kosong" }, 400);
        }

        const result = await db.transaction(async (tx) => {
            // Sesuai dengan schema.js kamu yang menggunakan 'customerName' dan 'addres'
            const [newOrder] = await tx.insert(schema.orders).values({
                customerName: customerName, 
                addres: address, // Sesuaikan dengan typo 'addres' di schema.js kamu
            }).returning();

            // ... sisa kode loop items tetap sama
            return { orderId: newOrder.id };
        });

        return c.json({ success: true, data: result });
    } catch (e) {
        return c.json({ success: false, message: e.message }, 400);
    }
});
app.use('/*', serveStatic({ path: './public' }));

const port = 6969;
console.log(`Server running at http://localhost:${port}`);
serve({ fetch: app.fetch, port });

export default app;