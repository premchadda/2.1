import { useState, useEffect, useCallback } from "react";

// FIX BUG-014: Use shared api client instead of raw fetch
import { adminAPI } from '../../../shared/lib/dataService'

// ─── HOOKS FOR DYNAMIC DATA ────────────────────────────────────────────────────
function useExamCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const res = await adminAPI.apiClient.get('/admin/exam-categories');
        const data = res.data?.success ? res.data.data : [];
        setCategories(data.filter(c => c.isActive !== false));
      } catch (e) { console.error("Failed to fetch exam categories:", e); }
      finally { setLoading(false); }
    })();
  }, []);
  return { categories, loading };
}

// FIX BUG-035: Removed duplicate useStages - use shared hook from packages/shared-hooks
// This local copy was dead code since the shared hook is exported

function useTestCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const res = await adminAPI.apiClient.get('/admin/test-categories');
        const data = res.data?.success ? res.data.data : [];
        setCategories(data.filter(c => c.isActive !== false));
      } catch (e) { console.error("Failed to fetch test categories:", e); }
      finally { setLoading(false); }
    })();
  }, []);
  return { categories, loading };
}

function useTests() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const res = await adminAPI.getTests();
        setTests(res.data?.data || []);
      } catch (e) { console.error("Failed to fetch tests:", e); }
      finally { setLoading(false); }
    })();
  }, []);
  return { tests, loading };
}

function useQuestions() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        // FIX PQ-01: Load explicitly from the dedicated practice questions endpoint
        const res = await adminAPI.apiClient.get('/admin/questions/practice');
        setQuestions(res.data?.data || []);
      } catch (e) { console.error("Failed to fetch questions:", e); }
      finally { setLoading(false); }
    })();
  }, [refreshKey]);
  return { questions, loading, refetch };
}

// FIX: Load SUBJECT_TREE from API instead of hardcoding
function useSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const res = await adminAPI.apiClient.get('/admin/subjects');
        const data = res.data?.success ? res.data.data : [];
        setSubjects(data.map(s => ({
          id: String(s.id || s._id),
          label: s.name || s.title || 'Untitled',
          icon: s.icon || '📚',
          color: s.color || '#f59e0b',
        })));
      } catch (e) { console.error("Failed to fetch subjects:", e); }
      finally { setLoading(false); }
    })();
  }, []);
  return { subjects, loading };
}

const SECTIONS     = ["Reasoning","Mathematics","English","General Knowledge"];
const DIFFS        = ["Easy","Medium","Hard"];
const TYPES        = ["MCQ","multi-select","numeric","descriptive"];
const STATUSES_Q   = ["draft","active","disabled"];
const LANGS        = ["English","Hindi","Bilingual"];

const SEC_COLORS = {
  Reasoning:          { bg:"rgba(99,102,241,.15)",  text:"#818cf8", icon:"◈" },
  Mathematics:        { bg:"rgba(245,158,11,.15)",  text:"#fbbf24", icon:"∑" },
  English:            { bg:"rgba(16,185,129,.15)",  text:"#34d399", icon:"∆" },
  "General Knowledge":{ bg:"rgba(236,72,153,.15)",  text:"#f472b6", icon:"⬡" },
};

const TEST_DATA = [
  { id:"t001", exam:"ssc-cgl", stage:"tier1", category:"Mock Tests", subcategory:"Full Mock",  title:"SSC CGL Mock 01",      date:"2025-01-15", duration:60,  totalQ:100, totalMarks:200, status:"live",  attempts:1247, avgScore:142 },
  { id:"t002", exam:"ssc-cgl", stage:"tier1", category:"Mock Tests", subcategory:"Full Mock",  title:"SSC CGL Mock 02",      date:"2025-01-22", duration:60,  totalQ:100, totalMarks:200, status:"live",  attempts:982,  avgScore:138 },
  { id:"t003", exam:"ssc-cgl", stage:"tier1", category:"Mock Tests", subcategory:"Mini Mock",  title:"Quant Booster #1",     date:"2025-02-01", duration:20,  totalQ:25,  totalMarks:50,  status:"draft", attempts:0,    avgScore:0   },
  { id:"t004", exam:"ssc-cgl", stage:"tier1", category:"Mock Tests", subcategory:"Sectional",  title:"Reasoning Drill #1",   date:"2025-01-18", duration:20,  totalQ:25,  totalMarks:50,  status:"live",  attempts:543,  avgScore:38  },
  { id:"t005", exam:"ssc-cgl", stage:"tier1", category:"PYPs",       subcategory:"Full Mock",  title:"CGL 2023 Paper 1",     date:"2024-09-10", duration:60,  totalQ:100, totalMarks:200, status:"live",  attempts:3210, avgScore:156 },
  { id:"t006", exam:"ssc-cgl", stage:"tier2", category:"Mock Tests", subcategory:"Full Mock",  title:"CGL Tier 2 Mock 01",   date:"2025-02-10", duration:120, totalQ:150, totalMarks:300, status:"draft", attempts:0,    avgScore:0   },
  { id:"t007", exam:"ssc-cgl", stage:"tier1", category:"Mock Tests", subcategory:"Live Test",  title:"Live Test – Jan 2025", date:"2025-01-05", duration:60,  totalQ:100, totalMarks:200, status:"ended", attempts:2891, avgScore:161 },
  { id:"t008", exam:"ssc-chsl",stage:"tier1", category:"Mock Tests", subcategory:"Full Mock",  title:"CHSL Mock 01",         date:"2025-01-20", duration:60,  totalQ:100, totalMarks:200, status:"live",  attempts:672,  avgScore:131 },
  { id:"t009", exam:"rrb-ntpc",stage:"cbt1",  category:"Mock Tests", subcategory:"Full Mock",  title:"NTPC CBT1 Mock 01",    date:"2025-01-28", duration:90,  totalQ:100, totalMarks:100, status:"live",  attempts:891,  avgScore:71  },
];

const MOCK_QUESTIONS = [
  { id:"q001", text:"If 40% of a number is 120, what is 60% of the same number?", type:"MCQ", subject:"Quantitative Aptitude", chapter:"Percentage", topic:"% of a Number", difficulty:"Easy", status:"active", marks:2, negMarks:0.5, options:["160","180","200","220"], answer:"2", version:3 },
  { id:"q002", text:"A shopkeeper sells at 20% profit. CP is ₹500. Find SP.", type:"MCQ", subject:"Quantitative Aptitude", chapter:"Profit & Loss", topic:"Basic", difficulty:"Easy", status:"active", marks:2, negMarks:0.5, options:["₹550","₹580","₹600","₹620"], answer:"2", version:1 },
  { id:"q003", text:"'His mother is the only daughter of my mother.' Relation?", type:"MCQ", subject:"Reasoning", chapter:"Blood Relations", topic:"Family Tree", difficulty:"Medium", status:"active", marks:2, negMarks:0.5, options:["Aunt","Mother","Sister","Daughter"], answer:"1", version:2 },
  { id:"q004", text:"MONKEY is XDJMNL. How is TIGER written?", type:"MCQ", subject:"Reasoning", chapter:"Coding-Decoding", topic:"Letter Shift", difficulty:"Medium", status:"draft", marks:2, negMarks:0.5, options:["QDFHS","SHFDE","PIGER","UJHFS"], answer:"0", version:1 },
  { id:"q005", text:"'A bolt from the blue' means:", type:"MCQ", subject:"English Language", chapter:"Vocabulary", topic:"Idioms", difficulty:"Medium", status:"active", marks:1, negMarks:0.25, options:["Sudden surprise","Lightning","Bad news","Heavy rain"], answer:"0", version:1 },
  { id:"q006", text:"Preamble amended by which Constitutional Amendment?", type:"MCQ", subject:"General Knowledge", chapter:"Indian Polity", topic:"Amendments", difficulty:"Hard", status:"active", marks:2, negMarks:0.5, options:["42nd","44th","52nd","61st"], answer:"0", version:2 },
  { id:"q007", text:"√(169 × 196) = ?", type:"numeric", subject:"Quantitative Aptitude", chapter:"Number System", topic:"Square Roots", difficulty:"Easy", status:"draft", marks:2, negMarks:0, options:[], answer:"182", version:1 },
  { id:"q008", text:"Which statements about photosynthesis are CORRECT? (Select all)", type:"multi-select", subject:"General Knowledge", chapter:"Science", topic:"Biology", difficulty:"Hard", status:"disabled", marks:3, negMarks:0, options:["Occurs in chloroplasts","Produces oxygen","Requires glucose","Uses CO₂"], answer:"0,1,3", version:4 },
];

