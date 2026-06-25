/* ═══════════════════════════════════════════════════════════
   ShopAI — Frontend Application
   Author: Dawood Ismail, GISMA University of Applied Sciences
   ═══════════════════════════════════════════════════════════ */

const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);
const EUR = (n) => `€${Number(n).toFixed(2)}`;

// ─── STATE ─────────────────────────────────────────────────
const State = {
  selectedPrefs: new Set(),
  activeSection: "home",
  cart: [],
  lastRecs: [],
  currentSort: "ai",
  payMethod: "card",
  checkoutStep: 1,
};

// ─── API ───────────────────────────────────────────────────
const api = {
  async get(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  },
  async post(url, data) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || `HTTP ${r.status}`);
    }
    return r.json();
  },
  async del(url, data) {
    const r = await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  },
};

// ─── TOAST ─────────────────────────────────────────────────
function showToast(msg, type = "") {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast show" + (type ? ` ${type}` : "");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = "toast"; }, 3000);
}

// ─── AI BAR ────────────────────────────────────────────────
function showAIBar(text) {
  $("aiBar").style.display = "flex";
  $("aiBarText").textContent = text;
}
function hideAIBar() {
  setTimeout(() => { $("aiBar").style.display = "none"; }, 700);
}

// ─── NAVIGATION ────────────────────────────────────────────
function setSection(sec) {
  State.activeSection = sec;
  const map = {
    home:   ["homeSection", "productsSection"],
    deals:  ["dealsSection"],
    budget: ["budgetSection"],
    how:    ["howSection"],
    cart:   ["cartSection"],
  };
  ["homeSection","productsSection","dealsSection","budgetSection","howSection","cartSection"]
    .forEach(id => { const el = $(id); if (el) el.style.display = "none"; });
  (map[sec] || []).forEach(id => { const el = $(id); if (el) el.style.display = "block"; });
  $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.section === sec));
  if (sec === "deals") loadDeals();
  if (sec === "cart")  renderCart();
}

// ─── STARS ─────────────────────────────────────────────────
function stars(r) {
  return "★".repeat(Math.floor(r)) + (r - Math.floor(r) >= 0.5 ? "½" : "");
}

// ─── SORT ──────────────────────────────────────────────────
function sortProducts(products, key) {
  const arr = [...products];
  if (key === "price_asc")  arr.sort((a, b) => a.price - b.price);
  if (key === "price_desc") arr.sort((a, b) => b.price - a.price);
  if (key === "rating")     arr.sort((a, b) => b.rating - a.rating);
  if (key === "discount")   arr.sort((a, b) => b.discount_percent - a.discount_percent);
  return arr;
}

