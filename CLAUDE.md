Always use context7 when referencing any library or framework documentation.

# CLAUDE.md — TravelHub

> This file gives Claude Code full context about the TravelHub project so it can generate
> accurate, consistent, and project-aligned code every session.

---

## Project Overview

**TravelHub** is a web-based group travel planning application.
It consolidates fragmented tools into a single platform featuring:

- User authentication with JWT + OTP email verification (2FA)
- Real-time encrypted group chat (WebSocket + TweetNaCl E2E encryption)
- Interactive maps, route planning, and favorite places (Mapbox)
- Booking management (flights, hotels, cars, activities)
- Shared expense tracking and finance overview
- AI-powered receipt scanning (Gemini Vision API)
- Travel preference management and place suggestions (Google Places)
- Image upload and storage (Supabase Storage)

**Target users:** Families and friend groups planning trips together.

---

## Architecture

```
Browser (React + Vite)
    ↓  /api proxy (Vite dev)
FastAPI Backend (Python)
    ↓
Supabase (PostgreSQL + Storage + Auth)
    +
External APIs (Mapbox, Google Places, Gemini, Google AI)
```

---

## Tech Stack

### Frontend

| Tech | Version | Purpose |
|------|---------|---------|
| React | 19.x | UI framework (JSX, functional components, hooks) |
| Vite | 7.x | Dev server + bundler (`npm run dev` → localhost:5173) |
| React Router DOM | 7.x | Client-side routing |
| TailwindCSS | 4.x | Utility-first styling |
| Mapbox GL | 3.x | Maps and navigation |
| React Map GL | 8.x | React wrapper for Mapbox GL |
| @mapbox/mapbox-sdk | 0.16.x | Mapbox Directions API |
| Supabase JS | 2.x | Supabase client (auth, DB, storage) |
| TweetNaCl.js | — | E2E encryption for chat messages |
| Lottie React | 2.x | Animations |
| Heroicons React | 2.x | Icon library |
| hello-pangea/dnd | 18.x | Drag-and-drop |

> The frontend is **React (web)**, not React Native. No TypeScript — all files are `.jsx` / `.js`.

### Backend

| Tech | Version | Purpose |
|------|---------|---------|
| FastAPI | 0.116.x | Web framework + WebSocket support |
| Uvicorn | 0.35.x | ASGI server |
| SQLAlchemy | 2.x | ORM |
| Supabase Python | 2.25.x | Supabase client |
| Pydantic | 2.x | Request/response schema validation |
| python-jose / PyJWT | — | JWT access tokens |
| bcrypt + passlib | — | Password hashing |
| python-dotenv | — | Environment variable loading |
| google-generativeai | — | Gemini Vision API (receipt scanning) |
| anthropic | — | Claude API (integrated but usage TBD) |
| Pillow + PyMuPDF | — | Image and PDF processing |
| pytest + pytest-asyncio | — | Testing |

---

## Project Structure

```
TravelerHub/
├── backend/
│   ├── main.py                # FastAPI app entry point, CORS, router inclusion
│   ├── models.py              # SQLAlchemy models (currently minimal)
│   ├── schemas.py             # Pydantic schemas for all request/response types
│   ├── supabase_client.py     # Supabase client initialization
│   ├── requirements.txt
│   ├── .env                   # Backend secrets (never commit)
│   ├── routers/
│   │   ├── auth.py            # Signup, login, OTP request/verify
│   │   ├── user.py            # User CRUD, password change
│   │   ├── routes.py          # Saved trip routes
│   │   ├── booking.py         # Bookings (flights, hotels, cars, activities)
│   │   ├── chatbox.py         # WebSocket chat + E2E encryption
│   │   ├── favorites.py       # Favorite places
│   │   ├── preferences.py     # User travel preferences
│   │   ├── images.py          # Image upload to Supabase Storage
│   │   ├── vision.py          # Gemini Vision receipt analysis
│   │   └── suggestion.py      # Google Places suggestions
│   ├── utils/
│   │   ├── oauth2.py          # JWT creation and verification
│   │   ├── hasing.py          # bcrypt password hashing
│   │   ├── otp.py             # OTP generation, email sending, verification
│   │   └── encryption.py      # Server-side encryption helpers
│   └── migrations/            # DB migration files
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js         # Proxy: /api → http://localhost:8000
    ├── .env                   # Frontend secrets (never commit)
    └── src/
        ├── router.jsx         # All route definitions
        ├── app/
        │   ├── main.jsx       # React root, router provider
        │   └── pages/         # One file per page
        │       ├── Landing.jsx
        │       ├── Login.jsx
        │       ├── SignUp.jsx
        │       ├── OTP.jsx
        │       ├── ResetPassword.jsx
        │       ├── NewPassword.jsx
        │       ├── Dashboard.jsx
        │       ├── WelcomeAfterLogin.jsx
        │       ├── Navigation.jsx     # Map + route planning
        │       ├── Profile.jsx
        │       ├── Settings.jsx
        │       ├── Message.jsx        # Chat interface
        │       ├── Booking.jsx
        │       ├── Expenses.jsx
        │       ├── Finance.jsx
        │       ├── About.jsx
        │       ├── ContactUs.jsx
        │       ├── Service.jsx
        │       └── Feedback.jsx
        ├── components/
        │   ├── navbar/
        │   ├── chatbox/
        │   ├── Map.jsx
        │   ├── Calendar.jsx
        │   ├── ImageUpload.jsx
        │   ├── TravelPreferences.jsx
        │   └── Footer.jsx
        ├── services/              # Per-feature API call wrappers
        │   ├── routeService.js
        │   ├── favoritesService.js
        │   ├── preferencesService.js
        │   ├── visionService.js
        │   ├── geocodingService.js
        │   ├── googlePlacesService.js
        │   └── placesService.js
        ├── lib/
        │   ├── api.js             # Central fetch-based API client
        │   └── encryption.js      # TweetNaCl E2E encryption helpers
        └── api/
            ├── request.js
            └── bookingAPI.js
```

