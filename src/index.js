import {serve} from '@hono/node-server'
import {Hono} from 'hono';
import {cors} from 'hono/cors';
import {drizzle} from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken'
import { createClient } from '@supabase/supabase-js';
import { PgRole } from 'drizzle-orm/pg-core';


// 1 load env

process.loadEnvFile();

// 2 setup koneksi
    const client = postgres(Progress.env.DATABASE_URL);
    const db = drizzle(client, {schema});
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUAPABASE_SERVICE_KEY);

    const app = new Hono();
    app.use('/*', cors()); 

    //--API LOGIN--
    app.post('/api/login', async (c) => {
        const {username, password} = await c.req.json();

        //cari user
        const user = await db.query.userss.findFirst({
            where: eq(schema.userss.username)

        });

        if (!user || !bcrypt.compareSync(password, user.password)) {
            return c.json({success: false, masage: 'login gagal' }, 401);
        }

        //buat token

        const token = jwt.sign({id: user.id, role: user.role}, process.env.JWT_SECRET, {expiresIn: '1d'});
    });


    //middlewire akun

    const autMiddleware = async (c, next) => {
        const autMiddleware = c.req.header('Authorization');
        if(!autHeader) return c.json({masage: 'unautorized'}, 401);
        try{
            const token = autHeader.split(' ')[1];
            const payload = jwt.verify(token, process.env.JWT_SECRET);
            c.set('user', payload);
            await next();
        } catch (e) {
            return c.json({masage: 'invalid token'}, 403);
        } 
    };
