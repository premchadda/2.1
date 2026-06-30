import { useState, useEffect, useCallback } from "react";

// FIX BUG-014: Use shared api client instead of raw fetch
import { adminAPI } from '../../../shared/lib/dataService'
import { useSubjects } from '../../../shared/hooks/useSubjects.js'

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

const SECTIONS     = ["Reasoning","Mathematics","English","General Knowledge"];
const DIFFS        = ["easy","medium","hard"];
const TYPES        = ["MCQ","multi-select","numeric","descriptive"];
const STATUSES_Q   = ["draft","active","archived"];
const LANGS        = ["English","Hindi","Bilingual"];

const SEC_COLORS = {
  Reasoning:          { bg:"rgba(99,102,241,.15)",  text:"#818cf8", icon:"◈" },
  Mathematics:        { bg:"rgba(245,158,11,.15)",  text:"#fbbf24", icon:"∑" },
  English:            { bg:"rgba(16,185,129,.15)",  text:"#34d399", icon:"∆" },
  "General Knowledge":{ bg:"rgba(236,72,153,.15)",  text:"#f472b6", icon:"⬡" },
};

function useWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => { const h = () => setW(window.innerWidth); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  return w;
}

const BTN_BASE = "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all whitespace-nowrap border-none";
const BTN_SM = "px-2.5 py-1 text-xs";
const BTN_P = `${BTN_BASE} bg-amber-600 text-white hover:bg-amber-700`;
const BTN_G = `${BTN_BASE} bg-transparent text-gray-600 border border-gray-300 hover:text-gray-900 hover:bg-gray-100`;
const BTN_DRAFT = `${BTN_BASE} bg-indigo-600 text-white hover:opacity-90`;
const BADGE_BASE = "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium font-mono whitespace-nowrap";

function diffBadge(d) { const dl=(d||"").toLowerCase(); return <span className={`${BADGE_BASE} ${dl==="easy"?"bg-green-100 text-green-700":dl==="medium"?"bg-amber-100 text-amber-700":"bg-red-100 text-red-700"}`}>{d}</span>; }
function statusBadge(s) {
  const m={active:"bg-green-100 text-green-700",draft:"bg-indigo-100 text-indigo-700",archived:"bg-red-100 text-red-700",live:"bg-green-100 text-green-700",ended:"bg-red-100 text-red-700"};
  return <span className={`${BADGE_BASE} ${m[s]||"bg-indigo-100 text-indigo-700"}`}>⬤ {s}</span>;
}
function typeBadge(t) {
  const m={MCQ:["bg-sky-100 text-sky-700","MCQ"],"multi-select":["bg-pink-100 text-pink-700","MSQ"],numeric:["bg-indigo-100 text-indigo-700","NUM"],descriptive:["bg-amber-100 text-amber-700","DESC"]};
  const [c,l]=m[t]||["bg-sky-100 text-sky-700","MCQ"];
  return <span className={`${BADGE_BASE} ${c}`}>{l}</span>;
}

function TN({ node, depth=0, sel, onSel }) {
  const [open, setOpen] = useState(depth<1);
  const has = node.children?.length>0;
  return (
    <div>
      <div className={`flex items-center gap-1.5 py-1 px-2 cursor-pointer rounded-md text-sm transition-all ${sel===node.id?"bg-amber-50 text-amber-700 hover:bg-gray-100":"hover:bg-gray-100"}`} style={{paddingLeft:8+depth*13}}
        onClick={()=>{if(has)setOpen(o=>!o);onSel(node);}}>
        {has?<span className={`text-xs text-gray-400 transition-transform ${open?"rotate-90":""}`}>▶</span>:<span style={{width:11}}/>}
        <span style={{fontSize:13,color:node.color||"#94a3b8"}}>{node.icon||"▪"}</span>
        <span className="flex-1 truncate overflow-hidden" style={{color:has?"#0f172a":"#475569",fontSize:Math.max(11,13-depth*.5)}}>{node.label}</span>
        {node.topicCount&&<span className="text-xs font-mono text-gray-400 bg-gray-100 px-1 py-0.5 rounded shrink-0">{node.topicCount}</span>}
      </div>
      {open&&has&&<div style={{paddingLeft:13}}>{node.children.map(c=><TN key={c.id} node={c} depth={depth+1} sel={sel} onSel={onSel}/>)}</div>}
    </div>
  );
}

