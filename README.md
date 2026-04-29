
# MugenArena

Jogo de batalha por turnos com frontend Vue 3 e backend PHP 8.

## Rodar com Docker (recomendado)

Requisito: [Docker](https://docs.docker.com/get-docker/) instalado.

```bash
docker compose up -d --build
```

Acessa em: `http://localhost:8080`

Para parar:

```bash
docker compose down
```

## Rodar sem Docker

Requisitos: PHP 8.2+ e Node.js 20+.

**Terminal 1 — backend PHP:**

```bash
php -S 127.0.0.1:8080 (dentro da pasta do projeto)
```

**Terminal 2 — frontend Vue:**

```bash
cd frontend (esse tem que ser na pasta do frontend)
npm install
npm run dev
```

Acessa em: `http://localhost:5173`

> O frontend em dev usa proxy — o PHP **deve** rodar na porta 8080 com o root apontando para a raiz do projeto (não para `backend/`).

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
  index.html           # Entry point
  src/                 # Código-fonte Vue
  assets/              # Sprites, sons e fundos por personagem
```
