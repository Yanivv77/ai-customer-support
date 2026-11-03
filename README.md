# AI Customer Support

AI-powered customer support API built with FastAPI and the Anthropic Claude SDK.

## Setup

Requires Python 3.13 and [uv](https://docs.astral.sh/uv/).

```bash
uv sync
cp .env.example .env   # then add your ANTHROPIC_API_KEY
```

## Run

```bash
uv run fastapi dev app/main.py
```
