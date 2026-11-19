const isConfigReady = () => {
  const url = window.AMOURA_SUPABASE_URL || "";
  const key = window.AMOURA_SUPABASE_PUBLISHABLE_KEY || "";
  return !!url && !!key && !/PASTE_|YOUR_/.test(url) && !/PASTE_|YOUR_/.test(key);
};

const supabaseClient = window.supabase.createClient(
  window.AMOURA_SUPABASE_URL,
  window.AMOURA_SUPABASE_PUBLISHABLE_KEY
);
let products = [];
let cart = JSON.parse(localStorage.getItem("amouraCart") || "[]");
let settings = JSON.parse(localStorage.getItem("amouraSettings") || '{"font":"\'Playfair Display\', serif","palette":"blush","phone1":"","phone2":"","email":"","boardEnabled":false}');
let pins = JSON.parse(localStorage.getItem("amouraPins") || "[]");
let searchTerm = "", sortMode = "featured";
const $ = id => document.getElementById(id);
const money = v => Number(v || 0).toLocaleString("en-PH",{style:"currency",currency:"PHP"});
const escapeHTML = (v="") => String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function showToast(message) {
  const el=$("toast"); if(!el)return; el.textContent=message; el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),2800);
}
function applySettings() {
  document.documentElement.style.setProperty("--font",settings.font||"'Playfair Display', serif");
  document.body.style.fontFamily=settings.font||"'Playfair Display', serif";
  const palettes={blush:["#f5dfe2","#d9aeb4","#eee7df","#fbf9f6"],rose:["#ead4d4","#c99da2","#f2e9e3","#fcf9f6"],cream:["#eee7df","#c8b8a7","#e9dfd3","#faf7f1"]};
  (palettes[settings.palette]||palettes.blush).forEach((v,i)=>document.documentElement.style.setProperty(["--pink","--pink-deep","--beige","--cream"][i],v));
}
function saveCart(){localStorage.setItem("amouraCart",JSON.stringify(cart))}
function renderProducts(){
  const grid=$("productGrid"); if(!grid)return;
  let shown=products.filter(p=>`${p.name} ${p.description||""}`.toLowerCase().includes(searchTerm));
  if(sortMode==="price-low")shown.sort((a,b)=>a.price-b.price);
  if(sortMode==="price-high")shown.sort((a,b)=>b.price-a.price);
  if(sortMode==="name")shown.sort((a,b)=>a.name.localeCompare(b.name));
  grid.innerHTML=shown.map(p=>`<article class="product-card"><div class="product-image">${p.image_url?`<img loading="lazy" src="${escapeHTML(p.image_url)}" alt="${escapeHTML(p.name)}">`:"♡"}<span class="handmade-tag">HANDMADE</span></div><div class="product-info"><h3>${escapeHTML(p.name)}</h3><p>${escapeHTML(p.description||"A lovely handmade piece from AMOURA.")}</p><div class="product-bottom"><span class="product-price">${money(p.price)}</span><button class="small-button" data-add="${escapeHTML(p.id)}">Add to cart</button></div></div></article>`).join("");
  $("emptyProducts").hidden=products.length!==0;
  $("resultsNote").textContent=products.length?`${shown.length} ${shown.length===1?"piece":"pieces"} to explore`:"";
  if(products.length&&!shown.length)grid.innerHTML='<p class="muted no-results">No pieces match your search. Try another keyword.</p>';
}
function renderCart(){
  $("cartItems").innerHTML=cart.length?cart.map(i=>`<div class="cart-row"><strong>${escapeHTML(i.name)}</strong><div class="qty-tools"><button data-qty="${escapeHTML(i.id)}" data-change="-1">−</button><span>${i.quantity}</span><button data-qty="${escapeHTML(i.id)}" data-change="1">+</button></div><div>${money(i.price*i.quantity)} <button class="remove-button" data-remove="${escapeHTML(i.id)}">Remove</button></div></div>`).join(""):'<p class="muted">Your bag is waiting for something lovely.</p>';
  $("cartTotal").textContent=money(cart.reduce((s,i)=>s+i.price*i.quantity,0));
  $("cartCount").textContent=cart.reduce((s,i)=>s+i.quantity,0);saveCart();
}
function renderContact(){
  const entries=[settings.phone1,settings.phone2,settings.email].filter(Boolean);
  $("contactNumbers").innerHTML=entries.length?entries.map(v=>`<span>${escapeHTML(v)}</span>`).join(""):"<span>Contact details coming soon.</span>";
}
function renderPins(){
  $("pinboard").hidden=!settings.boardEnabled;$("pinboardNav").hidden=!settings.boardEnabled;
  $("pinboardGrid").innerHTML=pins.map(p=>`<article class="pin-card"><img src="${p.image}" alt="${escapeHTML(p.title)}"><p>${escapeHTML(p.title)}</p></article>`).join("");
}
$("productGrid").addEventListener("click",e=>{
  const b=e.target.closest("[data-add]");if(!b)return;
  const p=products.find(x=>x.id===b.dataset.add);if(!p)return;
  const found=cart.find(x=>x.id===p.id);if(found)found.quantity++;else cart.push({id:p.id,name:p.name,price:Number(p.price),quantity:1});
  renderCart();showToast(`${p.name} added to your cart ♡`);
});
$("cartItems").addEventListener("click",e=>{
  const q=e.target.closest("[data-qty]"),r=e.target.closest("[data-remove]");
  if(q){const item=cart.find(x=>x.id===q.dataset.qty);if(item)item.quantity+=Number(q.dataset.change);cart=cart.filter(x=>x.quantity>0);renderCart()}
  if(r){cart=cart.filter(x=>x.id!==r.dataset.remove);renderCart()}
});

const checkoutForm = $("checkoutForm");

checkoutForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (!cart.length) {
    return alert("Your shopping cart is empty.");
  }

  const btn = checkoutForm.querySelector('[type="submit"]');

  btn.disabled = true;
  btn.textContent = "Sending order…";

  try {
    const f = new FormData(checkoutForm);

    const order = {
      id: "AM-" + Date.now().toString().slice(-8),
      customer_name: f.get("customerName").trim(),
      phone: f.get("phone").trim(),
      email: f.get("email").trim(),
      address: f.get("address").trim(),
      notes: f.get("notes").trim(),
      items: cart.map(i => ({ ...i })),
      total: cart.reduce((s, i) => s + i.price * i.quantity, 0),
      status: "New"
    };

    const { error } = await supabaseClient
      .from("orders")
      .insert(order);

    if (error) throw error;

    cart = [];
    renderCart();

    // Reset the actual checkout form directly.
    checkoutForm.reset();

    showToast("Thank you! Your order has been sent to AMOURA ♡");

  } catch (err) {
    console.error("AMOURA checkout error:", err);

    alert(
      "We couldn't submit your order. Please try again. Check the Console for the exact error."
    );

  } finally {
    btn.disabled = false;
    btn.textContent = "Place order";
  }
});

$("productSort").addEventListener("change",e=>{sortMode=e.target.value;renderProducts()});
async function init(){
  applySettings();renderCart();renderContact();renderPins();$("year").textContent=new Date().getFullYear();
  if(!isConfigReady()){
    $("emptyProducts").hidden=false;
    $("emptyProducts").textContent="Store setup is not finished yet. Update config.js with your Supabase URL and publishable key.";
    return;
  }
  const {data,error}=await supabaseClient.from("products").select("*").order("created_at",{ascending:false});
  if(error){console.error(error);$("emptyProducts").hidden=false;$("emptyProducts").textContent="Products could not load. Please try again later.";return;}
  products=data||[];renderProducts();
}
init();