---

## Frontend Routes

| Path | Page | Notes |
|------|------|-------|
| `/` | Landing | Public |
| `/about` | About | Public |
| `/contactus` | ContactUs | Public |
| `/service` | Service | Public |
| `/feedback` | Feedback | Public |
| `/login` | Login | Auth |
| `/signup` | SignUp | Auth |
| `/otp` | OTP | Email OTP verification |
| `/resetpassword` | ResetPassword | Request password reset |
| `/newpassword` | NewPassword | Set new password after OTP |
| `/welcome` | WelcomeAfterLogin | Post-login redirect |
| `/dashboard` | Dashboard | Protected |
| `/navigation` | Navigation | Maps + routes, Protected |
| `/profile` | Profile | Protected |
| `/settings` | Settings | Protected |
| `/message` | Message | Chat, Protected |
| `/booking` | Booking | Protected |
| `/expenses` | Expenses | Protected |
| `/finance` | Finance | Protected |

---

## Backend API Endpoints

### Auth — `/auth`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/signup` | Register user |
| POST | `/auth/login` | Login (OAuth2 password flow, returns JWT) |
| POST | `/auth/otp` | Request OTP email |
| POST | `/auth/otp/verify` | Verify OTP code |

### Users — `/users`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/users/me` | Current user (auth required) |
| GET | `/users/` | All users |
| GET | `/users/{id}` | Get by ID |
| PUT | `/users/{id}` | Update user |
| DELETE | `/users/{id}` | Delete user |
| PATCH | `/users/password` | Change password |

### Routes — `/routes`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/routes/` | Save route |
| GET | `/routes/` | Get user's saved routes |
| DELETE | `/routes/{route_id}` | Delete route |

### Bookings — `/api/bookings`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bookings` | List trip bookings |
| GET | `/api/bookings/{booking_id}` | Get booking |
| POST | `/api/bookings` | Create booking |
| PATCH | `/api/bookings/{booking_id}` | Update booking |

### Chat — `/api`
| Method | Path | Description |
|--------|------|-------------|
| WS | `/api/ws/conversation/{id}` | WebSocket chat connection |
| POST | `/api/conversations` | Create conversation |
| GET | `/api/conversations` | List conversations |
| POST | `/api/messages` | Send message |
| GET | `/api/messages` | Get messages |

### Favorites — `/favorites`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/favorites/` | Add favorite |
| GET | `/favorites/` | List favorites |
| GET | `/favorites/{id}` | Get favorite |
| PUT | `/favorites/{id}` | Update favorite |
| DELETE | `/favorites/{id}` | Delete favorite |

### Preferences — `/preferences`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/preferences/me` | Get travel preferences |
| PUT | `/preferences/me` | Update travel preferences |

### Images — `/images`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/images/upload` | Upload image to Supabase Storage |

### Vision — `/vision`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/vision/analyze-receipt` | Analyze receipt with Gemini Vision |

### Suggestions — `/trips`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/trips/{trip_id}/suggestions` | Get place suggestions (Google Places) |

---

## Key Pydantic Schemas (`backend/schemas.py`)

- **Auth:** `SignupRequest`, `LoginRequest`, `OtpRequest`, `OtpVerifyRequest`, `TokenData`
- **User:** `UserCreate`, `UserOut`, `UserUpdate`, `PasswordChange`, `UserKeypair`
- **Chat:** `MessageCreate`, `MessageOut`, `ConversationCreate`, `ConversationOut`, `GroupMemberCreate`, `ConversationSessionKey`
- **Routes:** `LocationPoint`, `RouteCreate`, `RouteResponse`
- **Bookings:** `BookingCreate`, `BookingPatch`
- **Favorites:** `FavoriteCreate`, `FavoriteOut`, `FavoriteUpdate`
- **Preferences:** `PreferencesUpdate`, `PreferencesOut`
- **Suggestions:** `SuggestionsRequest`, `SuggestionCard`

