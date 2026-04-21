import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

app = FastAPI()

_cors_env = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
_allowed_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]

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



# testing default route
@app.get("/") 
def root():
    #the data get send back to the client
    return {"message": "Hello World kinoko from TravelHub Backend!"}