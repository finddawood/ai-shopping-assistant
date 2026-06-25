"""
AI-Powered Shopping Assistant
Flask Backend with AI Recommendation Engine
Author: Dawood Ismail — GISMA University of Applied Sciences
"""

from flask import Flask, render_template, request, jsonify, session
import json
import os
import re
from collections import defaultdict
import math

app = Flask(__name__)
app.secret_key = "shopai-gisma-2024-dawood"

# ─────────────────────────────────────────────────────────────
# Load Product Data
# ─────────────────────────────────────────────────────────────
DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "products.json")
with open(DATA_PATH, "r") as f:
    PRODUCTS = json.load(f)


# ─────────────────────────────────────────────────────────────
# AI Recommendation Engine  (TF-IDF + Cosine Similarity)
# ─────────────────────────────────────────────────────────────
class AIRecommendationEngine:
    """
    Content-based filtering recommendation engine.
    Uses TF-IDF vectorisation and cosine similarity to match
    user preferences to products.  No external ML libraries needed.
    """

    def __init__(self, products):
        self.products = products
        self.vocab_list = []
        self.idf = {}
        self.tfidf_matrix = []
        self._build_vocabulary()
        self._compute_idf()
        self._build_tfidf_matrix()

    # ── Tokenisation ──────────────────────────────────────────
    def _tokenize(self, product):
        tokens = list(product.get("tags", []))
        tokens.append(product["category"])
        tokens += re.sub(r"[^a-z0-9\s]", "", product["name"].lower()).split()
        tokens += re.sub(r"[^a-z0-9\s]", "", product["description"].lower()).split()
        return tokens

    def _build_vocabulary(self):
        vocab = set()
        for p in self.products:
            vocab.update(self._tokenize(p))
        self.vocab_list = sorted(vocab)
        self.vocab_index = {w: i for i, w in enumerate(self.vocab_list)}

    def _compute_idf(self):
        N = len(self.products)
        doc_freq = defaultdict(int)
        for p in self.products:
            for t in set(self._tokenize(p)):
                doc_freq[t] += 1
        for w in self.vocab_list:
            self.idf[w] = math.log((N + 1) / (doc_freq.get(w, 0) + 1)) + 1

    def _tf(self, tokens):
        freq = defaultdict(int)
        for t in tokens:
            freq[t] += 1
        total = len(tokens) or 1
        return {w: c / total for w, c in freq.items()}

    def _tfidf_vector(self, tokens):
        tf = self._tf(tokens)
        return [tf.get(w, 0) * self.idf.get(w, 0) for w in self.vocab_list]

    def _build_tfidf_matrix(self):
        self.tfidf_matrix = [
            self._tfidf_vector(self._tokenize(p)) for p in self.products
        ]

    def _cosine_similarity(self, a, b):
        dot = sum(x * y for x, y in zip(a, b))
        na  = math.sqrt(sum(x * x for x in a))
        nb  = math.sqrt(sum(x * x for x in b))
        if na == 0 or nb == 0:
            return 0.0
        return dot / (na * nb)

    # ── Public methods ────────────────────────────────────────
    def get_recommendations(self, preferences, budget=None, top_n=6):
        """Return list of (product, score) tuples ranked by relevance."""
        prefs = [p for p in preferences if p.strip()]

        if not prefs:
            scored = [
                (p, p["rating"] * (1.2 if p.get("deal") else 1.0))
                for p in self.products
                if budget is None or p["price"] <= budget
            ]
            scored.sort(key=lambda x: x[1], reverse=True)
            return scored[:top_n]

        query_tokens = []
        for pref in prefs:
            query_tokens.extend(pref.lower().split())
        qvec = self._tfidf_vector(query_tokens)

        scored = []
        for i, product in enumerate(self.products):
            if budget is not None and product["price"] > budget:
                continue
            sim   = self._cosine_similarity(qvec, self.tfidf_matrix[i])
            score = sim * 0.6 + (product["rating"] / 5.0) * 0.4
            if product.get("deal"):
                score *= 1.15
            scored.append((product, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_n]

    def search_products(self, query, budget=None):
        """Full-text search with AI ranking."""
        tokens = re.sub(r"[^a-z0-9\s]", "", query.lower()).split()
        if not tokens:
            return []
        qvec = self._tfidf_vector(tokens)
        results = []
        for i, p in enumerate(self.products):
            if budget is not None and p["price"] > budget:
                continue
            sim = self._cosine_similarity(qvec, self.tfidf_matrix[i])
            if sim > 0.01:
                results.append((p, sim))
        results.sort(key=lambda x: x[1], reverse=True)
        return [p for p, _ in results]

    def get_similar_products(self, product_id, top_n=4):
        """Find products similar to a given product by vector distance."""
        idx = next((i for i, p in enumerate(self.products) if p["id"] == product_id), None)
        if idx is None:
            return []
        target = self.tfidf_matrix[idx]
        scored = [
            (p, self._cosine_similarity(target, self.tfidf_matrix[i]))
            for i, p in enumerate(self.products) if i != idx
        ]
        scored.sort(key=lambda x: x[1], reverse=True)
        return [p for p, _ in scored[:top_n]]

    def optimize_budget(self, budget, preferences=None):
        """
        Greedy budget optimisation.
        Scores ALL affordable products by a blend of:
          - TF-IDF similarity to preferences (if supplied)
          - Rating × (1 + discount) / price   (value score)
        Then greedily picks highest-scoring items that still fit.
        A per-category cap (max 2 when no preferences) prevents
        cheap books from flooding the result every time.
        """
        prefs = [p for p in (preferences or []) if p.strip()]

        if prefs:
            tokens = []
            for p in prefs:
                tokens.extend(p.lower().split())
            qvec = self._tfidf_vector(tokens)
        else:
            qvec = None

        candidates = []
        for i, product in enumerate(self.products):
            if product["price"] > budget:
                continue
            discount   = product.get("discount_percent", 0) / 100.0
            base_value = (product["rating"] * (1 + discount)) / max(product["price"], 1)

            if qvec is not None:
                sim   = self._cosine_similarity(qvec, self.tfidf_matrix[i])
                sim_n = min(sim * 2.5, 1.0)
                score = sim_n * 0.55 + base_value * 0.45
            else:
                score = base_value

            if product.get("deal"):
                score *= 1.12

            candidates.append((product, score))

        candidates.sort(key=lambda x: x[1], reverse=True)

        selected  = []
        remaining = budget
        cat_count = {}

        for product, _ in candidates:
            if product["price"] > remaining:
                continue
            cat = product["category"]
            # Without preferences: max 2 per category for variety
            if not prefs and cat_count.get(cat, 0) >= 2:
                continue
            selected.append(product)
            cat_count[cat] = cat_count.get(cat, 0) + 1
            remaining = round(remaining - product["price"], 2)
            if remaining < 1:
                break

        return selected, round(budget - remaining, 2)


# ─────────────────────────────────────────────────────────────
# Initialise engine
# ─────────────────────────────────────────────────────────────
ai_engine = AIRecommendationEngine(PRODUCTS)


# ─────────────────────────────────────────────────────────────
# Serialiser
# ─────────────────────────────────────────────────────────────
def serialize_product(p, score=None):
    d = {
        "id":               p["id"],
        "name":             p["name"],
        "category":         p["category"],
        "price":            p["price"],
        "original_price":   p["original_price"],
        "rating":           p["rating"],
        "reviews":          p["reviews"],
        "image_url":        p["image_url"],
        "tags":             p["tags"],
        "description":      p["description"],
        "in_stock":         p["in_stock"],
        "deal":             p.get("deal", False),
        "discount_percent": p.get("discount_percent", 0),
        "ai_reason":        p.get("ai_reason", ""),
    }
    if score is not None:
        d["ai_score"] = round(min(score * 100, 99))
    return d


# ─────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/products", methods=["GET"])
def get_products():
    cat = request.args.get("category", "all")
    products = PRODUCTS if cat == "all" else [p for p in PRODUCTS if p["category"] == cat]
    return jsonify([serialize_product(p) for p in products])


@app.route("/api/search", methods=["GET"])
def search():
    query  = request.args.get("q", "").strip()
    budget = request.args.get("budget", None)
    if budget:
        try:
            budget = float(budget)
        except ValueError:
            budget = None
    if not query:
        return jsonify([])
    # Track search history for session learning
    if "search_history" not in session:
        session["search_history"] = []
    session["search_history"] = (session["search_history"] + [query])[-10:]
    session.modified = True
    results = ai_engine.search_products(query, budget=budget)
    return jsonify([serialize_product(p) for p in results])


@app.route("/api/recommendations", methods=["POST"])
def recommendations():
    data        = request.get_json() or {}
    preferences = data.get("preferences", [])
    budget      = data.get("budget", None)
    # Merge explicit prefs with session-learned tags
    session_prefs = session.get("liked_categories", [])
    all_prefs     = list(set(preferences + session_prefs))
    recs = ai_engine.get_recommendations(all_prefs, budget=budget, top_n=6)
    return jsonify([serialize_product(p, score) for p, score in recs])


@app.route("/api/similar/<int:product_id>", methods=["GET"])
def similar_products(product_id):
    similar = ai_engine.get_similar_products(product_id, top_n=4)
    return jsonify([serialize_product(p) for p in similar])


@app.route("/api/budget-optimize", methods=["POST"])
def budget_optimize():
    data        = request.get_json() or {}
    preferences = data.get("preferences", [])
    budget_raw  = data.get("budget")
    try:
        budget = float(budget_raw)
    except (ValueError, TypeError):
        return jsonify({"error": "Please enter a valid numeric budget."}), 400
    if budget <= 0:
        return jsonify({"error": "Budget must be greater than €0."}), 400
    if budget > 99999:
        return jsonify({"error": "Budget must be €99,999 or less."}), 400

    selected, total_spent = ai_engine.optimize_budget(budget, preferences)
    savings = round(sum(p["original_price"] - p["price"] for p in selected), 2)
    return jsonify({
        "products":    [serialize_product(p) for p in selected],
        "total_spent": total_spent,
        "budget":      budget,
        "savings":     savings,
        "remaining":   round(budget - total_spent, 2),
    })


@app.route("/api/cart", methods=["GET", "POST", "DELETE"])
def cart():
    if "cart" not in session:
        session["cart"] = []

    if request.method == "GET":
        return jsonify(session["cart"])

    if request.method == "POST":
        data       = request.get_json() or {}
        product_id = data.get("product_id")
        product    = next((p for p in PRODUCTS if p["id"] == product_id), None)
        if not product:
            return jsonify({"error": "Product not found"}), 404
        existing = next((item for item in session["cart"] if item["id"] == product_id), None)
        if existing:
            existing["quantity"] = existing.get("quantity", 1) + 1
        else:
            item = serialize_product(product)
            item["quantity"] = 1
            session["cart"].append(item)
        # Learn preference from this add-to-cart action
        if "liked_categories" not in session:
            session["liked_categories"] = []
        combined = list(set(session["liked_categories"] + product.get("tags", [])))
        session["liked_categories"] = combined[-20:]
        session.modified = True
        return jsonify({"success": True, "cart_count": len(session["cart"])})

    if request.method == "DELETE":
        data       = request.get_json() or {}
        product_id = data.get("product_id")
        session["cart"] = [i for i in session["cart"] if i["id"] != product_id]
        session.modified = True
        return jsonify({"success": True, "cart_count": len(session["cart"])})


@app.route("/api/cart/clear", methods=["POST"])
def clear_cart():
    session["cart"] = []
    session.modified = True
    return jsonify({"success": True})


@app.route("/api/deals", methods=["GET"])
def get_deals():
    deals = sorted(
        [p for p in PRODUCTS if p.get("deal")],
        key=lambda x: x.get("discount_percent", 0),
        reverse=True
    )
    return jsonify([serialize_product(p) for p in deals])


@app.route("/api/stats", methods=["GET"])
def get_stats():
    cats  = {}
    for p in PRODUCTS:
        cats[p["category"]] = cats.get(p["category"], 0) + 1
    deals = [p for p in PRODUCTS if p.get("deal")]
    return jsonify({
        "total_products":   len(PRODUCTS),
        "total_categories": len(cats),
        "active_deals":     len(deals),
        "avg_discount":     round(sum(p.get("discount_percent", 0) for p in deals) / max(len(deals), 1), 1),
        "avg_rating":       round(sum(p["rating"] for p in PRODUCTS) / len(PRODUCTS), 2),
        "vocab_size":       len(ai_engine.vocab_list),
        "categories":       cats,
    })


@app.route("/api/checkout", methods=["POST"])
def checkout():
    """
    Simulates order placement.
    Receives delivery + payment info, validates, clears cart, returns order ref.
    In production this would integrate with a real payment processor.
    """
    import random, string
    data = request.get_json() or {}

    # Basic server-side validation
    required_delivery = ["first_name", "last_name", "email", "address", "city", "postal", "country"]
    for field in required_delivery:
        if not data.get(field, "").strip():
            return jsonify({"error": f"Missing required field: {field}"}), 400

    email = data.get("email", "")
    if "@" not in email or "." not in email:
        return jsonify({"error": "Invalid email address."}), 400

    cart_items = session.get("cart", [])
    if not cart_items:
        return jsonify({"error": "Your cart is empty."}), 400

    # Generate order reference
    ref = "SAI-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))

    # Clear cart after successful order
    session["cart"] = []
    session.modified = True

    # Calculate totals
    subtotal = round(sum(i["price"] * i.get("quantity", 1) for i in cart_items), 2)
    shipping_cost = {"standard": 0.0, "express": 9.99, "next_day": 19.99}
    shipping = data.get("shipping", "standard")
    ship_cost = shipping_cost.get(shipping, 0.0)
    total = round(subtotal + ship_cost, 2)

    return jsonify({
        "success":       True,
        "order_ref":     ref,
        "email":         email,
        "total":         total,
        "subtotal":      subtotal,
        "shipping_cost": ship_cost,
        "shipping":      shipping,
        "items":         cart_items,
        "name":          f"{data['first_name']} {data['last_name']}",
        "address":       f"{data['address']}, {data['city']}, {data['postal']}, {data['country']}",
    })


if __name__ == "__main__":
    print("=" * 50)
    print("  ShopAI — Starting Server")
    print("  Open: http://127.0.0.1:5000")
    print("=" * 50)
    app.run(debug=True, port=5000)
