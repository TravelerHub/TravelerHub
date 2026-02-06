from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import auth
from routers import user
from routers import routes
from routers import images
from routers import vision

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routers
app.include_router(auth.router)      # /auth
app.include_router(user.router)      # /users 
app.include_router(routes.router)    # /routes
app.include_router(images.router)    # /images
app.include_router(vision.router)    # /vision



# testing default route
@app.get("/") 
def root():
    #the data get send back to the client
    return {"message": "Hello World kinoko from TravelHub Backend!"}