from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Load .env into the environment, so Pydantic AI also finds ANTHROPIC_API_KEY.
load_dotenv()

# How often the poller checks Gmail, in seconds. Change it here, then redeploy.
POLL_INTERVAL_SECONDS = 30


class Settings(BaseSettings):
    google_client_id: str
    google_client_secret: str
    google_refresh_token: str
    database_url: str
    classifier_model: str = "anthropic:claude-haiku-5-5"
    agent_model: str = "anthropic:claude-sonnet-5-5"
    dashboard_username: str = "admin"
    dashboard_password: str = ""


settings = Settings()
