import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from app.config import settings


def connect() -> psycopg.Connection:
    return psycopg.connect(settings.database_url, autocommit=True, row_factory=dict_row)


def start_event(gmail_message_id: str) -> dict | None:
    """Claim a message. Returns None when it is already handled or in progress."""
    with connect() as conn:
        return conn.execute(
            """
            insert into events (gmail_message_id) values (%s)
            on conflict (gmail_message_id) do update
              set attempts = events.attempts + 1, status = 'processing', error = null
              where events.status = 'failed'
            returning id, attempts
            """,
            (gmail_message_id,),
        ).fetchone()


def finish_event(event_id: int, status: str, result: dict) -> None:
    with connect() as conn:
        conn.execute(
            "update events set status = %s, result = %s, processed_at = now() where id = %s",
            (status, Jsonb(result), event_id),
        )


def fail_event(event_id: int, error: str) -> None:
    with connect() as conn:
        conn.execute(
            "update events set status = 'failed', error = %s where id = %s",
            (error, event_id),
        )


def upsert_ticket(gmail_thread_id: str, customer_email: str, subject: str) -> int:
    with connect() as conn:
        row = conn.execute(
            """
            insert into tickets (gmail_thread_id, customer_email, subject)
            values (%s, %s, %s)
            on conflict (gmail_thread_id) do update set updated_at = now()
            returning id
            """,
            (gmail_thread_id, customer_email, subject),
        ).fetchone()
        return row["id"]


def update_ticket(
    ticket_id: int, status: str, category: str | None = None, proposed_action: str | None = None
) -> None:
    with connect() as conn:
        conn.execute(
            """
            update tickets
            set status = %s, category = coalesce(%s, category),
                proposed_action = %s, updated_at = now()
            where id = %s
            """,
            (status, category, proposed_action, ticket_id),
        )


def save_message(
    ticket_id: int, gmail_message_id: str, direction: str, from_address: str, body: str
) -> None:
    with connect() as conn:
        conn.execute(
            """
            insert into messages (ticket_id, gmail_message_id, direction, from_address, body)
            values (%s, %s, %s, %s, %s)
            on conflict (gmail_message_id) do nothing
            """,
            (ticket_id, gmail_message_id, direction, from_address, body),
        )


def save_agent_reply(ticket_id: int, gmail_message_id: str, from_address: str, body: str) -> None:
    """A reply a person sent from the dashboard. Needs the ticket_actions migration."""
    with connect() as conn:
        conn.execute(
            """
            insert into messages (ticket_id, gmail_message_id, direction, from_address, body, sent_by)
            values (%s, %s, 'out', %s, %s, 'agent')
            on conflict (gmail_message_id) do nothing
            """,
            (ticket_id, gmail_message_id, from_address, body),
        )


def list_sections() -> list[str]:
    with connect() as conn:
        rows = conn.execute("select distinct section from knowledge_base order by section").fetchall()
        return [row["section"] for row in rows]


def get_section(section: str) -> list[dict]:
    with connect() as conn:
        return conn.execute(
            "select title, content from knowledge_base where section = %s order by id",
            (section,),
        ).fetchall()


def list_events(limit: int = 100) -> list[dict]:
    with connect() as conn:
        return conn.execute("select * from events order by id desc limit %s", (limit,)).fetchall()


def list_tickets(status: str | None = None, query: str = "", limit: int = 50) -> dict:
    """One page of tickets, newest first, plus how many tickets each status has for this search."""
    search, params = "true", []
    if query:
        # Escape the LIKE wildcards, so a customer named 50%_off is searched literally.
        escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        search = "(subject ilike %s or customer_email ilike %s)"
        params = [f"%{escaped}%", f"%{escaped}%"]
    with connect() as conn:
        counts = conn.execute(
            f"select status, count(*) as count from tickets where {search} group by status", params
        ).fetchall()
        if status:
            search += " and status = %s"
            params.append(status)
        items = conn.execute(
            f"select * from tickets where {search} order by updated_at desc, id desc limit %s",
            [*params, limit],
        ).fetchall()
    return {"items": items, "counts": {row["status"]: row["count"] for row in counts}}


def get_ticket(ticket_id: int) -> dict | None:
    with connect() as conn:
        return conn.execute("select * from tickets where id = %s", (ticket_id,)).fetchone()


