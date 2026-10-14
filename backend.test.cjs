const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');const {createApp}=require('./server.cjs');
test('Accounts, ownership, inventory, orders, pricing, reviews, and restart persistence',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'vocalvend-test-')),databasePath=path.join(directory,'test.sqlite');let app=createApp({databasePath});
 async function listen(){await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(0,'127.0.0.1',resolve)});return `http://127.0.0.1:${app.server.address().port}`}
 let base=await listen();
 async function request(route,method='GET',body,cookie,headers={}){const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});const data=await response.json();return {status:response.status,data,cookie:response.headers.get('set-cookie')?.split(';')[0]}}
 const creds={name:'Ravi',email:'ravi@example.test',password:'testing-password',role:'vendor'};
 try{
  assert.equal((await request('/api/health')).status,200);assert.equal((await request('/api/orders')).status,401);
  const vendor=await request('/api/auth/register','POST',creds);assert.equal(vendor.status,200);assert(!vendor.data.user.password);assert(vendor.cookie);
  assert.equal((await request('/api/auth/register','POST',creds)).status,409);
  assert.equal((await request('/api/auth/login','POST',{...creds,password:'wrong-password'})).status,401);
  const other=await request('/api/auth/register','POST',{...creds,email:'other@example.test'});
  const wholesale=await request('/api/auth/register','POST',{...creds,email:'wholesale@example.test',role:'wholesaler',supplier:'Patil Fresh Traders'});assert.equal(wholesale.status,200);
  assert.equal((await request('/api/products/1','PATCH',{stock:20},wholesale.cookie)).status,403);assert.equal((await request('/api/verification','POST',require('./verification-fixture.cjs'),wholesale.cookie)).status,200);
  const original=(await request('/api/products')).data.products.find(p=>p.id===1);
  assert.equal((await request('/api/products/1','PATCH',{price:30},vendor.cookie)).status,403);
  assert.equal((await request('/api/products/2','PATCH',{price:30},wholesale.cookie)).status,403);
  assert.equal((await request('/api/products/1','PATCH',{price:-1},wholesale.cookie)).status,400);
  assert.equal((await request('/api/products/1','PATCH',{price:30,stock:15},wholesale.cookie)).status,200);
  assert.equal((await request('/api/orders','POST',{productId:1,qty:1,fulfilment:'Collect from supplier'},wholesale.cookie)).status,403);
  const pickup=await request('/api/orders','POST',{productId:1,qty:10,fulfilment:'Collect from supplier',total:1,deliveryFee:-999},vendor.cookie);assert.equal(pickup.status,201);assert.equal(pickup.data.order.total,300);assert.equal(pickup.data.order.deliveryFee,0);const id=pickup.data.order.id;
  const delivery=await request('/api/orders','POST',{productId:1,qty:5,fulfilment:'Wholesaler delivery',distance:0,transportWeightKg:0,transportType:'Standard',deliveryFee:0},vendor.cookie);assert.equal(delivery.data.order.total,200);assert.equal(delivery.data.order.deliveryFee,50);assert.equal(delivery.data.order.delivery.distanceKm,1.2);assert.equal(delivery.data.order.delivery.transportType,'Perishable');
  assert.equal((await request('/api/orders','POST',{productId:1,qty:1,fulfilment:'Collect from supplier'},vendor.cookie)).status,409);
  assert.equal((await request('/api/orders','POST',{productId:1,qty:0,fulfilment:'Collect from supplier'},vendor.cookie)).status,400);
  assert.equal((await request('/api/orders','POST',{productId:1,qty:1,fulfilment:'other'},vendor.cookie)).status,400);
  assert.equal((await request('/api/orders','GET',undefined,other.cookie)).data.orders.length,0);
  assert.equal((await request(`/api/orders/${id}/receive`,'POST',{},other.cookie)).status,404);
  assert.equal((await request(`/api/orders/${id}/review`,'POST',{rating:5},vendor.cookie)).status,409);
  assert.equal((await request(`/api/orders/${id}/messages`)).status,401);
  assert.equal((await request(`/api/orders/${id}/messages`,'GET',undefined,other.cookie)).status,404);
  const message=await request(`/api/orders/${id}/messages`,'POST',{text:'When can I collect this order?',senderId:999},vendor.cookie);assert.equal(message.status,201);assert.equal(message.data.message.senderId,vendor.data.user.id);
  assert.equal((await request(`/api/orders/${id}/messages`,'POST',{text:'Ready at 8 am.'},wholesale.cookie)).status,201);
  assert.equal((await request(`/api/orders/${id}/messages`,'GET',undefined,vendor.cookie)).data.messages.length,2);
  assert.equal((await request(`/api/orders/${id}/receive`,'POST',{},vendor.cookie)).status,200);
  assert.equal((await request(`/api/orders/${id}/review`,'POST',{rating:6},vendor.cookie)).status,400);
  assert.equal((await request(`/api/orders/${id}/review`,'POST',{rating:5,quality:7},vendor.cookie)).status,400);
  const detailed=await request(`/api/orders/${id}/review`,'POST',{rating:5,quality:4,feedback:'Good quality.',downsides:'Long wait at pickup.'},vendor.cookie);assert.equal(detailed.status,200);assert.equal(detailed.data.order.review.downsides,'Long wait at pickup.');
  assert.equal((await request(`/api/orders/${id}/review`,'POST',{rating:5},vendor.cookie)).status,409);
  assert.equal((await request('/api/products')).data.products.find(p=>p.id===1).reviews,original.reviews+1);
  assert.equal((await request('/api/orders','GET',undefined,wholesale.cookie)).data.orders.length,2);
  assert.equal((await request('/api/auth/logout','POST',{},other.cookie,{Origin:'https://untrusted.test'})).status,403);
  const created=await request('/api/products','POST',{name:'Custom takeaway bags',category:'Packaging & disposables',unit:'pack',price:75,stock:600,keywords:'bags',supplier:'Other business'},wholesale.cookie);assert.equal(created.status,201);assert.equal(created.data.product.supplier,'Patil Fresh Traders');
  assert.equal((await request('/api/products','POST',{name:'Invalid',category:'bad',unit:'kg',price:10,stock:5},wholesale.cookie)).status,400);
  assert.equal((await request('/api/products','POST',{name:'Bags',category:'Packaging & disposables',unit:'pack',price:10,stock:5},vendor.cookie)).status,403);
  assert.equal((await request(`/api/products/${created.data.product.id}`,'PATCH',{transportWeightKg:0},wholesale.cookie)).status,400);
  assert.equal((await request(`/api/products/${created.data.product.id}`,'PATCH',{transportType:'Unknown'},wholesale.cookie)).status,400);
  assert.equal((await request(`/api/products/${created.data.product.id}`,'PATCH',{transportWeightKg:1.25,transportType:'Fragile'},other.cookie)).status,403);
  assert.equal((await request(`/api/products/${created.data.product.id}`,'PATCH',{transportWeightKg:1.25,transportType:'Fragile'},wholesale.cookie)).status,200);
  const campaign=await request('/api/promotions/demo-checkout','POST',{plan:'weekly',category:'All categories',demoConfirmed:true,amount:1},wholesale.cookie);assert.equal(campaign.status,201);assert.equal(campaign.data.charged,false);assert.equal(campaign.data.promotion.amount,199);
  await new Promise(resolve=>app.server.close(resolve));app=createApp({databasePath});base=await listen();
  assert.equal((await request('/api/promotions','GET',undefined,wholesale.cookie)).data.promotion.id,campaign.data.promotion.id);
  assert((await request('/api/products')).data.products.find(p=>p.id===1).sponsored);
  assert.equal((await request('/api/promotions/stop','POST',{},wholesale.cookie)).status,200);
  assert.equal((await request('/api/products')).data.products.find(p=>p.id===1).sponsored,false);
  assert((await request('/api/products')).data.products.some(p=>p.id===created.data.product.id&&p.name==='Custom takeaway bags'&&p.unit==='pack'));
  const storedProduct=(await request('/api/products')).data.products.find(p=>p.id===created.data.product.id);assert.equal(storedProduct.transportWeightKg,1.25);assert.equal(storedProduct.transportType,'Fragile');
  assert.equal((await request('/api/orders','GET',undefined,vendor.cookie)).data.orders.length,2);assert.equal((await request('/api/products')).data.products.find(p=>p.id===1).stock,0);
  assert.equal((await request(`/api/orders/${id}/messages`,'GET',undefined,vendor.cookie)).data.messages.length,2);
  const login=await request('/api/auth/login','POST',creds);assert.equal(login.status,200);assert.equal((await request('/api/auth/logout','POST',{},login.cookie)).status,200);assert.equal((await request('/api/auth/me','GET',undefined,login.cookie)).status,401);
  const stored=app.db.prepare('SELECT password FROM users WHERE email=?').get(creds.email);assert.notEqual(stored.password,creds.password);
 }finally{await new Promise(resolve=>app.server.close(resolve));assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert(path.basename(directory).startsWith('vocalvend-test-'));fs.rmSync(directory,{recursive:true,force:true})}
});
test('Demo promotions require wholesaler consent, target categories, expire and never change trust',async()=>{
 const app=createApp({databasePath:':memory:'});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${app.server.address().port}`;
 async function request(route,body,cookie){const res=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]}}
 try{const vendor=await request('/api/auth/register',{name:'Vendor',email:'vp@example.test',password:'test-password',role:'vendor'});const seller=await request('/api/auth/register',{name:'Seller',email:'sp@example.test',password:'test-password',role:'wholesaler',supplier:'Patil Fresh Traders'});const payload={plan:'weekly',category:'Vegetables',demoConfirmed:true};
 assert.equal((await request('/api/promotions/demo-checkout',payload)).status,401);assert.equal((await request('/api/promotions/demo-checkout',payload,vendor.cookie)).status,403);assert.equal((await request('/api/promotions/demo-checkout',{...payload,demoConfirmed:false},seller.cookie)).status,400);assert.equal((await request('/api/promotions/demo-checkout',{...payload,plan:'free'},seller.cookie)).status,400);
 const before=(await request('/api/products')).data.products;const activated=await request('/api/promotions/demo-checkout',payload,seller.cookie);assert.equal(activated.status,201);assert.equal(activated.data.charged,false);assert.equal(activated.data.promotion.amount,199);assert.equal((await request('/api/promotions/demo-checkout',payload,seller.cookie)).status,409);
 const after=(await request('/api/products')).data.products;assert(after.find(p=>p.id===1).sponsored);assert(!after.find(p=>p.id===6).sponsored);for(const p of after){const old=before.find(x=>x.id===p.id);assert.equal(p.rating,old.rating);assert.equal(p.reviews,old.reviews);assert.equal(p.price,old.price)}
 app.db.prepare('UPDATE promotions SET ends=?').run(Date.now()-1);assert.equal((await request('/api/promotions',undefined,seller.cookie)).data.promotion,null);assert((await request('/api/products')).data.products.every(p=>!p.sponsored));
 }finally{await new Promise(resolve=>app.server.close(resolve))}
});
test('Non-food products, selling units, and large quantities use server pricing',async()=>{
 const app=createApp({databasePath:':memory:'});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${app.server.address().port}`;
 async function request(route,body,cookie){const res=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]}}
 try{const vendor=await request('/api/auth/register',{name:'Vendor',email:'v@example.test',password:'test-password',role:'vendor'});const seller=await request('/api/auth/register',{name:'Seller',email:'s@example.test',password:'test-password',role:'wholesaler',supplier:'Mahadev Market Supplies'});await request('/api/verification',require('./verification-fixture.cjs'),seller.cookie);const created=await request('/api/products',{name:'Paper cups (100 pcs)',category:'Packaging & disposables',unit:'pack',price:85,stock:600},seller.cookie);assert.equal(created.status,201);const bought=await request('/api/orders',{productId:created.data.product.id,qty:500,fulfilment:'Collect from supplier'},vendor.cookie);assert.equal(bought.status,201);assert.equal(bought.data.order.unit,'pack');assert.equal(bought.data.order.total,42500);assert.equal(bought.data.order.deliveryFee,0);const remaining=(await (await fetch(base+'/api/products')).json()).products.find(p=>p.id===created.data.product.id);assert.equal(remaining.stock,100);assert.equal((await request('/api/orders',{productId:remaining.id,qty:101,fulfilment:'Wholesaler delivery'},vendor.cookie)).status,409)}finally{await new Promise(resolve=>app.server.close(resolve))}
});


