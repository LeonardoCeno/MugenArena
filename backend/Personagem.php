<?php

require_once __DIR__ . '/ExcecaoJogo.php';

abstract class Personagem {

    protected string $nome;
    protected int $vidaMaxima;
    protected int $vidaAtual;
    protected int $ataque;
    protected int $energiaMaxima;
    protected int $energiaAtual;
    protected bool $defendendo = false;

    protected int $sangramentoTurnos = 0;
    protected int $sangramentoDanoPorTurno = 0;
    protected int $queimaduraTurnos = 0;
    protected int $queimaduraDanoPorTurno = 0;
    protected string $ultimoTipoDano = 'direct';
    protected ?string $proximoTipoDanoRecebido = null;

    const REGENERACAO_ENERGIA = 10;

    public function __construct(string $nome, int $vida, int $ataque, int $energia) {
        $this->nome = $nome;
        $this->vidaMaxima = $vida;
        $this->vidaAtual = $vida;
        $this->ataque = $ataque;
        $this->energiaMaxima = $energia;
        $this->energiaAtual = $energia;
    }

    // ── Getters ──────────────────────────────────────────────────────────

    public function getNome(): string {
        return $this->nome;
    }

    public function getVidaAtual(): int {
        return $this->vidaAtual;
    }

    public function getVidaMaxima(): int {
        return $this->vidaMaxima;
    }

    public function getEnergiaAtual(): int {
        return $this->energiaAtual;
    }

    public function getEnergiaMaxima(): int {
        return $this->energiaMaxima;
    }

    public function getUltimoTipoDano(): string {
        return $this->ultimoTipoDano;
    }

    public function estaDefendendo(): bool {
        return $this->defendendo;
    }

    public function estaVivo(): bool {
        return $this->vidaAtual > 0;
    }

    // ── Turno ────────────────────────────────────────────────────────────

    public function iniciarTurno(): void {
        $this->defendendo = false;
        $this->regenerarEnergia();
    }

    public function regenerarEnergia(): void {
        $this->energiaAtual = min(
            $this->energiaMaxima,
            $this->energiaAtual + $this->getRegeneracaoEnergia()
        );
    }

    protected function getRegeneracaoEnergia(): int {
        return self::REGENERACAO_ENERGIA;
    }

    // ── Ações ────────────────────────────────────────────────────────────

    public function atacar(Personagem $alvo): string {
        return $this->executarAtaqueDireto($alvo, "Ataque", max(0, $this->ataque))['mensagem'];
    }

    public function defender(): string {
        $this->defendendo = true;
        return $this->formatarMensagemAcaoSemAlvo("Defesa");
    }

    protected function consumirEnergia(int $custo): void {
        $custo = max(0, $custo);

        if ($this->energiaAtual < $custo) {
            throw new EnergiaInsuficienteException();
        }

        $this->energiaAtual -= $custo;
    }

    protected function curarVida(int $cura): void {
        if ($cura <= 0) {
            return;
        }

        $this->vidaAtual += $cura;

        if ($this->vidaAtual > $this->vidaMaxima) {
            $this->vidaAtual = $this->vidaMaxima;
        }
    }

    // ── Engine de combate ────────────────────────────────────────────────

    protected function executarAtaqueDireto(Personagem $alvo, string $nomeAcao, int $dano): array {
        if ($alvo->sorteouDesvio()) {
            return [
                'acertou'    => false,
                'vidaAntes'  => $alvo->getVidaAtual(),
                'danoReal'   => 0,
                'foiCritico' => false,
                'mensagem'   => "{$this->nome} usou {$nomeAcao} em {$alvo->getNome()}, mas {$alvo->getNome()} desviou!",
            ];
        }

        $vidaAntes = $alvo->getVidaAtual();
        $danoReal  = max(0, $dano);
        $foiCritico = $this->sorteouCritico();

        if ($foiCritico) {
            $danoReal = (int) ceil($danoReal * 2);
        }

        $alvo->receberDano($danoReal);

        $mensagem = $this->formatarMensagemAcaoComAlvo($nomeAcao, $alvo, $vidaAntes, $danoReal);

        if ($foiCritico && $danoReal > 0) {
            $mensagem .= " Acerto crítico!";
        }

        return [
            'acertou'    => true,
            'vidaAntes'  => $vidaAntes,
            'danoReal'   => $danoReal,
            'foiCritico' => $foiCritico,
            'mensagem'   => $mensagem,
        ];
    }

    protected function sorteouDesvio(): bool {
        return random_int(1, 100) <= 10;
    }

    protected function sorteouCritico(): bool {
        return random_int(1, 100) <= 5;
    }

