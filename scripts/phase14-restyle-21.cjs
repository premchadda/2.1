/**
 * Restyle ONE Phase-14 standalone HTML (GS 10th) to Trstprep 2.1 interface/style.
 * Keeps data (EXAM/MOCKS/META) + all quiz JS logic byte-identical; only the
 * shell (head/style/header/hero/footer/gate) is rebuilt with 2.1 design tokens.
 */
const fs = require('fs');
const path = require('path');

const SRC_ARG = process.argv[2] || 'GoalChasers_Phase14_GS_10th_Mocks.html';
const SRC = path.join(__dirname, '..', 'Phase 14', SRC_ARG);
const OUT_DIR = path.join(__dirname, '..', 'Phase 14', 'converted');
const OUT = path.join(OUT_DIR, SRC_ARG.replace(/\.html?$/i, '') + '_2.1.html');

const src = fs.readFileSync(SRC, 'utf8');
const jsStart = src.indexOf('<script>');
const jsEnd = src.indexOf('</script>');
if (jsStart < 0 || jsEnd < 0) throw new Error('script block not found');
let appJs = src.slice(jsStart + '<script>'.length, jsEnd);
// Remap the single legacy var reference (palette "current" swatch border) to brand;
// everything else in the quiz logic stays byte-identical.
appJs = appJs.replace(/var\(--gold\)/g, '#667eea');

// Page title from EXAM.en
const mExam = appJs.match(/const EXAM=(\{[\s\S]*?\});/);
let examEn = 'SSC Selection Post Phase-XIV · General Awareness Mock Tests';
try {
  const exam = eval('(' + mExam[1] + ')');
  if (exam.en) examEn = exam.en;
} catch (e) { /* keep fallback */ }

