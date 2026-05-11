from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import completeness_router, metadata_router

app = FastAPI(
    title="VKG Profiling Backend",
    description="Backend API for completeness profiling of a Virtual Knowledge Graph.",
    version="0.1.0",
)

origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}


app.include_router(metadata_router.router)
app.include_router(completeness_router.router)
