"""Fill the database with invented tickets, so the dashboard has something to show.

    uv run python -m scripts.seed_mock_data            # add two weeks of mock data
    uv run python -m scripts.seed_mock_data --clear    # remove it again
    uv run python -m scripts.seed_mock_data --dry-run  # try it, then undo everything

Every mock row has a Gmail id that starts with "mock-", so it can never collide with
real mail and --clear removes exactly these rows. Customers use example.com addresses.
"""

import argparse
import random
from datetime import UTC, datetime, timedelta

import psycopg
from psycopg.types.json import Jsonb

from app import db

PREFIX = "mock-"
SUPPORT = "support@ebikes-il.example"
SIGN_OFF = "\n\nBest regards,\nEBikes IL Support"
HANDOVER = "Thank you for your message. I have passed it to a colleague, who will reply to you personally."
TEAM_REPLY = (
    "Hello,\n\nThank you for your patience. I looked into this personally and it is now taken care of. "
    "You will get a separate confirmation by email." + SIGN_OFF
)

# (section, subject, customer email, action, reply, reason, suggested next step, weight)
SCENARIOS = [
    ("e-bikes", "Which frame size for the Carmel C1?",
     "Hi,\n\nI'm 172 cm tall and want to order the Carmel C1. Which frame size should I pick?\n\nThanks!",
     "reply", "Hi,\n\nFor a rider of 172 cm, the Carmel C1 in size M is the right fit. Size M suits riders from 165 to 179 cm." + SIGN_OFF,
     "Answered from 'Frame size for the C1': 172 cm falls in size M (165 to 179 cm).", None, 9),
    ("e-bikes", "C1 or F1 for commuting by train?",
     "Hello,\n\nI ride to the station and take the train every day. Which bike do you recommend, and what does it cost?",
     "reply", "Hello,\n\nFor rides combined with the train, we recommend the Carmel F1. It folds, so it is easy to take on board. The F1 costs 3,990 NIS including VAT." + SIGN_OFF,
     "Answered from 'Prices and which bike to choose': public transport points to the F1.", None, 8),
    ("batteries", "How far can I ride on one charge?",
     "Hello, how many kilometres does the C1 battery last? I ride about 18 km each way to work.",
     "reply", "Hello,\n\nThe Carmel C1 has a range of up to about 50 km per charge, depending on rider weight, hills, and assist level." + SIGN_OFF,
     "Answered from 'Models': C1 range is up to about 50 km, with the stated conditions.", None, 7),
    ("returns-and-warranty", "Is the display covered by warranty?",
     "Hi,\n\nI bought my Carmel C1 eight months ago and the display has started flickering. Is that covered?",
     "reply", "Hi,\n\nYes. The display is covered for 1 year against manufacturing faults. Could you reply with your order number and the model code from the sticker under the frame?" + SIGN_OFF,
     "Answered from 'Warranty': display has 1 year of cover; asked for order number and model code.", None, 6),
    ("shipping", "How long does a replacement charger take?",
     "Hello, you approved a replacement charger for me last week. How long does delivery take?",
     "reply", "Hello,\n\nReplacement parts leave our warehouse within 2 business days and arrive in 3 to 7 business days. You receive a tracking link by email." + SIGN_OFF,
     "Answered from 'Replacement parts': shipping times and tracking link.", None, 6),
    ("returns-and-warranty", "How do I return my bike?",
     "Hi, the F1 arrived yesterday but it is not what I expected. How does a return work?",
     "reply", "Hi,\n\nReturns go through Amazon. You can start a return in Your Orders on Amazon within 30 days of delivery." + SIGN_OFF,
     "Answered from 'Returns': the customer asked how returns work, not for a refund decision.", None, 5),
    ("batteries", "Battery is swollen and very hot",
     "My battery got really hot while charging last night and the case looks swollen. Is it safe to keep using it?",
     "escalate", "Hello,\n\nPlease stop using and charging the battery right away, and move it outdoors if that is safe. A colleague will contact you personally as soon as possible." + SIGN_OFF,
     "Battery safety rule: a swollen, hot battery is always handed to a person, with safety steps first.",
     "Call the customer today and arrange collection and a replacement battery.", 1),
    ("returns-and-warranty", "I want my money back",
     "The bike has been nothing but trouble since day one. I want a full refund. Order {order}.",
     "escalate", f"Hello,\n\n{HANDOVER}{SIGN_OFF}",
     "Always-escalate rule: the customer asks for a refund.",
     "Check the delivery date for order {order} and explain the Amazon return window.", 2),
    ("shipping", "Where is my order?",
     "Hi, I ordered a Carmel C1 nine days ago and tracking has not moved since Sunday. Can you check?",
     "escalate", f"Hi,\n\n{HANDOVER}{SIGN_OFF}",
     "Always-escalate rule: the customer asks about the status of one specific order.",
     "Look up the Amazon order and reply with the current delivery status.", 2),
    ("e-bikes", "Front light missing from the box",
     "Hello, my Carmel F1 arrived today (order {order}) but there was no front light in the box.",
     "escalate", "Hello,\n\nSorry about the missing light. I have passed this to a colleague, who will confirm the replacement with you personally." + SIGN_OFF,
     "Missing accessory with an order number: sending a part is a promise, so a person confirms it.",
     "Ship a front light to the address on order {order}.", 2),
]

