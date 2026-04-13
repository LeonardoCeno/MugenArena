<?php

require_once __DIR__ . '/../../Personagem.php';

class Ubuntu extends Personagem {

	const VELOCIDADE = 30;
	const DANO_ERRO = 9999;
	private bool $terminalAberto = false;

	public function __construct(string $nome) {
		parent::__construct($nome, 999, 10, 999);
	}

	public static function getDescricao(): string {
		return 'UBUNTU (personagem especial, habilidades: abrir terminal e ls)';
	}

	public function abrirTerminal(): string {
		$this->terminalAberto = true;

		return $this->formatarMensagemAcaoSemAlvo('abrir terminal');
	}

	public function erro(Personagem $alvo): string {
		$resultado = $this->executarAtaqueDireto($alvo, 'ls', self::DANO_ERRO);

		return $resultado['mensagem'] . ' O jogo foi encerrado. Permissão NEGADA.';
	}

	public function usarHabilidadeEspecial(Personagem $alvo): string {
		if (!$this->terminalAberto) {
			return $this->abrirTerminal();
		}

		return $this->erro($alvo);
	}

	public function usaSomenteHabilidades(): bool {
		return true;
	}

	public function retornaAoSetup(string $metodo): bool {
		return $metodo === 'erro';
	}

	public function getHabilidades(): array {
		if (!$this->terminalAberto) {
			return [
				[
					'nome' => 'abrir terminal',
					'metodo' => 'abrirTerminal',
					'precisaAlvo' => false,
				],
			];
		}

		return [
			[
				'nome' => 'ls',
				'metodo' => 'erro',
				'precisaAlvo' => true,
			],
		];
	}

	public function getDescricoesAcoes(): array {
		return array_merge(parent::getDescricoesAcoes(), [
			'abrir terminal' => 'Prepara o terminal para liberar a habilidade ls no próximo turno.',
			'ls' => '##@$$@#@$$@#@$$#@$#@%#$(&*@&#¨@&*%#&*@%&*%@&%#&*@.',
		]);
	}

	public function getConfiguracaoVisual(): array {
		return [
			'baseSprite' => './assets/ubuntu/sprites/ubuntuMALIGNO.png',
			'winImage' => './assets/ubuntu/sprites/ubuntuMALIGNO.png',
			'errorSplash' => './assets/ubuntu/sprites/ERROINSANO.avif',
			'actions' => [
				'abrir terminal' => [
					'frames' => [
						[
							'sprite' => './assets/ubuntu/sprites/ubuntuMALIGNO.png',
							'durationMs' => 1000,
						],
					],
				],
				'ls' => [
					'frames' => [
						[
							'sprite' => './assets/ubuntu/sprites/ubuntuMALIGNO.png',
							'durationMs' => 1000,
						],
					],
				],
			],
		];
	}
}