// ─── PRODUCT CARD ──────────────────────────────────────────
function productCard(p) {
  const hasDiscount = p.original_price > p.price;
  const cartItem = State.cart.find(c => c.id === p.id);
  const inQty = cartItem ? (cartItem.quantity || 1) : 0;
  const addLabel = inQty > 0 ? `In Cart (${inQty})` : "Add to Cart";
  const safeName = p.name.replace(/"/g, "&quot;");
  const dealBadge = p.deal ? `<span class="card-deal-badge">-${p.discount_percent}% OFF</span>` : "";
  const aiBadge = p.ai_score != null ? `<span class="card-ai-badge">AI ${p.ai_score}% match</span>` : "";
  const aiNote = p.ai_reason
    ? `<div class="card-ai-note"><span class="card-ai-note-icon">✦</span><span>${p.ai_reason}</span></div>` : "";

  return `
    <div class="product-card" onclick="openModal(${p.id})">
      <div class="card-badges">${dealBadge}${aiBadge}</div>
      <div class="card-img-wrap">
        <img src="${p.image_url}" alt="${safeName}" loading="lazy"
             onerror="this.src='https://placehold.co/400x400/161622/7c6dff?text=Product'" />
      </div>
      <div class="card-body">
        <div class="card-category">${p.category}</div>
        <div class="card-name">${p.name}</div>
        ${aiNote}
        <div class="card-meta">
          <span class="card-rating">${stars(p.rating)} ${p.rating}</span>
          <span class="card-reviews">(${p.reviews.toLocaleString()})</span>
        </div>
        <div class="card-pricing">
          <span class="card-price">${EUR(p.price)}</span>
          ${hasDiscount ? `<span class="card-original">${EUR(p.original_price)}</span>` : ""}
          ${hasDiscount ? `<span class="card-discount">-${p.discount_percent}%</span>` : ""}
        </div>
        <div class="card-footer" onclick="event.stopPropagation()">
          <button class="btn-sm btn-add" onclick="addToCart(${p.id})">${addLabel}</button>
        </div>
      </div>
    </div>`;
}

function showSkeletons(id, n = 8) {
  const el = $(id);
  if (el) el.innerHTML = Array(n).fill(`<div class="skeleton"></div>`).join("");
}

// ─── PRODUCT CACHE ─────────────────────────────────────────
let _cache = [];
async function getById(id) {
  if (!_cache.length) _cache = await api.get("/api/products");
  return _cache.find(p => p.id === id) || null;
}
function invalidateCache() { _cache = []; }

// ─── RENDER GRID ───────────────────────────────────────────
function renderProductGrid(gridId, products) {
  const grid = $(gridId);
  if (!grid) return;
  const empty = gridId === "productGrid" ? $("emptyState") : null;
  if (!products || products.length === 0) {
    grid.innerHTML = "";
    if (empty) empty.style.display = "block";
    return;
  }
  if (empty) empty.style.display = "none";
  grid.innerHTML = products.map(productCard).join("");
}

// ─── AI INSIGHT PANEL ──────────────────────────────────────
function showInsightPanel(prefs, budget, count) {
  const panel = $("aiInsightPanel");
  if (!panel) return;
  panel.style.display = "flex";
  $("aiInsightTitle").textContent = prefs.length
    ? `AI matched ${count} products to: ${prefs.slice(0, 4).join(", ")}${prefs.length > 4 ? "…" : ""}`
    : `Showing top ${count} products by quality & value`;
  $("aiInsightText").textContent = "Ranked using TF-IDF cosine similarity · rating boost · deal multiplier";
  const pills = [];
  if (prefs.length) pills.push(`<span class="insight-badge">✦ ${prefs.length} preference${prefs.length > 1 ? "s" : ""}</span>`);
  if (budget) pills.push(`<span class="insight-badge green">€ Budget: ${EUR(budget)}</span>`);
  pills.push(`<span class="insight-badge">${count} results</span>`);
  $("aiInsightBadges").innerHTML = pills.join("");
}

function hideInsightPanel() {
  const p = $("aiInsightPanel");
  if (p) p.style.display = "none";
}

// ─── RECOMMENDATIONS ───────────────────────────────────────
async function loadRecommendations() {
  const prefs  = [...State.selectedPrefs];
  const budget = parseFloat($("budgetInput").value) || null;
  showSkeletons("productGrid");
  showAIBar("AI engine computing TF-IDF similarity scores…");
  try {
    const data = await api.post("/api/recommendations", { preferences: prefs, budget });
    State.lastRecs = data;
    State.currentSort = "ai";
    if ($("sortFilter")) $("sortFilter").value = "ai";
    if ($("categoryFilter")) $("categoryFilter").value = "all";
    $("sectionTitle").textContent = prefs.length ? "Recommended For You" : "Top Picks Right Now";
    $("sectionSub").textContent = prefs.length
      ? `Based on: ${prefs.join(", ")}${budget ? ` · Budget: ${EUR(budget)}` : ""}`
      : "Best-rated products across all categories";
    showInsightPanel(prefs, budget, data.length);
    renderProductGrid("productGrid", data);
  } catch (e) {
    showToast("Could not load recommendations. Is the server running?", "error");
    $("productGrid").innerHTML = "";
  } finally {
    hideAIBar();
  }
}

// ─── SEARCH ────────────────────────────────────────────────
let _searchTimer;
function handleSearch(q) {
  clearTimeout(_searchTimer);
  $("searchClear").style.display = q ? "block" : "none";
  if (!q.trim()) { loadRecommendations(); return; }
  _searchTimer = setTimeout(async () => {
    const budget = parseFloat($("budgetInput").value) || null;
    const params = new URLSearchParams({ q });
    if (budget) params.set("budget", budget);
    showSkeletons("productGrid");
    showAIBar(`Searching for "${q}"…`);
    try {
      const data = await api.get(`/api/search?${params}`);
      State.lastRecs = data;
      State.currentSort = "ai";
      if ($("sortFilter")) $("sortFilter").value = "ai";
      if ($("categoryFilter")) $("categoryFilter").value = "all";
      $("sectionTitle").textContent = `Results for "${q}"`;
      $("sectionSub").textContent = `${data.length} product${data.length !== 1 ? "s" : ""} found`;
      if (data.length) {
        showInsightPanel([], budget, data.length);
        $("aiInsightTitle").textContent = `AI found ${data.length} results for "${q}"`;
        $("aiInsightText").textContent = "Ranked by TF-IDF text relevance to your query";
      } else {
        hideInsightPanel();
      }
      renderProductGrid("productGrid", data);
    } catch (e) {
      showToast("Search failed.", "error");
    } finally {
      hideAIBar();
    }
  }, 380);
}

// ─── CATEGORY FILTER ───────────────────────────────────────
async function filterByCategory(cat) {
  $("searchInput").value = "";
  $("searchClear").style.display = "none";
  clearTimeout(_searchTimer);
  hideInsightPanel();
  showSkeletons("productGrid");
  try {
    const data = await api.get(`/api/products?category=${encodeURIComponent(cat)}`);
    State.lastRecs = data;
    $("sectionTitle").textContent = cat === "all"
      ? "All Products"
      : cat.charAt(0).toUpperCase() + cat.slice(1);
    $("sectionSub").textContent = `${data.length} product${data.length !== 1 ? "s" : ""}`;
    renderProductGrid("productGrid", sortProducts(data, State.currentSort));
  } catch (e) {
    showToast("Could not load products.", "error");
  }
}

function handleSortChange(key) {
  State.currentSort = key;
  if (State.lastRecs.length) renderProductGrid("productGrid", sortProducts(State.lastRecs, key));
}

// ─── DEALS ─────────────────────────────────────────────────
async function loadDeals() {
  showSkeletons("dealsGrid", 6);
  try {
    const data = await api.get("/api/deals");
    const meta = $("dealsMeta");
    if (meta && data.length) {
      const avg = Math.round(data.reduce((s, d) => s + d.discount_percent, 0) / data.length);
      meta.innerHTML = `<div class="deals-meta-stat">${avg}%</div><div class="deals-meta-lbl">avg discount</div>`;
    }
    renderProductGrid("dealsGrid", data);
  } catch (e) {
    showToast("Could not load deals.", "error");
  }
}

// ─── BUDGET OPTIMISER ──────────────────────────────────────
async function optimiseBudget() {
  const raw    = $("budgetOptInput").value.trim();
  const budget = parseFloat(raw);
  const prefs  = ($("budgetPrefsInput").value.trim())
    .split(",").map(s => s.trim()).filter(Boolean);

  if (!raw || isNaN(budget) || budget <= 0) { showToast("Enter a valid budget greater than €0.", "error"); return; }
  if (budget > 99999) { showToast("Budget must be €99,999 or less.", "error"); return; }

  const btn = $("optimiseBudgetBtn");
  btn.textContent = "⟳  Optimising…"; btn.disabled = true;
  showAIBar("AI computing best value combination within your budget…");

  try {
    const data = await api.post("/api/budget-optimize", { budget, preferences: prefs });
    $("budgetResults").style.display = "block";
    $("budgetSummary").innerHTML = `
      <div class="budget-stat"><div class="budget-stat-label">Budget</div><div class="budget-stat-value">${EUR(data.budget)}</div></div>
      <div class="budget-stat"><div class="budget-stat-label">Spent</div><div class="budget-stat-value accent">${EUR(data.total_spent)}</div></div>
      <div class="budget-stat"><div class="budget-stat-label">Remaining</div><div class="budget-stat-value">${EUR(data.remaining)}</div></div>
      <div class="budget-stat"><div class="budget-stat-label">You Save</div><div class="budget-stat-value green">${EUR(data.savings)}</div></div>`;
    if (data.products && data.products.length) {
      renderProductGrid("budgetGrid", data.products);
      showToast(`AI picked ${data.products.length} products — saves you ${EUR(data.savings)}!`, "success");
    } else {
      $("budgetGrid").innerHTML = `<p style="color:var(--text-2);padding:20px 0">No products fit within this budget. Try a higher amount.</p>`;
    }
    $("budgetResults").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    showToast(e.message || "Optimisation failed.", "error");
  } finally {
    btn.textContent = "✦  Optimise My Budget"; btn.disabled = false;
    hideAIBar();
  }
}

// ─── CART ──────────────────────────────────────────────────
async function addToCart(productId) {
  try {
    const data = await api.post("/api/cart", { product_id: productId });
    if (data.success) {
      await syncCart();
      invalidateCache();
      showToast("Added to cart ✓", "success");
      bumpBadge();
      if (State.activeSection === "home") {
        const q = $("searchInput").value.trim();
        if (!q) loadRecommendations(); else handleSearch(q);
      } else if (State.activeSection === "deals") {
        loadDeals();
      }
    }
  } catch (e) { showToast("Could not add to cart.", "error"); }
}

async function removeFromCart(productId) {
  try {
    await api.del("/api/cart", { product_id: productId });
    await syncCart(); invalidateCache(); renderCart();
    showToast("Removed from cart.");
  } catch (e) { showToast("Could not remove item.", "error"); }
}

async function clearCart() {
  if (!State.cart.length) return;
  try {
    await api.post("/api/cart/clear", {});
    await syncCart(); invalidateCache(); renderCart();
    showToast("Cart cleared.");
  } catch (e) { showToast("Could not clear cart.", "error"); }
}

async function syncCart() {
  try {
    State.cart = await api.get("/api/cart");
    const total = State.cart.reduce((s, i) => s + (i.quantity || 1), 0);
    $("cartBadge").textContent = total;
  } catch (_) {}
}

function bumpBadge() {
  const b = $("cartBadge");
  b.classList.add("bump");
  setTimeout(() => b.classList.remove("bump"), 300);
}

function renderCart() {
  const items    = State.cart;
  const container = $("cartItems");
  const empty    = $("cartEmpty");
  const footer   = $("cartFooter");
  const sub      = $("cartSubtitle");
  const total    = items.reduce((s, i) => s + (i.quantity || 1), 0);
  sub.textContent = `${total} item${total !== 1 ? "s" : ""}`;

  if (!items.length) {
    container.innerHTML = ""; empty.style.display = "block"; footer.style.display = "none"; return;
  }
  empty.style.display = "none"; footer.style.display = "block";

  container.innerHTML = items.map(item => `
    <div class="cart-item">
      <img class="cart-item-img" src="${item.image_url}" alt="${item.name.replace(/"/g, "&quot;")}"
           onerror="this.src='https://placehold.co/88x88/161622/7c6dff?text=?'" />
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-cat">${item.category}</div>
        <div class="cart-item-price">${EUR(item.price)}<span class="cart-item-qty">× ${item.quantity || 1}</span></div>
      </div>
      <div class="cart-item-actions">
        <button class="btn-sm btn-remove" onclick="removeFromCart(${item.id})">Remove</button>
      </div>
    </div>`).join("");

  const subtotal = items.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
  const savings  = items.reduce((s, i) => s + (i.original_price - i.price) * (i.quantity || 1), 0);
  $("cartSubtotal").textContent = EUR(subtotal);
  $("cartSavings").textContent  = EUR(savings);
  $("cartTotal").textContent    = EUR(subtotal);
}

// ─── PRODUCT MODAL ─────────────────────────────────────────
async function openModal(productId) {
  $("modalBody").innerHTML = `<div style="padding:80px;text-align:center;color:var(--text-2);grid-column:1/-1">Loading…</div>`;
  $("modalSimilar").innerHTML = "";
  $("modalOverlay").style.display = "flex";
  document.body.style.overflow = "hidden";

  let product;
  try { product = await getById(productId); }
  catch (e) { closeModal(); showToast("Could not load product.", "error"); return; }
  if (!product) { closeModal(); showToast("Product not found.", "error"); return; }

  const hasDiscount = product.original_price > product.price;
  const saveAmt = hasDiscount ? (product.original_price - product.price).toFixed(2) : 0;
  const cartItem = State.cart.find(c => c.id === product.id);
  const addLabel = cartItem ? `In Cart (${cartItem.quantity || 1})` : "Add to Cart";
  const safe = product.name.replace(/"/g, "&quot;");

  const aiBox = product.ai_reason ? `
    <div class="modal-ai-box">
      <span class="modal-ai-box-icon">✦</span>
      <div class="modal-ai-box-text"><strong>AI Recommendation Reason</strong>${product.ai_reason}</div>
    </div>` : "";

  const scoreHtml = product.ai_score != null
    ? `<span style="font-size:12px;color:var(--accent);font-weight:700;background:var(--accent-dim);padding:3px 10px;border-radius:100px;margin-left:8px">AI ${product.ai_score}% match</span>` : "";

  $("modalBody").innerHTML = `
    <img class="modal-img" src="${product.image_url}" alt="${safe}"
         onerror="this.src='https://placehold.co/400x400/161622/7c6dff?text=Product'" />
    <div class="modal-info">
      <div class="modal-category">${product.category}${scoreHtml}</div>
      <div class="modal-name">${product.name}</div>
      <div class="modal-desc">${product.description}</div>
      ${aiBox}
      <div class="modal-price-row">
        <span class="modal-price">${EUR(product.price)}</span>
        ${hasDiscount ? `<span class="modal-original">${EUR(product.original_price)}</span><span class="modal-save">Save ${EUR(saveAmt)}</span>` : ""}
      </div>
      <div class="modal-rating">
        <strong>${stars(product.rating)} ${product.rating}</strong>
        <span>${product.reviews.toLocaleString()} reviews</span>
      </div>
      <div class="modal-tags">${product.tags.map(t => `<span class="modal-tag">${t}</span>`).join("")}</div>
      <button class="btn-primary" onclick="addToCart(${product.id}); closeModal();">${addLabel}</button>
    </div>`;

  try {
    const similar = await api.get(`/api/similar/${productId}`);
    if (similar && similar.length) {
      $("modalSimilar").innerHTML = `
        <h3>You Might Also Like</h3>
        <div class="similar-grid">
          ${similar.map(s => `
            <div class="similar-card" onclick="closeModal(); setTimeout(()=>openModal(${s.id}),200)">
              <img src="${s.image_url}" alt="${s.name.replace(/"/g,"&quot;")}"
                   onerror="this.src='https://placehold.co/100x100/161622/7c6dff?text=?'" />
              <div class="similar-card-name">${s.name}</div>
              <div class="similar-card-price">${EUR(s.price)}</div>
            </div>`).join("")}
        </div>`;
    }
  } catch (_) {}
}

