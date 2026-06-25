# ✦ ShopAI — AI-Powered Shopping Assistant

> An intelligent shopping assistant built with Python (Flask) + vanilla JavaScript. Uses a custom TF-IDF recommendation engine to deliver personalised product suggestions, budget optimisation, and smart deal discovery — all without any external AI API costs.

---

## 📸 Features

| Feature | Description |
|---|---|
| 🤖 **AI Recommendations** | Custom TF-IDF + Cosine Similarity engine learns from your preferences |
| 🔍 **Smart Search** | Real-time AI-ranked search across all products |
| 💰 **Budget Optimiser** | Greedy algorithm selects best-value products within your budget |
| 🔥 **Deal Discovery** | Automatically surfaces and ranks the best active discounts |
| 🛒 **Smart Cart** | Session-based cart with quantity tracking and savings summary |
| 👤 **Preference Learning** | System learns your taste from clicks and builds a preference profile |
| 📱 **Responsive** | Works on desktop, tablet, and mobile |

---

## 🚀 Quick Start (5 minutes)

### Prerequisites
- Python 3.8 or higher
- pip (comes with Python)

### Step 1 — Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/ai-shopping-assistant.git
cd ai-shopping-assistant
```

### Step 2 — Create a Virtual Environment (Recommended)
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### Step 3 — Install Dependencies
```bash
pip install -r requirements.txt
```
> Only **Flask** is required. The AI engine uses Python's standard library only (no scikit-learn, no PyTorch).

### Step 4 — Run the Application
```bash
python app.py
```

### Step 5 — Open in Browser
```
http://127.0.0.1:5000
```

---

## 📁 Project Structure

```
ai-shopping-assistant/
│
├── app.py                  # Flask backend + AI Recommendation Engine
├── requirements.txt        # Python dependencies (Flask only)
│
├── data/
│   └── products.json       # Product catalogue (16 products, 5 categories)
│
├── templates/
│   └── index.html          # Single-page frontend template
│
└── static/
    ├── css/
    │   └── style.css       # All styling
    └── js/
        └── app.js          # Frontend logic (vanilla JS)
```

---

## 🧠 How the AI Works

The recommendation engine is built from scratch using classic NLP techniques:

### 1. TF-IDF Vectorisation
Each product is represented as a vector of term weights. Terms include product name, description, category, and tags.

```
TF(t, d)  = (occurrences of term t in document d) / (total terms in d)
IDF(t)    = log((N + 1) / (df(t) + 1)) + 1
TF-IDF    = TF × IDF
```

### 2. Cosine Similarity
User preferences are converted to the same vector space and compared against every product:

```
similarity(A, B) = (A · B) / (||A|| × ||B||)
```

### 3. Personalisation Boosting
- **Rating boost** (40% weight): Higher-rated products score higher
- **Deal boost** (15% multiplier): Active deals get a relevance bump
- **Session memory**: Liked categories persist across page navigations

### 4. Budget Optimisation
A greedy algorithm scores products by `(rating × (1 + discount)) / price` and selects items that maximise value within the user's budget.

---

## 🛠 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/products?category=all` | All products, optionally filtered |
| `GET` | `/api/search?q=query&budget=200` | AI-ranked search |
| `POST` | `/api/recommendations` | Personalised recommendations |
| `GET` | `/api/similar/:id` | Content-similar products |
| `POST` | `/api/budget-optimize` | Budget optimisation |
| `GET/POST/DELETE` | `/api/cart` | Cart management |
| `GET` | `/api/deals` | Active deals sorted by discount |

---

## 💻 Technologies Used

| Layer | Technology |
|---|---|
| Backend | Python 3, Flask |
| AI Engine | Custom TF-IDF (Python stdlib only) |
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Data | JSON flat file |
| Fonts | Google Fonts (Inter, Syne) |

---

## 📚 Adding More Products

Edit `data/products.json` and add a new object following this schema:

```json
{
  "id": 17,
  "name": "Product Name",
  "category": "electronics",
  "price": 49.99,
  "original_price": 79.99,
  "rating": 4.5,
  "reviews": 1000,
  "image_url": "https://...",
  "tags": ["tag1", "tag2"],
  "description": "Short product description.",
  "in_stock": true,
  "deal": true,
  "discount_percent": 37
}
```

Restart the server — the AI engine rebuilds its index automatically.

---

## 🎓 Academic Context

This project was developed as a Bachelor's-level assessment for the topic **"AI-Powered Shopping Recommendations"**. The implementation demonstrates:

- Applied NLP (TF-IDF, Cosine Similarity)
- RESTful API design
- Session-based personalisation
- Full-stack web development
- Software engineering best practices (separation of concerns, clean architecture)

---

## 📄 License

MIT License — free to use for academic and personal projects.
