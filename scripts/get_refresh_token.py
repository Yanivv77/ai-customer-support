import sys
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]
SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPTS_DIR.parent

# Accept the file as downloaded from Google (client_secret_*.json) or renamed.
candidates = [
    ROOT_DIR / "credentials.json",
    *sorted(SCRIPTS_DIR.glob("client_secret*.json")),
    *sorted(ROOT_DIR.glob("client_secret*.json")),
]
CREDENTIALS_FILE = next((p for p in candidates if p.exists()), None)

if CREDENTIALS_FILE is None:
    sys.exit(
        "No OAuth client file found. Download the client JSON (Desktop app) from "
        "Google Cloud Console -> APIs & Services -> Credentials, and save it as "
        "credentials.json in the project root or as client_secret*.json in scripts/."
    )

flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_FILE), SCOPES)

# prompt="consent" makes Google return a refresh token every time.
creds = flow.run_local_server(port=0, access_type="offline", prompt="consent")

print(f"GOOGLE_CLIENT_ID={creds.client_id}")
print(f"GOOGLE_CLIENT_SECRET={creds.client_secret}")
print(f"GOOGLE_REFRESH_TOKEN={creds.refresh_token}")
