const transportTypes=['Standard','Fragile','Perishable','Bulky'];
function transportDefaults(category,unit='kg'){
 const type=category==='Packaging & disposables'?'Bulky':category==='Dairy & eggs'||category==='Fruits'||category==='Vegetables'?'Perishable':'Standard';
 return {transportType:type,transportWeightKg:unit==='kg'||unit==='litre'?1:unit==='pack'?0.5:0.1};
}
function deliveryQuote(product,quantity,fulfilment='Wholesaler delivery'){
 const defaults=transportDefaults(product.category,product.unit||'kg');const weightPerUnit=product.transportWeightKg??defaults.transportWeightKg;
 const transportType=product.transportType||defaults.transportType;
 const distanceKm=product.distance,loadKg=Math.round(weightPerUnit*quantity*1000)/1000;
 const baseCost=20,distanceCost=Math.ceil(distanceKm*8),loadCost=Math.ceil(loadKg*2),handlingCost={Standard:0,Fragile:15,Perishable:10,Bulky:20}[transportType];
 const deliveryEstimate=baseCost+distanceCost+loadCost+handlingCost;
 return {baseCost,distanceCost,loadCost,handlingCost,distanceKm,loadKg,transportType,deliveryEstimate,deliveryFee:fulfilment==='Collect from supplier'?0:deliveryEstimate};
}
if(typeof module!=='undefined')module.exports={transportTypes,transportDefaults,deliveryQuote};
