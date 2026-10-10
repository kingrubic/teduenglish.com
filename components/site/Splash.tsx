/* Loading screen from the original static site. Styled and scripted inline so it
   paints before the app bundle loads; it waits for fonts, the page and the first
   data from Convex ("tedu:ready"), shown at least ~1s and never more than 6s. */

const css = `
:root {
  --sp-bg: #fff9f3; --sp-plate: transparent; --sp-track: #f0e1d2; --sp-text: #7a6151;
  --sp-glow: rgba(245, 168, 67, 0.24); --sp-amber: #f5a843; --sp-orange: #c9692f;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --sp-bg: #17100b; --sp-plate: #fff6ec; --sp-track: #36261b; --sp-text: #c4ab96; --sp-glow: rgba(245, 168, 67, 0.14);
  }
}
:root[data-theme="dark"] {
  --sp-bg: #17100b; --sp-plate: #fff6ec; --sp-track: #36261b; --sp-text: #c4ab96; --sp-glow: rgba(245, 168, 67, 0.14);
}
html.is-loading, html.is-loading body { overflow: hidden; }
.splash {
  position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 24px 16px;
  background: var(--sp-bg); transition: opacity .45s ease, visibility 0s linear .45s;
  animation: splash-failsafe 0s linear 8s forwards;
}
.splash.out { opacity: 0; visibility: hidden; }
.splash.gone { display: none; }
.splash-inner { position: relative; display: flex; flex-direction: column; align-items: center; gap: 26px; max-width: 100%; transition: transform .45s ease; }
.splash.out .splash-inner { transform: scale(1.04); }
.splash-inner::before {
  content: ""; position: absolute; width: 420px; height: 420px; max-width: 120vw; max-height: 120vw;
  top: 44%; left: 50%; transform: translate(-50%, -50%); border-radius: 50%;
  background: radial-gradient(circle, var(--sp-glow) 0%, transparent 65%); pointer-events: none;
}
.splash-logo {
  position: relative; padding: 14px 18px; border-radius: 28px; background: var(--sp-plate);
  animation: splash-rise .7s cubic-bezier(.2, .8, .2, 1) both, splash-float 3.2s ease-in-out .7s infinite;
}
.splash-logo img { display: block; width: min(280px, 68vw); height: auto; }
.splash-bar { position: relative; width: min(240px, 60vw); height: 7px; border-radius: 99px; background: var(--sp-track); overflow: hidden; }
.splash-bar i {
  position: absolute; inset: 0 auto 0 0; width: 8%; border-radius: 99px;
  background: linear-gradient(90deg, var(--sp-amber), var(--sp-orange)); transition: width .5s cubic-bezier(.3, .7, .3, 1);
}
.splash-bar i::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, .55), transparent);
  transform: translateX(-100%); animation: splash-shine 1.2s ease-in-out infinite;
}
.splash-text {
  position: relative; margin: -12px 0 0; font: 500 0.85rem/1.4 "Be Vietnam Pro", "Segoe UI", system-ui, -apple-system, sans-serif;
  color: var(--sp-text); letter-spacing: 0.01em; text-align: center;
}
@keyframes splash-rise { from { transform: translateY(14px) scale(.96); } to { transform: none; } }
@keyframes splash-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes splash-shine { to { transform: translateX(100%); } }
@keyframes splash-failsafe { to { opacity: 0; visibility: hidden; } }
@media (prefers-reduced-motion: reduce) {
  .splash-logo, .splash-bar i::after { animation: none; }
  .splash-bar i { transition: none; }
}`;

const script = `(function () {
  var el = document.getElementById("splash");
  if (!el) return;
  var root = document.documentElement;
  var fill = document.getElementById("splash-fill");
  var text = document.getElementById("splash-text");
  var start = Date.now(), MIN_MS = 1100, MAX_MS = 6000, pct = 0, finished = false;
  root.classList.add("is-loading");
  function step(p, msg) {
    if (p > pct) { pct = p; fill.style.width = p + "%"; }
    if (msg) text.textContent = msg;
  }
  function finish() {
    if (finished) return;
    finished = true;
    step(100, "Sẵn sàng rồi!");
    setTimeout(function () {
      el.classList.add("out");
      root.classList.remove("is-loading");
      setTimeout(function () { el.classList.add("gone"); }, 500);
    }, Math.max(250, MIN_MS - (Date.now() - start)));
  }
  step(22);
  document.addEventListener("DOMContentLoaded", function () { step(48, "Đang tải bài học…"); });
  var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  var loaded = new Promise(function (resolve) {
    if (document.readyState === "complete") resolve();
    else window.addEventListener("load", resolve);
  });
  var data = new Promise(function (resolve) {
    if (window.__teduReady) resolve();
    else window.addEventListener("tedu:ready", resolve);
  });
  fonts.then(function () { step(76, "Đang chuẩn bị giao diện…"); });
  data.then(function () { step(88); });
  Promise.all([fonts, loaded, data]).then(finish, finish);
  setTimeout(finish, MAX_MS);
})();`;

export default function Splash() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="splash" id="splash" role="status" aria-live="polite" suppressHydrationWarning>
        <div className="splash-inner">
          <div className="splash-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/tedu-logo.png" alt="TEDU English, Better English Brighter Futures" width={520} height={385} fetchPriority="high" />
          </div>
          <div className="splash-bar" aria-hidden="true">
            <i id="splash-fill" suppressHydrationWarning />
          </div>
          <p className="splash-text" id="splash-text" suppressHydrationWarning>
            Đang mở góc luyện tập…
          </p>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: script }} />
    </>
  );
}

