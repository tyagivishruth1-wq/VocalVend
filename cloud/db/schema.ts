// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import {sqliteTable,integer,text,index} from 'drizzle-orm/sqlite-core';
export const users=sqliteTable('users',{id:integer('id').primaryKey({autoIncrement:true}),email:text('email').notNull().unique(),name:text('name').notNull(),password:text('password').notNull(),salt:text('salt').notNull(),role:text('role').notNull(),supplier:text('supplier').unique()});
export const sessions=sqliteTable('sessions',{token:text('token').primaryKey(),userId:integer('user_id').notNull().references(()=>users.id),expires:integer('expires').notNull()});
export const products=sqliteTable('products',{id:integer('id').primaryKey({autoIncrement:true}),info:text('info').notNull(),price:integer('price').notNull(),stock:integer('stock').notNull(),supplier:text('supplier').notNull()});
export const orders=sqliteTable('orders',{id:integer('id').primaryKey({autoIncrement:true}),userId:integer('user_id').notNull().references(()=>users.id),productId:integer('product_id').notNull().references(()=>products.id),info:text('info').notNull(),requestKey:text('request_key').unique()},t=>[index('orders_user').on(t.userId)]);
export const promotions=sqliteTable('promotions',{id:integer('id').primaryKey({autoIncrement:true}),userId:integer('user_id').notNull().references(()=>users.id),supplier:text('supplier').notNull(),category:text('category').notNull(),amount:integer('amount').notNull(),starts:integer('starts').notNull(),ends:integer('ends').notNull(),mode:text('mode').notNull()});
export const limits=sqliteTable('auth_limits',{key:text('key').primaryKey(),count:integer('count').notNull(),until:integer('until').notNull()});
export const messages=sqliteTable('messages',{id:integer('id').primaryKey({autoIncrement:true}),orderId:integer('order_id').notNull().references(()=>orders.id),senderId:integer('sender_id').notNull().references(()=>users.id),text:text('text').notNull(),createdAt:text('created_at').notNull()},t=>[index('messages_order').on(t.orderId,t.id)]);
export const verifications=sqliteTable('wholesaler_verifications',{userId:integer('user_id').primaryKey().references(()=>users.id),info:text('info').notNull()});
