const pricePanel=document.createElement('section');pricePanel.className='regional-prices';pricePanel.hidden=true;
pricePanel.innerHTML='<div class="price-chart-heading"><div><span class="eyebrow">LOCAL PRICE CHECK</span><h2>What are nearby wholesalers charging?</h2><p class="muted">Sample region: Shivaji Market, Pune. Compare item prices before choosing a supplier.</p></div><span class="sampletag">Sample inventory</span></div><div class="price-chart-controls"><label>Compare supply<select id="priceSupply"></select></label><label>Distance from sample market<select id="priceRadius"><option value="1">Within 1 km</option><option value="3">Within 3 km</option><option value="5" selected>Within 5 km</option></select></label></div><div id="priceSummary" aria-live="polite"></div><div id="priceBars"></div><p class="price-chart-note">Typical price is the median of available listings, with one price per wholesaler. Delivery is excluded. Product names and selling units must match; brands, quality and pack sizes may still differ. Sponsored suppliers receive no extra weight.</p>';
$('#market').insertBefore(pricePanel,$('#market .markethead'));
function renderRegionalPrices(){
 pricePanel.hidden=currentUser?.role!=='vendor';if(pricePanel.hidden)return;
 const matched=products.filter(p=>(category==='All supplies'||category===p.category)&&matchesSupply(p,$('#search').value));
 const groups=new Map(matched.map(p=>[priceGroupKey(p),p]));const select=$('#priceSupply'),previous=select.value;
 select.innerHTML=[...groups].map(([key,p])=>`<option value="${safe(key)}" data-no-translate>${safe(p.name)} · ${safe(p.unit||'kg')}</option>`).join('');
 if(groups.has(previous))select.value=previous;
 renderPriceBars();
}
function renderPriceBars(){
 const key=$('#priceSupply').value,p=products.find(p=>priceGroupKey(p)===key),stats=regionalPriceStats(products,key,Number($('#priceRadius').value));
 if(!stats.count){$('#priceSummary').innerHTML='<p class="muted">No available prices in this distance. Expand the distance or search for another supply.</p>';$('#priceBars').innerHTML='';return}
 const money=n=>'₹'+n.toLocaleString('en-IN',{maximumFractionDigits:2}),unit=p.unit||'kg',scale=stats.max*1.15;
 $('#priceSummary').innerHTML=`<div class="price-summary"><div><span>Typical local price (median)</span><strong data-no-translate>${money(stats.median)}/${safe(unit)}</strong></div><div><span>Local price range</span><strong data-no-translate>${money(stats.min)} – ${money(stats.max)}/${safe(unit)}</strong></div><div><span>Available wholesalers</span><strong data-no-translate>${stats.count}</strong></div></div>${stats.count<3?'<p class="price-small-sample">Limited sample: fewer than three wholesalers. This is a comparison, not a reliable regional benchmark.</p>':''}`;
 $('#priceBars').innerHTML=`<div class="price-chart-legend"><span class="median-key"></span><span>Dashed line: typical local price</span></div>`+stats.listings.map(row=>`<div class="price-bar-row"><div class="price-bar-label" data-no-translate><strong>${safe(row.supplier)}</strong><small>${row.distance} km · ${safe(row.name)}</small></div><div class="price-bar-track" role="img" aria-label="${safe(row.supplier)}: ${money(row.price)} per ${safe(unit)}, ${row.distance} km away"><div class="price-bar-fill" style="width:${row.price/scale*100}%"></div><span class="median-marker" style="left:${stats.median/scale*100}%"></span></div><strong data-no-translate>${money(row.price)}/${safe(unit)}</strong></div>`).join('');
 if(typeof translateUI==='function')translateUI();
}
$('#priceSupply').onchange=renderPriceBars;$('#priceRadius').onchange=renderPriceBars;
const renderBeforePriceChart=render;render=function(){renderBeforePriceChart();renderRegionalPrices()};
renderRegionalPrices();

$('#search').oninput=render;$('#searchBtn').onclick=render;$('#sort').onchange=render;