function closeModal() {
  $("modalOverlay").style.display = "none";
  document.body.style.overflow = "";
}

// ═══════════════════════════════════════════════════════════
// CHECKOUT
// ═══════════════════════════════════════════════════════════

function getShippingCost() {
  const sel = document.querySelector('input[name="shipping"]:checked');
  const val = sel ? sel.value : "standard";
  return val === "express" ? 9.99 : val === "next_day" ? 19.99 : 0;
}

function openCheckout() {
  if (!State.cart.length) { showToast("Your cart is empty!", "error"); return; }
  State.checkoutStep = 1;
  updateCheckoutSteps(1);
  showPanel(1);
  $("checkoutOverlay").style.display = "flex";
  document.body.style.overflow = "hidden";
  // Reset pay method to card
  setPayMethod("card");
}

function closeCheckout() {
  $("checkoutOverlay").style.display = "none";
  document.body.style.overflow = "";
}

function showPanel(n) {
  [1, 2, 3, 4].forEach(i => {
    const p = $(`coPanel${i}`);
    if (p) p.style.display = i === n ? "block" : "none";
  });
}

function updateCheckoutSteps(current) {
  [1, 2, 3].forEach(i => {
    const dot = $(`coStepDot${i}`);
    if (!dot) return;
    dot.classList.remove("active", "done");
    if (i < current) dot.classList.add("done");
    else if (i === current) dot.classList.add("active");
  });
  // Update lines
  for (let i = 1; i <= 2; i++) {
    const line = $(`coLine${i}`);
    if (line) line.classList.toggle("done", i < current);
  }
}

