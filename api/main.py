from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from games.borderstrife.api.routes import router as borderstrife_router

app = FastAPI(title="Web Game Factory API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(borderstrife_router)


@app.get("/")
async def root():
    return {"message": "Web Game Factory API"}


@app.get("/health")
async def health():
    return {"status": "ok"}