    protected function aplicarReducaoDanoDefesa(int $danoReal): int {
        if ($danoReal <= 0) {
            return 0;
        }

        if (!$this->defendendo) {
            return $danoReal;
        }

        return (int) ceil($danoReal * 0.5);
    }

    protected function formatarMensagemAcaoComAlvo(string $nomeAcao, Personagem $alvo, int $vidaAntes, int $danoReal): string {
        $vidaDepois = $alvo->getVidaAtual();

        if ($vidaDepois === $vidaAntes || $danoReal <= 0) {
            return "{$this->nome} usou {$nomeAcao} em {$alvo->getNome()}, mas {$alvo->getNome()} desviou!";
        }

        return "{$this->nome} usou {$nomeAcao} em {$alvo->getNome()}, causando {$danoReal} de dano.";
    }

    protected function formatarMensagemAcaoSemAlvo(string $nomeAcao): string {
        return "{$this->nome} usou {$nomeAcao}.";
    }

    // ── Receber dano ─────────────────────────────────────────────────────

    public function receberDano(int $danoReal): void {
        $tipoDano = $this->consumirTipoDanoRecebido();
        $danoReal = $this->aplicarReducaoDanoDefesa($danoReal);

        if ($danoReal <= 0) {
            return;
        }

        $this->registrarTipoDanoRecebido($tipoDano);

        $this->vidaAtual -= $danoReal;

        if ($this->vidaAtual < 0) {
            $this->vidaAtual = 0;
        }
    }

    protected function definirTipoDoProximoDanoRecebido(string $tipo): void {
        $this->proximoTipoDanoRecebido = $tipo;
    }

    protected function consumirTipoDanoRecebido(): string {
        $tipoDano = $this->proximoTipoDanoRecebido ?? 'direct';
        $this->proximoTipoDanoRecebido = null;

        return $tipoDano;
    }

    protected function registrarTipoDanoRecebido(string $tipo): void {
        $this->ultimoTipoDano = $tipo;
    }

    // ── Efeitos contínuos ────────────────────────────────────────────────

    public function aplicarSangramento(int $danoPorTurno, int $turnos): void {
        $this->sangramentoDanoPorTurno = max(0, $danoPorTurno);
        $this->sangramentoTurnos = max(0, $turnos);
    }

    public function aplicarQueimadura(int $danoPorTurno, int $turnos): void {
        $this->queimaduraDanoPorTurno = max(0, $danoPorTurno);
        $this->queimaduraTurnos = max(0, $turnos);
    }

    public function processarEfeitosContinuosFimTurno(): void {
        $this->processarSangramento();
        $this->processarQueimadura();
    }

    private function processarEfeitoContinuo(string $tipo, int &$turnos, int &$danoPorTurno): void {
        if ($turnos <= 0 || $danoPorTurno <= 0) {
            return;
        }

        $this->definirTipoDoProximoDanoRecebido($tipo);
        $this->receberDano($danoPorTurno);
        $turnos--;

        if ($turnos <= 0) {
            $danoPorTurno = 0;
        }
    }

    private function processarSangramento(): void {
        $this->processarEfeitoContinuo('bleed', $this->sangramentoTurnos, $this->sangramentoDanoPorTurno);
    }

    private function processarQueimadura(): void {
        $this->processarEfeitoContinuo('burn', $this->queimaduraTurnos, $this->queimaduraDanoPorTurno);
    }

    // ── Dados e configuração ─────────────────────────────────────────────

    public function getHabilidades(): array {
        return [
            [
                "nome"        => "Habilidade Especial",
                "metodo"      => "usarHabilidadeEspecial",
                "precisaAlvo" => true,
            ]
        ];
    }

    public function getDescricoesAcoes(): array {
        return [
            'Ataque' => "Causa {$this->ataque} de dano base.",
            'Defesa' => 'Reduz em 50% o dano recebido até o próximo turno.',
        ];
    }

    public function getConfiguracaoVisual(): array {
        return [
            'baseSprite' => null,
            'actions'    => [],
            'reactions'  => [],
        ];
    }

    // ── Identidade e flags ───────────────────────────────────────────────

    private function nomeClasse(): string {
        return (new ReflectionClass($this))->getShortName();
    }

    public function getClasse(): string {
        return strtolower($this->nomeClasse());
    }

    public function getClasseNome(): string {
        return $this->nomeClasse();
    }

    public function usaSomenteHabilidades(): bool {
        return false;
    }

    public function retornaAoSetup(string $metodo): bool {
        return false;
    }

    // ── Abstratos ────────────────────────────────────────────────────────

    abstract public function usarHabilidadeEspecial(Personagem $alvo): string;

    abstract public static function getDescricao(): string;
}