const css = `/* ===== Trstprep 2.1 interface — tokens (tokens.css + tailwind brand) ===== */
:root{
  --brand-start:#667eea;--brand-end:#764ba2;--brand-dark:#5a67d8;--brand-light:#e0e7ff;
  --bg:#f8f9fa;--surface:#ffffff;--surface-2:#f9fafb;--surface-3:#f3f4f6;
  --ink:#0f172a;--ink-2:#111827;--muted:#475569;--muted-3:#94a3b8;
  --line:#e2e8f0;--line-strong:#cbd5e1;
  --ok:#16a34a;--ok-bg:#dcfce7;--bad:#dc2626;--bad-bg:#fee2e2;--warn:#d97706;
  --r-sm:.375rem;--r-md:.5rem;--r-lg:.75rem;--r-xl:1rem;--r-2xl:1.5rem;
  --sh-soft:0 10px 30px rgba(0,0,0,.05);--sh-card:0 4px 6px -1px rgba(0,0,0,.1);
  --sh-hover:0 10px 25px rgba(0,0,0,.15);--sh-glow:0 5px 15px rgba(102,126,234,.4);
  --fluid-pad:clamp(.75rem,4vw,2rem);
}
*{box-sizing:border-box;margin:0;padding:0;min-width:0}
html{max-width:100%;width:100%;overflow-x:hidden;-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{background:var(--bg);color:var(--ink-2);font-family:'Segoe UI','Inter',system-ui,sans-serif;max-width:100%;overflow-x:hidden;min-height:100vh;min-height:100dvh;-webkit-overflow-scrolling:touch}
body.hi{font-family:'Noto Sans Devanagari','Segoe UI','Inter',system-ui,sans-serif}
button{font:inherit;cursor:pointer;border:0;background:none}
a{color:inherit;text-decoration:none}
img,video{max-width:100%;height:auto}
.hide{display:none!important}
::selection{background:rgba(102,126,234,.25)}
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:#94a3b8}

/* ===== 2.1 glass navbar (Navbar.jsx: bg-white/95 blur sticky) ===== */
#navbar,.glass-navbar{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.95);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid rgba(0,0,0,.08);box-shadow:0 10px 30px rgba(0,0,0,.05)}
.hd{max-width:80rem;margin:0 auto;padding:0 1rem;display:flex;height:3.5rem;min-height:3.5rem;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:nowrap}
.brand{display:flex;align-items:center;gap:.5rem;margin-right:auto;min-width:0}
.logo-mark{width:2rem;height:2rem;border-radius:.75rem;background:linear-gradient(135deg,var(--brand-start),var(--brand-end));display:grid;place-items:center;color:#fff;font-weight:900;font-size:.9rem;box-shadow:0 4px 6px -1px rgba(0,0,0,.1);flex:none}
.bname{font-weight:800;font-size:1.05rem;letter-spacing:-.02em;color:var(--ink-2);white-space:nowrap}
.bname b{background:linear-gradient(45deg,var(--brand-start),var(--brand-end));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.phase-pill{font-size:.65rem;font-weight:700;padding:.2rem .55rem;border-radius:999px;background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe;white-space:nowrap}
.nav-links{display:flex;align-items:center;gap:.25rem}
.nav-links a{padding:.45rem .8rem;border-radius:.5rem;font-size:.85rem;font-weight:600;color:#374151;position:relative;white-space:nowrap}
.nav-links a:hover{background:#f3f4f6}
.nav-links a.on{color:var(--brand-start)}
.nav-links a.on::after{content:'';position:absolute;bottom:0;left:.8rem;right:.8rem;height:2px;background:var(--brand-start);border-radius:2px}
.hd-actions{display:flex;align-items:center;gap:.5rem}
.hbtn{display:inline-flex;align-items:center;gap:.4rem;height:2.25rem;padding:0 .9rem;border-radius:1.125rem;font-weight:700;font-size:.8rem;white-space:nowrap;border:1px solid transparent}
.join{background:linear-gradient(135deg,var(--brand-start),var(--brand-end));color:#fff;box-shadow:0 4px 6px -1px rgba(0,0,0,.1);transition:all .3s}
.join:hover{transform:translateY(-2px);box-shadow:var(--sh-glow)}
.timer{background:rgba(59,130,246,.08);color:#1d4ed8;border-color:#bfdbfe;font-variant-numeric:tabular-nums}
.timer.warn{background:rgba(239,68,68,.1);color:var(--bad);border-color:#fecaca}
.mark{background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe;font-variant-numeric:tabular-nums}
.lang{display:inline-flex;background:#f3f4f6;border-radius:.5rem;padding:2px;height:2.25rem}
.lang button{background:transparent;color:#6b7280;border-radius:.375rem;padding:0 .7rem;font-weight:700;font-size:.78rem}
.lang button.on{background:#fff;color:var(--ink-2);box-shadow:var(--sh-card)}
.theme-btn{width:2.25rem;height:2.25rem;border-radius:.5rem;display:grid;place-items:center;background:#f3f4f6;color:#4b5563;font-size:1rem}
.theme-btn:hover{background:#e5e7eb}

/* ===== page container + breadcrumb (Layout.jsx / container-page) ===== */
main{width:100%;max-width:100%;margin:0 auto;padding:1.25rem var(--fluid-pad) 2.5rem;max-width:72rem}
.crumb{display:flex;align-items:center;gap:.4rem;font-size:.78rem;color:var(--muted);margin:0 .1rem .8rem}
.crumb b{color:var(--brand-start);font-weight:700}
.crumb .cur{color:var(--ink-2);font-weight:600}

/* ===== hero (Home.jsx gradient-mesh + glass-card) ===== */
.hero{position:relative;overflow:hidden;border-radius:20px;padding:1.6rem 1.6rem 1.4rem;color:#fff;
  background:radial-gradient(at 40% 20%,hsla(248,100%,76%,.35) 0px,transparent 50%),radial-gradient(at 80% 0%,hsla(189,100%,56%,.25) 0px,transparent 50%),radial-gradient(at 0% 50%,hsla(355,100%,93%,.25) 0px,transparent 50%),linear-gradient(135deg,#667eea,#764ba2);
  box-shadow:0 20px 40px rgba(0,0,0,.08);border:1px solid rgba(255,255,255,.3)}
.hero h1{font-size:clamp(1.25rem,3vw + .35rem,1.75rem);line-height:1.25;letter-spacing:-.02em;font-weight:800;max-width:46rem;position:relative;z-index:1}
.hero h1 span{background:linear-gradient(45deg,#fde68a,#fbbf24);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.hero .sub{margin-top:.4rem;font-size:.85rem;color:rgba(255,255,255,.85);position:relative;z-index:1}
.chips{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.9rem;position:relative;z-index:1}
.chip{background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3);backdrop-filter:blur(8px);border-radius:999px;padding:.35rem .75rem;font-size:.76rem;font-weight:600;color:#fff}
.chip b{font-weight:800}
.sect{font-weight:800;color:var(--ink-2);font-size:1.05rem;margin:1.4rem .1rem .7rem;display:flex;align-items:center;gap:.5rem}
.sect:before{content:'';width:5px;height:20px;border-radius:3px;background:linear-gradient(180deg,var(--brand-start),var(--brand-end))}

/* ===== mock cards (test-series-card) ===== */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:.9rem}
.mcard{background:#fff;border-radius:16px;border:1px solid #e5e7eb;padding:1rem;display:flex;flex-direction:column;gap:.65rem;box-shadow:var(--sh-card);transition:all .3s;position:relative;overflow:hidden;animation:slideUp .5s ease-out backwards}
.mcard::before{content:'';position:absolute;top:0;left:0;width:30%;height:4px;background:linear-gradient(90deg,var(--brand-start),var(--brand-end));border-radius:0 0 4px 0}
.mcard:hover{transform:translateY(-3px);box-shadow:var(--sh-hover);border-color:var(--brand-start)}
.mcard:nth-child(2){animation-delay:.05s}.mcard:nth-child(3){animation-delay:.1s}.mcard:nth-child(4){animation-delay:.15s}.mcard:nth-child(5){animation-delay:.2s}.mcard:nth-child(n+6){animation-delay:.25s}
.mtop{display:flex;align-items:center;gap:.65rem}
.mnum{width:2.6rem;height:2.6rem;border-radius:.75rem;background:linear-gradient(135deg,var(--brand-start),var(--brand-end));color:#fff;display:grid;place-items:center;font-weight:800;flex:none}
.mt{font-weight:700;color:var(--ink-2);font-size:.92rem}
.ms{font-size:.74rem;color:var(--muted);margin-top:2px}
.mmeta{display:flex;gap:.35rem;flex-wrap:wrap}
.mmeta span{font-size:.7rem;background:#f8f9fa;color:#555;border:1px solid #e5e7eb;border-radius:8px;padding:.2rem .45rem;font-weight:600}
.best{font-size:.74rem;color:var(--ok);font-weight:700;min-height:1rem}
.start{background:linear-gradient(135deg,var(--brand-start),var(--brand-end));color:#fff;border-radius:8px;height:2.5rem;font-weight:600;font-size:.8rem;width:100%;transition:all .3s}
.start:hover{transform:translateY(-1px);box-shadow:var(--sh-glow)}

/* ===== quiz (TestInterface.css: dark shell, sticky header, palette grid) ===== */
.qwrap{display:grid;grid-template-columns:1fr 290px;gap:1.25rem;align-items:start;animation:fadeIn .4s ease-out}
.qcard{background:#fff;border-radius:12px;border:1px solid #e5e7eb;box-shadow:0 1px 3px 0 rgba(0,0,0,.05);overflow:hidden}
.qbar{display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.75rem 1rem;background:#f9fafb;border-bottom:1px solid #e5e7eb}
.qno{font-weight:800;color:var(--ink-2)}
.qno span{display:inline-block;background:linear-gradient(135deg,var(--brand-start),var(--brand-end));color:#fff;border-radius:8px;padding:.15rem .55rem;margin-right:.4rem;font-size:.8rem}
.qsub{font-size:.76rem;color:var(--muted);font-weight:600}
.qbody{padding:1.1rem 1.1rem .5rem}
.qtext{font-size:1rem;line-height:1.65;color:var(--ink-2);overflow-wrap:anywhere;word-break:break-word}
.qtext p{margin-bottom:.25rem}
.qtext table{border-collapse:collapse;margin:.6rem auto;font-size:.92rem;display:block;max-width:100%;overflow-x:auto}
.qtext td{border:1px solid var(--line-strong);padding:.3rem .65rem;text-align:center;min-width:2rem}
.qtext tr:first-child td{background:#f8f9fa;font-weight:600}
.opts{display:grid;gap:.6rem;padding:.85rem 1.1rem 1.1rem}
.opt{display:flex;align-items:flex-start;gap:.75rem;text-align:left;background:#fff;border:1.5px solid var(--line);border-radius:.75rem;padding:.7rem .85rem;font-size:.94rem;line-height:1.5;color:var(--ink-2);transition:all .2s;width:100%}
.opt:hover{border-color:var(--brand-start);background:#eef2ff}
.opt .l{flex:none;width:1.75rem;height:1.75rem;border-radius:50%;background:#eef2ff;color:#4338ca;display:grid;place-items:center;font-weight:800;font-size:.8rem}
.opt.sel{border-color:var(--brand-start);background:#eef2ff}
.opt.sel .l{background:var(--brand-start);color:#fff}
.opt.right{border-color:var(--ok);background:#f0fdf4}
.opt.right .l{background:var(--ok);color:#fff}
.opt.wrong{border-color:var(--bad);background:#fef2f2}
.opt.wrong .l{background:var(--bad);color:#fff}
.opt .tag{margin-left:auto;font-size:.74rem;font-weight:700;white-space:nowrap;align-self:center}
.opt.right .tag{color:var(--ok)}.opt.wrong .tag{color:var(--bad)}
.review .opt{cursor:default}
.nav{display:flex;gap:.6rem;padding:0 1.1rem 1.1rem;flex-wrap:wrap}
.nbtn{height:2.75rem;border-radius:.7rem;padding:0 1.1rem;font-weight:700;font-size:.88rem;transition:all .3s}
.prev{background:#f3f4f6;color:var(--ink-2)}
.prev:hover{background:#e5e7eb}
.next{background:linear-gradient(135deg,var(--brand-start),var(--brand-end));color:#fff;margin-left:auto}
.next:hover{transform:translateY(-1px);box-shadow:var(--sh-glow)}
.clear{background:transparent;color:var(--muted);border:1px solid var(--line)}
.nbtn:disabled{opacity:.4;cursor:not-allowed}
.side{background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:1rem;position:sticky;top:4.5rem;box-shadow:0 1px 3px 0 rgba(0,0,0,.05)}
.side h3{font-size:.85rem;color:var(--ink-2);font-weight:700;margin-bottom:.6rem}
.pal{display:grid;grid-template-columns:repeat(5,1fr);gap:5px}
.pal button{height:1.75rem;width:100%;display:flex;align-items:center;justify-content:center;border-radius:3px;font-size:.72rem;font-weight:600;cursor:pointer;border:1px solid #e5e7eb;background:#fff;color:#000;transition:all .2s}
.pal button.ans{background:#22c55e;color:#fff;border-color:#16a34a}
.pal button.cur{border:2px solid #2563eb;transform:scale(1.08);z-index:10}
.pal button.pc{background:#22c55e;color:#fff}
.pal button.pw{background:#ef4444;color:#fff}
.pal button.ps{background:#e2e8f0;color:#64748b}
.legend{display:flex;flex-wrap:wrap;gap:.5rem .75rem;margin:.75rem 0 .85rem;font-size:.74rem;color:var(--muted)}
.legend i{display:inline-block;width:.75rem;height:.75rem;border-radius:3px;margin-right:.3rem;vertical-align:-2px}
.submit{width:100%;height:2.875rem;border-radius:.75rem;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-weight:700;font-size:.92rem;transition:all .3s}
.submit:hover{box-shadow:0 0 15px rgba(16,185,129,.4)}
.back{width:100%;height:2.6rem;border-radius:.75rem;background:#f3f4f6;color:var(--ink-2);font-weight:700;margin-top:.5rem}

/* ===== result (stats-card + progress + donut) ===== */
.res{background:#fff;border-radius:20px;border:1px solid #e5e7eb;padding:1.4rem;box-shadow:var(--sh-soft);margin-bottom:1.1rem;animation:scaleIn .5s ease-out}
.res h2{color:var(--ink-2);font-size:1.2rem;letter-spacing:-.02em}
.res h2 span{background:linear-gradient(45deg,var(--brand-start),var(--brand-end));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.res .rs{color:var(--muted);font-size:.8rem;margin-top:.25rem}
.rgrid{display:grid;grid-template-columns:260px 1fr;gap:1.4rem;align-items:center;margin-top:1rem}
.donut{position:relative;width:240px;height:240px;margin:0 auto}
.donut .c{position:absolute;inset:0;display:grid;place-items:center;text-align:center}
.donut .c b{display:block;font-size:2.1rem;color:var(--ink-2);font-weight:800}
.donut .c span{font-size:.76rem;color:var(--muted);font-weight:600}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem}
.st{border-radius:.9rem;padding:.85rem;border:1px solid #e5e7eb;background:#fff;transition:all .3s}
.st:hover{box-shadow:0 8px 25px rgba(0,0,0,.12)}
.st .k{font-size:.72rem;color:var(--muted);font-weight:600}
.st .v{font-size:1.5rem;font-weight:800;margin-top:.25rem;color:var(--ink-2)}
.st .p{font-size:.74rem;font-weight:700;margin-top:.15rem}
.st.c{background:#f0fdf4;border-color:#bbf7d0}.st.c .v,.st.c .p{color:var(--ok)}
.st.w{background:#fef2f2;border-color:#fecaca}.st.w .v,.st.w .p{color:var(--bad)}
.st.u .v,.st.u .p{color:#64748b}
.st.s{background:linear-gradient(135deg,var(--brand-start),var(--brand-end));border-color:transparent}.st.s .k{color:#c7d2fe}.st.s .v{color:#fff}
.bars{margin-top:1rem;display:flex;height:.75rem;border-radius:6px;overflow:hidden;background:#e5e7eb}
.bars i{display:block;height:100%}
.ract{display:flex;gap:.6rem;flex-wrap:wrap;margin-top:1rem}
.ract button,.ract a{height:2.6rem;border-radius:.7rem;padding:0 1rem;font-weight:700;display:inline-flex;align-items:center;font-size:.85rem;transition:all .3s}
.rv{background:linear-gradient(135deg,var(--brand-start),var(--brand-end));color:#fff}
.rv:hover{transform:translateY(-2px);box-shadow:var(--sh-glow)}
.rh{background:#f3f4f6;color:var(--ink-2)}
.rj{background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff}

/* ===== gate modal (Modal.jsx z overlay + glass card) ===== */
.gate{position:fixed;inset:0;z-index:99990;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);display:grid;place-items:center;padding:1rem}
.gbox{width:100%;max-width:25rem;background:#fff;color:var(--ink-2);border-radius:1.5rem;padding:1.6rem 1.4rem 1.25rem;text-align:center;border:1px solid var(--line);box-shadow:0 20px 40px rgba(0,0,0,.12);animation:scaleIn .25s ease-out}
.glogo{width:3.5rem;height:3.5rem;margin:0 auto;border-radius:1rem;background:linear-gradient(135deg,var(--brand-start),var(--brand-end));display:grid;place-items:center;color:#fff;font-size:1.6rem;font-weight:900;box-shadow:var(--sh-glow)}
.gt{font-weight:800;letter-spacing:.04em;font-size:1.25rem;margin-top:.85rem}
.gt b{background:linear-gradient(45deg,var(--brand-start),var(--brand-end));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.gsub{font-size:.8rem;color:var(--muted);margin-top:.25rem}
.gl{list-style:none;text-align:left;margin:1rem 0 1.1rem;display:grid;gap:.5rem}
.gl li{background:#f9fafb;border:1px solid #e5e7eb;border-radius:.65rem;padding:.55rem .75rem;font-weight:600;font-size:.85rem}
.gjoin{display:flex;align-items:center;justify-content:center;width:100%;height:3rem;border-radius:.8rem;background:linear-gradient(135deg,var(--brand-start),var(--brand-end));color:#fff;font-weight:700;font-size:.95rem}
.gjoin:hover{transform:translateY(-2px);box-shadow:var(--sh-glow)}
.gskip{margin-top:.6rem;background:transparent;color:var(--muted);font-weight:600;font-size:.84rem;padding:.4rem .9rem}

/* ===== footer (Footer.jsx: gray-900 grid) + bottom nav ===== */
.tsp-footer{background:#111827;border-top:1px solid #1f2937;color:#9ca3af;padding:2.5rem 0 calc(6.5rem + env(safe-area-inset-bottom,0px));margin-top:2.5rem}
.tsp-footer .fw{max-width:80rem;margin:0 auto;padding:0 1rem}
.fgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.5rem;margin-bottom:2rem}
@media(min-width:768px){.fgrid{grid-template-columns:repeat(4,minmax(0,1fr));gap:2rem}.tsp-footer{padding-bottom:2.5rem}}
.fbrand{display:flex;align-items:center;gap:.5rem;margin-bottom:.6rem}
.fbrand .logo-mark{width:2rem;height:2rem}
.fbrand span{color:#fff;font-weight:800;font-size:1.1rem;letter-spacing:-.02em}
.fdesc{font-size:.74rem;line-height:1.6;max-width:22rem;margin-bottom:.75rem}
.live-pill{display:inline-flex;align-items:center;gap:.4rem;padding:.25rem .65rem;border-radius:999px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.4);font-size:.68rem;font-weight:600;color:#a5b4fc}
.live-dot{width:.4rem;height:.4rem;border-radius:50%;background:#34d399;animation:pulseDot 2s infinite}
.fcol h4{color:#fff;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.75rem}
.fcol ul{list-style:none;display:grid;gap:.5rem;font-size:.74rem}
.fcol a:hover{color:#fff}
.fbottom{border-top:1px solid #1f2937;padding-top:1.25rem;display:flex;justify-content:space-between;gap:.75rem;flex-wrap:wrap;font-size:.72rem;color:#6b7280}
.bottom-nav{position:fixed;bottom:0;left:0;right:0;z-index:10000;background:rgba(255,255,255,.95);backdrop-filter:blur(12px);border-top:1px solid var(--line);display:flex;justify-content:space-around;padding:.5rem .25rem calc(.5rem + env(safe-area-inset-bottom,0px))}
.bottom-nav button{display:flex;flex-direction:column;align-items:center;gap:.15rem;font-size:.65rem;font-weight:600;color:var(--muted);padding:.25rem .75rem;border-radius:.5rem}
.bottom-nav button.on{color:var(--brand-start)}
@media(min-width:768px){.bottom-nav{display:none}}

/* ===== animations + focus (2.1) ===== */
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes scaleIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
@keyframes pulseDot{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes pop{from{transform:scale(.92);opacity:0}to{transform:none;opacity:1}}
input:focus,button:focus,a:focus{outline:none;box-shadow:0 0 0 2px rgba(102,126,234,.3)}

/* ===== dark mode (2.1: html.dark, surfaces #1f2937) ===== */
html.dark body,.dark body{background:#111827;color:#f3f4f6}
html.dark{color-scheme:dark}
html.dark ::-webkit-scrollbar-thumb{background:#475569}
html.dark #navbar{background:rgba(17,24,39,.95);border-color:rgba(55,65,81,.5)}
html.dark .bname{color:#f3f4f6}
html.dark .nav-links a{color:#d1d5db}
html.dark .nav-links a:hover{background:#374151}
html.dark .lang{background:#374151}
html.dark .lang button{color:#9ca3af}
html.dark .lang button.on{background:#1f2937;color:#f3f4f6}
html.dark .theme-btn{background:#374151;color:#e5e7eb}
html.dark .crumb{color:#9ca3af}
html.dark .crumb .cur{color:#f3f4f6}
html.dark .sect{color:#f3f4f6}
html.dark .mcard,html.dark .qcard,html.dark .side,html.dark .res,html.dark .st{background:#1f2937;border-color:#374151}
html.dark .mt,html.dark .qno,html.dark .qtext,html.dark .res h2,html.dark .side h3{color:#f3f4f6}
html.dark .ms,html.dark .qsub,html.dark .res .rs{color:#9ca3af}
html.dark .mmeta span{background:#374151;color:#d1d5db;border-color:#4b5563}
html.dark .qbar{background:#111827;border-color:#374151}
html.dark .opt{background:#1f2937;border-color:#4b5563;color:#e5e7eb}
html.dark .opt:hover{border-color:#818cf8;background:rgba(129,140,248,.1)}
html.dark .opt.sel{border-color:#818cf8;background:rgba(129,140,248,.12)}
html.dark .prev,html.dark .clear,html.dark .back,html.dark .rh{background:#374151;color:#e5e7eb;border-color:#4b5563}
html.dark .pal button{background:#374151;color:#e5e7eb;border-color:#4b5563}
html.dark .gbox{background:#1f2937;color:#f3f4f6;border-color:#374151}
html.dark .gl li{background:#111827;border-color:#374151}
html.dark .gskip{color:#9ca3af}
html.dark .bottom-nav{background:rgba(17,24,39,.95);border-color:#374151}

@media(max-width:860px){.qwrap{grid-template-columns:1fr}.side{position:static}.rgrid{grid-template-columns:1fr}.nav-links{display:none}}
@media(max-width:560px){.hd{gap:.5rem;padding:0 .75rem}.bname{font-size:.92rem}.phase-pill{display:none}.hbtn{height:2rem;padding:0 .65rem;font-size:.72rem}.lang{height:2rem}.stats{grid-template-columns:repeat(2,1fr)}.qtext{font-size:.95rem}.hero h1{font-size:1.15rem}.fgrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media print{#navbar .join,.gate,.nav,.side .submit,.side .back,.ract,.bottom-nav,.tsp-footer{display:none!important}}
`;

