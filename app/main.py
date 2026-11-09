import secrets
import time
from pathlib import Path

from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app import db
from app.ai.decide import decide_traced
from app.config import settings
from app.gmail import ESCALATED_LABEL, Gmail
from app.poller import poll_once

app = FastAPI(title="AI customer support")
security = HTTPBasic(auto_error=False)


def require_login(credentials: HTTPBasicCredentials | None = Depends(security)) -> None:
    valid = (
        credentials is not None
        and settings.dashboard_password != ""
        and secrets.compare_digest(credentials.username.encode(), settings.dashboard_username.encode())
        and secrets.compare_digest(credentials.password.encode(), settings.dashboard_password.encode())
    )
    if not valid:
        raise HTTPException(status_code=401, detail="Wrong username or password")


class EntryUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=20_000)


class NewEntry(EntryUpdate):
    section: str = Field(min_length=1, max_length=60, pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")


class TrialEmail(BaseModel):
    subject: str = Field(default="", max_length=200)
    body: str = Field(min_length=1, max_length=10_000)
    has_attachments: bool = False


class Reply(BaseModel):
    body: str = Field(min_length=1, max_length=10_000)
    resolve: bool = False


TicketStatus = Literal["open", "answered", "escalated", "resolved"]


def find_ticket(ticket_id: int) -> dict:
    ticket = db.get_ticket(ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


def is_mock(ticket: dict) -> bool:
    """Rows from scripts/seed_mock_data.py have no Gmail thread, so nothing is sent for them."""
    return ticket["gmail_thread_id"].startswith("mock-")


def set_escalated_label(ticket: dict, present: bool) -> None:
    if is_mock(ticket):
        return
    try:
        Gmail().set_thread_label(ticket["gmail_thread_id"], ESCALATED_LABEL, present)
    except Exception as error:
        raise gmail_failed(error) from error


def gmail_failed(error: Exception) -> HTTPException:
    return HTTPException(status_code=502, detail=f"Gmail did not accept this: {error}")


api = APIRouter(prefix="/api", dependencies=[Depends(require_login)])


@api.get("/login")
def login() -> dict:
    return {"ok": True}


@api.get("/events")
def events(limit: int = Query(100, ge=1, le=500)) -> list[dict]:
    return db.list_events(limit)


@api.get("/stats")
def stats(tz: str = "UTC") -> dict:
    try:
        ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(status_code=400, detail="Unknown time zone") from None
    return db.stats(tz)


@api.get("/tickets")
def tickets(
    status: TicketStatus | None = None,
    q: str = Query("", max_length=200),
    limit: int = Query(50, ge=1, le=500),
) -> dict:
    return db.list_tickets(status, q.strip(), limit)


@api.get("/tickets/{ticket_id}")
def ticket(ticket_id: int) -> dict:
    return find_ticket(ticket_id)


@api.get("/tickets/{ticket_id}/messages")
def ticket_messages(ticket_id: int) -> list[dict]:
    return db.list_messages(ticket_id)


@api.post("/tickets/{ticket_id}/reply")
def reply_to_ticket(ticket_id: int, reply: Reply) -> dict:
    """Send a person's reply into the customer's Gmail thread."""
    ticket = find_ticket(ticket_id)
    body = reply.body.strip()
    if not body:
        raise HTTPException(status_code=422, detail="The reply is empty")
    last = db.last_inbound_message(ticket_id)
    if last is None:
        raise HTTPException(status_code=409, detail="This ticket has no customer email to reply to")

    if is_mock(ticket):
        # Practice data: keep the reply in the database, send no email.
        db.save_agent_reply(ticket_id, f"mock-reply-{secrets.token_hex(8)}", settings.dashboard_username, body)
        return {**db.set_ticket_status(ticket_id, "resolved" if reply.resolve else ticket["status"]), "warning": None}

    try:
        gmail = Gmail()
        sent = gmail.send_reply(gmail.get_message(last["gmail_message_id"]), body)
    except Exception as error:
        raise gmail_failed(error) from error
    db.save_agent_reply(ticket_id, sent["id"], gmail.address, body)

    # The email is out, so from here on never answer with an error: a retry would send it twice.
    status, warning = ticket["status"], None
    if reply.resolve:
        try:
            # Hand the thread back to the AI for whatever the customer writes next.
            gmail.set_thread_label(ticket["gmail_thread_id"], ESCALATED_LABEL, False)
            status = "resolved"
        except Exception as error:
            warning = f"The reply was sent, but the ticket could not be resolved: {error}"
    return {**db.set_ticket_status(ticket_id, status), "warning": warning}


@api.post("/tickets/{ticket_id}/resolve")
def resolve_ticket(ticket_id: int) -> dict:
    """Close the ticket and let the AI answer this thread again."""
    ticket = find_ticket(ticket_id)
    set_escalated_label(ticket, False)
    return db.set_ticket_status(ticket_id, "resolved")


@api.post("/tickets/{ticket_id}/reopen")
def reopen_ticket(ticket_id: int) -> dict:
    """Give the ticket back to a person. The AI stays out of the thread until it is resolved."""
    ticket = find_ticket(ticket_id)
    set_escalated_label(ticket, True)
    return db.set_ticket_status(ticket_id, "escalated")


@api.get("/knowledge-base")
def knowledge_base() -> list[dict]:
    return db.list_knowledge_base()


@api.put("/knowledge-base/{entry_id}")
def update_entry(entry_id: int, update: EntryUpdate) -> dict:
    entry = db.update_knowledge_base_entry(entry_id, update.title, update.content)
    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@api.post("/knowledge-base", status_code=201)
def create_entry(entry: NewEntry) -> dict:
    created = db.create_knowledge_base_entry(entry.section, entry.title.strip(), entry.content.strip())
    if created is None:
        raise HTTPException(status_code=409, detail="This section already has an entry with that title")
    return created


@api.get("/knowledge-gaps")
def knowledge_gaps() -> list[dict]:
    return db.list_knowledge_gaps()


@api.post("/simulate")
def simulate(email: TrialEmail) -> dict:
    """Run the AI on a made-up email and show every step. Nothing is sent and nothing is saved."""
    body = email.body.strip()
    if not body:
        raise HTTPException(status_code=422, detail="Write the email first")
    thread = f"Subject: {email.subject.strip()}\n\nCustomer (customer@example.com):\n{body}"
    started = time.perf_counter()
    try:
        decision, trace = decide_traced(thread, email.has_attachments)
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"The AI could not answer: {error}") from error
    return {
        "decision": decision.model_dump(),
        "classification": trace.classification.model_dump() if trace.classification else None,
        "answer": trace.answer.model_dump() if trace.answer else None,
        "sources": trace.sources,
        "rule": trace.rule,
        "timings": {
            "classify": trace.classify_seconds,
            "agent": trace.agent_seconds,
            "total": time.perf_counter() - started,
        },
    }


@api.post("/poll")
def poll() -> dict:
    return {"messages": poll_once()}


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


app.include_router(api)

# The built dashboard. Mounted last, so the API routes above take precedence.
dashboard = Path(__file__).resolve().parent.parent / "dashboard" / "dist"
if dashboard.exists():
    app.mount("/", StaticFiles(directory=dashboard, html=True), name="dashboard")
