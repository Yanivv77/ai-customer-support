# How this project is kept secure

The idea: **close everything, then open the one door you need, for one person, with one key.**

## The server (VPS)

| Protection | What it means |
|---|---|
| Firewall | The only open door is SSH, and only my own IP address can use it. |
| Key login only | No passwords to guess. You need my private key file. |
| No root login | Even with the key, you can only log in as a normal user (`deploy`). |
| Nothing public | The app has no public port. The API listens on `localhost` only. The email poller only makes outgoing calls. |

## The database (Supabase)

| Protection | What it means |
|---|---|
| IP allow list | Only my laptop and my server can connect to the database. |
| Row Level Security | The public web API is on but returns nothing, because no access rules exist. |
| Strong password | The database password is the last lock if the others fail. |

## Secrets (passwords and keys)

| Rule | Why |
|---|---|
| Kept in `.env`, never in Git | The code is public. The secrets are not. |
| `.env` is not in the Docker image | Anyone with the image still gets no secrets. |
| `.env` on the server is readable only by its owner | Other users on the machine can't read it. |
| The server's GitHub key is read-only | If the server is hacked, nobody can change my code. |

## The AI

| Protection | What it means |
|---|---|
| Answers only from the knowledge base | It does not guess. If it doesn't know, it hands the email to a person. |
| Escalation rules | Safety issues, refunds, legal questions, angry customers and attachments always go to a human. |
| No promises | It never promises refunds, discounts, shipments or dates. |
| Ignores injected instructions | An email that tries to give it new rules gets escalated. |

## If something leaks

Replace the leaked key or password first, then investigate.

1. Create a new key or password with the provider (Anthropic, Google, Supabase).
2. Put the new value in `.env` on my laptop and on the server.
3. Run `docker compose up -d` on the server.
4. Delete the old key.

If the server itself is compromised: rebuild it in Hostinger, then replace every secret above.
