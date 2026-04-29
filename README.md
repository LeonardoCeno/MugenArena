
# MugenArena

Jogo de batalha por turnos com frontend Vue 3 e backend PHP 8.

## Rodar com Docker (recomendado)

Requisito: [Docker](https://docs.docker.com/get-docker/) instalado.
Se voce clonou em uma pasta vazia, usa "cd MugenArena", dai roda o comando, se voce clonou direto pode rodar direto.

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

**Terminal 1 — backend PHP** (rodar na raiz do projeto):

```bash
php -S 127.0.0.1:8080
```

**Terminal 2 — frontend Vue:**

```bash
cd frontend
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
