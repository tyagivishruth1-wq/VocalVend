const test=require('node:test'),assert=require('node:assert/strict');
const {priceGroupKey,regionalPriceStats}=require('./dist/price-stats.js');
const base={name:'Fresh tomatoes',unit:'kg',stock:10,distance:2};const key=priceGroupKey(base);
test('Regional median compares available matching units and counts each supplier once',()=>{
 const rows=[{...base,supplier:'A',price:24,sponsored:true},{...base,supplier:'B',price:26},{...base,supplier:'A',price:30},{...base,supplier:'C',price:999,distance:6},{...base,supplier:'D',price:20,stock:0},{...base,supplier:'E',price:5,unit:'pack'},{...base,supplier:'F',price:2,name:'Cherry tomatoes'}];
 assert.deepEqual({...regionalPriceStats(rows,key,5),listings:undefined},{count:2,median:25,min:24,max:26,listings:undefined});
 assert.equal(regionalPriceStats([...rows,{...base,supplier:'G',price:100}],key,5).median,26);
 assert.equal(regionalPriceStats(rows,key,1).count,0);
});
