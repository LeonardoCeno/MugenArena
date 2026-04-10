<?php

require_once __DIR__ . '/../../Personagem.php';

class Sans extends Personagem {

    const DANO_EEEEH = 999;
    const REGENERACAO_PROPRIA = 0;

    public function __construct(string $nome) {
        parent::__construct($nome, 1, 1, 200);
    }

    public static function getDescricao(): string {

        return "Sans (HP baixíssimo, ataque alto, passiva: esquiva usando energia, habilidade: eeeeh)";
    }

    public function receberDano(int $danoReal): void {
        $tipoDano = $this->consumirTipoDanoRecebido();
        $danoReal = $this->aplicarReducaoDanoDefesa($danoReal);

        if ($danoReal <= 0) {
            return;
        }

        if ($this->energiaAtual > 0) {
            $this->energiaAtual -= $danoReal;

            if ($this->energiaAtual < 0) {
                $this->energiaAtual = 0;
            }

            return;
        }

        $this->registrarTipoDanoRecebido($tipoDano);

        $this->vidaAtual -= $danoReal;

        if ($this->vidaAtual < 0) {
            $this->vidaAtual = 0;
        }
    }

    public function eeeeh(Personagem $alvo): string {
        $resultado = $this->executarAtaqueDireto($alvo, "eeeeh", self::DANO_EEEEH);

        return $resultado['mensagem'];
    }

    public function usarHabilidadeEspecial(Personagem $alvo): string {
        return $this->eeeeh($alvo);
    }

    public function getHabilidades(): array {

        return [
            [
                "nome" => "eeeeh",
                "metodo" => "eeeeh",
                "precisaAlvo" => true
            ]
        ];
    }

    public function getDescricoesAcoes(): array {
        return array_merge(parent::getDescricoesAcoes(), [
            'eeeeh' => 'Causa ' . self::DANO_EEEEH . ' de dano fixo.',
        ]);
    }

    public function getConfiguracaoVisual(): array {
        return [
            'baseSprite' => './assets/sans/sprites/SANSBASEFINAL.png',
            'winImage' => './assets/sans/sprites/sansrealista.jpg',
            'dodgeSprite' => './assets/sans/sprites/SANSSKILL1FINAL.png',
            'actions' => [
                'eeeeh' => [
                    'frames' => [
                        [
                            'sprite' => './assets/sans/sprites/SANSKILL1FINAL.png',
                            'durationMs' => 1000,
                        ],
                    ],
                ],
            ],
        ];
    }

    protected function getRegeneracaoEnergia(): int {
        return self::REGENERACAO_PROPRIA;
    }
}