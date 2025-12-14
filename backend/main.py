from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import auth
from routers import user
from routers import images
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
app.include_router(user.router)      # /users (or whatever you set)
app.include_router(images.router)



# testing default route
@app.get("/") 
def root():
    #the data get send back to the client
    return {"message": "Hello World kinoko from TravelHub Backend!"}