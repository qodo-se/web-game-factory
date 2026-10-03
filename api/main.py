from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from games.imperium.api.routes import router as imperium_router

app = FastAPI(title="Web Game Factory API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(imperium_router)


@app.get("/")
async def root():
    return {"message": "Web Game Factory API"}


@app.get("/health")
async def health():
    return {"status": "ok"}