// ── Step 1: Delivery validation ────────────────────────────
function validateDelivery() {
  const fields = [
    { id: "coFirstName", errId: "errFirstName", label: "First name" },
    { id: "coLastName",  errId: "errLastName",  label: "Last name" },
    { id: "coEmail",     errId: "errEmail",     label: "Email", type: "email" },
    { id: "coAddress",   errId: "errAddress",   label: "Address" },
    { id: "coCity",      errId: "errCity",      label: "City" },
    { id: "coPostal",    errId: "errPostal",    label: "Postal code" },
  ];
  let valid = true;
  fields.forEach(({ id, errId, label, type }) => {
    const inp = $(id);
    const err = $(errId);
    const val = inp ? inp.value.trim() : "";
    inp && inp.classList.remove("error");
    if (err) err.textContent = "";
    if (!val) {
      valid = false;
      if (inp) inp.classList.add("error");
      if (err) err.textContent = `${label} is required.`;
    } else if (type === "email" && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val))) {
      valid = false;
      inp.classList.add("error");
      if (err) err.textContent = "Enter a valid email address.";
    }
  });
  return valid;
}

// ── Step 2: Payment validation ─────────────────────────────
function validatePayment() {
  if (State.payMethod !== "card") return true; // PayPal/Klarna — no local validation
  const fields = [
    { id: "coCardName", errId: "errCardName", label: "Cardholder name" },
    { id: "coCardNum",  errId: "errCardNum",  label: "Card number",  type: "card" },
    { id: "coExpiry",   errId: "errExpiry",   label: "Expiry date",  type: "expiry" },
    { id: "coCVV",      errId: "errCVV",      label: "CVV",          type: "cvv" },
  ];
  let valid = true;
  fields.forEach(({ id, errId, label, type }) => {
    const inp = $(id);
    const err = $(errId);
    const val = inp ? inp.value.trim() : "";
    inp && inp.classList.remove("error");
    if (err) err.textContent = "";
    if (!val) {
      valid = false;
      if (inp) inp.classList.add("error");
      if (err) err.textContent = `${label} is required.`;
      return;
    }
    if (type === "card") {
      const digits = val.replace(/\s/g, "");
      if (!/^\d{13,19}$/.test(digits)) {
        valid = false; inp.classList.add("error");
        if (err) err.textContent = "Enter a valid card number (13–19 digits).";
      }
    }
    if (type === "expiry") {
      if (!/^\d{2}\s*\/\s*\d{2}$/.test(val)) {
        valid = false; inp.classList.add("error");
        if (err) err.textContent = "Use MM / YY format.";
      }
    }
    if (type === "cvv") {
      if (!/^\d{3,4}$/.test(val)) {
        valid = false; inp.classList.add("error");
        if (err) err.textContent = "CVV must be 3 or 4 digits.";
      }
    }
  });
  return valid;
}

