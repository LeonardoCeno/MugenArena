<?php

require_once __DIR__ . '/../../Personagem.php';

class Sukuna extends Personagem {

    const VELOCIDADE = 70;
    const CUSTO_DESMANTELAR = 550;
    const CUSTO_KAMINO_FUGA = 800;
    const CUSTO_DOMAIN = 1900;
    const CUSTO_REVERSE = 700;
    const DANO_DESMANTELAR = 40;
    const DANO_KAMINO_FUGA = 50;
    const DANO_DOMAIN = 70;
    const CURA_REVERSE = 100;
    const REGENERACAO_PROPRIA = 70;
    const LIMIAR_TRANSFORMACAO = 0.40; // % de HP para transformar

    // Valores boosted na forma transformada
    const DANO_DESMANTELAR_T = 65;
    const DANO_KAMINO_FUGA_T = 80;
    const DANO_DOMAIN_T = 110;
    const CURA_REVERSE_T = 180;
    const VELOCIDADE_T = 95;

    protected bool $transformado = false;

    public function __construct(string $nome) {
        parent::__construct($nome, 300, 25, 4000);
    }

    // ── Transformação ────────────────────────────────────────────────────

    public function receberDano(int $danoReal): void {
        parent::receberDano($danoReal);
        $this->verificarTransformacao();
    }

    private function verificarTransformacao(): void {
        if ($this->transformado || $this->vidaMaxima <= 0) return;
        if ($this->vidaAtual / $this->vidaMaxima <= self::LIMIAR_TRANSFORMACAO) {
            $this->transformado = true;
        }
    }

    public function estaTransformado(): bool {
        return $this->transformado;
    }

    public function getVelocidade(): int {
        return $this->transformado ? self::VELOCIDADE_T : self::VELOCIDADE;
    }

    // ── Habilidades ──────────────────────────────────────────────────────

    public static function getDescricao(): string {
        return "Sukuna (Alto HP, ataque médio, habilidades: Desmantelar, Kamino Fuga, Reverse Energy e Domain. Transforma ao atingir 40% de HP)";
    }

    public function usarHabilidadeEspecial(Personagem $alvo): string {
        $dano = $this->transformado ? self::DANO_DESMANTELAR_T : self::DANO_DESMANTELAR;
        $this->consumirEnergia(self::CUSTO_DESMANTELAR);
        $resultado = $this->executarAtaqueDireto($alvo, "Desmantelar", $dano);

        if (!$resultado['acertou']) {
            return $resultado['mensagem'];
        }

        $danoBleed = (int) ceil($dano * 0.40);
        if ($danoBleed > 0) {
            $alvo->aplicarSangramento($danoBleed, 1);
        }

        $mensagem = $resultado['mensagem'];
        if ($danoBleed > 0) {
            $mensagem .= " Sangramento aplicado por 2 turnos ({$danoBleed} por turno).";
        }

        return $mensagem;
    }

    public function kaminoFuga(Personagem $alvo): string {
        $dano = $this->transformado ? self::DANO_KAMINO_FUGA_T : self::DANO_KAMINO_FUGA;
        $this->consumirEnergia(self::CUSTO_KAMINO_FUGA);
        $resultado = $this->executarAtaqueDireto($alvo, "Kamino Fuga", $dano);

        if (!$resultado['acertou']) {
            return $resultado['mensagem'];
        }

        $danoBurn = (int) ceil($dano * 0.60);
        if ($danoBurn > 0) {
            $alvo->aplicarQueimadura($danoBurn, 1);
        }

        $mensagem = $resultado['mensagem'];
        if ($danoBurn > 0) {
            $mensagem .= " Burn aplicado por 1 turno ({$danoBurn} por turno).";
        }

        return $mensagem;
    }

    public function reverseEnergy(): string {
        $cura = $this->transformado ? self::CURA_REVERSE_T : self::CURA_REVERSE;
        $this->consumirEnergia(self::CUSTO_REVERSE);
        $this->curarVida($cura);
        return $this->formatarMensagemAcaoSemAlvo("Reverse Energy");
    }

    public function santuarioMalevolente(Personagem $alvo): string {
        $dano = $this->transformado ? self::DANO_DOMAIN_T : self::DANO_DOMAIN;
        $this->consumirEnergia(self::CUSTO_DOMAIN);
        $resultado = $this->executarAtaqueDireto($alvo, "Domain", $dano);

        if (!$resultado['acertou']) {
            return $resultado['mensagem'];
        }

        $turnos = $this->transformado ? 4 : 3;
        $danoBleed = (int) ceil($dano * 0.50);
        if ($danoBleed > 0) {
            $alvo->aplicarSangramento($danoBleed, 1);
        }

        $mensagem = $resultado['mensagem'];
        if ($danoBleed > 0) {
            $mensagem .= " Sangramento aplicado por {$turnos} turnos ({$danoBleed} por turno).";
        }

        return $mensagem;
    }

