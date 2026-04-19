# GameService Split — Design Spec
**Date:** 2026-04-19  
**Branch:** clahs

## Objetivo
Dividir `backend/GameService.php` (813 linhas, 1 classe monolítica) em uma pasta `backend/GameService/` com arquivos por responsabilidade, usando **PHP Traits**. Nenhum call-site externo muda — `web_api.php` continua chamando `GameService::método()` normalmente.

## Abordagem: PHP Traits
Todos os métodos são `static`. Traits PHP suportam métodos estáticos perfeitamente. A classe `GameService` usa todos os traits via `use`, e `self::` resolve na classe composta em tempo de execução — sem quebrar nada.

## Estrutura de Arquivos

```
backend/GameService/
├── GameService.php        ← classe principal (API pública + use dos traits)
├── Helpers.php            ← trait GameHelpers
├── TurnOrder.php          ← trait TurnOrder
├── TurnExecution.php      ← trait TurnExecution
├── GameSetup.php          ← trait GameSetup
└── StateExport.php        ← trait GameStateExport
```

O arquivo original `backend/GameService.php` vira um proxy com `require_once` + `class_alias` ou apenas redireciona o include.

## Responsabilidade de Cada Arquivo

### `Helpers.php` — trait GameHelpers
Utilitários internos usados por todos os outros traits. Sem dependências entre si.

Métodos: `validarChave`, `chaveOposta`, `jogadorPorChave`, `domainVazio`, `resetarDomain`, `decrementarDomain`, `existeDomainAtivo`, `metodoSkill`, `habilidadeDaAcao`, `efeitosVazio`, `efeitosDaSkill`, `aplicarParalisia`

### `TurnOrder.php` — trait TurnOrder
Sistema de prioridade e ordem de turno. Define quem age primeiro, checks de clash, penalidades de domain.

Métodos: `acaoTemPrioridadeBruta`, `acaoTemPrioridade`, `acaoEhClashavel`, `acaoAtivaDomain`, `acaoPodeEntrarEmDomainClash`, `acaoDeveExecutarPorUltimo`, `obterPenalidadeEnergiaDeDomain`, `aplicarPenalidadeEnergiaDeDomain`, `acaoPodeAtingirOponente`, `domainFoiInterrompido`, `determinarOrdem`

### `TurnExecution.php` — trait TurnExecution
Motor de execução: resolve ações, clashes, turno simultâneo e rodada completa.

Métodos: `preencherAcoesSkip`, `executarAcao` (public), `executarAcaoPendente`, `deveResetarJogo`, `decidirVencedorDoClash`, `avancarTurno`, `resolverClash`, `executarTurnoSimultaneo`, `resolverRodada`

### `GameSetup.php` — trait GameSetup
Criação de personagens e estado inicial de jogo. Catálogo de classes disponíveis.

Métodos: `mapaDeClasses` (public), `catalogoDePersonagens` (public), `criarPersonagem` (public), `criarEstadoDeJogo` (public)

### `StateExport.php` — trait GameStateExport
Serialização do estado do jogo para o frontend. Ações disponíveis por jogador.

Métodos: `exportarPersonagem` (public), `exportarEstado` (public), `acoesDisponiveis` (public)

### `GameService.php` — classe principal
API pública fina + `use` dos 5 traits. Apenas os métodos que orquestram o fluxo externo ficam aqui.

Métodos: `determinarVencedor` (public), `submeterAcao` (public), `retornaAoSetup` (public)

## Arquivo Proxy
O `backend/GameService.php` original vira proxy para retrocompatibilidade:
```php
require_once __DIR__ . '/GameService/GameService.php';
```

## require_once em GameService/GameService.php
Todos os `require_once` de personagens ficam no topo de `GameService/GameService.php`. Os traits não precisam de includes próprios — herdam o autoload da classe.

## Invariantes Preservadas
- Nenhuma assinatura pública muda
- `web_api.php` não precisa de alteração
- `self::` continua resolvendo na classe `GameService`
- Todos os métodos existentes permanecem acessíveis

## O que NÃO muda
- Lógica interna de nenhum método
- Tipos de retorno
- Exceções lançadas (`EntradaInvalidaException`)
- Interface com `Personagem.php` e subclasses