// ── Build review summary ───────────────────────────────────
function buildReviewSummary() {
  const items = State.cart;
  const subtotal  = items.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
  const savings   = items.reduce((s, i) => s + (i.original_price - i.price) * (i.quantity || 1), 0);
  const shipCost  = getShippingCost();
  const total     = subtotal + shipCost;
  const shippingLabel = document.querySelector('input[name="shipping"]:checked')?.value || "standard";
  const shippingNames = { standard: "Standard (Free)", express: "Express (€9.99)", next_day: "Next Day (€19.99)" };
  const payLabel  = State.payMethod === "card" ? "Credit / Debit Card" : State.payMethod === "paypal" ? "PayPal" : "Klarna (Pay in 3)";
  const maskCard  = State.payMethod === "card" ? (" •••• " + (($("coCardNum")?.value || "").replace(/\s/g,"").slice(-4) || "????")) : "";

  const itemsHtml = items.map(i => `
    <div class="co-summary-item">
      <img src="${i.image_url}" onerror="this.src='https://placehold.co/44x44/161622/7c6dff?text=?'" />
      <span class="co-summary-item-name">${i.name} × ${i.quantity || 1}</span>
      <span class="co-summary-item-price">${EUR(i.price * (i.quantity || 1))}</span>
    </div>`).join("");

  $("coSummary").innerHTML = `
    <div class="co-summary-section">
      <div class="co-summary-section-title">Delivery To</div>
      <div class="co-summary-row"><span>Name</span><strong>${$("coFirstName")?.value || ""} ${$("coLastName")?.value || ""}</strong></div>
      <div class="co-summary-row"><span>Email</span><strong>${$("coEmail")?.value || ""}</strong></div>
      <div class="co-summary-row"><span>Address</span><strong>${$("coAddress")?.value || ""}, ${$("coCity")?.value || ""}, ${$("coPostal")?.value || ""}</strong></div>
      <div class="co-summary-row"><span>Shipping</span><strong>${shippingNames[shippingLabel]}</strong></div>
    </div>
    <div class="co-summary-section">
      <div class="co-summary-section-title">Payment</div>
      <div class="co-summary-row"><span>Method</span><strong>${payLabel}${maskCard}</strong></div>
    </div>
    <div class="co-summary-section">
      <div class="co-summary-section-title">Order Items</div>
      <div class="co-summary-items">${itemsHtml}</div>
    </div>
    <div class="co-summary-section">
      <div class="co-total-row"><span>Subtotal</span><span>${EUR(subtotal)}</span></div>
      <div class="co-total-row savings"><span>You Save</span><span style="color:var(--green)">-${EUR(savings)}</span></div>
      ${shipCost > 0 ? `<div class="co-total-row"><span>Shipping</span><span>${EUR(shipCost)}</span></div>` : ""}
      <div class="co-total-row"><span><strong>Total</strong></span><span><strong style="color:var(--accent)">${EUR(total)}</strong></span></div>
    </div>`;
}