    public function getHabilidades(): array {
        $t = $this->transformado;
        return [
            [
                "nome"       => "Desmantelar",
                "metodo"     => "usarHabilidadeEspecial",
                "precisaAlvo"=> true,
                "energyCost" => self::CUSTO_DESMANTELAR,
                "priority"   => false,
            ],
            [
                "nome"       => "Kamino Fuga",
                "metodo"     => "kaminoFuga",
                "precisaAlvo"=> true,
                "energyCost" => self::CUSTO_KAMINO_FUGA,
                "priority"   => true,
                "clashable"  => true,
            ],
            [
                "nome"       => "Reverse Energy",
                "metodo"     => "reverseEnergy",
                "precisaAlvo"=> false,
                "energyCost" => self::CUSTO_REVERSE,
            ],
            [
                "nome"       => "Domain",
                "metodo"     => "santuarioMalevolente",
                "precisaAlvo"=> true,
                "energyCost" => self::CUSTO_DOMAIN,
                "priority"   => true,
            ],
        ];
    }

    public function getDescricoesAcoes(): array {
        $danoDesm  = $this->transformado ? self::DANO_DESMANTELAR_T : self::DANO_DESMANTELAR;
        $danoFuga  = $this->transformado ? self::DANO_KAMINO_FUGA_T : self::DANO_KAMINO_FUGA;
        $curaRev   = $this->transformado ? self::CURA_REVERSE_T     : self::CURA_REVERSE;
        $danoDomain= $this->transformado ? self::DANO_DOMAIN_T      : self::DANO_DOMAIN;
        $prefixo   = $this->transformado ? '[TRANSFORMADO] '        : '';

        return array_merge(parent::getDescricoesAcoes(), [
            'Desmantelar'  => "{$prefixo}Cria cortes contínuos no inimigo, causando sangramento.\nDano: {$danoDesm}  Custo: " . self::CUSTO_DESMANTELAR,
            'Kamino Fuga'  => "{$prefixo}Lança uma flecha de fogo que queima o inimigo por 1 turno.\nDano: {$danoFuga}  Custo: " . self::CUSTO_KAMINO_FUGA,
            'Reverse Energy'=> "{$prefixo}Inverte a energia amaldiçoada para regenerar vida.\nCura: {$curaRev}  Custo: " . self::CUSTO_REVERSE,
            'Domain'       => "{$prefixo}Expande o Santuário Malevolente, cortando o inimigo repetidamente.\nDano: {$danoDomain}  Custo: " . self::CUSTO_DOMAIN,
        ]);
    }

    // ── Visual ───────────────────────────────────────────────────────────