ACKNOWLEDGE = "Hello,\n\nThank you for your message. A colleague will reply to you within one business day." + SIGN_OFF

# Questions the knowledge base cannot answer: (section, subject, email, what is missing).
GAPS = [
    ("e-bikes", "Can I ride the F1 in the rain?", "Hello, I commute all year. Can I ride the Carmel F1 in heavy rain? Is it waterproof?",
     "Whether the F1 can be ridden in heavy rain, and its water resistance rating"),
    ("e-bikes", "Maximum rider weight", "Hi, what is the maximum rider weight for the Carmel C1? I weigh about 115 kg.",
     "The maximum rider weight for the C1 and F1"),
    ("other", "Test ride in Haifa?", "Do you have a showroom in Haifa where I can test ride the bikes before buying?",
     "Whether there is a showroom or test ride option, and where"),
    ("e-bikes", "Child seat for the C1", "Can I mount a rear child seat on the Carmel C1? Which ones fit?",
     "Whether a child seat fits the C1, and which models are compatible"),
    ("batteries", "Battery in winter storage", "How should I store the battery over the winter when I'm not riding?",
     "How to store the battery when the bike is not used for months"),
]
GAP_BY_SUBJECT = {subject: missing for _, subject, _, missing in GAPS}
SCENARIOS += [
    (section, subject, body, "escalate", ACKNOWLEDGE, "The knowledge base does not answer this", None, 2)
    for section, subject, body, _ in GAPS
]

CUSTOMERS = [
    "dana.levi", "yoav.mizrahi", "noa.friedman", "amit.shapiro", "tamar.cohen", "eitan.peretz",
    "maya.goldberg", "omer.katz", "shira.ben-david", "lior.avraham", "michal.rosen", "daniel.segal",
]


def clear(conn: psycopg.Connection) -> None:
    like = PREFIX + "%"
    tickets = conn.execute("delete from tickets where gmail_thread_id like %s", (like,)).rowcount
    events = conn.execute("delete from events where gmail_message_id like %s", (like,)).rowcount
    print(f"Removed {tickets} mock tickets and {events} mock events.")


