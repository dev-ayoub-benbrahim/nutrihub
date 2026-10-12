# NutriHub — AI-Powered Social Food Discovery & Meal Planning Platform

> Final Year Project — BSc Computer Science, De Montfort University (First-Class Honours)

NutriHub is a full-stack web platform that combines AI-generated meal planning, ingredient-level nutritional validation against the USDA FoodData Central database, a social recipe community, and an expert verification system for registered nutritionists.

## Key Features

### AI Meal Planning Pipeline
- Generates a personalised daily meal plan (breakfast, lunch, dinner) using **GPT-4o-mini**
- Validates every generated ingredient against **USDA FoodData Central** using a three-tier lookup strategy — built-in table → live API → LLM fallback
- Stores both LLM estimates and USDA-validated values side-by-side to enable accuracy evaluation
- Calorie warning badges flag meals that deviate more than 25% from the per-meal target
- Individual meal swap without regenerating the full plan
- Shopping list auto-generated from the day's ingredients

### Nutritional Accuracy Evaluation (MAE Study)
- Evaluated LLM nutritional accuracy across **273 generated meal records**
- **Mean Absolute Error: 91.9 kcal/meal** for calories, **6.8g/meal** for protein (~13–15% error)
- Results consistent with Bondevik et al. (2024) — confirms USDA validation layer is necessary
- Both values stored in database from the start, making the study a natural byproduct of production use

### Social Recipe Platform
- Create and share recipes with structured ingredient data and step-by-step instructions
- Automatic macro calculation from a 130-ingredient USDA-sourced built-in nutrition table
- Per-ingredient badges: USDA validated, author estimate, or no data — full nutritional transparency
- Like, save, comment, and follow system with a notification pipeline
- Explore feed with Recent, Popular, and Trending sort modes
- Personalised For You feed combining social graph and cuisine preference filtering
- Related recipes surfaced on detail page via content-based filtering (cuisine + tags)

### Expert Verification System
- Users apply for EXPERT status by submitting profession, qualifications, and credential documents
- Admins review and approve applications through the admin panel
- Experts can add verified notes to recipes and mark community answers as verified

### Community Platform
- Create topic-based communities with a wall, members tab, and post composer
- Three post types: Question, Cooking Log, Recipe Draft
- Recipe Draft posts include an ingredient list and a "Convert to Recipe" shortcut
- Comment threads on every post with expert-verified answer badges

### Admin Dashboard
- Platform analytics: user growth, recipe counts, engagement metrics, trending content, top communities
- Content moderation: review and resolve reports with dismiss, warn, or delete actions
- Automated notification pipeline notifies both reporter and content owner on resolution
- Expert request review with credential document viewing

### TDEE Calculator
- Mifflin-St Jeor equation implemented entirely client-side
- Weight, height, and age never transmitted to any server — privacy by design
- Calorie split shown per meal: breakfast 28%, lunch 35%, dinner 37%

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 19 + Vite | UI framework and sub-second dev server |
| Tailwind CSS v4 | Utility-first styling with custom design tokens |
| React Hook Form + Zod | Zero-rerender form management and schema validation |
| Recharts | Weekly calorie tracking chart |
| React Router v6 | Client-side routing with protected routes |
| React Hot Toast | Lightweight user feedback notifications |

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express 5 | Non-blocking REST API server |
| Prisma 6 | Type-safe ORM with migration system |
| PostgreSQL | Relational database — 24 tables, 5 schema groups |
| JWT + bcrypt | Stateless authentication, cost-10 password hashing |
| Multer + Cloudinary | Memory-storage file uploads, cloud CDN image hosting |

### AI Microservice
| Technology | Purpose |
|---|---|
| Python + FastAPI | Async-native AI service |
| OpenAI SDK (GPT-4o-mini) | Daily meal plan structure generation |
| USDA FoodData Central API | Ingredient-level nutritional validation |
| asyncio | Concurrent lookups with per-call 3s timeouts |

---

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│                 │  REST   │                  │  HTTP   │                  │
│   React 19      │ ──────► │  Node.js /       │ ──────► │  Python FastAPI  │
│   Frontend      │         │  Express 5       │         │  AI Microservice │
│                 │ ◄────── │                  │ ◄────── │                  │
└─────────────────┘         └──────┬───────────┘         └──────────────────┘
                                   │                               │
                                   ▼                               ▼
                            ┌──────────────┐               ┌──────────────┐
                            │  PostgreSQL  │               │  OpenAI API  │
                            │  (Prisma)    │               │  USDA API    │
                            └──────────────┘               └──────────────┘
```

### AI Pipeline — Four Stages

```
Stage 1 — Prompt Assembly
  Goal + calorie target + allergies + preferences → structured prompt
  Calorie split hardcoded: Breakfast 28% · Lunch 35% · Dinner 37%
  Allergies injected as hard safety constraints

