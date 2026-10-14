// Product aliases are matched independently of the interface language.
const supplyAliases=[
 ['tomato',['tomato','tomatoes','tamatar','tamaatar','tamato','tomatoe','टमाटर','टमाटरें','टमाटर चाहिए','टोमॅटो','टोमाटो','தக்காளி','தக்காளிகள்','thakkali','takkali','టమోటా','టమాటా','టమోటాలు']],
 ['onion',['onion','onions','pyaz','pyaaz','kanda','प्याज','प्याज़','कांदा','कांदे','வெங்காயம்','வெங்காயங்கள்','vengayam','ఉల్లిపాయ','ఉల్లిపాయలు','ullipaya']],
 ['potato',['potato','potatoes','aloo','aalu','batata','आलू','बटाटा','बटाटे','உருளைக்கிழங்கு','urulaikizhangu','బంగాళాదుంప','బంగాళాదుంపలు']],
 ['rice',['rice','chawal','chaaval','tandul','arisi','biyyam','चावल','तांदूळ','அரிசி','బియ్యం']],
 ['banana',['banana','bananas','kela','kele','केला','केले','केळी','வாழைப்பழம்','வாழைப்பழங்கள்','అరటి','అరటిపండు','అరటిపండ్లు']],
 ['lemon',['lemon','lemons','nimbu','limbu','नींबू','नीबू','लिंबू','எலுமிச்சை','నిమ్మ','నిమ్మకాయ']],
 ['toor dal',['toor dal','tur dal','तूर दाल','तूर डाळ','துவரம் பருப்பு','కందిపప్పు']],
 ['wheat flour',['wheat flour','atta','aata','आटा','गव्हाचे पीठ','கோதுமை மாவு','గోధుమ పిండి']],
 ['sugar',['sugar','cheeni','chini','sakhar','चीनी','साखर','சர்க்கரை','చక్కెర']],
 ['turmeric',['turmeric','haldi','हल्दी','हळद','மஞ்சள்','పసుపు']],
 ['chilli powder',['chilli powder','chili powder','mirch powder','मिर्च पाउडर','लाल तिखट','மிளகாய் தூள்','కారం పొడి']],
 ['salt',['salt','namak','नमक','मीठ','உப்பு','ఉప్పు']],
 ['oil',['oil','sunflower oil','cooking oil','तेल','सूरजमुखी तेल','सूर्यफूल तेल','எண்ணெய்','నూనె']],
 ['milk',['milk','doodh','dudh','दूध','பால்','పాలు']],
 ['eggs',['egg','eggs','anda','ande','अंडा','अंडे','अंडी','முட்டை','முட்டைகள்','గుడ్డు','గుడ్లు']],
 ['bread',['bread','ब्रेड','पाव','ரொட்டி','బ్రెడ్']],
 ['biscuits',['biscuit','biscuits','बिस्कुट','बिस्किट','பிஸ்கட்','బిస్కెట్లు']],
 ['tea powder',['tea','tea powder','chai','chaha','चाय','चहा','தேயிலை','தேநீர்','టీ']],
 ['bottled water',['water','bottled water','pani','पानी','पाणी','தண்ணீர்','నీరు']],
 ['paper cups',['paper cup','paper cups','पेपर कप','காகிதக் குவளைகள்','పేపర్ కప్పులు']],
 ['takeaway containers',['takeaway containers','food containers','फ़ूड डिब्बे','खाद्यपदार्थांचे डबे','உணவுப் பெட்டிகள்','ఆహార డబ్బాలు']],
 ['paper bags',['paper bag','paper bags','पेपर बैग','कागदी पिशव्या','காகிதப் பைகள்','పేపర్ సంచులు']],
 ['dishwashing',['dishwashing','dishwashing liquid','बर्तन धोने','भांडी धुण्याचा','பாத்திரம் கழுவும்','పాత్రలు కడిగే']],
 ['cleaning cloths',['cleaning cloth','cleaning cloths','सफ़ाई के कपड़े','स्वच्छतेचे कापड','சுத்தம் செய்யும் துணிகள்','శుభ్రపరిచే వస్త్రాలు']]
];
function normalizeSupplyText(s){return String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim()}
function containsSupplyPhrase(text,phrase){const t=normalizeSupplyText(text),p=normalizeSupplyText(phrase);return p&&(' '+t+' ').includes(' '+p+' ')}
function resolveSupplyName(text){const matches=[];for(const [canonical,aliases]of supplyAliases)for(const alias of aliases)if(containsSupplyPhrase(text,alias))matches.push({canonical,length:normalizeSupplyText(alias).length});matches.sort((a,b)=>b.length-a.length);return matches[0]?.canonical||null}
function matchesSupply(product,query){const q=normalizeSupplyText(query);if(!q)return true;const canonical=resolveSupplyName(q);if(canonical)return normalizeSupplyText(product.name).includes(canonical)||resolveSupplyName(product.name+' '+(product.keywords||''))===canonical;const haystack=normalizeSupplyText([product.name,product.keywords,product.category,product.supplier].join(' '));if(haystack.includes(q))return true;return q.split(' ').every(word=>haystack.includes(word))}
if(typeof module!=='undefined')module.exports={normalizeSupplyText,containsSupplyPhrase,resolveSupplyName,matchesSupply};
