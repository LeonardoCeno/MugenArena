const MUSICAS_FUNDO = [
	"./assets/audiosdefundo/megalovania.mp3",
	"./assets/audiosdefundo/intheend.mp3",
	"./assets/audiosdefundo/numb.mp3",
	"./assets/audiosdefundo/HERO.mp3",
	"./assets/audiosdefundo/monsterskillet.mp3",
];
const AUDIO_CLASH_DOMAIN = "./assets/audiosgerais/clashaudio.mp3";
export const AUDIO_DOMAIN_BREAK = "./assets/audiosgerais/domainfailed.mp3";

export function createAudioController({ els }) {
	let bgMusic = null;
	let domainClashAudio = null;
	let volumeLevel = 1;
	let muted = false;

	function getVolume() {
		return Math.max(1, Math.min(10, volumeLevel)) / 10;
	}

	function applyVolumeToAll() {
		if (bgMusic) bgMusic.volume = getVolume();
		if (domainClashAudio) domainClashAudio.volume = getVolume();
	}

	function updateMuteButton() {
		if (!els.bgmToggleBtn) return;
		els.bgmToggleBtn.textContent = muted ? "MUSICA: OFF" : "MUSICA: ON";
		els.bgmToggleBtn.classList.toggle("is-muted", muted);
		els.bgmToggleBtn.setAttribute("aria-pressed", String(muted));
	}

	function setVolume(raw) {
		const nivel = Number.parseInt(String(raw), 10);
		if (Number.isNaN(nivel)) {
			if (els.bgmVolumeInput) els.bgmVolumeInput.value = String(volumeLevel);
			return;
		}
		volumeLevel = Math.max(1, Math.min(10, nivel));
		if (els.bgmVolumeInput) els.bgmVolumeInput.value = String(volumeLevel);
		applyVolumeToAll();
	}

	function stopBgm() {
		if (!bgMusic) return;
		bgMusic.removeEventListener("ended", playRandomBgm);
		bgMusic.pause();
		bgMusic.currentTime = 0;
		bgMusic = null;
	}

	function playRandomBgm() {
		stopBgm();
		const src = MUSICAS_FUNDO[Math.floor(Math.random() * MUSICAS_FUNDO.length)];
		const audio = new Audio(src);
		audio.loop = false;
		audio.volume = getVolume();
		audio.muted = muted;
		audio.addEventListener("play", () => { audio.volume = getVolume(); });
		audio.addEventListener("ended", playRandomBgm);
		audio.play().catch(() => {});
		bgMusic = audio;
	}

	function stopClashDomain() {
		if (!domainClashAudio) return;
		domainClashAudio.pause();
		domainClashAudio.currentTime = 0;
		domainClashAudio = null;
	}

	function fadeOutClashDomain(durationMs = 1000) {
		const audio = domainClashAudio;
		if (!audio) return Promise.resolve();
		if (durationMs <= 0) {
			stopClashDomain();
			return Promise.resolve();
		}

		const initialVolume = audio.volume;
		const stepMs = 50;
		const totalSteps = Math.max(1, Math.ceil(durationMs / stepMs));
		let currentStep = 0;

		return new Promise(resolve => {
			const timer = setInterval(() => {
				if (domainClashAudio !== audio) { clearInterval(timer); resolve(); return; }
				currentStep++;
				const progress = Math.min(1, currentStep / totalSteps);
				audio.volume = Math.max(0, initialVolume * (1 - progress));
				if (progress >= 1) { clearInterval(timer); stopClashDomain(); resolve(); }
			}, stepMs);
		});
	}

	// Generic fade for one-shot audio elements not tracked in state.
	function fadeAudioOut(audioEl, durationMs = 1000) {
		if (!audioEl || durationMs <= 0) return Promise.resolve();
		const initialVolume = audioEl.volume;
		const stepMs = 50;
		const totalSteps = Math.max(1, Math.ceil(durationMs / stepMs));
		let step = 0;
		return new Promise(resolve => {
			const timer = setInterval(() => {
				step++;
				const progress = Math.min(1, step / totalSteps);
				audioEl.volume = Math.max(0, initialVolume * (1 - progress));
				if (progress >= 1) { clearInterval(timer); resolve(); }
			}, stepMs);
		});
	}

	function playClashDomain() {
		stopClashDomain();
		const audio = new Audio(AUDIO_CLASH_DOMAIN);
		audio.loop = true;
		audio.volume = getVolume();
		audio.currentTime = 0;
		audio.muted = false;
		audio.play().catch(() => {});
		domainClashAudio = audio;
	}

	function toggleMute() {
		muted = !muted;
		if (bgMusic) bgMusic.muted = muted;
		updateMuteButton();
	}

	return {
		getVolume,
		setVolume,
		updateMuteButton,
		playRandomBgm,
		stopBgm,
		playClashDomain,
		stopClashDomain,
		fadeOutClashDomain,
		fadeAudioOut,
		toggleMute,
	};
}