const bodyTop = `<nav id="navbar" class="glass-navbar" aria-label="Primary">
  <div class="hd">
    <div class="brand"><div class="logo-mark">⚡</div><div class="bname">Trst<b>prep</b></div><span class="phase-pill">Phase-XIV · Mock Lab</span></div>
    <div class="nav-links" aria-label="Sections">
      <a href="#" class="on">Home</a><a href="#">Exams</a><a href="#">Test Series</a><a href="#">Study</a>
    </div>
    <div class="hd-actions">
      <a class="hbtn join" href="https://t.me/GOAL_CHASERS_UPDATESS" target="_blank" rel="noopener">✈ Join Channel</a>
      <div class="hbtn timer hide" id="timer">⏱ 15:00</div>
      <div class="hbtn mark">+2 / −0.5</div>
      <div class="lang"><button id="lEn" class="on" onclick="setLang('en')">English</button><button id="lHi" onclick="setLang('hi')">हिन्दी</button></div>
      <button class="theme-btn" id="themeBtn" onclick="toggleTspTheme()" title="Toggle dark mode">🌙</button>
    </div>
  </div>
</nav>

<main>
  <!-- HOME -->
  <section id="home">
    <div class="crumb"><b>Trstprep</b><span>›</span><span>Test Series</span><span>›</span><span class="cur" id="crumbCur">General Awareness Mocks</span></div>
    <div class="hero">
      <h1 id="hTitle"></h1>
      <div class="sub" id="hSub"></div>
      <div class="chips" id="hChips"></div>
    </div>
    <div class="sect" id="hSect"></div>
    <div class="grid" id="mgrid"></div>
  </section>

  <!-- QUIZ -->
  <section id="quiz" class="hide">
    <div id="resBox"></div>
    <div class="qwrap">
      <div class="qcard" id="qcard">
        <div class="qbar"><div class="qno" id="qno"></div><div class="qsub" id="qsub"></div></div>
        <div class="qbody"><div class="qtext" id="qtext"></div></div>
        <div class="opts" id="opts"></div>
        <div class="nav">
          <button class="nbtn prev" id="bPrev" onclick="go(cur-1)"></button>
          <button class="nbtn clear" id="bClear" onclick="clearAns()"></button>
          <button class="nbtn next" id="bNext" onclick="go(cur+1)"></button>
        </div>
      </div>
      <aside class="side">
        <h3 id="palT"></h3>
        <div class="pal" id="pal"></div>
        <div class="legend" id="legend"></div>
        <button class="submit" id="bSubmit" onclick="askSubmit()"></button>
        <button class="back" id="bBack" onclick="goHome()"></button>
      </aside>
    </div>
  </section>
</main>

<!-- JOIN GATE -->
<div class="gate" id="gate">
  <div class="gbox">
    <div class="glogo">⚡</div>
    <div class="gt">Trst<b>prep</b></div>
    <div class="gsub">Phase-XIV Mock Lab · bilingual · +2 / −0.5</div>
    <ul class="gl"><li>25 Questions · 50 Marks · 15 Minutes</li><li>English + हिन्दी medium</li><li>Best score saved on this device</li></ul>
    <a class="gjoin" href="https://t.me/GOAL_CHASERS_UPDATESS" target="_blank" rel="noopener" onclick="closeGate()">🔔 Join Telegram Channel</a>
    <button class="gskip" onclick="closeGate()">Skip</button>
  </div>
</div>

<footer class="tsp-footer" role="contentinfo">
  <div class="fw">
    <div class="fgrid">
      <div>
        <div class="fbrand"><div class="logo-mark">⚡</div><span>Trstprep</span></div>
        <p class="fdesc">India's high-yield AI test preparation platform for SSC, Railways, Banking, and State Government exams.</p>
        <div class="live-pill"><span class="live-dot"></span>Live Mock System Active</div>
      </div>
      <div class="fcol"><h4>Tests &amp; Practice</h4><ul><li><a href="#">Test Series</a></li><li><a href="#">Live Tests</a></li><li><a href="#">Previous Year Papers</a></li><li><a href="#">Practice Lab</a></li><li><a href="#">All-India Leaderboard</a></li></ul></div>
      <div class="fcol"><h4>Study Resources</h4><ul><li><a href="#">Study Materials &amp; Notes</a></li><li><a href="#">Video Lectures</a></li><li><a href="#">Daily Current Affairs</a></li><li><a href="#">Blog</a></li></ul></div>
      <div class="fcol"><h4>Support</h4><ul><li><a href="#">About</a></li><li><a href="#">Contact</a></li><li><a href="#">FAQ</a></li><li><a href="#">Terms &amp; Privacy</a></li></ul></div>
    </div>
    <div class="fbottom"><span>© Trstprep · Phase-XIV Mock Lab (converted to 2.1 interface)</span><span>Dark mode · Bilingual · Mobile responsive</span></div>
  </div>
</footer>
<nav class="bottom-nav" aria-label="Mobile">
  <button class="on" onclick="goHome()">⌂<span>Home</span></button>
  <button onclick="document.getElementById('mgrid').scrollIntoView({behavior:'smooth'})">📝<span>Mocks</span></button>
  <button onclick="toggleTspTheme()">🌙<span>Theme</span></button>
</nav>
`;

