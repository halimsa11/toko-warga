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

        console.log("--- Login Attempt ---");
        console.log("Username dari Request:", username);

        // Cari user di tabel userss
        const user = await db.query.userss.findFirst({
            where: eq(schema.userss.username, username)
        });

        if (!user) {
            console.log("Status: User tidak ditemukan di database.");
            return c.json({ success: false, message: 'username atau password salah' }, 401);
        }

        // Cek password menggunakan bcrypt
        const isMatch = bcrypt.compareSync(password, user.password);
        
        if (!isMatch) {
            console.log("Status: Password tidak cocok dengan hash di database.");
            return c.json({ success: false, message: 'username atau password salah' }, 401);
        }

        console.log("Status: Login Berhasil!");
        const token = jwt.sign(
            { id: user.id, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1d' }
        );

        return c.json({ success: true, token });
    } catch (e) {
        console.error("Login Error:", e.message);
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

// -- API REGISTER PRODUCT --
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
            stock: parseInt(body['stock']),
            categoryId: parseInt(body['categoryId']),
            imageUrl: imageUrl
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

// -- API ORDERS --
app.post('/api/orders', async (c) => {
    try {
        const { customersName, address, items } = await c.req.json();

        const result = await db.transaction(async (tx) => {
            let total = 0;

            const [newOrder] = await tx.insert(schema.orders).values({
                customersName, 
                address, 
                totalAmount: '0', 
                status: 'pending'
            }).returning();

            for (const item of items) {
                const product = await tx.query.products.findFirst({
                    where: eq(schema.products.id, item.productId)
                });

                if (!product || product.stock < item.quantity) {
                    throw new Error(`stok ${product?.name || 'Produk'} tidak cukup`);
                }
                
                total += Number(product.price) * item.quantity;

                await tx.insert(schema.orderItems).values({
                    ordersId: newOrder.id,
                    productId: item.productId,
                    quantity: item.quantity
                });

                await tx.update(schema.products)
                    .set({ stock: product.stock - item.quantity })
                    .where(eq(schema.products.id, item.productId));
            }

            await tx.update(schema.orders)
                .set({ totalAmount: total.toString() })
                .where(eq(schema.orders.id, newOrder.id));

            return { orderId: newOrder.id, total };
        });

        return c.json({ success: true, data: result });
    } catch (e) {
        return c.json({ success: false, message: e.message }, 400);
    }
});
app.use('/*', serveStatic({ path: './public' }));

const port = 6969;
console.log(`server running at http://localhost:${port}`);
serve({ fetch: app.fetch, port });

export default app;