def seed(conn: psycopg.Connection) -> None:
    rng = random.Random(11)
    now = datetime.now(UTC)
    # Resolved tickets and team replies need the ticket_actions migration.
    migrated = conn.execute(
        "select 1 from information_schema.columns where table_name = 'messages' and column_name = 'sent_by'"
    ).fetchone() is not None

    arrivals = []
    for day in range(13, -1, -1):
        count = rng.randint(5, 8) if day < 7 else rng.randint(3, 6)
        arrivals += [now - timedelta(days=day, seconds=rng.uniform(0.02, 0.9) * 86400) for _ in range(count)]
    arrivals.append(now - timedelta(minutes=4))
    arrivals.sort()

    # Collected here and written in three batches at the end: far fewer round trips.
    messages, team_messages, events = [], [], []

    def message(ticket_id: int, key: str, direction: str, sender: str, body: str, at: datetime) -> None:
        messages.append((ticket_id, key, direction, sender, body, at))

    tickets = resolved = 0
    for index, received in enumerate(arrivals):
        key = f"{PREFIX}{index:04d}"
        if rng.random() < 0.07:
            events.append((key, "skipped", Jsonb({"reason": "bulk or list mail"}), received, received + timedelta(seconds=2)))
            continue

        section, subject, body, action, reply, reason, proposed, _ = rng.choices(
            SCENARIOS, weights=[s[-1] for s in SCENARIOS]
        )[0]
        order = f"114-{rng.randint(2400000, 9399999)}"
        body, proposed = body.format(order=order), proposed and proposed.format(order=order)
        customer = f"{rng.choice(CUSTOMERS)}@example.com"
        replied = received + timedelta(seconds=rng.uniform(7, 21))
        status, updated = ("escalated" if action == "escalate" else "answered"), replied
        close = migrated and action == "escalate" and now - replied > timedelta(days=5)
        if close:
            status, updated = "resolved", replied + timedelta(hours=rng.uniform(1, 6))

        ticket_id = conn.execute(
            """
            insert into tickets (gmail_thread_id, customer_email, subject, category, status, proposed_action, created_at, updated_at)
            values (%s, %s, %s, %s, %s, %s, %s, %s) returning id
            """,
            (key, customer, subject, section, status, proposed, received, updated),
        ).fetchone()["id"]
        message(ticket_id, key, "in", customer, body, received)
        message(ticket_id, f"{key}-out", "out", SUPPORT, reply, replied)
        if close:
            team_messages.append((ticket_id, f"{key}-team", SUPPORT, TEAM_REPLY, updated))
            resolved += 1
        decision = {"action": action, "section": section, "reply": reply, "reason": reason, "proposed_action": proposed,
                    "knowledge_gap": GAP_BY_SUBJECT.get(subject)}
        events.append((key, "processed", Jsonb(decision), received, replied))
        tickets += 1

    with conn.cursor() as cursor:
        cursor.executemany(
            "insert into messages (ticket_id, gmail_message_id, direction, from_address, body, created_at) values (%s, %s, %s, %s, %s, %s)",
            messages,
        )
        cursor.executemany(
            "insert into messages (ticket_id, gmail_message_id, direction, from_address, body, created_at, sent_by) values (%s, %s, 'out', %s, %s, %s, 'agent')",
            team_messages,
        )
        cursor.executemany(
            "insert into events (gmail_message_id, status, result, created_at, processed_at) values (%s, %s, %s, %s, %s)",
            events,
        )

    print(f"Added {tickets} mock tickets ({resolved} resolved) and {len(arrivals)} mock events.")
    if not migrated:
        print("Note: the ticket_actions migration is not applied, so no ticket was marked resolved.")


class Undo(Exception):
    pass


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--clear", action="store_true", help="remove the mock data and stop")
    parser.add_argument("--dry-run", action="store_true", help="run everything, then roll it back")
    args = parser.parse_args()

    with db.connect() as conn:
        try:
            # One transaction: either all of it lands, or none of it.
            with conn.transaction():
                clear(conn)
                if not args.clear:
                    seed(conn)
                if args.dry_run:
                    raise Undo
        except Undo:
            print("Dry run: nothing was changed.")


if __name__ == "__main__":
    main()