const themeJs = `
function toggleTspTheme(){
  const d=document.documentElement.classList.toggle('dark');
  try{localStorage.setItem('tsp-theme',d?'dark':'light')}catch(e){}
  const b=document.getElementById('themeBtn');if(b)b.textContent=d?'☀️':'🌙';
}
(function(){
  try{
    const saved=localStorage.getItem('tsp-theme');
    const prefersDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
    if(saved==='dark'||(!saved&&prefersDark)){document.documentElement.classList.add('dark')}
  }catch(e){}
  const isDark=document.documentElement.classList.contains('dark');
  const b=document.getElementById('themeBtn');if(b)b.textContent=isDark?'☀️':'🌙';
  const sub=document.getElementById('hSub');
  if(sub)sub.textContent='Bilingual mock lab · 9 shifts · best score on this device';
  const crumb=document.getElementById('crumbCur');
  try{if(crumb&&typeof EXAM!=='undefined'&&EXAM.hl)crumb.textContent=EXAM.hl[0]+' Mocks'}catch(e){}
})();
`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${examEn} · Trstprep 2.1 Mock Lab</title>
<style>${css}
</style>
</head>
<body>
${bodyTop}
<script>${appJs}
${themeJs}
</script>
</body>
</html>
`;

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');
console.log('Wrote ' + OUT + ' (' + html.length + ' chars, appJs ' + appJs.length + ')');