// ─── REST OF CSS AND COMPONENT CODE ──────────────────────────────────────────
const getCSS = (dark) => `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --ff:'Space Grotesk',sans-serif;--fm:'JetBrains Mono',monospace;
  ${dark ? `
  --bg0:#0b0e16;--bg1:#121520;--bg2:#181d2a;--bg3:#1e2435;
  --bg-grad:linear-gradient(135deg,#0d1117 0%,#0e1525 40%,#130d1f 100%);
  --card-bg:rgba(18,21,32,0.85);--b1:#252d42;--b2:#2e3a52;
  --t1:#e8edf8;--t2:#8898b8;--t3:#4a5670;--ac:#f59e0b;--ac2:#fbbf24;
  --in:#7c7fff;--gr:#22d3a2;--re:#ff6b6b;--pk:#f472b6;--sk:#38bdf8;
  --shadow:0 4px 24px rgba(0,0,0,.5);--glow-ac:0 0 20px rgba(245,158,11,.15);
  --step-done:#22d3a2;--step-act:#f59e0b;--step-idle:#2e3a52;`
    : `
  --bg0:#f0f4ff;--bg1:#ffffff;--bg2:#f5f7fe;--bg3:#eef1fb;
  --bg-grad:linear-gradient(135deg,#e8eeff 0%,#f5f0ff 40%,#fff0f8 100%);
  --card-bg:rgba(255,255,255,0.92);--b1:#dde3f5;--b2:#c8d2ec;
  --t1:#0f172a;--t2:#475569;--t3:#94a3b8;--ac:#d97706;--ac2:#b45309;
  --in:#4f46e5;--gr:#059669;--re:#dc2626;--pk:#db2777;--sk:#0284c7;
  --shadow:0 4px 24px rgba(0,0,0,.08);--glow-ac:0 0 20px rgba(217,119,6,.08);
  --step-done:#059669;--step-act:#d97706;--step-idle:#dde3f5;`
}
html,body{height:100%;overflow:hidden;}
body{font-family:var(--ff);background:var(--bg-grad);color:var(--t1);transition:all .3s;}
.app{display:flex;height:100vh;overflow:hidden;position:relative;}
.app::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background:${dark ? `radial-gradient(ellipse 80% 60% at 20% 10%,rgba(99,102,241,.07) 0%,transparent 60%),radial-gradient(ellipse 60% 80% at 80% 80%,rgba(236,72,153,.05) 0%,transparent 60%),radial-gradient(ellipse 50% 50% at 50% 50%,rgba(245,158,11,.03) 0%,transparent 70%)` : `radial-gradient(ellipse 80% 60% at 20% 10%,rgba(99,102,241,.06) 0%,transparent 60%),radial-gradient(ellipse 60% 80% at 80% 80%,rgba(236,72,153,.04) 0%,transparent 60%),radial-gradient(ellipse 50% 50% at 50% 50%,rgba(245,158,11,.03) 0%,transparent 70%)`};
}
.sc{scrollbar-width:thin;scrollbar-color:var(--b2) transparent;}
.sc::-webkit-scrollbar{width:4px;height:4px;}
.sc::-webkit-scrollbar-thumb{background:var(--b2);border-radius:3px;}
.sidebar{position:relative;z-index:10;width:230px;flex-shrink:0;background:var(--card-bg);border-right:1px solid var(--b1);display:flex;flex-direction:column;overflow:hidden;transition:transform .28s ease,background .3s;backdrop-filter:blur(12px);}
.sb-logo{padding:15px 17px;border-bottom:1px solid var(--b1);display:flex;align-items:center;gap:9px;flex-shrink:0;}
.sb-mark{width:30px;height:30px;background:var(--ac);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#fff;flex-shrink:0;box-shadow:0 0 12px rgba(245,158,11,.4);}
.sb-name{font-size:14px;font-weight:700;letter-spacing:-.3px;}
.sb-sub{font-size:10px;color:var(--t3);font-family:var(--fm);letter-spacing:1px;text-transform:uppercase;}
.sb-nav{flex:1;overflow-y:auto;padding:7px 0;}
.sb-sec{padding:6px 14px 3px;font-size:10px;color:var(--t3);letter-spacing:1.5px;text-transform:uppercase;font-family:var(--fm);}
.sb-item{display:flex;align-items:center;gap:8px;padding:8px 13px;cursor:pointer;font-size:13px;color:var(--t2);transition:all .13s;border-left:2px solid transparent;border-radius:0 6px 6px 0;margin-right:8px;}
.sb-item:hover{color:var(--t1);background:var(--bg3);}
.sb-item.on{color:var(--ac);background:rgba(245,158,11,.1);border-left-color:var(--ac);font-weight:600;}
.sb-ic{font-size:13px;width:15px;text-align:center;flex-shrink:0;}
.sb-badge{margin-left:auto;background:var(--bg3);color:var(--t3);font-size:10px;font-family:var(--fm);padding:1px 5px;border-radius:3px;}
.sb-item.on .sb-badge{background:rgba(245,158,11,.15);color:var(--ac);}
.sb-foot{padding:11px 13px;border-top:1px solid var(--b1);font-size:11px;color:var(--t3);font-family:var(--fm);flex-shrink:0;}
.ovl{display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:290;backdrop-filter:blur(2px);}
.ovl.on{display:block;}
.main{position:relative;z-index:1;flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;}
.topbar{height:50px;background:var(--card-bg);border-bottom:1px solid var(--b1);display:flex;align-items:center;padding:0 16px;gap:8px;flex-shrink:0;backdrop-filter:blur(12px);}
.tb-burg{display:none;background:none;border:1px solid var(--b2);color:var(--t2);border-radius:5px;padding:5px 8px;font-size:14px;cursor:pointer;flex-shrink:0;line-height:1;}
.tb-ttl{font-size:13px;font-weight:600;white-space:nowrap;}
.tb-sep{color:var(--t3);}
.tb-sub{font-size:12px;color:var(--t2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;}
.tb-r{margin-left:auto;display:flex;gap:6px;flex-shrink:0;align-items:center;}
.content{flex:1;overflow:hidden;display:flex;flex-direction:column;}
.toggle-wrap{display:flex;align-items:center;gap:6px;}
.toggle-lbl{font-size:11px;color:var(--t3);}
.toggle{width:36px;height:20px;background:var(--b2);border-radius:10px;cursor:pointer;position:relative;transition:background .2s;flex-shrink:0;border:none;}
.toggle.on{background:var(--ac);}
.toggle::after{content:'';position:absolute;top:3px;left:3px;width:14px;height:14px;background:#fff;border-radius:50%;transition:transform .2s;box-shadow:0 1px 4px rgba(0,0,0,.3);}
.toggle.on::after{transform:translateX(16px);}
.bnav{display:none;height:56px;background:var(--card-bg);border-top:1px solid var(--b1);align-items:center;justify-content:space-around;flex-shrink:0;backdrop-filter:blur(12px);}
.bn-i{display:flex;flex-direction:column;align-items:center;gap:3px;padding:5px 8px;cursor:pointer;border-radius:7px;flex:1;transition:all .12s;}
.bn-i.on{background:rgba(245,158,11,.1);}
.bn-ic{font-size:18px;color:var(--t3);}
.bn-i.on .bn-ic{color:var(--ac);}
.bn-lb{font-size:9px;color:var(--t3);font-family:var(--fm);text-transform:uppercase;letter-spacing:.5px;}
.bn-i.on .bn-lb{color:var(--ac);}
.btn{display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:7px;font-family:var(--ff);font-size:13px;font-weight:500;cursor:pointer;transition:all .13s;border:none;white-space:nowrap;flex-shrink:0;}
.btn-p{background:var(--ac);color:#fff;box-shadow:0 2px 8px rgba(245,158,11,.3);}
.btn-p:hover{background:var(--ac2);transform:translateY(-1px);}
.btn-draft{background:var(--in);color:#fff;box-shadow:0 2px 8px rgba(99,102,241,.25);}
.btn-draft:hover{opacity:.9;transform:translateY(-1px);}
.btn-g{background:transparent;color:var(--t2);border:1px solid var(--b2);}.btn-g:hover{color:var(--t1);background:var(--bg3);}
.btn-d{background:rgba(255,107,107,.1);color:var(--re);border:1px solid rgba(255,107,107,.2);}
.sm{padding:4px 10px;font-size:12px;}.xs{padding:2px 7px;font-size:11px;}
.card{background:var(--card-bg);border:1px solid var(--b1);border-radius:12px;backdrop-filter:blur(8px);box-shadow:var(--shadow);}
.stat-row{display:flex;gap:10px;padding:14px 16px;overflow-x:auto;flex-shrink:0;}
.stat-row::-webkit-scrollbar{height:3px;}
.stat-card{background:var(--card-bg);border:1px solid var(--b1);border-radius:11px;padding:13px 15px;flex-shrink:0;min-width:148px;border-top-width:2px;backdrop-filter:blur(8px);box-shadow:var(--shadow);transition:transform .15s;}
.stat-card:hover{transform:translateY(-2px);}
.sc-icon{font-size:15px;margin-bottom:5px;}
.sc-val{font-size:20px;font-weight:700;font-family:var(--fm);}
.sc-lbl{font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.7px;margin-top:2px;}
.sc-dl{font-size:10px;color:var(--t3);margin-top:2px;font-family:var(--fm);}
.b{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:500;font-family:var(--fm);white-space:nowrap;}
.ba{background:rgba(34,211,162,.12);color:var(--gr);}
.bdr{background:rgba(124,127,255,.12);color:var(--in);}
.bdi{background:rgba(255,107,107,.12);color:var(--re);}
.be{background:rgba(34,211,162,.08);color:var(--gr);}
.bm{background:rgba(245,158,11,.08);color:var(--ac);}
.bh{background:rgba(255,107,107,.08);color:var(--re);}
.bmc{background:rgba(56,189,248,.08);color:var(--sk);}
.bms{background:rgba(244,114,182,.08);color:var(--pk);}
.bnn{background:rgba(124,127,255,.08);color:var(--in);}
.browser{flex:1;display:flex;flex-direction:column;overflow:hidden;}
.exam-tabs{display:flex;padding:0 16px;background:var(--card-bg);border-bottom:1px solid var(--b1);overflow-x:auto;flex-shrink:0;backdrop-filter:blur(8px);}
.exam-tabs::-webkit-scrollbar{height:2px;}
.exam-tab{display:flex;align-items:center;gap:7px;padding:11px 16px;cursor:pointer;font-size:13px;font-weight:500;color:var(--t2);border-bottom:2px solid transparent;transition:all .15s;white-space:nowrap;flex-shrink:0;}
.exam-tab:hover{color:var(--t1);}
.exam-tab.on{border-bottom-color:currentColor;}
.filter-strip{background:var(--card-bg);border-bottom:1px solid var(--b1);padding:10px 16px;display:flex;flex-direction:column;gap:8px;flex-shrink:0;}
.filter-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.filter-label{font-size:10px;color:var(--t3);font-family:var(--fm);letter-spacing:.8px;text-transform:uppercase;white-space:nowrap;width:80px;flex-shrink:0;}
.pill-row{display:flex;gap:5px;flex-wrap:wrap;}
.pill{padding:4px 12px;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;transition:all .13s;border:1px solid var(--b2);color:var(--t2);background:var(--bg2);white-space:nowrap;}
.pill:hover{color:var(--t1);border-color:var(--t3);}
.pill.on{background:var(--ac);color:#fff;border-color:var(--ac);box-shadow:0 2px 8px rgba(245,158,11,.3);}
.cards-area{flex:1;overflow-y:auto;padding:16px;}
.cards-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(265px,1fr));gap:12px;}
.test-card{background:var(--card-bg);border:1px solid var(--b1);border-radius:12px;cursor:pointer;transition:all .18s;overflow:hidden;backdrop-filter:blur(8px);}
.test-card:hover{border-color:var(--b2);transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,0,0,.2);}
.tc-head{padding:13px 14px 10px;}
.tc-badge-row{display:flex;align-items:center;gap:5px;margin-bottom:8px;}
.tc-title{font-size:14px;font-weight:600;color:var(--t1);margin-bottom:4px;line-height:1.3;}
.tc-date{font-size:11px;color:var(--t3);font-family:var(--fm);}
.tc-stats{padding:10px 14px;display:grid;grid-template-columns:1fr 1fr;gap:6px;border-top:1px solid var(--b1);}
.tc-stat-val{font-size:14px;font-weight:700;color:var(--t1);font-family:var(--fm);}
.tc-stat-lbl{font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.4px;}
.tc-foot{padding:9px 14px;background:var(--bg3);border-top:1px solid var(--b1);display:flex;align-items:center;justify-content:space-between;}
.stepper-layout{display:flex;height:100%;overflow:hidden;}
.stepper-sidebar{width:220px;flex-shrink:0;background:var(--card-bg);border-right:1px solid var(--b1);display:flex;flex-direction:column;overflow:hidden;backdrop-filter:blur(8px);}
.stepper-head{padding:14px 16px;border-bottom:1px solid var(--b1);}
.stepper-head-title{font-size:13px;font-weight:700;color:var(--t1);}
.stepper-head-sub{font-size:11px;color:var(--t3);margin-top:2px;font-family:var(--fm);}
.steps-list{flex:1;overflow-y:auto;padding:10px 10px;}
.step-item{display:flex;align-items:flex-start;gap:10px;padding:9px 10px;border-radius:8px;cursor:pointer;transition:all .14s;margin-bottom:4px;}
.step-item:hover{background:var(--bg3);}
.step-item.active{background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25);}
.step-item:not(.active){border:1px solid transparent;}
.step-dot{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;transition:all .2s;}
.step-dot.done{background:rgba(34,211,162,.15);color:var(--step-done);border:2px solid var(--step-done);}
.step-dot.active{background:rgba(245,158,11,.15);color:var(--step-act);border:2px solid var(--step-act);}
.step-dot.idle{background:var(--bg3);color:var(--t3);border:2px solid var(--step-idle);}
.step-info{flex:1;min-width:0;}
.step-lbl{font-size:13px;font-weight:600;color:var(--t1);}
.step-desc{font-size:11px;color:var(--t3);margin-top:1px;}
.step-item.active .step-lbl{color:var(--ac);}
.step-connector{width:2px;height:14px;background:var(--b1);margin:0 0 0 22px;}
.step-connector.done{background:var(--step-done);}
.stepper-footer{padding:12px 14px;border-top:1px solid var(--b1);display:flex;flex-direction:column;gap:8px;}
.draft-indicator{display:flex;align-items:center;gap:6px;padding:7px 10px;background:rgba(124,127,255,.1);border:1px solid rgba(124,127,255,.2);border-radius:7px;font-size:12px;color:var(--in);}
.draft-dot{width:7px;height:7px;border-radius:50%;background:var(--in);animation:pulse 1.5s infinite;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.4;}}
.stepper-content{flex:1;overflow-y:auto;background:transparent;}
.step-panel{max-width:760px;margin:0 auto;padding:24px 20px;}
.step-panel-title{font-size:18px;font-weight:700;color:var(--t1);margin-bottom:4px;}
.step-panel-sub{font-size:13px;color:var(--t2);margin-bottom:20px;}
.step-section{margin-bottom:20px;}
.step-lbl2{font-size:11px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.7px;margin-bottom:7px;display:flex;align-items:center;gap:5px;}
.req{color:var(--re);}
textarea.fd{width:100%;background:var(--bg2);border:1px solid var(--b1);border-radius:8px;padding:10px 12px;color:var(--t1);font-family:var(--ff);font-size:13px;outline:none;resize:vertical;line-height:1.6;transition:border-color .15s;}
textarea.fd:focus{border-color:var(--ac);box-shadow:var(--glow-ac);}
input.fd{background:var(--bg2);border:1px solid var(--b1);border-radius:7px;padding:8px 11px;color:var(--t1);font-family:var(--ff);font-size:13px;outline:none;transition:border-color .15s;width:100%;}
input.fd:focus{border-color:var(--ac);box-shadow:var(--glow-ac);}
select.fd{background:var(--bg2);border:1px solid var(--b1);border-radius:7px;padding:8px 11px;color:var(--t2);font-family:var(--ff);font-size:13px;outline:none;cursor:pointer;width:100%;transition:border-color .15s;}
select.fd:focus{border-color:var(--ac);}
.fg{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.fg3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}
.fld{display:flex;flex-direction:column;gap:4px;}
.flbl{font-size:11px;color:var(--t3);}
.opt-row{display:flex;align-items:center;gap:9px;margin-bottom:8px;}
.orad{width:17px;height:17px;border-radius:50%;border:2px solid var(--b2);background:var(--bg2);cursor:pointer;flex-shrink:0;transition:all .13s;}
.orad.ok{background:var(--gr);border-color:var(--gr);}
.oltr{font-family:var(--fm);font-size:12px;color:var(--t3);width:14px;flex-shrink:0;}
.format-bar{display:flex;gap:5px;margin-top:6px;flex-wrap:wrap;}
.char-count{font-size:11px;color:var(--t3);font-family:var(--fm);text-align:right;margin-top:4px;}
.review-card{background:var(--card-bg);border:1px solid var(--b1);border-radius:12px;padding:18px 20px;margin-bottom:14px;}
.review-row{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;font-size:13px;}
.review-key{color:var(--t3);width:110px;flex-shrink:0;font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-family:var(--fm);padding-top:2px;}
.review-val{color:var(--t1);flex:1;}
.review-opts{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:4px;}
.review-opt{display:flex;align-items:center;gap:7px;padding:6px 10px;background:var(--bg3);border:1px solid var(--b1);border-radius:6px;font-size:12px;}
.review-opt.correct{background:rgba(34,211,162,.08);border-color:rgba(34,211,162,.3);color:var(--gr);}
.upload-zone{border:2px dashed var(--b2);border-radius:11px;padding:36px 20px;text-align:center;cursor:pointer;transition:all .2s;}
.upload-zone:hover,.upload-zone.drag{border-color:var(--ac);background:rgba(245,158,11,.04);}
.map-table{width:100%;border-collapse:collapse;font-size:13px;}
.map-table th{padding:8px 12px;text-align:left;background:var(--bg3);color:var(--t3);font-size:11px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--b1);}
.map-table td{padding:8px 12px;border-bottom:1px solid var(--b1);color:var(--t2);vertical-align:middle;}
.map-table tr:hover td{background:var(--bg3);}
.vrow{display:flex;align-items:flex-start;gap:8px;padding:7px 10px;border-radius:6px;margin-bottom:5px;font-size:12px;}
.vok{background:rgba(34,211,162,.07);color:var(--gr);}
.vw{background:rgba(245,158,11,.07);color:var(--ac);}
.ve{background:rgba(255,107,107,.07);color:var(--re);}
.prev-row{display:flex;border-bottom:1px solid var(--b1);}
.prev-row.hdr{background:var(--bg3);font-size:10px;color:var(--t3);text-transform:uppercase;font-weight:600;}
.prev-cell{padding:7px 10px;font-size:11px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--fm);}
.progress-bar{height:4px;background:var(--bg3);border-radius:2px;overflow:hidden;margin-bottom:12px;}
.progress-fill{height:100%;background:linear-gradient(90deg,var(--step-act),var(--in));border-radius:2px;transition:width .4s ease;}
.complete-card{background:var(--card-bg);border:1px solid var(--b1);border-radius:14px;padding:40px 24px;text-align:center;box-shadow:var(--shadow);}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(6px);}
.modal{background:var(--bg1);border:1px solid var(--b1);border-radius:14px;width:100%;max-width:980px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4);}
.modal-head{padding:16px 18px;border-bottom:1px solid var(--b1);display:flex;align-items:flex-start;gap:12px;flex-shrink:0;background:var(--bg2);}
.modal-title{font-size:16px;font-weight:700;color:var(--t1);}
.modal-sub{font-size:12px;color:var(--t3);margin-top:2px;font-family:var(--fm);}
.sec-tabs{display:flex;padding:0 18px;background:var(--bg2);border-bottom:1px solid var(--b1);overflow-x:auto;flex-shrink:0;}
.sec-tab{display:flex;align-items:center;gap:7px;padding:10px 14px;cursor:pointer;font-size:12px;font-weight:500;color:var(--t2);border-bottom:2px solid transparent;transition:all .13s;white-space:nowrap;flex-shrink:0;}
.sec-tab:hover{color:var(--t1);}
.sec-tab.on{border-bottom-color:currentColor;}
.sec-count{font-size:10px;font-family:var(--fm);background:var(--bg3);padding:1px 5px;border-radius:3px;}
.sec-stats-bar{padding:10px 18px;background:var(--bg3);border-bottom:1px solid var(--b1);display:flex;gap:20px;flex-shrink:0;flex-wrap:wrap;}
.ssb-val{font-size:14px;font-weight:700;font-family:var(--fm);color:var(--t1);}
.ssb-lbl{font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;}
.q-list{flex:1;overflow-y:auto;padding:14px 18px;display:flex;flex-direction:column;gap:9px;}
.q-item{background:var(--bg2);border:1px solid var(--b1);border-radius:9px;overflow:hidden;transition:border-color .13s;}
.q-item:hover{border-color:var(--b2);}
.q-item-head{padding:11px 14px;display:flex;align-items:flex-start;gap:9px;cursor:pointer;}
.q-num{font-family:var(--fm);font-size:11px;color:var(--t3);flex-shrink:0;width:26px;margin-top:1px;}
.q-text-main{font-size:13px;color:var(--t1);line-height:1.5;}
.q-meta{display:flex;gap:5px;align-items:center;margin-top:5px;flex-wrap:wrap;}
.q-expand{background:var(--bg3);border-top:1px solid var(--b1);padding:13px 14px;}
.opt-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;}
.opt-item{display:flex;align-items:center;gap:7px;padding:6px 10px;background:var(--bg2);border:1px solid var(--b1);border-radius:6px;font-size:12px;}
.opt-item.correct{background:rgba(34,211,162,.08);border-color:rgba(34,211,162,.25);color:var(--gr);}
.opt-ltr{font-family:var(--fm);font-size:11px;color:var(--t3);flex-shrink:0;width:14px;}
.expl-box{background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.2);border-radius:6px;padding:9px 12px;font-size:12px;color:var(--t2);line-height:1.6;}
.ie-wrap{display:flex;flex-direction:column;gap:10px;}
.ie-row{display:flex;flex-direction:column;gap:4px;}
.ie-lbl{font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;font-family:var(--fm);}
.ie-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}
textarea.ie{width:100%;background:var(--bg1);border:1px solid var(--b1);border-radius:6px;padding:8px 10px;color:var(--t1);font-family:var(--ff);font-size:13px;outline:none;resize:vertical;line-height:1.5;}
textarea.ie:focus{border-color:var(--ac);}
input.ie{width:100%;background:var(--bg1);border:1px solid var(--b1);border-radius:6px;padding:7px 10px;color:var(--t1);font-family:var(--ff);font-size:13px;outline:none;}
input.ie:focus{border-color:var(--ac);}
select.ie{width:100%;background:var(--bg1);border:1px solid var(--b1);border-radius:6px;padding:7px 10px;color:var(--t2);font-family:var(--ff);font-size:13px;outline:none;cursor:pointer;}
select.ie:focus{border-color:var(--ac);}
.opt-edit-row{display:flex;align-items:center;gap:7px;margin-bottom:5px;}
.orad-sm{width:15px;height:15px;border-radius:50%;border:2px solid var(--b2);background:var(--bg3);cursor:pointer;flex-shrink:0;transition:all .12s;}
.orad-sm.ok{background:var(--gr);border-color:var(--gr);}
input.opt-in{flex:1;background:var(--bg1);border:1px solid var(--b1);border-radius:5px;padding:5px 8px;color:var(--t1);font-family:var(--ff);font-size:12px;outline:none;}
input.opt-in:focus{border-color:var(--ac);}
.fbar{display:flex;align-items:center;gap:7px;padding:9px 12px;background:var(--card-bg);border-bottom:1px solid var(--b1);flex-wrap:wrap;flex-shrink:0;backdrop-filter:blur(8px);}
.sbox{display:flex;align-items:center;gap:7px;background:var(--bg2);border:1px solid var(--b1);border-radius:7px;padding:5px 9px;flex:1;min-width:150px;}
.sbox input{background:none;border:none;outline:none;color:var(--t1);font-family:var(--ff);font-size:13px;width:100%;}
.sbox input::placeholder{color:var(--t3);}
select.fil{background:var(--bg2);border:1px solid var(--b1);border-radius:6px;padding:5px 7px;color:var(--t2);font-family:var(--ff);font-size:12px;outline:none;cursor:pointer;}
.twrap{overflow-x:auto;}
table{width:100%;border-collapse:collapse;font-size:13px;min-width:540px;}
thead th{padding:8px 11px;text-align:left;color:var(--t3);font-size:11px;text-transform:uppercase;letter-spacing:.6px;border-bottom:1px solid var(--b1);background:var(--card-bg);font-weight:500;position:sticky;top:0;z-index:1;}
tbody tr{border-bottom:1px solid var(--b1);transition:background .1s;cursor:pointer;}
tbody tr:hover{background:var(--bg3);}
td{padding:8px 11px;color:var(--t2);vertical-align:middle;}
.qt{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:230px;font-size:13px;color:var(--t1);}
.cbx{width:14px;height:14px;border:1.5px solid var(--b2);border-radius:3px;background:var(--bg2);cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .12s;font-size:10px;}
.cbx.on{background:var(--ac);border-color:var(--ac);color:#fff;}
.abar{display:flex;align-items:center;gap:7px;padding:6px 12px;background:var(--bg3);border-bottom:1px solid var(--b1);flex-wrap:wrap;flex-shrink:0;}
.tree-row{display:flex;align-items:center;gap:6px;padding:6px 7px;cursor:pointer;border-radius:5px;font-size:13px;transition:all .12s;}
.tree-row:hover{background:var(--bg3);}
.tree-row.on{background:rgba(245,158,11,.1);color:var(--ac);}
.chev{font-size:9px;color:var(--t3);width:11px;transition:transform .12s;flex-shrink:0;}
.chev.op{transform:rotate(90deg);}
.tlbl{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.tcnt{font-size:10px;font-family:var(--fm);color:var(--t3);background:var(--bg3);padding:1px 4px;border-radius:3px;flex-shrink:0;}
.split{display:flex;height:100%;overflow:hidden;position:relative;}
.sl2{width:215px;flex-shrink:0;border-right:1px solid var(--b1);background:var(--card-bg);overflow-y:auto;transition:transform .25s;backdrop-filter:blur(8px);}
.sr{flex:1;overflow-y:auto;min-width:0;}
.sh{padding:9px 12px;border-bottom:1px solid var(--b1);font-size:11px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.6px;display:flex;align-items:center;gap:8px;justify-content:space-between;flex-shrink:0;}
.sgg{display:grid;grid-template-columns:repeat(3,1fr);gap:11px;padding:14px;overflow-y:auto;height:100%;}
.stbl{background:var(--card-bg);border:1px solid var(--b1);border-radius:9px;overflow:hidden;backdrop-filter:blur(8px);}
.sth{padding:8px 11px;background:var(--bg3);border-bottom:1px solid var(--b1);display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
.scol{display:flex;align-items:center;gap:7px;padding:5px 11px;border-bottom:1px solid var(--b1);font-size:11px;opacity:.85;}
.scol:last-child{border-bottom:none;}
.sn{font-family:var(--fm);color:var(--t2);flex:1;}
.stp{font-family:var(--fm);color:var(--t3);font-size:10px;}
.spk{color:var(--ac);font-size:9px;margin-left:auto;}
.sfk{color:var(--in);font-size:9px;margin-left:auto;}
.snn{color:var(--re);font-size:9px;}
.tag2{display:inline-flex;font-size:10px;color:var(--t3);background:var(--bg3);border:1px solid var(--b1);padding:2px 5px;border-radius:3px;font-family:var(--fm);}
@media(max-width:1024px){.sgg{grid-template-columns:repeat(2,1fr);}.fg3{grid-template-columns:1fr 1fr;}.stepper-sidebar{width:190px;}}
@media(max-width:768px){
  .sidebar{position:fixed;top:0;left:0;height:100%;transform:translateX(-100%);box-shadow:6px 0 28px rgba(0,0,0,.4);}
  .sidebar.open{transform:translateX(0);}
  .tb-burg{display:flex;}
  .bnav{display:flex;}
  .sl2{position:absolute;top:0;left:0;height:100%;width:240px;transform:translateX(-100%);z-index:20;box-shadow:4px 0 20px rgba(0,0,0,.3);}
  .sl2.open{transform:translateX(0);}
  .cards-grid{grid-template-columns:repeat(auto-fill,minmax(220px,1fr));}
  .sgg{grid-template-columns:1fr;}
  .fg,.fg3{grid-template-columns:1fr;}
  .ie-grid{grid-template-columns:1fr 1fr;}
  .opt-grid{grid-template-columns:1fr;}
  .stepper-layout{flex-direction:column;}
  .stepper-sidebar{width:100%;flex-shrink:0;max-height:none;border-right:none;border-bottom:1px solid var(--b1);}
  .steps-list{display:flex;flex-direction:row;overflow-x:auto;padding:8px 10px;gap:0;}
  .step-item{flex-direction:column;align-items:center;text-align:center;min-width:70px;padding:7px 6px;}
  .step-connector{display:none;}
  .step-info .step-desc{display:none;}
}
@media(max-width:500px){
  .stat-row{padding:10px;}.stat-card{min-width:130px;padding:10px 12px;}
  .cards-grid{grid-template-columns:1fr;}
  .filter-row{gap:5px;}
  .pill{padding:3px 9px;font-size:11px;}
  .ie-grid{grid-template-columns:1fr;}
  .step-panel{padding:16px 12px;}
}
`;

function useWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => { const h = () => setW(window.innerWidth); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  return w;
}

function diffBadge(d) { return <span className={`b ${d==="Easy"?"be":d==="Medium"?"bm":"bh"}`}>{d}</span>; }
function statusBadge(s) {
  const m={active:"ba",draft:"bdr",disabled:"bdi",live:"ba",ended:"bdi"};
  return <span className={`b ${m[s]||"bdr"}`}>⬤ {s}</span>;
}
function typeBadge(t) {
  const m={MCQ:["bmc","MCQ"],"multi-select":["bms","MSQ"],numeric:["bnn","NUM"],descriptive:["bm","DESC"]};
  const [c,l]=m[t]||["bmc","MCQ"];
  return <span className={`b ${c}`}>{l}</span>;
}

function TN({ node, depth=0, sel, onSel }) {
  const [open, setOpen] = useState(depth<1);
  const has = node.children?.length>0;
  return (
    <div>
      <div className={`tree-row ${sel===node.id?"on":""}`} style={{paddingLeft:8+depth*13}}
        onClick={()=>{if(has)setOpen(o=>!o);onSel(node);}}>
        {has?<span className={`chev ${open?"op":""}`}>▶</span>:<span style={{width:11}}/>}
        <span style={{fontSize:13,color:node.color||"var(--t3)"}}>{node.icon||"▪"}</span>
        <span className="tlbl" style={{color:has?"var(--t1)":"var(--t2)",fontSize:Math.max(11,13-depth*.5)}}>{node.label}</span>
        {node.topicCount&&<span className="tcnt">{node.topicCount}</span>}
      </div>
      {open&&has&&<div style={{paddingLeft:13}}>{node.children.map(c=><TN key={c.id} node={c} depth={depth+1} sel={sel} onSel={onSel}/>)}</div>}
    </div>
  );
}

function SplitView({leftLabel,leftContent,rightContent}) {
  const w=useWidth(); const mob=w<=768; const [lo,setLo]=useState(false);
  return (
    <div className="split" style={{flex:1,overflow:"hidden"}}>
      {mob&&lo&&<div className="ovl on" onClick={()=>setLo(false)}/>}
      <div className={`sl2 sc ${mob&&lo?"open":""}`}>
        <div className="sh"><span>{leftLabel}</span>{mob&&<button className="btn btn-g sm" onClick={()=>setLo(false)}>✕</button>}</div>
        {leftContent}
      </div>
      <div className="sr sc">
        {mob&&<div className="sh"><button className="btn btn-g sm" onClick={()=>setLo(true)}>☰ {leftLabel}</button></div>}
        {rightContent}
      </div>
    </div>
  );
}

// FIX: Use subjects from API in QuestionCreator
function QuestionCreator({ initialQ, onClose, subjects = [] }) {
  const [form, setForm] = useState(initialQ ? {...initialQ, options: initialQ.options||["","","",""]} : { text:"", type:"MCQ", subject:"", chapter:"", topic:"", difficulty:"Medium", marks:2, negMarks:0.5, status:"draft", language:"English", options:["","","",""], answer:"", explanation:"", tags:"" });
  const [activeStep, setActiveStep] = useState("classify");
  const [completed, setCompleted] = useState(initialQ ? ["classify","content","options","scoring","explain","review"] : []);
  const [isDraft, setIsDraft] = useState(!!initialQ);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const setOpt = (i,v) => { const o=[...form.options]; o[i]=v; set("options",o); };
  const L = ["A","B","C","D","E"];

  const markDone = (stepId) => setCompleted(c => c.includes(stepId)?c:[...c,stepId]);
  const next = (cur) => { markDone(cur); const idx = ["classify","content","options","scoring","explain","review"].indexOf(cur); if(idx < 5) setActiveStep(["classify","content","options","scoring","explain","review"][idx+1]); };

  const buildPayload = (status) => ({
    questionText: form.text, type: form.type === "MCQ" ? "mcq" : form.type === "multi-select" ? "msq" : form.type.toLowerCase(),
    category: "practice", // FIX BUG-015
    isPractice: true, // FIX PQ-02: Explicitly mark as practice question
    subject: form.subject, chapter: form.chapter, topic: form.topic,
    difficulty: (form.difficulty || "medium").toLowerCase(),
    marks: form.marks || 2, negativeMarks: form.negMarks || 0,
    options: form.options || [], correctOption: form.type === "multi-select" ? (form.answer ? form.answer.split(",").map(Number).filter(Boolean) : []) : Number(form.answer) || 0,
    explanation: form.explanation, status: status || "draft",
    tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
  });

  const saveDraft = async () => {
    try {
      const payload = buildPayload("draft");
      if (initialQ?.id || initialQ?._id) await adminAPI.apiClient.put(`/admin/questions/${initialQ.id || initialQ._id}`, payload);
      else await adminAPI.apiClient.post('/admin/questions', payload);
      setIsDraft(true);
    } catch (e) { console.error("Failed to save draft:", e); }
  };

  const publish = async () => {
    try {
      const payload = buildPayload("active");
      if (initialQ?.id || initialQ?._id) await adminAPI.apiClient.put(`/admin/questions/${initialQ.id || initialQ._id}`, payload);
      else await adminAPI.apiClient.post('/admin/questions', payload);
      markDone(activeStep); onClose();
    } catch (e) { console.error("Failed to publish:", e); }
  };

  const progressPct = Math.round((completed.length / 6) * 100);

  const renderStep = () => {
    if (activeStep === "classify") return (
      <div className="step-panel">
        <div className="step-panel-title">📍 Classify Question</div>
        <div className="progress-bar"><div className="progress-fill" style={{width:progressPct+"%"}}/></div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,padding:"8px 12px",background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.25)",borderRadius:8}}>
          <span style={{fontSize:11,color:"var(--t3)",textTransform:"uppercase",fontFamily:"var(--fm)"}}>Category:</span>
          <span style={{fontSize:13,fontWeight:600,color:"#059669"}}>Practice & Quiz</span>
        </div>
        <div className="step-lbl2">Subject <span className="req">*</span></div>
        <select className="fd" value={form.subject} onChange={e=>set("subject",e.target.value)}>
          <option value="">— Select Subject —</option>
          {subjects.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <button className="btn btn-p" onClick={()=>next("classify")}>Next: Content →</button>
          <button className="btn btn-g" onClick={saveDraft}>Save Draft</button>
        </div>
      </div>
    );
    if (activeStep === "content") return (
      <div className="step-panel">
        <div className="step-panel-title">✏️ Question Content</div>
        <div className="progress-bar"><div className="progress-fill" style={{width:progressPct+"%"}}/></div>
        <textarea className="fd" rows={5} value={form.text} onChange={e=>set("text",e.target.value)} placeholder="Write your question here…"/>
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <button className="btn btn-g" onClick={()=>setActiveStep("classify")}>← Classify</button>
          <button className="btn btn-p" onClick={()=>next("content")}>Next: Options →</button>
        </div>
      </div>
    );
    if (activeStep === "options") return (
      <div className="step-panel">
        <div className="step-panel-title">☑ Options & Answer</div>
        <div className="progress-bar"><div className="progress-fill" style={{width:progressPct+"%"}}/></div>
        {(form.options||[]).map((opt,i) => (
          <div className="opt-row" key={i}>
            <div className={`orad ${form.answer===String(i)?"ok":""}`} onClick={()=>set("answer",String(i))}/>
            <span className="oltr">{L[i]}</span>
            <input className="fd" type="text" value={opt} onChange={e=>setOpt(i,e.target.value)} placeholder={`Option ${L[i]}`}/>
          </div>
        ))}
        <button className="btn btn-g sm" onClick={()=>set("options",[...form.options,""])}>+ Add Option</button>
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <button className="btn btn-g" onClick={()=>setActiveStep("content")}>← Content</button>
          <button className="btn btn-p" onClick={()=>next("options")}>Next: Scoring →</button>
        </div>
      </div>
    );
    if (activeStep === "scoring") return (
      <div className="step-panel">
        <div className="step-panel-title">⚙ Scoring & Metadata</div>
        <div className="progress-bar"><div className="progress-fill" style={{width:progressPct+"%"}}/></div>
        <div className="fg3">
          <div className="fld"><span className="flbl">Marks (+)</span><input className="fd" type="number" value={form.marks} onChange={e=>set("marks",+e.target.value)}/></div>
          <div className="fld"><span className="flbl">Neg. Marks (-)</span><input className="fd" type="number" value={form.negMarks} onChange={e=>set("negMarks",+e.target.value)}/></div>
          <div className="fld"><span className="flbl">Difficulty</span>
            <select className="fd" value={form.difficulty} onChange={e=>set("difficulty",e.target.value)}>
              {["Easy","Medium","Hard"].map(d=><option key={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <button className="btn btn-g" onClick={()=>setActiveStep("options")}>← Options</button>
          <button className="btn btn-p" onClick={()=>next("scoring")}>Next: Explanation →</button>
        </div>
      </div>
    );
    if (activeStep === "explain") return (
      <div className="step-panel">
        <div className="step-panel-title">💡 Explanation & Tags</div>
        <div className="progress-bar"><div className="progress-fill" style={{width:progressPct+"%"}}/></div>
        <textarea className="fd" rows={5} value={form.explanation} onChange={e=>set("explanation",e.target.value)} placeholder="Explanation…"/>
        <input className="fd" type="text" value={form.tags||""} onChange={e=>set("tags",e.target.value)} placeholder="Tags (comma-separated)" style={{marginTop:12}}/>
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <button className="btn btn-g" onClick={()=>setActiveStep("scoring")}>← Scoring</button>
          <button className="btn btn-p" onClick={()=>next("explain")}>Review →</button>
        </div>
      </div>
    );
    // review
    return (
      <div className="step-panel">
        <div className="step-panel-title">👁 Review & Publish</div>
        <div className="review-card">
          <div className="review-row"><span className="review-key">Question</span><span className="review-val">{form.text}</span></div>
          <div className="review-row"><span className="review-key">Type</span><span className="review-val">{form.type}</span></div>
          <div className="review-row"><span className="review-key">Difficulty</span><span className="review-val">{form.difficulty}</span></div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-draft" onClick={saveDraft}>💾 Save Draft</button>
          <button className="btn btn-p" onClick={publish}>🚀 Publish</button>
        </div>
      </div>
    );
  };

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column"}}>
      <div className="topbar">
        <button className="btn btn-g sm" onClick={onClose}>← Back</button>
        <span className="tb-ttl">{initialQ?"Edit Question":"New Question"}</span>
        <div className="tb-r">
          <button className="btn btn-g sm" onClick={saveDraft}>Save Draft</button>
          <button className="btn btn-p sm" onClick={publish}>Publish</button>
        </div>
      </div>
      {renderStep()}
    </div>
  );
}

// Bulk Upload Stepper
function BulkUploadStepper({ onClose }) {
  const [activeStep, setActiveStep] = useState("upload");
  const [uploaded, setUploaded] = useState(false);
  const renderStep = () => {
    if (activeStep === "upload") return (
      <div className="step-panel">
        <div className="step-panel-title">⬆ Upload Question File</div>
        {!uploaded ? (
          <div className="upload-zone" onClick={()=>setUploaded(true)}>
            <div style={{fontSize:36,marginBottom:10}}>📂</div>
            <div>Drop file or click to browse</div>
            <div style={{fontSize:12,color:"var(--t3)",marginTop:6}}>CSV · XLSX · JSON</div>
          </div>
        ) : (
          <div style={{textAlign:"center",padding:20}}>
            <div style={{fontSize:24}}>📄</div>
            <div>File uploaded</div>
          </div>
        )}
        <button className="btn btn-p" disabled={!uploaded} style={{marginTop:16,opacity:uploaded?1:0.4}} onClick={()=>setActiveStep("commit")}>
          {uploaded ? "Commit Import" : "Upload First"}
        </button>
      </div>
    );
    return (
      <div className="step-panel" style={{textAlign:"center"}}>
        <div style={{fontSize:48}}>🎉</div>
        <div style={{fontSize:20,fontWeight:700}}>Import Complete!</div>
        <button className="btn btn-p" style={{marginTop:16}} onClick={onClose}>Go to Bank</button>
      </div>
    );
  };

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column"}}>
      <div className="topbar">
        <button className="btn btn-g sm" onClick={onClose}>← Back</button>
        <span className="tb-ttl">Bulk Upload</span>
      </div>
      {renderStep()}
    </div>
  );
}

// Question Bank Component
function QuestionBank({ onEdit, refreshTrigger }) {
  const { subjects } = useSubjects();
  const { questions: allQuestions, loading: questionsLoading, refetch } = useQuestions();
  const [search,setSearch]=useState("");

  useEffect(() => {
    refetch();
  }, [refreshTrigger, refetch]);


  const normalizedQuestions = allQuestions.map(q => ({
    id: q.id || q._id,
    text: q.questionText || q.question_text || "",
    type: q.type || "MCQ",
    subject: q.subject || "General",
    difficulty: q.difficulty || "Medium",
    status: q.status || "draft",
    marks: q.marks || 2,
    negMarks: q.negativeMarks || 0,
    options: q.options || [],
    answer: String(q.correctOption ?? 0),
  }));

  const filtered = normalizedQuestions.filter(q =>
    !search || q.text.toLowerCase().includes(search.toLowerCase())
  );

  if (questionsLoading) return <div style={{padding:40,textAlign:"center",color:"var(--t3)"}}>Loading questions...</div>;

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column"}}>
      <div className="fbar">
        <div className="sbox"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search questions…"/></div>
        <button className="btn btn-p sm" onClick={()=>onEdit(null)}>+ New</button>
      </div>
      <div className="twrap sc" style={{flex:1,overflowY:"auto"}}>
        <table>
          <thead><tr><th>#</th><th>Question</th><th>Type</th><th>Subject</th><th>Difficulty</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {filtered.map((q, i) => (
              <tr key={q.id} onClick={()=>onEdit(q)}>
                <td className="font-mono text-gray-500">{i+1}</td>
                <td className="qt">{q.text}</td>
                <td>{typeBadge(q.type)}</td>
                <td>{q.subjectName || q.subject}</td>
                <td>{diffBadge(q.difficulty)}</td>
                <td>{statusBadge(q.status)}</td>
                <td><button className="btn btn-g sm">Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// FIX: Import useStages from shared hooks instead of local definition
// Test Browser
function TestBrowser() {
  const { categories: examCategories } = useExamCategories();
  const { categories: testCategories } = useTestCategories();
  const { tests } = useTests();
  const [exam,setExam] = useState("");
  const [cat,setCat] = useState("");
  const [subcat,setSubcat] = useState("All");
  const [modal,setModal] = useState(null);

  useEffect(() => {
    if (examCategories.length > 0 && !exam) setExam(examCategories[0].categoryId || examCategories[0].id);
    if (testCategories.length > 0 && !cat) {
      const fc = testCategories.find(c => c.isActive !== false);
      if (fc) setCat(fc.name);
    }
  }, [examCategories, testCategories]);

  const filtered = tests.filter(t => {
    const matchesExam = !exam || t.examId === exam || t.exam_id === exam || t.categoryId === exam;
    const matchesCat = !cat || t.category === cat || t.type === cat;
    const matchesSubcat = subcat === "All" || t.subcategory === subcat || t.sub_category === subcat;
    return matchesExam && matchesCat && matchesSubcat;
  });

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column"}}>
      <div className="stat-row">
        <div className="stat-card"><div className="sc-val">{tests.length}</div><div className="sc-lbl">Total Tests</div></div>
        <div className="stat-card" style={{borderTopColor:"#10b981"}}><div className="sc-val">{tests.filter(t=>t.isActive!==false).length}</div><div className="sc-lbl">Active</div></div>
      </div>
      <div className="browser">
        <div className="exam-tabs">
          {examCategories.map(e => (
            <div key={e.categoryId||e.id} className={`exam-tab ${exam===(e.categoryId||e.id)?"on":""}`} onClick={()=>setExam(e.categoryId||e.id)}>{e.name}</div>
          ))}
        </div>
        <div className="cards-area sc">
          <div className="cards-grid">
            {filtered.map(t => (
              <div key={t.id||t._id} className="test-card" onClick={()=>setModal(t)}>
                <div className="tc-head">
                  <div className="tc-title">{t.title}</div>
                  <div className="tc-date">{t.duration||60} min · {t.totalQuestions||t.total_questions||0} Qs</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Minimal modal for now - actual questions fetched from API */}
    </div>
  );
}

// Schema View
const SCHEMA_TABLES = [
  {name:"questions",cols:[{n:"id",t:"UUID",pk:true},{n:"questionText",t:"TEXT"},{n:"type",t:"ENUM"},{n:"difficulty",t:"ENUM"},{n:"options",t:"JSONB"},{n:"correctOption",t:"INT"},{n:"marks",t:"NUMERIC"}]},
  {name:"subjects",cols:[{n:"id",t:"UUID",pk:true},{n:"name",t:"TEXT"}]},
  {name:"tests",cols:[{n:"id",t:"UUID",pk:true},{n:"title",t:"TEXT"},{n:"duration",t:"INT"}]},
];
function SchemaView(){return(<div className="sgg sc">{SCHEMA_TABLES.map(t=><div className="stbl" key={t.name}><div className="sth" style={{fontSize:12,fontWeight:600}}>{t.name}</div>{t.cols.map(c=><div className="scol" key={c.n}><span className="sn">{c.n}</span><span className="stp">{c.t}</span>{c.pk&&<span className="spk">PK</span>}</div>)}</div>)}</div>);}

// Constants
const NAV=[{sec:"Overview"},{id:"browser",label:"Test Browser",icon:"◉"},{id:"bank",label:"Question Bank",icon:"∑"},{id:"new_q",label:"New Question",icon:"✎"},{id:"bulk",label:"Bulk Upload",icon:"⬆"},{id:"schema",label:"DB Schema",icon:"⊞"}];

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [page,setPage] = useState("bank");
  const [editQ,setEditQ] = useState(undefined);
  const [dark,setDark] = useState(true);
  const { subjects } = useSubjects();

  const renderPage = () => {
    if (page === "new_q" || page === "edit_q") return <QuestionCreator initialQ={editQ} onClose={()=>{setEditQ(undefined);setPage("bank");}} subjects={subjects} />;
    if (page === "bulk") return <BulkUploadStepper onClose={()=>setPage("bank")} />;
    if (page === "bank") return <QuestionBank onEdit={q=>{setEditQ(q);setPage("edit_q");}} />;
    if (page === "browser") return <TestBrowser />;
    if (page === "schema") return <SchemaView />;
    return <QuestionBank onEdit={q=>{setEditQ(q);setPage("edit_q");}} />;
  };

  return (
    <>
      <style>{getCSS(dark)}</style>
      <div className="app">
        <div className="sidebar">
          <div className="sb-logo">
            <div className="sb-mark">T</div>
            <div><div className="sb-name">Testprep</div><div className="sb-sub">QMS</div></div>
          </div>
          <div className="sb-nav">
            {NAV.map((item,i)=>{
              if(item.sec) return <div key={i} className="sb-sec">{item.sec}</div>;
              return <div key={item.id} className={`sb-item ${page===item.id||((page==="edit_q")&&item.id==="new_q")?"on":""}`} onClick={()=>{setPage(item.id);setEditQ(undefined);}}>
                <span>{item.label}</span>
              </div>;
            })}
          </div>
          <div className="sb-foot">
            <button className={`toggle ${dark?"on":""}`} onClick={()=>setDark(d=>!d)}/>{dark?"Dark":"Light"}
          </div>
        </div>
        <div className="main">
          <div className="content">{renderPage()}</div>
        </div>
      </div>
    </>
  );
}