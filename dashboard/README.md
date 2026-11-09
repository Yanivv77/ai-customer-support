# Support dashboard

The panel for the AI email responder: what the AI did, which tickets wait for a person, and the knowledge base it answers from.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173, API calls go to http://127.0.0.1:8000
```

Start the API in another terminal from the project root: `uv run fastapi dev app/main.py`.
Log in with `DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD` from `.env`.

No backend at hand? Click **Explore with sample data** on the login screen. It runs on invented customers and emails, fully in the browser.

## Checks

```bash
npm run build      # type-check and production build
npm run lint
npm test
```

## Pages

| Page | What it is for |
|---|---|
| Overview | Emails handled, share answered without a person, time to reply, tickets waiting. Numbers come from `GET /api/stats`. |
| Tickets | Search and filter conversations, reply to the customer, resolve or reopen. |
| Activity | Every email the AI looked at, with its reasoning and the reply it sent. |
| Knowledge base | Edit what the AI knows. Edits apply from the next email. |
| Knowledge gaps | Questions the AI handed over because the knowledge base lacked the answer, grouped by what is missing. Add the answer in place. |
| Try an email | Write an email as a customer and see the AI's reply and every step of its decision. Calls the real AI; nothing is sent or saved. |

## How tickets move

- **Answered**: the AI replied on its own.
- **Needs a person**: the AI stepped back. It stays out of the Gmail thread while the `needs-human` label is on it.
- **Resolved**: a person closed the ticket. This removes the `needs-human` label, so the AI answers the customer's next email again.
- **Reopen** puts the label back.

A reply from the panel is sent as a real email in the customer's thread. It cannot be unsent.

## Where things live

```
src/lib/api.ts        login state and fetch wrapper
src/lib/queries.ts    every API call, as TanStack Query hooks
src/lib/metrics.ts    chart and statistics helpers
src/lib/demo.ts       the sample-data backend
src/pages/            one file per page
src/components/       shell, charts, shared pieces
```

## Deploy

The Dockerfile in the project root builds this folder and the API serves it at `/`. Apply the database migrations in `supabase/migrations` before deploying a version that needs them.