Stage 2 — GPT-4o-mini Generation
  response_format: json_object enforces structured output
  Truncation detected via finish_reason === "length" or missing closing brace
  Three-tier JSON recovery: direct parse → bracket suffix → character-level extraction

Stage 3 — USDA Three-Tier Validation (per ingredient)
  Tier 1: Built-in table (~130 ingredients, <1ms, no network)
  Tier 2: Live USDA FoodData Central API (asyncio 3s timeout)
  Tier 3: LLM estimate fallback
  Both LLM value and USDA value stored in DB → enables MAE study

Stage 4 — Warning Evaluation
  Per-meal calorie deviation checked against target
  >25% deviation → amber warning badge returned to frontend
```

---

## Database Schema

24 tables across 5 groups:

| Group | Tables |
|---|---|
| Users & Auth | users, follows, notifications |
| Recipes & Ingredients | recipes, recipe_ingredients, recipe_steps, recipe_tags, ingredients |
| Social | likes, saves, comments, reports |
| AI & Meal Planning | meal_plans, meals, meal_ingredients, meal_logs |
| Communities | community, community_members, community_posts, community_post_comments, community_recipes, expert_requests, expert_notes, verified_answers |

Key constraints: `@@unique([userId, recipeId])` on Like and Save, `@@unique([userId, mealId])` on MealLog, `onDelete: Cascade` throughout to maintain referential integrity on account deletion.

---

## API Overview

48 REST endpoints across 8 route groups:

```
/api/auth          — Register, login, profile management, password change
/api/recipes       — CRUD, ingredient-level USDA annotation, macro auto-calculation
/api/social        — Likes, saves, comments, follows, meal logging, weekly nutrition
/api/meal-plans    — Generate, swap, fetch, delete, history
/api/notifications — Unread count, mark read
/api/reports       — User content report submission
/api/communities   — Community CRUD, posts, expert verification, member management
/api/admin         — Analytics, report moderation, expert approvals, user role management
```

---

## Security

- **bcrypt** (cost factor 10) — computationally expensive brute-force resistance
- **JWT** (24h expiry) — stateless, verified on every protected request, works across microservices without shared session store
- **Role-based access control** — USER / EXPERT / ADMIN enforced at middleware and controller level
- **Owner-or-admin checks** on all modification operations — prevents horizontal privilege escalation
- **Prisma ORM** — parameterised queries, SQL injection structurally impossible
- **Multer** — 5MB file size limit, memoryStorage (files never written to disk), piped to Cloudinary
- **CORS** scoped to the frontend origin only
- **TDEE calculator** runs client-side — biometric data never leaves the browser
- **API keys** (OpenAI, USDA) isolated in Python microservice — never exposed to the frontend or Node.js layer
- **asyncio timeouts** — all external API calls time out at 3 seconds, preventing denial-of-service via hanging requests
- **Prompt injection prevention** — prompt built server-side from validated structured inputs, not raw user text

---

## Getting Started

### Prerequisites

```
Node.js v22+
Python 3.11+
PostgreSQL 16+
```

### 1. Clone the repository

```bash
git clone https://github.com/dev-ayoub-benbrahim/nutrihub.git
cd nutrihub
```

### 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET, CLOUDINARY_*, AI_SERVICE_URL
npx prisma migrate dev
npm run dev
```

### 3. AI Microservice setup

```bash
cd ai-service
python -m venv env
source env/bin/activate        # Windows: env\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Fill in OPENAI_API_KEY, USDA_API_KEY
uvicorn main:app --reload --port 8000
```

### 4. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
# Fill in VITE_API_URL=http://localhost:5000
npm run dev
```

### Environment Variables

**Backend `.env`**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/nutrihub
JWT_SECRET=your_jwt_secret_here
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
AI_SERVICE_URL=http://localhost:8000
```

**AI Service `.env`**
```env
OPENAI_API_KEY=sk-...
USDA_API_KEY=your_usda_key_here
```

---

## Project Structure

```
nutrihub/
├── frontend/                  # React 19 + Vite
│   └── src/
│       ├── components/        # Shared UI — ConfirmModal, ReportModal, ReportActionModal
│       │   ├── layout/        # Navbar, Footer, Sidebar
│       │   ├── recipes/       # RecipeCard, RecipeList
│       │   └── ui/            # Button, Input, etc.
│       ├── pages/             # Route-level page components
│       │   ├── MealPlanner/   # MealPlannerPage — TDEE, generation, logging
│       │   ├── Recipes/       # RecipeDetails, EditRecipePage
│       │   ├── AddRecipe/     # AddRecipePage — manual + USDA nutrition
│       │   ├── Dashboard/     # Profile, EditProfilePage, weekly chart
│       │   ├── Community/     # CommunityDetailPage — wall, posts, members
│       │   └── Admin/         # AdminPage — reports, analytics, expert requests
│       ├── hooks/             # useAuth
│       ├── context/           # AuthContext
│       └── utils/             # axios instance, helpers
│
├── backend/                   # Node.js + Express 5
│   ├── controllers/           # Business logic per domain
│   ├── routes/                # Express routers (8 route groups)
│   ├── middleware/            # protect, restrictTo, error handling
│   ├── lib/                   # Prisma client, aiService caller
│   └── prisma/
│       └── schema.prisma      # 24-table schema with cascade rules
│
└── ai-service/                # Python FastAPI
    └── app/
        ├── routers/           # FastAPI route handlers
        ├── services/
        │   └── llm.py         # GPT-4o-mini pipeline, USDA validation, JSON recovery
        ├── models/
        │   └── schemas.py     # Pydantic request/response models
        └── core/
            └── config.py      # Environment config
```

