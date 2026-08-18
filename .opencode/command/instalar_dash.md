# /instalar_dash

Wizard para instalar o Dashboard2 em um ambiente novo.

## Objetivo

Configurar `.env`, validar conectividade e orientar deploy via Docker Compose ou Komodo.

## Perguntas

1. Qual porta local deve publicar o dashboard? Padrao: `4080`.
2. Vai usar Komodo? Se sim, pedir `KOMODO_URL`, `KOMODO_API_KEY` e `KOMODO_API_SECRET`.
3. Vai monitorar servidores por SSH? Se sim, pedir `SERVERS`, `SERVER_HOSTS`, `SERVER_USERS` e confirmar chave SSH.
4. Vai ler projetos? Se sim, pedir `PROJECTS_HOST` e `PROJECTS_PATH`.
5. Vai integrar OpenCode? Se sim, pedir `OPENCODE_API_URL` e `OPENCODE_PUBLIC_URL`.
6. Vai integrar Poste.io? Se sim, pedir `POSTE_HOST`, `POSTE_USER`, `POSTE_CONTAINER`, `POSTE_DATA_PATH` e `POSTE_DMARC_DOMAIN`.

## Execucao

1. Criar `.env` a partir de `.env.example` com os valores informados.
2. Rodar `docker compose config` para validar o compose.
3. Rodar `docker compose up --build -d`.
4. Validar `GET /api/health`.
5. Validar `GET /api/summary` e reportar integracoes com erro.

## Cuidados

- Nunca imprimir segredos no resumo final.
- Nunca commitar `.env`.
- Se exposto publicamente, recomendar autenticação ou restricao por VPN/rede privada.