// ── Step navigation ────────────────────────────────────────
function coGoStep(n) {
  if (n === 2) {
    if (!validateDelivery()) { showToast("Please fill in all required fields.", "error"); return; }
  }
  if (n === 3) {
    if (!validatePayment()) { showToast("Please check your payment details.", "error"); return; }
    buildReviewSummary();
  }
  State.checkoutStep = n;
  updateCheckoutSteps(n);
  showPanel(n);
  // Scroll checkout modal to top
  const modal = document.querySelector(".checkout-modal");
  if (modal) modal.scrollTop = 0;
}

// ── Place order ────────────────────────────────────────────
async function placeOrder() {
  const btn = $("coPlaceBtn");
  btn.textContent = "⟳  Processing…"; btn.disabled = true;

  const shippingVal = document.querySelector('input[name="shipping"]:checked')?.value || "standard";

  const payload = {
    first_name: $("coFirstName")?.value.trim() || "",
    last_name:  $("coLastName")?.value.trim()  || "",
    email:      $("coEmail")?.value.trim()      || "",
    phone:      $("coPhone")?.value.trim()      || "",
    address:    $("coAddress")?.value.trim()    || "",
    city:       $("coCity")?.value.trim()       || "",
    postal:     $("coPostal")?.value.trim()     || "",
    country:    $("coCountry")?.value           || "DE",
    shipping:   shippingVal,
    pay_method: State.payMethod,
  };

  try {
    const data = await api.post("/api/checkout", payload);

    // Populate success screen
    $("coSuccessEmail").textContent  = data.email;
    $("coOrderRef").textContent      = data.order_ref;

    const itemsHtml = (data.items || []).map(i => `
      <div class="co-summary-item" style="margin-bottom:8px">
        <img src="${i.image_url}" style="width:40px;height:40px;border-radius:6px;object-fit:cover"
             onerror="this.src='https://placehold.co/40x40/161622/7c6dff?text=?'" />
        <span class="co-summary-item-name">${i.name} × ${i.quantity || 1}</span>
        <span class="co-summary-item-price">${EUR(i.price * (i.quantity || 1))}</span>
      </div>`).join("");
    $("coSuccessItems").innerHTML = itemsHtml;
    $("coSuccessTotal").innerHTML = `<span>Total Charged</span><span>${EUR(data.total)}</span>`;

    // Clear local cart state
    State.cart = [];
    $("cartBadge").textContent = 0;
    invalidateCache();

    // Show success panel
    updateCheckoutSteps(4);
    showPanel(4);

  } catch (e) {
    showToast(e.message || "Order failed. Please try again.", "error");
  } finally {
    btn.textContent = "Place Order"; btn.disabled = false;
  }
}

