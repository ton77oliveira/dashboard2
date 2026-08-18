# AGENTS.md

This repository is a public, self-hosted operational dashboard template.

## Rules

- Never commit real secrets, SSH keys, tokens, private hostnames, private IPs or production domains.
- Keep integrations optional and configured through environment variables.
- Prefer small, direct changes over abstractions.
- Run a leak check before public commits:

```bash
rg -n "(password|secret|token|api[_-]?key|BEGIN .*PRIVATE|ssh-ed25519|ssh-rsa)" .
```

## Development

- Backend: `cd backend && npm install && npm run dev`.
- Frontend: `cd frontend && npm install && npm run dev`.
- Container: `cp .env.example .env && docker compose up --build`.
