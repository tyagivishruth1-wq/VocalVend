// One temporary vendor account validates the deployed authentication flow.
// Password and session cookie stay in memory and are never printed.
import {randomUUID} from 'node:crypto';
const base=process.argv[2];if(!base||!/^https:\/\/[a-z0-9.-]+\.workers\.dev$/.test(base))throw Error('Provide the deployed workers.dev origin');
const email='deployment-check-'+randomUUID()+'@example.test',password=randomUUID()+randomUUID();
const page=await fetch(base);if(page.status!==200||!(await page.text()).includes('loginPage'))throw Error('Login page check failed');
const health=await fetch(base+'/api/health');if(!health.ok||(await health.json()).ok!==true)throw Error('Backend check failed');
const catalogue=await fetch(base+'/api/products');const products=(await catalogue.json()).products;if(!catalogue.ok||products.length<25)throw Error('Catalogue check failed');
const register=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,name:'Deployment check',role:'vendor'})});if(!register.ok)throw Error('Registration check failed: HTTP '+register.status);const account=await register.json();const cookie=register.headers.get('Set-Cookie')?.split(';')[0];if(!cookie)throw Error('Session cookie missing');
const me=await fetch(base+'/api/auth/me',{headers:{Cookie:cookie}});if(!me.ok||(await me.json()).user.id!==account.user.id)throw Error('Session check failed');
const logout=await fetch(base+'/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:'{}'});if(!logout.ok)throw Error('Logout check failed');
console.log(JSON.stringify({page:200,backend:true,listings:products.length,registration:true,session:true,logout:true,temporaryUserId:account.user.id,temporaryEmail:email}));