def set_ticket_status(ticket_id: int, status: str) -> dict | None:
    with connect() as conn:
        return conn.execute(
            "update tickets set status = %s, updated_at = now() where id = %s returning *",
            (status, ticket_id),
        ).fetchone()


def last_inbound_message(ticket_id: int) -> dict | None:
    with connect() as conn:
        return conn.execute(
            "select * from messages where ticket_id = %s and direction = 'in' order by id desc limit 1",
            (ticket_id,),
        ).fetchone()


def stats(timezone: str) -> dict:
    """Numbers for the overview: the last 14 days per day, and the last 7 days against the 7 before."""
    handled = """
        select created_at, processed_at, result->>'action' as action
        from events
        where status = 'processed' and result->>'action' in ('reply', 'escalate')
    """
    with connect() as conn:
        days = conn.execute(
            f"""
            select (created_at at time zone %s)::date as day,
                   count(*) filter (where action = 'reply') as answered,
                   count(*) filter (where action = 'escalate') as escalated
            from ({handled}) as handled
            where created_at >= now() - interval '15 days'
            group by 1 order by 1
            """,
            (timezone,),
        ).fetchall()
        windows = conn.execute(
            f"""
            select created_at >= now() - interval '7 days' as is_current,
                   count(*) filter (where action = 'reply') as answered,
                   count(*) filter (where action = 'escalate') as escalated,
                   percentile_cont(0.5) within group (
                     order by extract(epoch from processed_at - created_at)::float8
                   ) as median_seconds
            from ({handled}) as handled
            where created_at >= now() - interval '14 days'
            group by 1
            """
        ).fetchall()
        topics = conn.execute(
            """
            select coalesce(category, 'other') as section,
                   count(*) as total,
                   count(*) filter (where status = 'answered') as answered
            from tickets
            where created_at >= now() - interval '14 days'
            group by 1 order by 2 desc
            """
        ).fetchall()
        waiting = conn.execute(
            "select count(*) as count from tickets where status = 'escalated'"
        ).fetchone()

    empty = {"answered": 0, "escalated": 0, "median_seconds": None}
    by_window = {row.pop("is_current"): row for row in windows}
    return {
        "days": days,
        "current": by_window.get(True, empty),
        "previous": by_window.get(False, empty),
        "topics": topics,
        "waiting": waiting["count"],
    }


def list_messages(ticket_id: int) -> list[dict]:
    with connect() as conn:
        return conn.execute(
            "select * from messages where ticket_id = %s order by id", (ticket_id,)
        ).fetchall()


def list_knowledge_base() -> list[dict]:
    with connect() as conn:
        return conn.execute("select * from knowledge_base order by section, id").fetchall()


def update_knowledge_base_entry(entry_id: int, title: str, content: str) -> dict | None:
    with connect() as conn:
        return conn.execute(
            """
            update knowledge_base set title = %s, content = %s, updated_at = now()
            where id = %s returning *
            """,
            (title, content, entry_id),
        ).fetchone()


def list_knowledge_gaps(limit: int = 200) -> list[dict]:
    """Emails handed over because the knowledge base lacks the answer, newest first.

    Older rows have no knowledge_gap field, so they are recognised by their fixed reason.
    """
    with connect() as conn:
        return conn.execute(
            """
            select e.id as event_id, e.created_at,
                   coalesce(e.result->>'knowledge_gap', e.result->>'reason') as missing,
                   e.result->>'section' as section,
                   m.body as question, t.id as ticket_id, t.subject, t.customer_email, t.status
            from events e
            left join messages m on m.gmail_message_id = e.gmail_message_id
            left join tickets t on t.id = m.ticket_id
            where e.status = 'processed'
              and (e.result->>'knowledge_gap' is not null
                   or e.result->>'reason' = 'The knowledge base does not answer this')
            order by e.id desc
            limit %s
            """,
            (limit,),
        ).fetchall()


def create_knowledge_base_entry(section: str, title: str, content: str) -> dict | None:
    """None when the section already has an entry with this title."""
    with connect() as conn:
        return conn.execute(
            """
            insert into knowledge_base (section, title, content) values (%s, %s, %s)
            on conflict (section, title) do nothing
            returning *
            """,
            (section, title, content),
        ).fetchone()
