function priceGroupKey(p){return JSON.stringify([String(p.name).trim().toLowerCase(),p.unit||'kg'])}
function regionalPriceStats(products,key,radius){
 const suppliers=new Map();
 for(const p of products){if(priceGroupKey(p)!==key||!Number.isFinite(p.distance)||p.distance<0||p.distance>radius||p.stock<=0||!Number.isFinite(p.price)||p.price<=0)continue;const previous=suppliers.get(p.supplier);if(!previous||p.price<previous.price)suppliers.set(p.supplier,p)}
 const listings=[...suppliers.values()].sort((a,b)=>a.price-b.price),n=listings.length;
 if(!n)return {listings,count:0};
 return {listings,count:n,median:n%2?listings[(n-1)/2].price:(listings[n/2-1].price+listings[n/2].price)/2,min:listings[0].price,max:listings[n-1].price};
}
if(typeof module!=='undefined')module.exports={priceGroupKey,regionalPriceStats};
