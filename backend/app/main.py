import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import APP_TITLE, APP_VERSION, APP_DESCRIPTION, DISCLAIMER_TEXT
from .database import init_db
from .routes import records, chain, sync, export, images, auth_routes

EVIDENCE_IMAGES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "evidence_images")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create evidence directory if it doesn't exist
    os.makedirs(EVIDENCE_IMAGES_DIR, exist_ok=True)
    # Initialize SQLite database schema on startup
    init_db()
    yield


app = FastAPI(
    title=APP_TITLE,
    version=APP_VERSION,
    description=APP_DESCRIPTION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Enable CORS for local development and mobile client integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(auth_routes.router)
app.include_router(records.router)
app.include_router(chain.router)
app.include_router(sync.router)
app.include_router(export.router)
app.include_router(images.router)


from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

@app.get("/", tags=["Root"])
def root():
    return {
        "service": APP_TITLE,
        "version": APP_VERSION,
        "status": "operational",
        "docs": "/docs",
        "dashboard": "/dashboard/",
        "disclaimer": DISCLAIMER_TEXT,
    }

@app.get("/health", tags=["Root"])
def health_check():
    return {
        "status": "healthy",
        "timestamp": True,
    }

# Mount the static directory for the Lab Web Dashboard
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/dashboard", StaticFiles(directory=STATIC_DIR, html=True), name="dashboard")
