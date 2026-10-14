import fs from 'node:fs';import path from 'node:path';
const root=path.resolve('..');fs.mkdirSync('shared',{recursive:true});fs.copyFileSync(path.join(root,'seed.json'),'seed.json');
const config=['catalogue.js','delivery.js','review-fields.js','verification-fields.js'].map(f=>fs.readFileSync(path.join(root,'dist',f),'utf8').split('\n').filter(l=>!l.startsWith("if(typeof module")).join('\n')).join('\n');fs.writeFileSync('shared/config.mjs',config+'\nexport {productCategories,productUnits,transportTypes,transportDefaults,deliveryQuote,reviewDimensions,validateReview,validateVerification};\n');
const assets={};for(const file of fs.readdirSync(path.join(root,'dist'))){if(!/\.(html|css|js|svg)$/.test(file))continue;assets['/'+file]=fs.readFileSync(path.join(root,'dist',file),'utf8')}fs.mkdirSync('backend',{recursive:true});fs.writeFileSync('backend/assets.mjs','export default '+JSON.stringify(assets)+';\n');

