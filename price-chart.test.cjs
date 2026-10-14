const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('Vendor chart follows regional-language search, radius changes and role visibility',()=>{
 const els={};function get(s){return els[s]??=(s==='#priceSupply'?{value:'',set innerHTML(html){this.html=html;this.value=html.match(/value="([^"]+)"/)?.[1].replaceAll('&quot;','"')||''}}:{value:'',insertBefore(){}})}
 get('#priceRadius').value='5';get('#search').value='टमाटर';let panel;
 const ctx=vm.createContext({...require('./dist/price-stats.js'),...require('./dist/supply-search.js'),$:get,currentUser:{role:'vendor'},category:'All supplies',products:require('./seed.json').products,render(){},safe:s=>String(s).replaceAll('"','&quot;').replaceAll('<','&lt;'),document:{createElement(){return panel={}}},translateUI(){}});
 vm.runInContext(fs.readFileSync('dist/price-chart.js','utf8'),ctx);
 assert.equal(panel.hidden,false);assert(get('#priceSummary').innerHTML.includes('₹25/kg'));assert(get('#priceBars').innerHTML.includes('₹24/kg'));assert(get('#priceBars').innerHTML.includes('₹26/kg'));
 get('#priceRadius').value='1';get('#priceRadius').onchange();assert(get('#priceSummary').innerHTML.includes('No available prices'));assert.equal(get('#priceBars').innerHTML,'');
 ctx.currentUser={role:'wholesaler'};ctx.render();assert.equal(panel.hidden,true);
 ctx.currentUser={role:'vendor'};get('#search').value='cups';get('#priceRadius').value='5';get('#search').oninput();assert.equal(panel.hidden,false);assert(get('#priceSummary').innerHTML.includes('₹85/pack'));assert(get('#priceSummary').innerHTML.includes('Limited sample'));
});