// ── Pay method toggle ──────────────────────────────────────
function setPayMethod(method) {
  State.payMethod = method;
  ["card","paypal","klarna"].forEach(m => {
    const tab = $(`tab${m.charAt(0).toUpperCase() + m.slice(1)}`);
    const panel = $(`pay${m.charAt(0).toUpperCase() + m.slice(1)}`);
    if (tab) tab.classList.toggle("active", m === method);
    if (panel) panel.style.display = m === method ? "block" : "none";
  });
  // Populate Klarna instalment amounts
  if (method === "klarna") {
    const subtotal = State.cart.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
    const inst = (subtotal / 3).toFixed(2);
    const pills = $("klarnaPills");
    if (pills) pills.innerHTML = [1,2,3].map(n =>
      `<div class="co-klarna-pill">Instalment ${n}<br><strong>${EUR(inst)}</strong></div>`
    ).join("");
  }
}

// ── Card number formatting ─────────────────────────────────
function formatCardNumber(e) {
  let v = e.target.value.replace(/\D/g, "").slice(0, 16);
  e.target.value = v.replace(/(.{4})/g, "$1  ").trim();
  // Detect card type
  const first = v[0];
  $("badgeVisa")  && ($("badgeVisa").classList.toggle("faded",  first !== "4"));
  $("badgeMC")    && ($("badgeMC").classList.toggle("faded",    !["5","2"].includes(first)));
  $("badgeAmex")  && ($("badgeAmex").classList.toggle("faded",  first !== "3"));
}

function formatExpiry(e) {
  let v = e.target.value.replace(/\D/g, "").slice(0, 4);
  if (v.length >= 3) v = v.slice(0, 2) + " / " + v.slice(2);
  e.target.value = v;
}

function formatCVV(e) {
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
}

// ─── LIVE DEMO (How It Works) ──────────────────────────────
let _demoTimer;
function handleDemoInput(q) {
  clearTimeout(_demoTimer);
  const results = $("demoResults");
  if (!q.trim()) { results.innerHTML = ""; return; }
  _demoTimer = setTimeout(async () => {
    try {
      const data = await api.get(`/api/search?q=${encodeURIComponent(q)}`);
      if (!data.length) {
        results.innerHTML = `<p style="color:var(--text-3);font-size:13px">No matches for this query.</p>`;
        return;
      }
      results.innerHTML = data.slice(0, 5).map((p, i) => `
        <div class="demo-result-row">
          <div class="demo-result-rank">${i + 1}</div>
          <div class="demo-result-name">${p.name}</div>
          <div class="demo-score-bar">
            <div class="demo-score-track"><div class="demo-score-fill" style="width:${Math.round(p.rating / 5 * 100)}%"></div></div>
            <div class="demo-score-pct">⭐ ${p.rating} · ${EUR(p.price)}</div>
          </div>
        </div>`).join("");
    } catch (_) {}
  }, 380);
}

