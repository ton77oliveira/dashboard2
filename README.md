# Dashboard2

Operational dashboard for Komodo, servers, projects, OpenCode sessions and Poste.io mail metrics.

The project is designed to be self-hosted. All integrations are optional and configured through environment variables.

## Features

- Komodo stacks, deployments, builds, repos, server stats and activity states.
- Lightweight server metrics through Komodo or SSH/local commands.
- Project inventory from `PROJECT_STATUS.md`, `.opencode/status.json` and SDD task files.
- OpenCode session/status links when an OpenCode API is available.
- Poste.io mail metrics from transactional logs, service state, container stats and DMARC reports.
- React frontend served by nginx with a Node/Fastify API backend.

## Quick Start

```bash
cp .env.example .env
docker compose up --build
```

Open `http://localhost:4080`.

By default, integrations are disabled. Enable only the ones you have configured.

## OpenCode Install Wizard

If you use OpenCode, this repository includes an installation wizard command:

```text
/instalar_dash
```

The command guides you through `.env` configuration, Docker Compose validation, deployment and health checks.

Command file: `.opencode/command/instalar_dash.md`.

## Configuration

Copy `.env.example` to `.env` and fill your values.

Important variables:

- `KOMODO_ENABLED`, `KOMODO_URL`, `KOMODO_API_KEY`, `KOMODO_API_SECRET` enable Komodo collection.
- `SERVERS`, `SERVER_HOSTS`, `SERVER_USERS`, `SSH_USER` configure SSH/local server metrics.
- `PROJECTS_ENABLED`, `PROJECTS_HOST`, `PROJECTS_PATH` enable project inventory.
- `OPENCODE_ENABLED`, `OPENCODE_API_URL`, `OPENCODE_PUBLIC_URL` enable OpenCode status links.
- `POSTE_ENABLED`, `POSTE_HOST`, `POSTE_USER`, `POSTE_CONTAINER`, `POSTE_DATA_PATH`, `POSTE_DMARC_DOMAIN` enable Poste.io metrics.

`SERVERS`, `SERVER_HOSTS` and `SERVER_USERS` use comma-separated values:

```env
SERVERS=server-a,server-b
SERVER_HOSTS=server-a=192.0.2.10,server-b=192.0.2.11
SERVER_USERS=server-a=admin,server-b=admin
```

## SSH Requirements

The container needs SSH access to the hosts you configure. Mount an SSH key or run the dashboard on a host that can reach the targets.

For Docker Compose, add a volume such as:

```yaml
volumes:
  - ~/.ssh:/root/.ssh:ro
```

The target user should be able to run the lightweight shell commands used for metrics. Poste.io metrics also require Docker access on the mail host.

## Development

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Project Status Format

```md
# Status

Estado: em_andamento
Fase: implementacao
Prioridade: alta
Ultima atualização: 2026-01-01

## Progresso

- [x] Setup inicial
- [ ] Deploy staging
```

## OpenCode Status Format

```json
{
  "state": "waiting_user",
  "agent": "developer",
  "task": "Configure staging deploy",
  "updated_at": "2026-01-01T14:45:00Z",
  "waiting_for": "Confirm domain"
}
```

## Security

- Do not commit `.env`.
- Use read-only SSH keys when possible.
- Restrict dashboard access to a private network or put it behind authentication.
- Komodo API secrets and SSH keys are runtime configuration, not repository content.
