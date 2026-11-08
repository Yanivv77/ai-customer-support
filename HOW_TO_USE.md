# How to use this project

An AI answers customer emails for EBikes IL. It runs on a server 
## How it works

```
Customer email -> Gmail inbox -> Poller (every X s) -> AI reads the knowledge base
                                                         |
                          answers the customer  <--------+-------->  or hands it to a person
```

1. The **poller** checks the Gmail inbox for new emails.
2. The **AI** reads the matching parts of the **knowledge base** and decides: reply, or escalate to a person.
3. The reply is sent and everything is saved in the **database** (Supabase).

## Where things are

| What | Where |
|---|---|
| AI + email code | `app/` |
| What the AI knows | `knowledge_base/*.md` |
| Test emails | `evals/` |
| Poll speed | `POLL_INTERVAL_SECONDS` in `app/config.py` |
| Secrets | `.env` (never in Git) |
| Server notes | `VPS_GUIDE.md` (private), `SECURITY_NOTES.md` |

## Everyday tasks

### Test it
Send an email from another address to `yanivai777@gmail.com`, for example `Which of your bikes is the cheapest?`. A reply arrives within a minute.

Watch what happens:

```bash
ssh support-vps 'cd ~/ai-customer-support && docker compose logs -f poller'
```

`Handled 1 new messages` means it worked. Stop watching with Ctrl+C.

### Change what the AI knows
1. Edit a file in `knowledge_base/` (each `## Heading` is one entry).
2. Save it to the database:
   ```bash
   uv run python -m scripts.seed_knowledge_base
   ```
3. Done. The server reads the database, so there is nothing to redeploy.

### Change code and put it live
Pushing to GitHub does not update the server. After `git push`, run:

```bash
ssh support-vps 'cd ~/ai-customer-support && git pull && docker compose up -d --build'
```

### Change the poll speed
Edit `POLL_INTERVAL_SECONDS` in `app/config.py` (30 for testing, 600 for real use), push, then deploy as above.

### Check the AI quality
Runs the golden test emails and scores the answers:

```bash
uv run python -m evals.run_evals
```

Run it after changing the knowledge base or the AI code.

### Change a secret
Edit `.env` on the laptop, copy it to the server, and reload:

```bash
scp .env support-vps:~/ai-customer-support/.env
ssh support-vps 'cd ~/ai-customer-support && docker compose up -d'
```

## Check the server

```bash
ssh support-vps 'cd ~/ai-customer-support && docker compose ps'
```

Both `api` and `poller` should say `Up`. They restart on their own if they crash.

## Important rules

- **Never run the poller on my laptop while the server runs it.** Two pollers send double replies.
- **Never commit `.env`.** It holds all the secrets.
- **Code changes need `--build`**, or the server keeps the old code.
- If SSH stops working, my IP probably changed. See `VPS_GUIDE.md`.

## Run on my laptop (development only)

Stop the server poller first, or use a test inbox.

```bash
uv sync
uv run python -m app.poller            # the email poller
uv run fastapi dev app/main.py         # the API (health check at /health)
```
