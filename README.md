# Jogo de Combate por Turnos (PHP)

Projeto de batalha por turnos com dois modos de execução:

- **Web** via `frontend/batalha.html` + `backend/web_api.php`
- **Terminal (CLI)** via `backend/index.php`

## Rodar com Docker (recomendado)

Requisitos: [Docker](https://docs.docker.com/get-docker/) instalado.

```bash
docker compose up --build
```

Abra no navegador: `http://localhost:8080/frontend/batalha.html`

## Rodar sem Docker

Requisitos: PHP 8.2+

```bash
php -S 127.0.0.1:8080
```

Abra no navegador: `http://127.0.0.1:8080/frontend/batalha.html`

## Rodar no Terminal (CLI)

```bash
php backend/index.php
```

## Estrutura

```
backend/
  Personagem.php       # Classe base e mecânicas comuns
  GameService.php      # Fluxo central de partida (turno, ação, estado)
  web_api.php          # Camada HTTP/JSON para o frontend
  index.php            # Interface de terminal
  ExcecaoJogo.php      # Exceções do jogo
  characters/          # Um subdiretório por personagem

frontend/
  batalha.html         # Interface web
  batalha.css          # Estilos
  app.js               # Orquestrador principal
  ui-status.js         # HUD e ações
  battle-animations.js # Engine de animações
  assets/              # Sprites por personagem
```

## Observações

- As configurações visuais por personagem (sprites e animações) são declaradas nas classes PHP e enviadas pela API ao frontend.
- Para o modo Web sem Docker, use servidor local (`http://`), não `file://`.
