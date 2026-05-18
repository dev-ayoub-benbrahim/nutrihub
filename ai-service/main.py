from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.ai import router as ai_router
from app.core.config import settings

app = FastAPI(
    title="NutriHub AI Microservice",
    description="Two-stage AI pipeline: GPT-4o meal plan generation + USDA nutritional validation",
    version="1.0.0",
)

# only accept requests from the Node.js API and the React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(ai_router)


@app.get("/")
async def root():
    return {
        "service": "NutriHub AI Microservice",
        "version": "1.0.0",
        "endpoints": [
            "POST /ai/parse-input",
            "POST /ai/generate-plan",
            "GET  /ai/health",
        ],
    }