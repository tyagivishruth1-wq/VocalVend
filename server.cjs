const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {randomBytes,createHash,scrypt,timingSafeEqual}=require('node:crypto');
const {promisify}=require('node:util');const derive=promisify(scrypt);
const seed=require('./seed.json');const SESSION_AGE=7*24*60*60*1000;
const {productCategories,productUnits}=require('./dist/catalogue.js');
const {transportTypes,transportDefaults,deliveryQuote}=require('./dist/delivery.js');
const {validateReview}=require('./dist/review-fields.js');
const {validateVerification}=require('./dist/verification-fields.js');
const digest=s=>createHash('sha256').update(s).digest('hex');
const publicUser=u=>({id:u.id,name:u.name,email:u.email,role:u.role,supplier:u.supplier});
function fail(status,message){const error=new Error(message);error.status=status;throw error}
function createApp({databasePath=path.join(__dirname,'data','vocalvend.sqlite')}={}){
 if(databasePath!==':memory:')fs.mkdirSync(path.dirname(databasePath),{recursive:true});
 const db=new DatabaseSync(databasePath);db.exec(`PRAGMA foreign_keys=ON;PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,salt TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('vendor','wholesaler')),supplier TEXT UNIQUE);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY,info TEXT NOT NULL,price INTEGER NOT NULL CHECK(price>0),stock INTEGER NOT NULL CHECK(stock>=0),supplier TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id),product_id INTEGER NOT NULL REFERENCES products(id),info TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id);
 CREATE TABLE IF NOT EXISTS promotions(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id),supplier TEXT NOT NULL,category TEXT NOT NULL,amount INTEGER NOT NULL,starts INTEGER NOT NULL,ends INTEGER NOT NULL,mode TEXT NOT NULL CHECK(mode='demo'));
 CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER NOT NULL REFERENCES orders(id),sender_id INTEGER NOT NULL REFERENCES users(id),text TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS messages_order ON messages(order_id,id);
 CREATE TABLE IF NOT EXISTS wholesaler_verifications(user_id INTEGER PRIMARY KEY REFERENCES users(id),info TEXT NOT NULL);`);
 const insertProduct=db.prepare('INSERT OR IGNORE INTO products(id,info,price,stock,supplier) VALUES(?,?,?,?,?)');
 for(const p of seed.products){insertProduct.run(p.id,JSON.stringify(p),p.price,p.stock,p.supplier);const row=db.prepare('SELECT info FROM products WHERE id=?').get(p.id),info=JSON.parse(row.info);if(info.name===p.name&&(info.transportWeightKg===undefined||info.transportType===undefined)){const defaults=transportDefaults(p.category,p.unit||'kg');info.transportWeightKg??=p.transportWeightKg??defaults.transportWeightKg;info.transportType??=p.transportType??defaults.transportType;db.prepare('UPDATE products SET info=? WHERE id=?').run(JSON.stringify(info),p.id)}}
 const attempts=new Map();
 function rateLimit(ip){const now=Date.now();for(const [key,entry]of attempts)if(entry.until<now)attempts.delete(key);const entry=attempts.get(ip)||{count:0,until:now+15*60*1000};entry.count++;attempts.set(ip,entry);if(entry.count>30)fail(429,'Too many attempts. Try again in 15 minutes.')}
 function getUser(req){const token=(req.headers.cookie||'').match(/(?:^|;\s*)vv_session=([a-f0-9]{64})(?:;|$)/)?.[1];if(!token)return null;return db.prepare('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token=? AND sessions.expires>?').get(digest(token),Date.now())||null}
 function requireUser(req,role){const u=getUser(req);if(!u)fail(401,'Please log in again.');if(role&&u.role!==role)fail(403,'This action is not available for your account.');return u}
 function cookieSession(res,u){db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),u.id,Date.now()+SESSION_AGE);res.setHeader('Set-Cookie',`vv_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_AGE/1000}`)}
 function products(){const campaigns=new Map(db.prepare('SELECT * FROM promotions WHERE starts<=? AND ends>? ORDER BY id').all(Date.now(),Date.now()).map(p=>[p.supplier,p]));return db.prepare('SELECT * FROM products ORDER BY id').all().map(p=>{const info=JSON.parse(p.info),campaign=campaigns.get(p.supplier);return {...transportDefaults(info.category,info.unit||'kg'),...info,price:p.price,stock:p.stock,sponsored:Boolean(campaign&&(campaign.category==='All categories'||campaign.category===info.category))}})}
 function userOrders(u){const rows=u.role==='vendor'?db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC').all(u.id):db.prepare('SELECT orders.* FROM orders JOIN products ON products.id=orders.product_id WHERE products.supplier=? ORDER BY orders.id DESC').all(u.supplier);return rows.map(o=>({...JSON.parse(o.info),id:o.id}))}
 async function body(req){if(!req.headers['content-type']?.startsWith('application/json'))fail(415,'Send JSON data.');let data='',size=0;for await(const chunk of req){size+=chunk.length;if(size>(req.url.startsWith('/api/verification')?65536:16384))fail(413,'Request is too large.');data+=chunk}try{const value=JSON.parse(data);if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Invalid request.');return value}catch{fail(400,'Invalid JSON data.')}}
 function send(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value))}
 async function handler(req,res){try{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
  const url=new URL(req.url,'http://localhost'),route=url.pathname,method=req.method;
  if(route.startsWith('/api/')){
   if(!['GET','HEAD'].includes(method)&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)fail(403,'Request origin is not allowed.');
   if(route==='/api/health'&&method==='GET')return send(res,200,{ok:true});
   if(route==='/api/products'&&method==='GET')return send(res,200,{products:products()});
   if(route==='/api/wholesalers'&&method==='GET')return send(res,200,{wholesalers:seed.wholesalers});
   if(route==='/api/promotions'&&method==='GET'){const u=requireUser(req,'wholesaler');const promotion=db.prepare('SELECT * FROM promotions WHERE user_id=? AND ends>? ORDER BY id DESC LIMIT 1').get(u.id,Date.now());return send(res,200,{plan:{id:'weekly',amount:199,days:7,mode:'demo'},promotion:promotion?{id:promotion.id,category:promotion.category,ends:promotion.ends,amount:promotion.amount,mode:'demo'}:null})}
   if(route==='/api/promotions/demo-checkout'&&method==='POST'){
    const u=requireUser(req,'wholesaler'),b=await body(req);if(b.plan!=='weekly'||b.demoConfirmed!==true)fail(400,'Confirm demo checkout. No money will be charged.');if(b.category!=='All categories'&&!productCategories.some(c=>c[0]===b.category))fail(400,'Choose a valid promotion category.');
    if(db.prepare('SELECT id FROM promotions WHERE user_id=? AND ends>?').get(u.id,Date.now()))fail(409,'You already have an active promotion.');
    const starts=Date.now(),ends=starts+7*24*60*60*1000;const result=db.prepare("INSERT INTO promotions(user_id,supplier,category,amount,starts,ends,mode) VALUES(?,?,?,?,?,?,'demo')").run(u.id,u.supplier,b.category,199,starts,ends);return send(res,201,{promotion:{id:Number(result.lastInsertRowid),category:b.category,ends,amount:199,mode:'demo'},charged:false});
   }
   if(route==='/api/promotions/stop'&&method==='POST'){const u=requireUser(req,'wholesaler');await body(req);db.prepare('UPDATE promotions SET ends=? WHERE user_id=? AND ends>?').run(Date.now(),u.id,Date.now());return send(res,200,{ok:true})}
   if(['/api/auth/register','/api/auth/login'].includes(route)&&method==='POST'){
    rateLimit(req.socket.remoteAddress);const b=await body(req);const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)fail(400,'Enter a valid email address.');if(typeof b.password!=='string'||b.password.length<8||b.password.length>128)fail(400,'Password must be 8–128 characters.');
    let u;
    if(route.endsWith('register')){
     const name=typeof b.name==='string'?b.name.trim():'';if(!name||name.length>60)fail(400,'Enter your name.');if(!['vendor','wholesaler'].includes(b.role))fail(400,'Choose an account role.');
     const supplier=b.role==='wholesaler'?b.supplier:null;if(b.role==='wholesaler'&&!seed.wholesalers.some(w=>w.name===supplier))fail(400,'Choose a sample wholesaler.');
     const salt=randomBytes(16).toString('hex'),hash=(await derive(b.password,salt,64)).toString('hex');
     try{const result=db.prepare('INSERT INTO users(email,name,password,salt,role,supplier) VALUES(?,?,?,?,?,?)').run(email,name,hash,salt,b.role,supplier);u=db.prepare('SELECT * FROM users WHERE id=?').get(Number(result.lastInsertRowid))}catch(e){if([2067,1555].includes(e.errcode)||e.message?.includes('UNIQUE constraint failed'))fail(409,'Email or sample wholesaler is already registered.');throw e}
    }else{u=db.prepare('SELECT * FROM users WHERE email=?').get(email);const hash=await derive(b.password,u?.salt||'vocalvend-dummy-salt',64);if(!u||!timingSafeEqual(hash,Buffer.from(u.password,'hex')))fail(401,'Email or password is incorrect.')}
    cookieSession(res,u);return send(res,200,{user:publicUser(u)});
   }
   if(route==='/api/auth/me'&&method==='GET')return send(res,200,{user:publicUser(requireUser(req))});
   if(route==='/api/auth/logout'&&method==='POST'){await body(req);const token=(req.headers.cookie||'').match(/(?:^|;\s*)vv_session=([a-f0-9]{64})(?:;|$)/)?.[1];if(token)db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token));res.setHeader('Set-Cookie','vv_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send(res,200,{ok:true})}
   if(route==='/api/orders'&&method==='GET')return send(res,200,{orders:userOrders(requireUser(req))});
   if(route==='/api/orders'&&method==='POST'){
    const u=requireUser(req,'vendor'),b=await body(req);if(!Number.isInteger(b.productId)||!Number.isInteger(b.qty)||b.qty<1||b.qty>100000)fail(400,'Choose a quantity between 1 and 100000 units.');if(!['Wholesaler delivery','Collect from supplier'].includes(b.fulfilment))fail(400,'Choose delivery or supplier pickup.');
    db.exec('BEGIN IMMEDIATE');let order;
    try{const p=db.prepare('SELECT * FROM products WHERE id=?').get(b.productId);if(!p)fail(404,'Product not found.');if(p.stock<b.qty)fail(409,'Not enough stock. Please refresh the inventory.');const info=JSON.parse(p.info),subtotal=b.qty*p.price,delivery=deliveryQuote(info,b.qty,b.fulfilment),deliveryFee=delivery.deliveryFee;
     order={product:info.name,supplier:p.supplier,qty:b.qty,unit:info.unit||'kg',subtotal,deliveryFee,delivery,total:subtotal+deliveryFee,fulfilment:b.fulfilment,status:'Placed',rating:null,createdAt:new Date().toISOString()};
     const result=db.prepare('INSERT INTO orders(user_id,product_id,info) VALUES(?,?,?)').run(u.id,p.id,JSON.stringify(order));order.id=Number(result.lastInsertRowid);db.prepare('UPDATE products SET stock=stock-? WHERE id=?').run(b.qty,p.id);db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e}return send(res,201,{order});
   }
   if(route==='/api/verification'&&method==='GET'){const u=requireUser(req,'wholesaler'),row=db.prepare('SELECT info FROM wholesaler_verifications WHERE user_id=?').get(u.id);const v=row?JSON.parse(row.info):null;return send(res,200,{verification:v?{...v,documents:Object.fromEntries(Object.entries(v.documents).map(([key,d])=>[key,{name:d.name}]))}:null})}
   if(route==='/api/verification'&&method==='POST'){const u=requireUser(req,'wholesaler'),v=validateVerification(await body(req));db.prepare('INSERT INTO wholesaler_verifications(user_id,info) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET info=excluded.info').run(u.id,JSON.stringify(v));return send(res,200,{status:'demo_complete'})}
   if((route==='/api/products'&&method==='POST'||/^\/api\/products\/\d+$/.test(route)&&method==='PATCH')){const u=requireUser(req,'wholesaler');if(!db.prepare('SELECT user_id FROM wholesaler_verifications WHERE user_id=?').get(u.id))fail(403,'Complete dummy business verification before managing stock.')}
   const chatMatch=route.match(/^\/api\/orders\/(\d+)\/messages$/);
   if(chatMatch&&['GET','POST'].includes(method)){
    const u=requireUser(req),order=db.prepare('SELECT orders.*,products.supplier FROM orders JOIN products ON products.id=orders.product_id WHERE orders.id=?').get(Number(chatMatch[1]));if(!order||(u.role==='vendor'?order.user_id!==u.id:order.supplier!==u.supplier))fail(404,'Order not found.');
    if(method==='POST'){const b=await body(req),message=typeof b.text==='string'?b.text.trim():'';if(!message||message.length>1500)fail(400,'Write a message of 1–1500 characters.');const result=db.prepare('INSERT INTO messages(order_id,sender_id,text,created_at) VALUES(?,?,?,?)').run(order.id,u.id,message,new Date().toISOString());return send(res,201,{message:{id:Number(result.lastInsertRowid),senderId:u.id,senderName:u.name,senderRole:u.role,text:message,createdAt:new Date().toISOString()}})}
    const after=url.searchParams.get('after');if(after!==null&&(!/^\d+$/.test(after)||!Number.isSafeInteger(Number(after))))fail(400,'Invalid message cursor.');const rows=after===null?db.prepare('SELECT messages.*,users.name,users.role FROM messages JOIN users ON users.id=messages.sender_id WHERE order_id=? ORDER BY messages.id DESC LIMIT 100').all(order.id).reverse():db.prepare('SELECT messages.*,users.name,users.role FROM messages JOIN users ON users.id=messages.sender_id WHERE order_id=? AND messages.id>? ORDER BY messages.id LIMIT 100').all(order.id,Number(after));const peer=u.role==='vendor'?db.prepare('SELECT name FROM users WHERE supplier=? AND role=?').get(order.supplier,'wholesaler'):db.prepare('SELECT name FROM users WHERE id=?').get(order.user_id);return send(res,200,{peer:peer?.name||order.supplier,peerConnected:Boolean(peer),messages:rows.map(m=>({id:m.id,senderId:m.sender_id,senderName:m.name,senderRole:m.role,text:m.text,createdAt:m.created_at}))});
   }
   const orderMatch=route.match(/^\/api\/orders\/(\d+)\/(receive|review)$/);
   if(orderMatch&&method==='POST'){
    const u=requireUser(req,'vendor'),b=await body(req),row=db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(Number(orderMatch[1]),u.id);if(!row)fail(404,'Order not found.');const o=JSON.parse(row.info);
    if(orderMatch[2]==='receive'){o.status='Received'}else{if(o.status!=='Received')fail(409,'Receive your order before leaving a review.');if(o.rating!==null)fail(409,'This order already has a review.');o.review=validateReview(b);o.rating=o.review.rating;
     // Preserve sample historical review counts and add this real prototype review.
     for(const p of db.prepare('SELECT * FROM products WHERE supplier=?').all(o.supplier)){const info=JSON.parse(p.info);info.rating=Math.round((info.rating*info.reviews+b.rating)/(info.reviews+1)*10)/10;info.reviews++;db.prepare('UPDATE products SET info=? WHERE id=?').run(JSON.stringify(info),p.id)}
    }db.prepare('UPDATE orders SET info=? WHERE id=?').run(JSON.stringify(o),row.id);return send(res,200,{order:{...o,id:row.id}});
   }
   if(route==='/api/products'&&method==='POST'){
    const u=requireUser(req,'wholesaler'),b=await body(req),name=typeof b.name==='string'?b.name.trim():'',keywords=typeof b.keywords==='string'?b.keywords.trim():'';
    if(!name||name.length>100||keywords.length>300)fail(400,'Enter a product name of up to 100 characters.');
    const category=productCategories.find(c=>c[0]===b.category);if(!category||!productUnits.includes(b.unit))fail(400,'Choose a valid category and selling unit.');
    if(!Number.isInteger(b.price)||b.price<1||b.price>10000||!Number.isInteger(b.stock)||b.stock<0||b.stock>100000)fail(400,'Enter a valid price and stock quantity.');
    const w=seed.wholesalers.find(w=>w.name===u.supplier),existing=db.prepare('SELECT info FROM products WHERE supplier=? LIMIT 1').get(u.supplier),trust=existing?JSON.parse(existing.info):w;
    const transport=transportDefaults(b.category,b.unit);if(b.transportWeightKg!==undefined)transport.transportWeightKg=b.transportWeightKg;if(b.transportType!==undefined)transport.transportType=b.transportType;
    if(!Number.isFinite(transport.transportWeightKg)||transport.transportWeightKg<0.001||transport.transportWeightKg>1000||!transportTypes.includes(transport.transportType))fail(400,'Enter valid transport weight and handling type.');
    const info={name,keywords:name+' '+keywords,category:b.category,unit:b.unit,...transport,supplier:u.supplier,price:b.price,stock:b.stock,emoji:category[1],color:'supply',tag:'New listing',distance:w.distance,rating:trust.rating,reviews:trust.reviews};
    const result=db.prepare('INSERT INTO products(info,price,stock,supplier) VALUES(?,?,?,?)').run(JSON.stringify(info),b.price,b.stock,u.supplier);info.id=Number(result.lastInsertRowid);db.prepare('UPDATE products SET info=? WHERE id=?').run(JSON.stringify(info),info.id);return send(res,201,{product:info});
   }
   const productMatch=route.match(/^\/api\/products\/(\d+)$/);
   if(productMatch&&method==='PATCH'){
    const u=requireUser(req,'wholesaler'),b=await body(req),p=db.prepare('SELECT * FROM products WHERE id=?').get(Number(productMatch[1]));if(!p)fail(404,'Product not found.');if(p.supplier!==u.supplier)fail(403,'You can edit only your own inventory.');if(Object.keys(b).some(k=>!['price','stock','transportWeightKg','transportType'].includes(k))||!Object.keys(b).length)fail(400,'Update price, stock or transport details.');const price=b.price??p.price,stock=b.stock??p.stock;if(!Number.isInteger(price)||price<1||price>10000||!Number.isInteger(stock)||stock<0||stock>100000)fail(400,'Enter a valid price and stock quantity.');const info=JSON.parse(p.info);if(b.transportWeightKg!==undefined){if(!Number.isFinite(b.transportWeightKg)||b.transportWeightKg<0.001||b.transportWeightKg>1000)fail(400,'Enter valid transport weight and handling type.');info.transportWeightKg=b.transportWeightKg}if(b.transportType!==undefined){if(!transportTypes.includes(b.transportType))fail(400,'Enter valid transport weight and handling type.');info.transportType=b.transportType}db.prepare('UPDATE products SET price=?,stock=?,info=? WHERE id=?').run(price,stock,JSON.stringify(info),p.id);return send(res,200,{products:products()});
   }
   fail(404,'API endpoint not found.');
  }
  if(method!=='GET'&&method!=='HEAD')fail(405,'Method not allowed.');
  const root=path.join(__dirname,'dist'),filename=path.resolve(root,'.'+decodeURIComponent(route==='/'?'/index.html':route));if(!filename.startsWith(root+path.sep))fail(403,'Not allowed.');
  let data;try{data=fs.readFileSync(filename)}catch{fail(404,'File not found.')}
  const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(method==='HEAD'?undefined:data);
 }catch(e){if(!res.headersSent)send(res,e.status||500,{error:e.status?e.message:'Server error. Please try again.'});else res.end();if(!e.status)console.error('Backend request failed:',e.code||e.name)}}
 const server=http.createServer(handler);server.requestTimeout=15000;server.on('close',()=>db.close());return {server,db,handler};
}
if(require.main===module){const {server}=createApp();const port=Number(process.env.PORT||4173);server.listen(port,'127.0.0.1',()=>console.log(`VocalVend: http://127.0.0.1:${port}`));server.on('error',e=>{console.error('Unable to start:',e.code);process.exitCode=1});for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)))}
module.exports={createApp};