// ─── STATS ─────────────────────────────────────────────────
async function loadStats() {
  try {
    const s = await api.get("/api/stats");
    if ($("statProducts")) $("statProducts").textContent = s.total_products;
    if ($("statVocab"))    $("statVocab").textContent    = s.vocab_size.toLocaleString();
    if ($("statDeals"))    $("statDeals").textContent    = s.active_deals;
    if ($("statCats"))     $("statCats").textContent     = s.total_categories;
    if ($("statRating"))   $("statRating").textContent   = s.avg_rating + "★";
    if ($("vocabCount"))   $("vocabCount").textContent   = s.vocab_size.toLocaleString();
  } catch (_) {}
}

// ─── PREF CHIPS ────────────────────────────────────────────
function toggleChip(chip) {
  const pref = chip.dataset.pref;
  if (State.selectedPrefs.has(pref)) {
    State.selectedPrefs.delete(pref); chip.classList.remove("selected");
  } else {
    State.selectedPrefs.add(pref); chip.classList.add("selected");
  }
}

// ─── INIT ──────────────────────────────────────────────────
function init() {
  // Navigation
  $$(".nav-btn").forEach(b => b.addEventListener("click", () => setSection(b.dataset.section)));

  // Preference chips
  $$(".chip").forEach(c => c.addEventListener("click", () => toggleChip(c)));

  // Search
  $("searchInput").addEventListener("input", e => handleSearch(e.target.value));
  $("searchClear").addEventListener("click", () => {
    $("searchInput").value = ""; $("searchClear").style.display = "none";
    clearTimeout(_searchTimer); loadRecommendations();
  });

  // Filters
  $("categoryFilter").addEventListener("change", e => filterByCategory(e.target.value));
  $("sortFilter").addEventListener("change", e => handleSortChange(e.target.value));

  // CTA
  $("getRecsBtn").addEventListener("click", () => {
    const q = $("searchInput").value.trim();
    if (q) handleSearch(q); else loadRecommendations();
    $("productsSection").scrollIntoView({ behavior: "smooth" });
  });

  // Budget optimiser
  $("optimiseBudgetBtn").addEventListener("click", optimiseBudget);
  $("budgetOptInput").addEventListener("keydown", e => { if (e.key === "Enter") optimiseBudget(); });

  // Cart
  $("clearCartBtn").addEventListener("click", clearCart);

  // Product modal
  $("modalClose").addEventListener("click", closeModal);
  $("modalOverlay").addEventListener("click", e => { if (e.target === $("modalOverlay")) closeModal(); });

  // Checkout button
  $("checkoutBtn").addEventListener("click", openCheckout);

  // Checkout cancel / close  (backdrop click closes too)
  $("coCancelBtn").addEventListener("click", closeCheckout);
  $("checkoutOverlay").addEventListener("click", e => {
    if (e.target === $("checkoutOverlay")) closeCheckout();
  });

  // Checkout step buttons
  $("coStep1NextBtn").addEventListener("click", () => coGoStep(2));
  $("coStep2BackBtn").addEventListener("click", () => coGoStep(1));
  $("coStep2NextBtn").addEventListener("click", () => coGoStep(3));
  $("coStep3BackBtn").addEventListener("click", () => coGoStep(2));
  $("coPlaceBtn").addEventListener("click", placeOrder);

  // After success: back to shop
  $("coBackToShopBtn").addEventListener("click", () => {
    closeCheckout();
    renderCart();
    setSection("home");
  });

  // Payment tabs
  $("tabCard").addEventListener("click",   () => setPayMethod("card"));
  $("tabPaypal").addEventListener("click", () => setPayMethod("paypal"));
  $("tabKlarna").addEventListener("click", () => setPayMethod("klarna"));

  // Card formatting
  const cardNumEl = $("coCardNum");
  if (cardNumEl) cardNumEl.addEventListener("input", formatCardNumber);
  const expiryEl = $("coExpiry");
  if (expiryEl) expiryEl.addEventListener("input", formatExpiry);
  const cvvEl = $("coCVV");
  if (cvvEl) cvvEl.addEventListener("input", formatCVV);

  // How it works demo
  const demoInput = $("demoInput");
  if (demoInput) demoInput.addEventListener("input", e => handleDemoInput(e.target.value));

  // Escape key closes any open modal
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closeModal(); closeCheckout(); }
  });

  // Boot: load stats → warm cache → sync cart → load initial recs
  loadStats();
  syncCart()
    .then(() => api.get("/api/products"))
    .then(data => { _cache = data; })
    .catch(() => {})
    .finally(() => loadRecommendations());
}

document.addEventListener("DOMContentLoaded", init);
