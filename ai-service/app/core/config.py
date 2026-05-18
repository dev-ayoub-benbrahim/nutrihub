from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    OPENAI_API_KEY: str
    USDA_API_KEY: str = "DEMO_KEY"   # DEMO_KEY works for low-volume dev usage
    NODE_API_URL: str = "http://localhost:5000"
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()