---

## Supabase Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts |
| `user_preferences` | Per-user travel preferences |
| `user_keypair` | E2E encryption keypairs (NaCl public/private) |
| `favorites` | Saved favorite places |
| `saved_routes` | Saved trip routes with waypoints |
| `trip` | Trip records |
| `group_member` | Trip/conversation membership |
| `booking` | Bookings (flights, hotels, cars, activities) |
| `images` | Uploaded image metadata |

---

## Environment Variables

### Backend (`backend/.env`)
```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
JWT_SECRET_KEY=
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SENDER_EMAIL=
SENDER_PASSWORD=
OTP_EXPIRY_MINUTES=10
MAX_OTP_ATTEMPTS=5
GOOGLE_PLACES_API_KEY=
GOOGLE_API_KEY=
```

### Frontend (`frontend/.env`)
```env
VITE_MAPBOX_TOKEN=
```

Never hardcode secrets. Always read from `.env`. Never commit `.env` to git.

---

## Coding Standards

### Frontend (React / JSX)
- Functional components and hooks only — no class components
- Files are `.jsx` / `.js` — **no TypeScript in this project**
- Component file naming: `PascalCase.jsx`
- Service files in `src/services/` — one per feature domain
- All API calls go through `src/lib/api.js` or the relevant service file
- Styling via TailwindCSS utility classes
- Keep components focused — extract logic to custom hooks when complex
- Chat messages use TweetNaCl box encryption (`src/lib/encryption.js`)

### Backend (Python / FastAPI)
- All endpoints require JWT auth unless explicitly public
- Use Pydantic schemas for all request bodies and responses
- Dependency injection for DB sessions and current user (`oauth2.py`)
- Rate limiting and OTP lockout enforced in `utils/otp.py`
- OTP codes expire in 10 minutes, max 5 attempts before lockout
- Passwords hashed with bcrypt via passlib
- Never log sensitive data (tokens, passwords, OTP codes)

### Database
- Use Supabase client for all DB operations — no raw SQL in application code
- Row Level Security (RLS) should be enabled for user/group data isolation
- Migrations tracked in `backend/migrations/`

---

## Git Workflow

- Branch off `main` for every feature: `feature/your-feature-name`
- All changes go through Pull Requests — no direct pushes to `main`
- Commit messages: `feat: add expense split validation`, `fix: OTP expiry check`

---

## Security Rules

- JWT tokens expire in 30 minutes — refresh flow required for long sessions
- OTP: 10-minute expiry, 5-attempt lockout, sent via Gmail SMTP
- E2E chat encryption: NaCl box (TweetNaCl) — keypairs stored in `user_keypair` table
- No sensitive data in console logs or error responses
- Supabase RLS policies enforce user-scoped data access

---

## MCP Instructions

### Context7 — always use for library docs
Append `use context7` to any prompt involving external library APIs to get current, accurate documentation instead of relying on training data.

Use it for:
- React / React Router DOM
- Supabase JS client
- Mapbox GL / React Map GL / @mapbox/mapbox-sdk
- FastAPI / Uvicorn / Pydantic
- TailwindCSS
- TweetNaCl.js
- Google Generative AI / Gemini SDK
- Anthropic / Claude SDK

Example: *"Set up a Supabase realtime subscription for new messages — use context7"*

### shadcn — use for UI components
Append `use shadcn` when building UI components such as:
- Forms, modals, dialogs
- Data tables (bookings ledger, expense list)
- Cards (trip cards, booking cards)
- Navigation, tabs, dropdowns

Example: *"use shadcn — build a Dialog for adding a new booking with type, vendor, cost fields"*

### Combine both for best results
*"use context7 and use shadcn — build a finance page with a transaction table, summary cards, and a transfer dialog"*

---

## Dev Setup

```bash
# Frontend
cd frontend
npm install
npm run dev          # → http://localhost:5173

# Backend
cd backend
python3 -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload   # → http://localhost:8000
```

Vite proxies `/api` requests to `http://localhost:8000` — no CORS config needed in dev.

---

## Team

| Name | Focus |
|------|-------|
| My Lu | React frontend, Supabase |
| Fozhan Babaeiyan | React frontend, API integration |
| Isaiah Pone | UI/UX Design |
| Win Quy | Security |
| Michael Racioppi | Business, Jira |

GitHub Org: https://github.com/TravelerHub/TravelerHub