---

## Functional Requirements

All 20 functional requirements implemented and verified:

| Area | Requirements | Status |
|---|---|---|
| Authentication & Onboarding | FR01–FR05 | ✅ Complete |
| Recipe Management | FR06–FR11 | ✅ Complete |
| Social Features | FR12–FR15 | ✅ Complete |
| AI Meal Planning | FR16–FR19 | ✅ Complete |
| Nutrition Logging | FR20 | ✅ Complete |

Additional features beyond the original contract: meal swap, shopping list, community platform, expert verification system, admin analytics, content moderation with automated notifications.

---

## MAE Evaluation Results

The system stores both LLM-generated nutritional estimates and USDA-validated values for every ingredient from the start, making the accuracy study a natural byproduct of production use.

| Metric | Result |
|---|---|
| Sample size | 273 meal records |
| MAE — Calories | **91.9 kcal per meal** |
| MAE — Protein | **6.8g per meal** |
| Average error rate | ~13–15% per meal |
| Literature benchmark | Bondevik et al. (2024): 15–20% |

These results confirm that raw LLM nutritional estimates cannot be reliably shown to users managing a calorie deficit, which validates the architectural decision to build the USDA validation layer into the pipeline.

To run the evaluation yourself:

```sql
-- Overall MAE
SELECT
  COUNT(*) AS total_meals,
  ROUND(AVG(ABS(llm_calories - total_calories))::numeric, 1) AS mae_calories_kcal,
  ROUND(AVG(ABS(llm_protein_g - total_protein_g))::numeric, 1) AS mae_protein_g,
  ROUND(AVG(ABS(llm_calories - total_calories) / NULLIF(total_calories, 0) * 100)::numeric, 1) AS mae_pct
FROM meals
WHERE llm_calories > 0 AND total_calories > 0;

-- By meal type
SELECT meal_type, COUNT(*),
  ROUND(AVG(ABS(llm_calories - total_calories))::numeric, 1) AS mae_kcal,
  ROUND(AVG(ABS(llm_protein_g - total_protein_g))::numeric, 1) AS mae_protein
FROM meals
WHERE llm_calories > 0 AND total_calories > 0
GROUP BY meal_type ORDER BY meal_type;
```

---

## Design System

Custom forest green palette designed to evoke health, nature, and freshness — avoiding the clinical aesthetic common to health apps.

| Token | Hex | Usage |
|---|---|---|
| forest (darkest) | `#1A2E1E` | Page background |
| forest2 | `#213B26` | Card backgrounds |
| forest3 | `#2A4A30` | Nested elements |
| sage | `#4A7C59` | Primary interactive |
| sage-l | `#8AAB94` | Secondary text |
| gold | `#C8A84B` | Calorie figures, accents |
| cream | `#EDE8D8` | Body text |

All colours defined as Tailwind design tokens — changing one value updates the entire system. Components reference semantic names (`text-cream`, `bg-forest2`, `border-sage`) rather than hardcoded hex values.

---

## Key Academic References

- **Trattner & Elsweiler (2017)** — Recipe platforms optimise for engagement, not nutrition — the primary gap NutriHub addresses
- **Bondevik et al. (2024)** — LLM nutritional estimates deviate 15–20% from verified values — directly confirmed by the MAE study
- **Plaatão et al. (2022)** — Poor retention in calorie tracking apps due to manual logging burden — motivates the AI generation approach
- **USDA FoodData Central (2019)** — Authoritative nutritional database used for validation and the built-in ingredient table

---

## Author

**Ayoub Ben Brahim**
BSc Computer Science — De Montfort University (First-Class Honours)

- GitHub: [dev-ayoub-benbrahim](https://github.com/dev-ayoub-benbrahim)
- LinkedIn: [ayoub-ben-brahim-846aa6387](https://linkedin.com/in/ayoub-ben-brahim-846aa6387)

---

## Acknowledgements

Supervised by Qadri Mishael, De Montfort University.
Nutritional data provided by [USDA FoodData Central](https://fdc.nal.usda.gov/).