function SplitView({leftLabel,leftContent,rightContent}) {
  const w=useWidth(); const mob=w<=768; const [lo,setLo]=useState(false);
  return (
    <div className="flex" style={{flex:1,overflow:"hidden"}}>
      {mob&&lo&&<div className="fixed inset-0 bg-black/65 z-290" onClick={()=>setLo(false)}/>}
      <div className={`w-[215px] shrink-0 border-r border-gray-200 bg-white overflow-y-auto transition-transform ${mob&&lo?"translate-x-0":""}`}>
        <div className="p-2.5 border-b border-gray-200 text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2 justify-between"><span>{leftLabel}</span>{mob&&<button className={`${BTN_G} ${BTN_SM}`} onClick={()=>setLo(false)}>✕</button>}</div>
        {leftContent}
      </div>
      <div className="flex-1 overflow-y-auto min-w-0">
        {mob&&<div className="p-2.5 border-b border-gray-200 text-xs font-semibold text-gray-400 uppercase tracking-wide"><button className={`${BTN_G} ${BTN_SM}`} onClick={()=>setLo(true)}>☰ {leftLabel}</button></div>}
        {rightContent}
      </div>
    </div>
  );
}

// FIX: Use subjects from API in QuestionCreator
function QuestionCreator({ initialQ, onClose, subjects = [] }) {
  const [form, setForm] = useState(initialQ ? {...initialQ, options: initialQ.options||["","","",""]} : { text:"", type:"MCQ", subject:"", chapter:"", topic:"", difficulty:"medium", marks:2, negMarks:0.5, status:"draft", language:"English", options:["","","",""], answer:"", explanation:"", tags:"" });
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
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-lg font-bold text-gray-900 mb-1">📍 Classify Question</div>
        <div className="h-1 bg-gray-200 rounded mb-3"><div className="h-full bg-gradient-to-r from-amber-500 to-indigo-500 rounded transition-all" style={{width:progressPct+"%"}}/></div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,padding:"8px 12px",background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.25)",borderRadius:8}}>
          <span className="text-xs text-gray-400 uppercase font-mono">Category:</span>
          <span style={{fontSize:13,fontWeight:600,color:"#059669"}}>Practice & Quiz</span>
        </div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Subject <span className="text-red-500">*</span></div>
        <select className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-amber-500 outline-none" value={form.subject} onChange={e=>set("subject",e.target.value)}>
          <option value="">— Select Subject —</option>
          {subjects.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <button className={BTN_P} onClick={()=>next("classify")}>Next: Content →</button>
          <button className={BTN_G} onClick={saveDraft}>Save Draft</button>
        </div>
      </div>
    );
    if (activeStep === "content") return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-lg font-bold text-gray-900 mb-1">✏️ Question Content</div>
        <div className="h-1 bg-gray-200 rounded mb-3"><div className="h-full bg-gradient-to-r from-amber-500 to-indigo-500 rounded transition-all" style={{width:progressPct+"%"}}/></div>
        <textarea className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:border-amber-500 outline-none resize-y leading-relaxed" rows={5} value={form.text} onChange={e=>set("text",e.target.value)} placeholder="Write your question here…"/>
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <button className={BTN_G} onClick={()=>setActiveStep("classify")}>← Classify</button>
          <button className={BTN_P} onClick={()=>next("content")}>Next: Options →</button>
        </div>
      </div>
    );
    if (activeStep === "options") return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-lg font-bold text-gray-900 mb-1">☑ Options & Answer</div>
        <div className="h-1 bg-gray-200 rounded mb-3"><div className="h-full bg-gradient-to-r from-amber-500 to-indigo-500 rounded transition-all" style={{width:progressPct+"%"}}/></div>
        {(form.options||[]).map((opt,i) => (
          <div className="flex items-center gap-2 mb-2" key={i}>
            <div className={`w-4 h-4 rounded-full border-2 cursor-pointer shrink-0 ${form.answer===String(i)?"bg-green-500 border-green-500":"border-gray-300 bg-gray-50"}`} onClick={()=>set("answer",String(i))}/>
            <span className="text-xs font-mono text-gray-400 w-3.5 shrink-0">{L[i]}</span>
            <input className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-amber-500 outline-none" type="text" value={opt} onChange={e=>setOpt(i,e.target.value)} placeholder={`Option ${L[i]}`}/>
          </div>
        ))}
        <button className={`${BTN_G} ${BTN_SM}`} onClick={()=>set("options",[...form.options,""])}>+ Add Option</button>
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <button className={BTN_G} onClick={()=>setActiveStep("content")}>← Content</button>
          <button className={BTN_P} onClick={()=>next("options")}>Next: Scoring →</button>
        </div>
      </div>
    );
    if (activeStep === "scoring") return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-lg font-bold text-gray-900 mb-1">⚙ Scoring & Metadata</div>
        <div className="h-1 bg-gray-200 rounded mb-3"><div className="h-full bg-gradient-to-r from-amber-500 to-indigo-500 rounded transition-all" style={{width:progressPct+"%"}}/></div>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1"><span className="text-xs text-gray-400">Marks (+)</span><input className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-amber-500 outline-none" type="number" value={form.marks} onChange={e=>set("marks",+e.target.value)}/></div>
          <div className="flex flex-col gap-1"><span className="text-xs text-gray-400">Neg. Marks (-)</span><input className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-amber-500 outline-none" type="number" value={form.negMarks} onChange={e=>set("negMarks",+e.target.value)}/></div>
          <div className="flex flex-col gap-1"><span className="text-xs text-gray-400">Difficulty</span>
            <select className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-amber-500 outline-none" value={form.difficulty} onChange={e=>set("difficulty",e.target.value)}>
              {["easy","medium","hard"].map(d=><option key={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <button className={BTN_G} onClick={()=>setActiveStep("options")}>← Options</button>
          <button className={BTN_P} onClick={()=>next("scoring")}>Next: Explanation →</button>
        </div>
      </div>
    );
    if (activeStep === "explain") return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-lg font-bold text-gray-900 mb-1">💡 Explanation & Tags</div>
        <div className="h-1 bg-gray-200 rounded mb-3"><div className="h-full bg-gradient-to-r from-amber-500 to-indigo-500 rounded transition-all" style={{width:progressPct+"%"}}/></div>
        <textarea className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:border-amber-500 outline-none resize-y leading-relaxed" rows={5} value={form.explanation} onChange={e=>set("explanation",e.target.value)} placeholder="Explanation…"/>
        <input className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-amber-500 outline-none mt-3" type="text" value={form.tags||""} onChange={e=>set("tags",e.target.value)} placeholder="Tags (comma-separated)"/>
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <button className={BTN_G} onClick={()=>setActiveStep("scoring")}>← Scoring</button>
          <button className={BTN_P} onClick={()=>next("explain")}>Review →</button>
        </div>
      </div>
    );
    // review
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-lg font-bold text-gray-900 mb-1">👁 Review & Publish</div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <div className="flex items-start gap-2.5 mb-2.5 text-sm"><span className="text-gray-400 text-xs uppercase font-mono w-28 shrink-0 pt-0.5">Question</span><span className="text-gray-900 flex-1">{form.text}</span></div>
          <div className="flex items-start gap-2.5 mb-2.5 text-sm"><span className="text-gray-400 text-xs uppercase font-mono w-28 shrink-0 pt-0.5">Type</span><span className="text-gray-900 flex-1">{form.type}</span></div>
          <div className="flex items-start gap-2.5 text-sm"><span className="text-gray-400 text-xs uppercase font-mono w-28 shrink-0 pt-0.5">Difficulty</span><span className="text-gray-900 flex-1">{form.difficulty}</span></div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className={BTN_DRAFT} onClick={saveDraft}>💾 Save Draft</button>
          <button className={BTN_P} onClick={publish}>🚀 Publish</button>
        </div>
      </div>
    );
  };

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column"}}>
      <div className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-2">
        <button className={`${BTN_G} ${BTN_SM}`} onClick={onClose}>← Back</button>
        <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{initialQ?"Edit Question":"New Question"}</span>
        <div className="ml-auto flex gap-1.5 shrink-0">
          <button className={`${BTN_G} ${BTN_SM}`} onClick={saveDraft}>Save Draft</button>
          <button className={`${BTN_P} ${BTN_SM}`} onClick={publish}>Publish</button>
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
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-lg font-bold text-gray-900 mb-1">⬆ Upload Question File</div>
        {!uploaded ? (
          <div className="border-2 border-dashed border-gray-300 rounded-xl py-9 px-5 text-center cursor-pointer hover:border-amber-500 hover:bg-amber-50/40 transition-all" onClick={()=>setUploaded(true)}>
            <div style={{fontSize:36,marginBottom:10}}>📂</div>
            <div className="text-gray-700">Drop file or click to browse</div>
            <div className="text-xs text-gray-400 mt-1.5">CSV · XLSX · JSON</div>
          </div>
        ) : (
          <div className="text-center py-5">
            <div style={{fontSize:24}}>📄</div>
            <div className="text-gray-700">File uploaded</div>
          </div>
        )}
        <button className={BTN_P} disabled={!uploaded} style={{marginTop:16,opacity:uploaded?1:0.4}} onClick={()=>setActiveStep("commit")}>
          {uploaded ? "Commit Import" : "Upload First"}
        </button>
      </div>
    );
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <div style={{fontSize:48}}>🎉</div>
        <div className="text-xl font-bold text-gray-900">Import Complete!</div>
        <button className={BTN_P} style={{marginTop:16}} onClick={onClose}>Go to Bank</button>
      </div>
    );
  };

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column"}}>
      <div className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-2">
        <button className={`${BTN_G} ${BTN_SM}`} onClick={onClose}>← Back</button>
        <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">Bulk Upload</span>
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
    difficulty: (q.difficulty || "medium").toLowerCase(),
    status: q.status || "draft",
    marks: q.marks || 2,
    negMarks: q.negativeMarks || 0,
    options: q.options || [],
    answer: String(q.correctOption ?? 0),
  }));

  const filtered = normalizedQuestions.filter(q =>
    !search || q.text.toLowerCase().includes(search.toLowerCase())
  );

  if (questionsLoading) return <div className="p-10 text-center text-gray-400">Loading questions...</div>;

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column"}}>
      <div className="flex items-center gap-2 p-3 bg-white border-b border-gray-200 flex-wrap">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 flex-1 min-w-[150px]"><span className="text-gray-400">⌕</span><input className="bg-transparent border-none outline-none text-sm text-gray-900 w-full" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search questions…"/></div>
        <button className={`${BTN_P} ${BTN_SM}`} onClick={()=>onEdit(null)}>+ New</button>
      </div>
      <div className="overflow-x-auto flex-1 overflow-y-auto">
        <table className="w-full border-collapse text-sm min-w-[540px]">
          <thead><tr><th className="p-2 text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-200 bg-white font-medium sticky top-0 z-10">#</th><th className="p-2 text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-200 bg-white font-medium sticky top-0 z-10">Question</th><th className="p-2 text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-200 bg-white font-medium sticky top-0 z-10">Type</th><th className="p-2 text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-200 bg-white font-medium sticky top-0 z-10">Subject</th><th className="p-2 text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-200 bg-white font-medium sticky top-0 z-10">Difficulty</th><th className="p-2 text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-200 bg-white font-medium sticky top-0 z-10">Status</th><th className="p-2 text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-200 bg-white font-medium sticky top-0 z-10"></th></tr></thead>
          <tbody>
            {filtered.map((q, i) => (
              <tr key={q.id} className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer" onClick={()=>onEdit(q)}>
                <td className="font-mono text-gray-500 p-2">{i+1}</td>
                <td className="overflow-hidden text-ellipsis whitespace-nowrap max-w-[230px] text-gray-900 p-2">{q.text}</td>
                <td className="p-2">{typeBadge(q.type)}</td>
                <td className="p-2 text-gray-600">{q.subjectName || q.subject}</td>
                <td className="p-2">{diffBadge(q.difficulty)}</td>
                <td className="p-2">{statusBadge(q.status)}</td>
                <td className="p-2"><button className={`${BTN_G} ${BTN_SM}`}>Edit</button></td>
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
      <div className="flex gap-2.5 p-4 overflow-x-auto shrink-0">
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm shrink-0 min-w-[148px] border-t-2"><div className="text-xl font-bold font-mono text-gray-900">{tests.length}</div><div className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">Total Tests</div></div>
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm shrink-0 min-w-[148px] border-t-2" style={{borderTopColor:"#10b981"}}><div className="text-xl font-bold font-mono text-gray-900">{tests.filter(t=>t.isActive!==false).length}</div><div className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">Active</div></div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex px-4 bg-white border-b border-gray-200 overflow-x-auto shrink-0">
          {examCategories.map(e => (
            <div key={e.categoryId||e.id} className={`flex items-center gap-2 py-3 px-4 cursor-pointer text-sm font-medium border-b-2 transition-all whitespace-nowrap shrink-0 ${exam===(e.categoryId||e.id)?"border-current text-gray-900":"border-transparent text-gray-500 hover:text-gray-900"}`} onClick={()=>setExam(e.categoryId||e.id)}>{e.name}</div>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid gap-3" style={{gridTemplateColumns:"repeat(auto-fill,minmax(265px,1fr))"}}>
            {filtered.map(t => (
              <div key={t.id||t._id} className="bg-white border border-gray-200 rounded-xl cursor-pointer transition-all hover:shadow-md" onClick={()=>setModal(t)}>
                <div className="p-3.5 pb-2.5">
                  <div className="text-sm font-semibold text-gray-900 mb-1 leading-snug">{t.title}</div>
                  <div className="text-xs text-gray-400 font-mono">{t.duration||60} min · {t.totalQuestions||t.total_questions||0} Qs</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Schema View
const SCHEMA_TABLES = [
  {name:"questions",cols:[{n:"id",t:"UUID",pk:true},{n:"questionText",t:"TEXT"},{n:"type",t:"ENUM"},{n:"difficulty",t:"ENUM"},{n:"options",t:"JSONB"},{n:"correctOption",t:"INT"},{n:"marks",t:"NUMERIC"}]},
  {name:"subjects",cols:[{n:"id",t:"UUID",pk:true},{n:"name",t:"TEXT"}]},
  {name:"tests",cols:[{n:"id",t:"UUID",pk:true},{n:"title",t:"TEXT"},{n:"duration",t:"INT"}]},
];
function SchemaView(){return(<div className="grid gap-3 p-4 overflow-y-auto h-full" style={{gridTemplateColumns:"repeat(3,1fr)"}}>{SCHEMA_TABLES.map(t=><div className="bg-white border border-gray-200 rounded-lg overflow-hidden" key={t.name}><div className="p-2 px-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2 flex-wrap" style={{fontSize:12,fontWeight:600}}>{t.name}</div>{t.cols.map(c=><div className="flex items-center gap-2 py-1 px-3 border-b border-gray-200 text-xs opacity-85" key={c.n}><span className="font-mono text-gray-600 flex-1">{c.n}</span><span className="font-mono text-gray-400 text-[10px]">{c.t}</span>{c.pk&&<span className="text-amber-600 text-[9px] ml-auto">PK</span>}</div>)}</div>)}</div>);}

// Constants
const NAV=[{sec:"Overview"},{id:"browser",label:"Test Browser",icon:"◉"},{id:"bank",label:"Question Bank",icon:"∑"},{id:"new_q",label:"New Question",icon:"✎"},{id:"bulk",label:"Bulk Upload",icon:"⬆"},{id:"schema",label:"DB Schema",icon:"⊞"}];

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [page,setPage] = useState("bank");
  const [editQ,setEditQ] = useState(undefined);
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
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <div className="relative z-10 w-[230px] shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 bg-amber-600 rounded-md flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-sm">T</div>
          <div><div className="text-sm font-bold tracking-tight text-gray-900">Testprep</div><div className="text-[10px] text-gray-400 font-mono tracking-wide uppercase">QMS</div></div>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {NAV.map((item,i)=>{
            if(item.sec) return <div key={i} className="px-3.5 py-1.5 text-[10px] text-gray-400 tracking-widest uppercase font-mono">{item.sec}</div>;
            return <div key={item.id} className={`flex items-center gap-2 py-2 px-3.5 cursor-pointer text-sm border-l-2 border-transparent rounded-r-md mr-2 transition-all ${page===item.id||((page==="edit_q")&&item.id==="new_q")?"text-amber-600 bg-amber-50 border-l-amber-600 font-semibold":"text-gray-500 hover:text-gray-900 hover:bg-gray-50"}`} onClick={()=>{setPage(item.id);setEditQ(undefined);}}>
              <span>{item.label}</span>
            </div>;
          })}
        </div>
        <div className="p-3 border-t border-gray-200 text-xs text-gray-400 font-mono shrink-0">
          Practice QMS v1
        </div>
      </div>
      <div className="relative z-1 flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="flex-1 overflow-hidden flex flex-col">{renderPage()}</div>
      </div>
    </div>
  );
}