    public function getConfiguracaoVisual(): array {
        $baseSprite = $this->transformado
            ? './assets/sukuna/sprites/sprite_8.png'
            : './assets/sukuna/sprites/sukunabasefinal.png';

        return [
            'baseSprite' => $baseSprite,
            'winMessage' => 'Até que é forte, mas não o mais forte',
            'winImage'   => './assets/sukuna/sprites/sukunawin.jpg',
            'actions'    => [
                'Ataque' => [
                    'audio' => [
                        ['file' => './assets/audiosgerais/punchs2.mp3', 'startMs' => 0, 'durationMs' => 1300],
                    ],
                    'frames' => [
                        ['sprite' => './assets/sukuna/sprites/sukuachute1.png',      'durationMs' => 450],
                        ['sprite' => './assets/sukuna/sprites/sukunachute2real.png', 'durationMs' => 400],
                    ],
                ],
                'Desmantelar' => [
                    'audio' => [
                        ['file' => './assets/sukuna/audios/sukunahai.mp3', 'startMs' => 0],
                    ],
                    'frames' => [
                        ['sprite' => './assets/sukuna/sprites/sukunabasefinal.png', 'durationMs' => 400],
                        ['sprite' => './assets/sukuna/sprites/sukuacleave.png',     'durationMs' => 1600],
                    ],
                    'overlays' => [
                        ['target' => 'opponent', 'sprite' => './assets/sukuna/sprites/CORTE1.png', 'startMs' => 1200, 'durationMs' => 150, 'x' => 0, 'y' => 0, 'scale' => 1.2],
                        ['target' => 'opponent', 'sprite' => './assets/sukuna/sprites/CORTE2.png', 'startMs' => 1300, 'durationMs' => 150, 'x' => 0, 'y' => 0, 'scale' => 1.2],
                        ['target' => 'opponent', 'sprite' => './assets/sukuna/sprites/CORTE1.png', 'startMs' => 1400, 'durationMs' => 190, 'x' => 0, 'y' => 0, 'scale' => 1.2],
                        ['target' => 'opponent', 'sprite' => './assets/sukuna/sprites/CORTE2.png', 'startMs' => 1500, 'durationMs' => 200, 'x' => 0, 'y' => 0, 'scale' => 1.2],
                    ],
                ],
                'Kamino Fuga' => [
                    'frames' => [
                        ['sprite' => './assets/sukuna/sprites/sukunafuga1.png',  'durationMs' => 400],
                        ['sprite' => './assets/sukuna/sprites/sukunafuga2.png',  'durationMs' => 400],
                        ['sprite' => './assets/sukuna/sprites/FUGAFINAL.png',    'durationMs' => 1300, 'scale' => 1.1],
                        ['sprite' => './assets/sukuna/sprites/sukunabasefinal.png', 'durationMs' => 100],
                    ],
                    'overlays' => [
                        ['mode' => 'projectile', 'target' => 'opponent', 'sprite' => './assets/sukuna/sprites/FUGA.png', 'startMs' => 2200, 'durationMs' => 500, 'sizePx' => 260, 'frontOffsetPx' => 130, 'projectileAngleDeg' => -15, 'startOffsetX' => 0, 'startOffsetY' => -20, 'endOffsetX' => 0, 'endOffsetY' => 0],
                        ['target' => 'opponent', 'sprite' => './assets/sukuna/sprites/boom-explosion.gif', 'startMs' => 2750, 'durationMs' => 1400, 'x' => 0, 'y' => 0, 'scale' => 2],
                    ],
                    'audio' => [
                        ['file' => './assets/sukuna/audios/fuga.mp3',    'startMs' => 0],
                        ['file' => './assets/audiosgerais/bomba.mp3',    'startMs' => 2750],
                    ],
                ],
                'Reverse Energy' => [
                    'frames' => [
                        ['sprite' => './assets/sukuna/sprites/REALSUKUNAREGEN.png', 'durationMs' => 1500],
                    ],
                ],
                'Domain' => [
                    'domainDelayMs'      => 1700,
                    'domainImage'        => './assets/sukuna/sprites/DomainSukuna.gif',
                    'domainCutsDelayMs'  => 1000,
                    'audio' => [
                        ['file' => './assets/sukuna/audios/sukunadomain.mp3', 'startMs' => 0,    'durationMs' => 2800],
                        ['file' => './assets/sukuna/audios/sukunatheme.mp3',  'startMs' => 1600, 'durationMs' => 9000],
                    ],
                    'frames' => [
                        ['sprite' => './assets/sukuna/sprites/DOMAINSUKUNA.png', 'durationMs' => 9000],
                    ],
                    'overlays' => [
                        ['target' => 'opponent', 'sprite' => './assets/sukuna/sprites/docorte2.png', 'startMs' => 100, 'durationMs' => 100, 'x' => 0, 'y' => 0,   'scale' => 1.2],
                        ['target' => 'opponent', 'sprite' => './assets/sukuna/sprites/docorte3.png', 'startMs' => 200, 'durationMs' => 100, 'x' => 0, 'y' => 0,   'scale' => 1.2],
                        ['target' => 'opponent', 'sprite' => './assets/sukuna/sprites/docorte4.png', 'startMs' => 300, 'durationMs' => 100, 'x' => 0, 'y' => 0,   'scale' => 1.2],
                        ['target' => 'opponent', 'sprite' => './assets/sukuna/sprites/docorte5.png', 'startMs' => 400, 'durationMs' => 100, 'x' => 0, 'y' => -20, 'scale' => 1.2],
                        ['target' => 'opponent', 'sprite' => './assets/sukuna/sprites/docorte3.png', 'startMs' => 200, 'durationMs' => 100, 'x' => 0, 'y' => 0,   'scale' => 1.2],
                    ],
                    'repeatOverlaysStartMs' => 2000,
                    'repeatOverlays'        => 18,
                ],
            ],
            'reactions' => [
                'defendingHit' => [
                    'frames' => [
                        ['sprite' => './assets/sukuna/sprites/sukunadefreal.png', 'durationMs' => 1200],
                    ],
                ],
            ],
            'transformation' => [
                'sprite' => './assets/sukuna/sprites/sprite_8.png',
                ],

        ];
    }

    // ── Export extra ─────────────────────────────────────────────────────

    public function getEstadoExtra(): array {
        return ['transformado' => $this->transformado];
    }

    // ── Energia ──────────────────────────────────────────────────────────

    protected function getRegeneracaoEnergia(): int {
        return self::REGENERACAO_PROPRIA;
    }
}
