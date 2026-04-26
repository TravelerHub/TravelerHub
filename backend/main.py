import os
import time
import logging
import traceback
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

logger = logging.getLogger("travelhub")

from routers import auth
from routers import user
from routers import routes
from routers import images
from routers import vision
from routers import preferences
from routers import favorites
from routers import booking
from routers import bookings as bookings_search

from routers import chatbox
from routers import groups
from routers import navigation
from routers import checklists
from routers import calendar
from routers import ai_chat
from routers import discovery
from routers import smart_route
from routers import nominations
from routers import polls
from routers import finance
from routers import settlements
from routers import billing
from routers import gcs
from routers import weather
from routers import gallery
from routers import map_pins
from routers import activity
from routers import trip_todos
from routers import media_comments
from routers import cards
from routers import suggestion
from routers import story
from routers import search
from routers import invites
from routers import export as export_router
from routers import notifications
from routers import push
from routers import currency
from routers import trip_wrapup

limiter = Limiter(key_func=get_remote_address)
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all handler: log every unhandled exception with structured context."""
    logger.error(
        "Unhandled exception",
        extra={
            "method": request.method,
            "path": request.url.path,
            "error": str(exc),
            "traceback": traceback.format_exc(),
        },
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

_cors_env = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,https://travelhub.fozhan.dev",
)
_allowed_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    ms = round((time.time() - start) * 1000)
    print(f"{request.method} {request.url.path} → {response.status_code} ({ms}ms)")
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routers
app.include_router(auth.router)           # /auth
app.include_router(user.router)           # /users 
app.include_router(routes.router)         # /routes
app.include_router(images.router)         # /images
app.include_router(vision.router)         # /vision
app.include_router(preferences.router)    # /preferences
app.include_router(favorites.router)      # /favorites
app.include_router(chatbox.router)        # /api (chatbox routes)
app.include_router(bookings_search.router)  # /api/bookings/hotels|cars|attractions (Booking.com API — must be before booking.router)
app.include_router(booking.router)        # /api/bookings (CRUD)
app.include_router(groups.router)         # /groups
app.include_router(navigation.router)     # /navigation
app.include_router(checklists.router)    # /checklists
app.include_router(calendar.router)      # /calendar
app.include_router(ai_chat.router)       # /ai-chat
app.include_router(discovery.router)     # /discovery
app.include_router(smart_route.router)   # /smart-route
app.include_router(nominations.router)   # /nominations
app.include_router(polls.router)         # /polls
app.include_router(finance.router)       # /finance
app.include_router(settlements.router)   # /finance (splitting & settlements)
app.include_router(billing.router)       # /billing
app.include_router(gcs.router)           # /gcs (Group-Centric Search)
app.include_router(weather.router)       # /weather
app.include_router(gallery.router)       # /trips/{trip_id}/media|upload (gallery)
app.include_router(map_pins.router)      # /map-pins (shared collaborative map annotations)
app.include_router(activity.router)      # /activity (social activity feed)
app.include_router(trip_todos.router)    # /todos (group-synced trip todos)
app.include_router(media_comments.router)  # /media-comments (photo comments)
app.include_router(cards.router)           # /cards (credit card optimizer)
app.include_router(cards.budget_router)    # /finance/budget (trip budgets)
app.include_router(suggestion.router)     # /suggestions (POI ranking)
app.include_router(story.router)          # /trips/{trip_id}/story (shareable timeline)
app.include_router(story.public_router)   # /public/story/{token} (no-auth public story)
app.include_router(search.router)         # /search (global search across trips, expenses, photos)
app.include_router(invites.router)        # /groups/invite/* (invite links)
app.include_router(export_router.router)  # /export (iCal, CSV, JSON summary)
app.include_router(notifications.router)  # /notifications
app.include_router(push.router)            # /push (web push subscriptions)
app.include_router(currency.router)       # /api/currency (exchange rates)
app.include_router(trip_wrapup.router)    # /trips/{trip_id}/wrapup-data|complete



# testing default route
@app.get("/")
def root():
    #the data get send back to the client
    return {"message": "Hello World kinoko from TravelHub Backend!"}

@app.get("/health")
def health():
    from supabase_client import supabase
    db_ok = False
    db_error = None
    try:
        supabase.table("users").select("id").limit(1).execute()
        db_ok = True
    except Exception as e:
        db_error = str(e)
        logger.warning("Health check DB ping failed: %s", e)

    if not db_ok:
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", "db": "unreachable", "detail": db_error},
        )
    return {"status": "ok", "db": "reachable"}