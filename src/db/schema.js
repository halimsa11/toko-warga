import { pgTable, serial, varchar, text, integer, numeric, timestamp }  from "drizzle-orm/pg-core";

//1. table users(amind)

export const userss = pgTable('userss', {
    id: serial('id').primaryKey(),
    username: varchar('username', {length: 100}).unique().notNull(),
    password: varchar('password', {length: 256}).notNull(),
    role: varchar('role', {length: 20 }).default('customer'),
});


// 2 pgtable categorise
export const categorise = pgTable('categories', {
    id: serial("id").primaryKey(),
    name: varchar("name", {length: 100}).notNull()

});

//2. tabel products 
export const products = pgTable("products", {
    id: serial('id').primaryKey(),
    name: varchar("name", {length: 256}).notNull(),
    description: text('description'),
    price: numeric('price', {pricesion: 12, scale: 2}).notNull(),
    stock: text('image_url'),
    categoryId: integer('category_id').references(() => categorise.id),
});

// 4 tabel orders
export const orders = pgTable('orders', {
    id: serial('id').primaryKey(),
    customerName: varchar('customer_name', {length: 256}).notNull(),
    addres: text('addres').notNull(),
});

// 5 tabel order items (datail belanja)
export const orderItems = pgTable('order_items',
    {
        id: serial('id').primaryKey(),
        orderId: integer('order_id').references(() => orders.id).notNull(),
        quantity: integer('quantity').notNull(),
        priceAtTime: numeric('price_at_time', {pricesion: 12, slace: 2}).notNull(),
    });

