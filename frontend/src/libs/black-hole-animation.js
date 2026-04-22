export function startBlackHoleAnimation({ onBattleSetup } = {}) {
  return new Promise(resolve => {
    const overlay = document.getElementById('black-hole-overlay');
    const canvas  = document.getElementById('black-hole-canvas');
    if (!overlay || !canvas) { resolve(); return; }

    const W  = window.innerWidth;
    const H  = window.innerHeight;
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const cx  = W / 2;
    const cy  = H / 2;
    const diagR = Math.hypot(cx, cy) + 40;

    const pts = Array.from({ length: 480 }, () => ({
      angle:    Math.random() * Math.PI * 2,
      orbMult:  1.1  + Math.random() * 2.8,
      speed:   (0.35 + Math.random() * 1.55) * (Math.random() < 0.5 ? 1 : -1),
      size:     0.5  + Math.random() * 3.2,
      hue:      200  + Math.random() * 40,
      bright:   58   + Math.random() * 42,
      alpha:    0.28 + Math.random() * 0.72,
    }));

    const topbar      = document.querySelector('.topbar');
    const setupScreen = document.querySelector('.setup-screen');
    const suckTargets = [topbar, setupScreen].filter(Boolean);

    suckTargets.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      const dx   = cx - (rect.left + rect.width  / 2);
      const dy   = cy - (rect.top  + rect.height / 2);
      const dur  = 1.5 + i * 0.12;
      el.style.willChange = 'transform, opacity';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.transition = `transform ${dur}s cubic-bezier(0.48,0,0.82,0.18), opacity ${dur - 0.12}s ease`;
        el.style.transform  = `translate(${dx}px,${dy}px) scale(0.01) rotate(1260deg)`;
        el.style.opacity    = '0';
      }));
    });

    const PHASE1 = 1800;
    const PHASE2 = 2200;

    let phase = 1;
    let t0    = null;
    let raf;
    let battleSetupDone = false;

    const easeInQuad  = t => t * t;
    const easeOut3    = t => 1 - Math.pow(1 - t, 3);
    const easeOut5    = t => 1 - Math.pow(1 - t, 5);

    function drawBlackHole(bhR, progress, time) {
      if (bhR > diagR * 0.55) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
      }

      const glowR = Math.min(bhR * 4.8, W * 1.6);
      const ng    = ctx.createRadialGradient(cx, cy, bhR * 0.5, cx, cy, glowR);
      ng.addColorStop(0,    `rgba(200,220,255,${0.72 * progress})`);
      ng.addColorStop(0.32, `rgba(100,150,200,${0.46 * progress})`);
      ng.addColorStop(0.68, `rgba(50,100,150,${0.22 * progress})`);
      ng.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.fillStyle = ng;
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, 0.27);
      const dIn  = bhR * 1.08;
      const dOut = bhR * 3.6;
      for (let r = dIn; r < dOut; r += 1.5) {
        const i   = 1 - (r - dIn) / (dOut - dIn);
        const hue = 200 + i * 40;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${hue},100%,66%,${i * 0.27 * progress})`;
        ctx.lineWidth   = 1;
        ctx.stroke();
      }
      ctx.restore();

      const pProg = Math.min(1, progress * 2.5);
      pts.forEach(p => {
        const r = bhR * p.orbMult;
        const a = p.angle + time * p.speed * 0.00088;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r * 0.27;
        ctx.beginPath();
        ctx.arc(x, y, p.size * pProg, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},100%,${p.bright}%,${p.alpha * pProg})`;
        ctx.fill();
      });

      const pr = ctx.createRadialGradient(cx, cy, bhR * 0.84, cx, cy, bhR * 1.72);
      pr.addColorStop(0,    `rgba(255,250,250,${progress})`);
      pr.addColorStop(0.20, `rgba(255,250,250 ,${0.88 * progress})`);
      pr.addColorStop(0.60, `rgba(224,255,255,${0.40 * progress})`);
      pr.addColorStop(1,    'rgba(192,246,251)');
      ctx.fillStyle = pr;
      ctx.beginPath();
      ctx.arc(cx, cy, bhR * 1.72, 0, Math.PI * 2);
      ctx.fill();

      if (time - t0 < 1000 && t0 !== null) {
        const rt = (time - t0) / 1000;
        [0, 0.25, 0.55].forEach(offset => {
          const t2 = Math.max(0, rt - offset);
          if (t2 <= 0) return;
          const rr = t2 * 340;
          const ra = (1 - t2) * 0.65;
          ctx.beginPath();
          ctx.arc(cx, cy, rr, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(175,95,255,${ra})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
      }

      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(cx, cy, bhR, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawReveal(openR, t) {
      const rimW    = (1 - easeOut3(t)) * 145 + 8;
      const rimAlpha = Math.max(0, 1 - t * 1.15);
      if (openR > 0 && rimAlpha > 0.01) {
        const blackG = ctx.createRadialGradient(cx, cy, 0, cx, cy, openR + rimW);
        blackG.addColorStop(0,   `rgba(0,0,0,${rimAlpha})`);
        blackG.addColorStop(0.7, `rgba(0,0,0,${rimAlpha * 0.2})`);
        blackG.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = blackG;
        ctx.beginPath();
        ctx.arc(cx, cy, openR + rimW, 0, Math.PI * 2);
        ctx.fill();

        const rg = ctx.createRadialGradient(cx, cy, Math.max(0, openR * 0.80), cx, cy, openR + rimW);
        rg.addColorStop(0,    `rgba(230,245,255,${rimAlpha})`);
        rg.addColorStop(0.22, `rgba(160,210,255,${rimAlpha * 0.85})`);
        rg.addColorStop(0.55, `rgba(80,140,220,${rimAlpha * 0.42})`);
        rg.addColorStop(1,    'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(cx, cy, openR + rimW, 0, Math.PI * 2);
        ctx.fill();
      }

      // destination-out torna o canvas transparente, revelando o DOM atrás do overlay
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx, cy, openR, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }

    overlay.style.display = 'block';

    raf = requestAnimationFrame(function frame(ts) {
      if (!t0) t0 = ts;
      const elapsed = ts - t0;
      ctx.clearRect(0, 0, W, H);

      if (phase === 1) {
        const t   = Math.min(elapsed / PHASE1, 1);
        const bhR = 4 + easeInQuad(t) * (diagR - 4);
        drawBlackHole(bhR, Math.min(1, t * 2.2), ts);

        if (t >= 1) {
          phase = 2;
          t0    = ts;

          if (!battleSetupDone) {
            battleSetupDone = true;
            suckTargets.forEach(el => {
              el.style.transition = 'none';
              el.style.transform  = '';
              el.style.opacity    = '';
              el.style.willChange = '';
              requestAnimationFrame(() => requestAnimationFrame(() => {
                el.style.transition = '';
              }));
            });
            if (onBattleSetup) onBattleSetup();
          }
        }

      } else if (phase === 2) {
        const t     = Math.min(elapsed / PHASE2, 1);
        const openR = easeOut5(t) * (diagR + 60);
        drawReveal(openR, t);

        if (t >= 1) {
          cancelAnimationFrame(raf);
          overlay.style.display = 'none';
          resolve();
          return;
        }
      }

      raf = requestAnimationFrame(frame);
    });
  });
}
