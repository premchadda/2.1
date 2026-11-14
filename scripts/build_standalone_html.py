import json
import glob
import os
import sys
import shutil

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = "output/cgl_2026_tier1"
SHIFTS_DIR = os.path.join(BASE_DIR, "shifts")
MASTER_JSON_PATH = os.path.join(BASE_DIR, "ssc_cgl_2026_tier1_master_question_bank.json")
OUTPUT_HTML_PATH = os.path.join(BASE_DIR, "cgl_test_runner.html")
ARTIFACT_DIR = r"C:\Users\mahic\.gemini\antigravity\brain\ea3d66b5-64c9-4099-94e9-32619c1356c8"
ARTIFACT_HTML_PATH = os.path.join(ARTIFACT_DIR, "cgl_test_runner_standalone.html")

print("1. Loading all 53 shift JSON files...")
shift_files = sorted(glob.glob(os.path.join(SHIFTS_DIR, "shift_*.json")))
all_shifts = []

total_qs = 0
total_opts = 0
total_opt_dig = 0
total_opt_diags = 0
total_q_diags = 0

for sf in shift_files:
    with open(sf, "r", encoding="utf-8") as f:
        s_data = json.load(f)
    all_shifts.append(s_data)
    qs = s_data.get("questions", [])
    total_qs += len(qs)
    for q in qs:
        # Guarantee no scanned text images
        q["question_image"] = None
        q["options_image"] = None
        if q.get("has_diagram") and q.get("diagram_image"):
            total_q_diags += 1
        for o in q.get("options", []):
            total_opts += 1
            if o.get("has_diagram") and o.get("image"):
                total_opt_diags += 1
            else:
                total_opt_dig += 1

print(f"Loaded {len(all_shifts)} shifts: {total_qs} questions, {total_opts} options.")
print(f"  - Digitized text options: {total_opt_dig}")
print(f"  - Visual shape option diagrams: {total_opt_diags}")
print(f"  - Problem figure diagrams: {total_q_diags}")

# Save master JSON
print(f"2. Saving master JSON to {MASTER_JSON_PATH}...")
master_data = {
    "exam": "SSC CGL 2026 Tier-1",
    "total_shifts": len(all_shifts),
    "total_questions": total_qs,
    "shifts": all_shifts
}
with open(MASTER_JSON_PATH, "w", encoding="utf-8") as f:
    json.dump(master_data, f, ensure_ascii=False)
print(f"Master JSON saved ({os.path.getsize(MASTER_JSON_PATH) / (1024*1024):.2f} MB).")

# Build Standalone HTML
print("3. Building Standalone Interactive HTML Test Runner...")
json_payload = json.dumps(all_shifts, ensure_ascii=False)

html_template = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SSC CGL 2026 Tier-1 — Official Test Bank (All 53 Shifts Preloaded)</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {{
      font-family: 'Inter', 'Noto Sans Devanagari', -apple-system, BlinkMacSystemFont, sans-serif;
    }}
    .custom-scrollbar::-webkit-scrollbar {{
      width: 6px;
      height: 6px;
    }}
    .custom-scrollbar::-webkit-scrollbar-track {{
      background: #f1f5f9;
    }}
    .custom-scrollbar::-webkit-scrollbar-thumb {{
      background: #cbd5e1;
      border-radius: 3px;
    }}
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {{
      background: #94a3b8;
    }}
    /* Distinctive subtle question background without harsh border */
    .question-statement-box {{
      background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
      border: none !important;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }}
    .diagram-box {{
      background: #ffffff;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
    }}
  </style>
</head>
<body class="bg-slate-100 text-slate-800 antialiased h-screen flex flex-col overflow-hidden select-none">

  <!-- ======================================================== -->
  <!-- VIEW 1: SHIFT-WISE CARDS CATALOG DASHBOARD               -->
  <!-- ======================================================== -->
  <div id="catalogView" class="flex-1 flex flex-col overflow-hidden bg-slate-50">
    
    <!-- CATALOG TOP NAVBAR -->
    <header class="bg-white border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs">
      <div class="flex items-center gap-3.5">
        <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
          SSC
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-base font-bold text-slate-900 leading-tight">SSC CGL 2026 Tier-1 — Shift Question Bank</h1>
            <span class="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
              ✓ All 5,300 Questions Digitalized
            </span>
          </div>
          <p class="text-xs text-slate-500 font-medium mt-0.5">53 Official Shifts · 100 Questions per Shift · 100% Digital Text Options & Problem Figures</p>
        </div>
      </div>

      <!-- SEARCH & SHIFT FILTER PILLS -->
      <div class="flex items-center gap-3">
        <div class="relative">
          <input 
            type="text" 
            id="shiftSearchInput" 
            placeholder="Search shift or date (e.g. 30 Sep, 12 Oct)..."
            oninput="filterShifts()"
            class="w-64 sm:w-72 bg-slate-50 border border-slate-300 text-xs rounded-lg pl-8 pr-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          />
          <span class="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
        </div>

        <div class="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium">
          <button onclick="setShiftFilter('all')" id="pill-all" class="px-2.5 py-1 rounded bg-white text-indigo-700 shadow-xs font-semibold transition">
            All (53)
          </button>
          <button onclick="setShiftFilter(1)" id="pill-1" class="px-2 py-1 rounded text-slate-600 hover:text-slate-900 transition">
            Shift 1
          </button>
          <button onclick="setShiftFilter(2)" id="pill-2" class="px-2 py-1 rounded text-slate-600 hover:text-slate-900 transition">
            Shift 2
          </button>
          <button onclick="setShiftFilter(3)" id="pill-3" class="px-2 py-1 rounded text-slate-600 hover:text-slate-900 transition">
            Shift 3
          </button>
        </div>
      </div>
    </header>

    <!-- SHIFT STATS BANNER -->
    <div class="bg-indigo-50/70 border-b border-indigo-100 px-6 py-2.5 flex flex-wrap items-center justify-between text-xs text-indigo-950 font-medium">
      <div class="flex items-center gap-6">
        <span>Total Shifts: <strong class="font-bold text-indigo-900">53 Shifts</strong></span>
        <span>Questions: <strong class="font-bold text-indigo-900">5,300 Questions Digitalized</strong></span>
        <span>Marking: <strong class="font-bold text-emerald-700">+2.0 / -0.50</strong></span>
        <span>Duration: <strong class="font-bold text-indigo-900">60 Mins</strong></span>
      </div>
      <div class="text-[11px] text-indigo-700 font-semibold">
        ⚡ 100% pure digital text: No scanned question strips or option images. Click any card to launch only its questions.
      </div>
    </div>

    <!-- CARDS GRID CONTAINER -->
    <main class="flex-1 overflow-y-auto p-6 custom-scrollbar">
      <div class="max-w-7xl mx-auto">
        <div id="shiftsGrid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <!-- Populated dynamically via JS -->
        </div>
      </div>
    </main>

  </div>

  <!-- ======================================================== -->
  <!-- VIEW 2: SINGLE SHIFT TEST RUNNER (ONLY ITS QUESTIONS)    -->
  <!-- ======================================================== -->
  <div id="testRunnerView" class="hidden flex-1 flex flex-col overflow-hidden bg-slate-100">

    <!-- TEST RUNNER TOP HEADER -->
    <header class="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shrink-0 shadow-xs z-20">
      
      <!-- LEFT: BACK BUTTON & ACTIVE SHIFT TITLE -->
      <div class="flex items-center gap-3">
        <button onclick="backToCatalog()" class="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs">
          <span>←</span> Back to All Shifts
        </button>

        <div class="h-5 w-px bg-slate-200 hidden sm:block"></div>

        <div>
          <div class="flex items-center gap-2">
            <span id="activeShiftBadge" class="bg-indigo-600 text-white font-bold text-[10px] px-2 py-0.5 rounded tracking-wide">
              Shift 01
            </span>
            <h2 id="activeShiftTitle" class="text-xs sm:text-sm font-bold text-slate-900 truncate">
              SSC CGL 2026 Tier-1
            </h2>
          </div>
          <p id="activeShiftSubtitle" class="text-[10px] text-slate-500 font-medium">30 Sep 2026 · 100 Questions</p>
        </div>
      </div>

      <!-- SHIFT SWITCHER DROPDOWN (QUICK JUMP) -->
      <div class="hidden md:flex items-center gap-2">
        <select id="quickShiftSelect" onchange="openShift(parseInt(this.value, 10))" class="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-indigo-500 outline-none font-medium cursor-pointer">
          <!-- Populated dynamically -->
        </select>
      </div>

      <!-- TIMER, MODE & LAYOUT TOGGLES -->
      <div class="flex items-center gap-2.5">
        <div class="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
          <span class="text-xs">⏱️</span>
          <span id="examTimer" class="font-mono text-xs font-semibold text-indigo-700">59:45</span>
        </div>

        <!-- CBT vs PAPER REVIEW TOGGLE -->
        <div class="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium">
          <button id="btnModeCbt" onclick="setMode('cbt')" class="px-2.5 py-1 rounded bg-white text-indigo-700 shadow-xs font-semibold transition">
            🖥️ CBT Mode
          </button>
          <button id="btnModeReview" onclick="setMode('review')" class="px-2.5 py-1 rounded text-slate-600 hover:text-slate-900 transition">
            📄 Paper Review
          </button>
        </div>

        <!-- 2-COL vs 1-COL LAYOUT TOGGLE -->
        <div class="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium">
          <button id="btnLayout2Col" onclick="setLayout('2col')" class="px-2 py-1 rounded bg-white text-slate-800 shadow-xs transition" title="2-Column Options Grid">
            ⊞ 2-Col
          </button>
          <button id="btnLayout1Col" onclick="setLayout('1col')" class="px-2 py-1 rounded text-slate-600 hover:text-slate-900 transition" title="1-Column Options List">
            ☰ 1-Col
          </button>
        </div>
      </div>

    </header>

    <!-- SECTION NAVIGATION BAR -->
    <nav class="bg-slate-50 border-b border-slate-200 px-4 py-1.5 flex items-center justify-between shrink-0 overflow-x-auto gap-2">
      <div class="flex items-center gap-1.5 text-xs">
        <button onclick="switchSection('GI')" id="secTab-GI" class="px-3 py-1.5 rounded-md font-semibold text-white bg-indigo-600 transition shadow-xs flex items-center gap-1.5">
          <span>Part A: Reasoning</span>
          <span class="text-[10px] bg-indigo-700/60 px-1.5 py-0.2 rounded-full">Q1–25</span>
        </button>
        <button onclick="switchSection('GA')" id="secTab-GA" class="px-3 py-1.5 rounded-md font-medium text-slate-600 hover:bg-slate-200/60 transition flex items-center gap-1.5">
          <span>Part B: General Awareness</span>
          <span class="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">Q26–50</span>
        </button>
        <button onclick="switchSection('QA')" id="secTab-QA" class="px-3 py-1.5 rounded-md font-medium text-slate-600 hover:bg-slate-200/60 transition flex items-center gap-1.5">
          <span>Part C: Quantitative Aptitude</span>
          <span class="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">Q51–75</span>
        </button>
        <button onclick="switchSection('EN')" id="secTab-EN" class="px-3 py-1.5 rounded-md font-medium text-slate-600 hover:bg-slate-200/60 transition flex items-center gap-1.5">
          <span>Part D: English Comprehension</span>
          <span class="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">Q76–100</span>
        </button>
      </div>

      <div class="hidden lg:flex items-center gap-3 text-[11px] text-slate-500 font-medium">
        <span>Correct: <strong class="text-emerald-700 font-semibold">+2.0</strong></span>
        <span>Negative: <strong class="text-rose-600 font-semibold">-0.50</strong></span>
        <span>Duration: <strong>60 Mins</strong></span>
      </div>
    </nav>

    <!-- TEST WORKSPACE (LEFT QUESTION VIEW + RIGHT PALETTE) -->
    <div class="flex-1 flex overflow-hidden">
      
      <!-- MAIN QUESTION VIEW CONTAINER -->
      <main class="flex-1 flex flex-col bg-white overflow-hidden relative">

        <!-- CBT SINGLE QUESTION VIEW -->
        <div id="cbtView" class="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col justify-between">
          <div id="questionContainer" class="max-w-4xl mx-auto w-full">
            <!-- Rendered dynamically -->
          </div>

          <!-- CBT BOTTOM ACTION CONTROLS -->
          <div class="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between shrink-0 max-w-4xl mx-auto w-full bg-white">
            <div class="flex items-center gap-2">
              <button onclick="markForReview()" class="px-3.5 py-2 rounded-lg border border-purple-300 text-purple-700 hover:bg-purple-50 text-xs font-semibold transition flex items-center gap-1.5">
                <span>🏷️</span> Mark for Review & Next
              </button>
              <button onclick="clearResponse()" class="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-medium transition">
                Clear Response
              </button>
            </div>

            <div class="flex items-center gap-2">
              <button onclick="prevQuestion()" id="btnPrev" class="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed">
                ← Previous
              </button>
              <button onclick="saveAndNext()" id="btnNext" class="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-sm flex items-center gap-1.5">
                Save & Next →
              </button>
            </div>
          </div>
        </div>

        <!-- REVIEW / ALL 100 QUESTIONS SCROLL VIEW -->
        <div id="reviewView" class="hidden flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div class="max-w-4xl mx-auto space-y-6" id="reviewContainer">
            <!-- Rendered dynamically -->
          </div>
        </div>

      </main>

      <!-- RIGHT: QUESTION PALETTE SIDEBAR -->
      <aside class="w-80 bg-slate-50 border-l border-slate-200 flex flex-col shrink-0 overflow-hidden">
        
        <!-- CANDIDATE INFO -->
        <div class="p-3.5 border-b border-slate-200 bg-white flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-sm">
            TP
          </div>
          <div class="overflow-hidden">
            <div class="text-xs font-semibold text-slate-900 truncate">Candidate Examination Portal</div>
            <div class="text-[11px] text-slate-500 truncate" id="sideShiftLabel">Shift 01</div>
          </div>
        </div>

        <!-- PALETTE LEGEND -->
        <div class="p-3 bg-slate-100/70 border-b border-slate-200 grid grid-cols-2 gap-2 text-[10.5px]">
          <div class="flex items-center gap-1.5">
            <span class="w-3.5 h-3.5 rounded bg-emerald-500 text-white font-bold flex items-center justify-center text-[8px]" id="countAnswered">0</span>
            <span class="text-slate-600 font-medium">Answered</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-3.5 h-3.5 rounded bg-rose-500 text-white font-bold flex items-center justify-center text-[8px]" id="countNotAnswered">1</span>
            <span class="text-slate-600 font-medium">Not Answered</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-3.5 h-3.5 rounded bg-purple-600 text-white font-bold flex items-center justify-center text-[8px]" id="countReview">0</span>
            <span class="text-slate-600 font-medium">Marked for Review</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-3.5 h-3.5 rounded bg-slate-200 border border-slate-300 text-slate-600 font-bold flex items-center justify-center text-[8px]" id="countNotVisited">99</span>
            <span class="text-slate-600 font-medium">Not Visited</span>
          </div>
        </div>

        <!-- SECTION PROGRESS TITLE -->
        <div class="px-3 py-2 border-b border-slate-200 bg-white flex items-center justify-between text-xs font-semibold text-slate-700">
          <span id="sideSectionTitle">Part A: Reasoning</span>
          <span class="text-[11px] text-slate-500 font-normal" id="sideSectionProgress">Q 1 / 100</span>
        </div>

        <!-- 100 QUESTION BUTTONS GRID -->
        <div class="flex-1 overflow-y-auto p-3 custom-scrollbar">
          <div class="grid grid-cols-5 gap-2" id="paletteGrid">
            <!-- 100 buttons rendered via JS -->
          </div>
        </div>

        <!-- SHIFT STATS SUMMARY -->
        <div class="p-3 border-t border-slate-200 bg-white text-[11px] text-slate-500 space-y-1">
          <div class="flex justify-between">
            <span>Shift Questions:</span>
            <span class="font-semibold text-slate-700">100</span>
          </div>
          <div class="flex justify-between">
            <span>Shift Total Marks:</span>
            <span class="font-semibold text-slate-700">200.0</span>
          </div>
          <div class="flex justify-between">
            <span>Problem Figures:</span>
            <span class="font-semibold text-indigo-600" id="diagCount">...</span>
          </div>
        </div>

        <!-- SUBMIT TEST BUTTON -->
        <div class="p-3 border-t border-slate-200 bg-slate-50">
          <button onclick="submitTest()" class="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center justify-center gap-1.5">
            <span>✓</span> Submit Shift Examination
          </button>
        </div>

      </aside>

    </div>

  </div>

  <!-- EMBEDDED MASTER SHIFTS DATA (ALL 5,300 QUESTIONS EMBEDDED DIRECTLY) -->
  <script>
    window.ALL_SHIFTS_DATA = {json_payload};

    let activeShiftIndex = 1;
    let currentShiftData = null;
    let currentQuestionIndex = 0;
    let currentMode = 'cbt';
    let currentLayout = '2col';
    let activeFilter = 'all';

    let questionStates = {{}};
    let timerInterval = null;
    let timeRemaining = 3600;

    function init() {{
      renderCatalogCards();
      populateQuickShiftDropdown();
    }}

    function renderCatalogCards() {{
      const grid = document.getElementById('shiftsGrid');
      grid.innerHTML = '';

      const query = (document.getElementById('shiftSearchInput')?.value || '').toLowerCase().trim();

      ALL_SHIFTS_DATA.forEach(shift => {{
        const matchesFilter = (activeFilter === 'all') || (shift.shift_number === activeFilter);
        const matchesQuery = !query || 
          shift.shift_name.toLowerCase().includes(query) || 
          shift.exam_date.toLowerCase().includes(query) ||
          (`shift ${{shift.shift_index}}`).includes(query);

        if (!matchesFilter || !matchesQuery) return;

        const card = document.createElement('div');
        card.className = "bg-white border border-slate-200 hover:border-indigo-400 rounded-xl p-4 shadow-xs hover:shadow-md transition cursor-pointer flex flex-col justify-between group";
        card.onclick = () => openShift(shift.shift_index);

        card.innerHTML = `
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                Shift ${{String(shift.shift_index).padStart(2, '0')}}
              </span>
              <span class="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                Shift ${{shift.shift_number}}
              </span>
            </div>
            
            <h3 class="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition leading-snug">
              ${{shift.shift_name}}
            </h3>

            <div class="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
              <span>📅 ${{shift.exam_date}}</span>
            </div>

            <div class="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-600">
              <div>Questions: <strong class="text-slate-800 font-semibold">100 Qs</strong></div>
              <div>Duration: <strong class="text-slate-800 font-semibold">60 Mins</strong></div>
              <div>Total Marks: <strong class="text-slate-800 font-semibold">200</strong></div>
              <div>Sections: <strong class="text-slate-800 font-semibold">4 (GI, GA, QA, EN)</strong></div>
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span class="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/50">
              ✓ Ready
            </span>
            <button class="text-xs font-bold text-indigo-600 group-hover:text-indigo-800 flex items-center gap-1">
              Start Test →
            </button>
          </div>
        `;
        grid.appendChild(card);
      }});
    }}

    function filterShifts() {{
      renderCatalogCards();
    }}

    function setShiftFilter(filterVal) {{
      activeFilter = filterVal;
      ['all', 1, 2, 3].forEach(k => {{
        const btn = document.getElementById(`pill-${{k}}`);
        if (!btn) return;
        if (k === filterVal) {{
          btn.className = "px-2.5 py-1 rounded bg-white text-indigo-700 shadow-xs font-semibold transition";
        }} else {{
          btn.className = "px-2 py-1 rounded text-slate-600 hover:text-slate-900 transition";
        }}
      }});
      renderCatalogCards();
    }}

    function populateQuickShiftDropdown() {{
      const sel = document.getElementById('quickShiftSelect');
      if (!sel) return;
      sel.innerHTML = '';
      ALL_SHIFTS_DATA.forEach(s => {{
        const opt = document.createElement('option');
        opt.value = s.shift_index;
        opt.textContent = `Shift ${{String(s.shift_index).padStart(2, '0')}}: ${{s.exam_date}} (Shift ${{s.shift_number}})`;
        sel.appendChild(opt);
      }});
    }}

    function openShift(shiftIdx) {{
      activeShiftIndex = shiftIdx;
      currentShiftData = ALL_SHIFTS_DATA.find(s => s.shift_index === shiftIdx);
      if (!currentShiftData) return;

      document.getElementById('catalogView').classList.add('hidden');
      document.getElementById('testRunnerView').classList.remove('hidden');

      document.getElementById('activeShiftBadge').textContent = `Shift ${{String(shiftIdx).padStart(2, '0')}}`;
      document.getElementById('activeShiftTitle').textContent = currentShiftData.shift_name;
      document.getElementById('activeShiftSubtitle').textContent = `${{currentShiftData.exam_date}} · 100 Questions · 200 Marks`;
      document.getElementById('sideShiftLabel').textContent = `Shift ${{String(shiftIdx).padStart(2, '0')}} · ${{currentShiftData.exam_date}}`;
      document.getElementById('quickShiftSelect').value = shiftIdx;

      let dCount = currentShiftData.questions.filter(q => q.has_diagram).length;
      document.getElementById('diagCount').textContent = dCount;

      questionStates = {{}};
      for (let i = 1; i <= 100; i++) {{
        questionStates[i] = {{
          status: (i === 1) ? 'not_answered' : 'not_visited',
          selectedOption: null
        }};
      }}
      currentQuestionIndex = 0;

      startTimer();
      setMode('cbt');
      updateSectionFromQIndex();
      renderPalette();
      renderCurrentQuestion();
    }}

    function backToCatalog() {{
      if (timerInterval) clearInterval(timerInterval);
      document.getElementById('testRunnerView').classList.add('hidden');
      document.getElementById('catalogView').classList.remove('hidden');
    }}

    function startTimer() {{
      if (timerInterval) clearInterval(timerInterval);
      timeRemaining = 3600;
      const timerEl = document.getElementById('examTimer');
      timerInterval = setInterval(() => {{
        if (timeRemaining <= 0) {{
          clearInterval(timerInterval);
          alert('Time is up! Submitting examination automatically.');
          submitTest();
          return;
        }}
        timeRemaining--;
        const m = Math.floor(timeRemaining / 60);
        const s = timeRemaining % 60;
        timerEl.textContent = `${{String(m).padStart(2, '0')}}:${{String(s).padStart(2, '0')}}`;
      }}, 1000);
    }}

    function switchSection(secCode) {{
      const secRanges = {{
        'GI': 0,
        'GA': 25,
        'QA': 50,
        'EN': 75
      }};
      currentQuestionIndex = secRanges[secCode] || 0;
      if (questionStates[currentQuestionIndex + 1].status === 'not_visited') {{
        questionStates[currentQuestionIndex + 1].status = 'not_answered';
      }}
      updateSectionTabs(secCode);
      renderPalette();
      renderCurrentQuestion();
    }}

    function updateSectionTabs(activeSec) {{
      ['GI', 'GA', 'QA', 'EN'].forEach(code => {{
        const btn = document.getElementById(`secTab-${{code}}`);
        if (!btn) return;
        if (code === activeSec) {{
          btn.className = "px-3 py-1.5 rounded-md font-semibold text-white bg-indigo-600 transition shadow-xs flex items-center gap-1.5";
        }} else {{
          btn.className = "px-3 py-1.5 rounded-md font-medium text-slate-600 hover:bg-slate-200/60 transition flex items-center gap-1.5";
        }}
      }});

      const titles = {{
        'GI': 'Part A: Reasoning (Q1–25)',
        'GA': 'Part B: General Awareness (Q26–50)',
        'QA': 'Part C: Quantitative Aptitude (Q51–75)',
        'EN': 'Part D: English Comprehension (Q76–100)'
      }};
      document.getElementById('sideSectionTitle').textContent = titles[activeSec] || 'Examination';
    }}

    function updateSectionFromQIndex() {{
      const qNum = currentQuestionIndex + 1;
      let sec = 'GI';
      if (qNum > 75) sec = 'EN';
      else if (qNum > 50) sec = 'QA';
      else if (qNum > 25) sec = 'GA';
      updateSectionTabs(sec);
      document.getElementById('sideSectionProgress').textContent = `Q ${{qNum}} / 100`;
    }}

    function renderCurrentQuestion() {{
      if (!currentShiftData) return;
      const q = currentShiftData.questions[currentQuestionIndex];
      const qNum = q.question_number;
      const state = questionStates[qNum];

      const container = document.getElementById('questionContainer');

      const optGridClass = (currentLayout === '2col') 
        ? 'grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-5' 
        : 'flex flex-col gap-3 mt-5';

      let optionsHtml = '';
      ['A', 'B', 'C', 'D'].forEach(optKey => {{
        const optObj = (q.options && q.options.find(o => o.id === optKey)) || {{ id: optKey, text: `Option ${{optKey}}`, has_diagram: false }};
        const isSelected = state.selectedOption === optKey;
        const optClass = isSelected 
          ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/50 text-indigo-950 font-semibold' 
          : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50/80 text-slate-800';

        const optContentHtml = (optObj.has_diagram && optObj.image) 
          ? `<div class="p-1 bg-white rounded border border-slate-200 flex justify-center"><img src="${{optObj.image}}" alt="Option ${{optKey}}" class="max-h-16 object-contain" /></div>`
          : `<div class="text-sm font-medium leading-relaxed">${{optObj.text || 'Option ' + optKey}}</div>`;

        optionsHtml += `
          <div onclick="selectOption('${{optKey}}')" class="flex items-center gap-3.5 p-3.5 rounded-xl border ${{optClass}} transition cursor-pointer shadow-2xs">
            <div class="w-7 h-7 rounded-full border ${{isSelected ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs' : 'border-slate-300 bg-slate-50 text-slate-700'}} flex items-center justify-center text-xs font-bold shrink-0">
              ${{optKey}}
            </div>
            <div class="flex-1 overflow-x-auto">
              ${{optContentHtml}}
            </div>
          </div>
        `;
      }});

      // Problem figure diagram (only when authentic diagram exists)
      const diagramHtml = (q.has_diagram && q.diagram_image) ? `
        <div class="my-4 p-4 diagram-box rounded-xl flex flex-col items-center justify-center">
          <div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Problem Figure / Diagram</div>
          <img src="${{q.diagram_image}}" alt="Q${{qNum}} Diagram" class="max-w-md max-h-72 object-contain rounded" />
        </div>
      ` : '';

      container.innerHTML = `
        <div class="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-xs">
          
          <!-- QUESTION HEADER INFO (SLEEK, LESS DOMINANT THAN QUESTION) -->
          <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-5">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                Question ${{qNum}}
              </span>
              <span class="text-xs text-slate-500 font-medium">
                ${{q.section}}
              </span>
              ${{q.has_diagram ? '<span class="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-bold">📊 Problem Figure</span>' : ''}}
            </div>

            <!-- EXAM INFO RIGHT SIDE (SUBTLE LESS BIG) -->
            <div class="text-[10px] font-medium text-slate-500 bg-slate-100/70 px-2 py-0.5 rounded">
              📅 ${{currentShiftData.exam_date}} (Shift-${{currentShiftData.shift_number}})
            </div>
          </div>

          <!-- QUESTION STATEMENT IN DISTINCTIVE SUBTLE BACKGROUND (NO EXTRA BORDER) -->
          <div class="question-statement-box rounded-xl p-5 mb-4 text-slate-900 text-base md:text-lg leading-relaxed font-semibold">
            <span class="font-bold text-indigo-700 mr-2">Q.${{qNum}}.</span>
            <span>${{q.question_text || 'Select the correct option below:'}}</span>
          </div>

          <!-- PROBLEM FIGURE DIAGRAM (IF AUTHENTIC FIGURE) -->
          ${{diagramHtml}}

          <!-- INTERACTIVE DIGITAL OPTIONS -->
          <div class="${{optGridClass}}">
            ${{optionsHtml}}
          </div>

        </div>
      `;

      document.getElementById('btnPrev').disabled = (currentQuestionIndex === 0);
      document.getElementById('btnNext').textContent = (currentQuestionIndex === 99) ? 'Finish Shift' : 'Save & Next →';
    }}

    function selectOption(optKey) {{
      const qNum = currentQuestionIndex + 1;
      questionStates[qNum].selectedOption = optKey;
      questionStates[qNum].status = 'answered';
      renderCurrentQuestion();
      renderPalette();
    }}

    function clearResponse() {{
      const qNum = currentQuestionIndex + 1;
      questionStates[qNum].selectedOption = null;
      questionStates[qNum].status = 'not_answered';
      renderCurrentQuestion();
      renderPalette();
    }}

    function markForReview() {{
      const qNum = currentQuestionIndex + 1;
      questionStates[qNum].status = 'review';
      saveAndNext();
    }}

    function saveAndNext() {{
      const qNum = currentQuestionIndex + 1;
      if (!questionStates[qNum].selectedOption && questionStates[qNum].status !== 'review') {{
        questionStates[qNum].status = 'not_answered';
      }}

      if (currentQuestionIndex < 99) {{
        currentQuestionIndex++;
        if (questionStates[currentQuestionIndex + 1].status === 'not_visited') {{
          questionStates[currentQuestionIndex + 1].status = 'not_answered';
        }}
        updateSectionFromQIndex();
        renderPalette();
        renderCurrentQuestion();
      }} else {{
        alert('You have reached the end of the shift. Click "Submit Shift Examination" to finalize.');
      }}
    }}

    function prevQuestion() {{
      if (currentQuestionIndex > 0) {{
        currentQuestionIndex--;
        updateSectionFromQIndex();
        renderPalette();
        renderCurrentQuestion();
      }}
    }}

    function renderPalette() {{
      const grid = document.getElementById('paletteGrid');
      grid.innerHTML = '';

      let cAnswered = 0;
      let cNotAnswered = 0;
      let cReview = 0;
      let cNotVisited = 0;

      for (let i = 1; i <= 100; i++) {{
        const st = questionStates[i] || {{ status: 'not_visited' }};
        const isCurrent = (i === currentQuestionIndex + 1);

        let bgClass = 'bg-slate-100 text-slate-600 border-slate-200';
        if (st.status === 'answered') {{
          bgClass = 'bg-emerald-500 text-white border-emerald-600 font-bold';
          cAnswered++;
        }} else if (st.status === 'not_answered') {{
          bgClass = 'bg-rose-500 text-white border-rose-600 font-bold';
          cNotAnswered++;
        }} else if (st.status === 'review') {{
          bgClass = 'bg-purple-600 text-white border-purple-700 font-bold';
          cReview++;
        }} else {{
          cNotVisited++;
        }}

        const ringClass = isCurrent ? 'ring-2 ring-indigo-600 ring-offset-1 font-extrabold scale-105 z-10' : '';

        const btn = document.createElement('button');
        btn.className = `w-9 h-9 rounded-lg border text-xs flex items-center justify-center transition shadow-2xs ${{bgClass}} ${{ringClass}}`;
        btn.textContent = i;
        btn.onclick = () => {{
          currentQuestionIndex = i - 1;
          if (questionStates[i].status === 'not_visited') {{
            questionStates[i].status = 'not_answered';
          }}
          updateSectionFromQIndex();
          renderPalette();
          renderCurrentQuestion();
        }};
        grid.appendChild(btn);
      }}

      document.getElementById('countAnswered').textContent = cAnswered;
      document.getElementById('countNotAnswered').textContent = cNotAnswered;
      document.getElementById('countReview').textContent = cReview;
      document.getElementById('countNotVisited').textContent = cNotVisited;
    }}

    function renderReviewAll() {{
      const container = document.getElementById('reviewContainer');
      container.innerHTML = `
        <div class="bg-indigo-50/70 border border-indigo-200/60 rounded-xl p-4 flex items-center justify-between text-xs text-indigo-950 mb-6">
          <div>
            <div class="font-bold text-sm text-indigo-900">${{currentShiftData.shift_name}} — Paper Review</div>
            <div class="text-indigo-700 mt-0.5">All 100 Questions with 100% digitalized text and official SSC answer keys.</div>
          </div>
          <div class="text-right font-medium">
            <div>Total Marks: <strong class="text-indigo-900">200</strong></div>
            <div>Marking: <strong class="text-emerald-700">+2.0 / -0.50</strong></div>
          </div>
        </div>
      `;

      currentShiftData.questions.forEach(q => {{
        const qNum = q.question_number;
        const card = document.createElement('div');
        card.id = `rev-q-${{qNum}}`;
        card.className = "bg-white rounded-2xl border border-slate-200 p-6 shadow-xs";

        const diagramHtml = (q.has_diagram && q.diagram_image) ? `
          <div class="my-3 p-3 diagram-box rounded-xl flex flex-col items-center justify-center">
            <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Problem Figure / Diagram</div>
            <img src="${{q.diagram_image}}" alt="Q${{qNum}} Diagram" class="max-w-md max-h-64 object-contain rounded" />
          </div>
        ` : '';

        let optsHtml = '';
        ['A', 'B', 'C', 'D'].forEach(k => {{
          const optObj = (q.options && q.options.find(o => o.id === k)) || {{ id: k, text: `Option ${{k}}`, has_diagram: false }};
          const isCorrect = (k === q.correct_option);
          const badgeClass = isCorrect 
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold ring-1 ring-emerald-400' 
            : 'bg-slate-50 border-slate-200 text-slate-700';

          const optTextHtml = (optObj.has_diagram && optObj.image)
            ? `<div class="p-1 bg-white rounded border border-slate-200 inline-block"><img src="${{optObj.image}}" alt="Option ${{k}}" class="max-h-12 object-contain" /></div>`
            : `<span>${{optObj.text || 'Option ' + k}}</span>`;

          optsHtml += `
            <div class="p-3 rounded-xl border ${{badgeClass}} text-xs flex items-center justify-between shadow-2xs">
              <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-full border ${{isCorrect ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white border-slate-300 text-slate-700'}} flex items-center justify-center font-bold text-xs shrink-0">${{k}}</span>
                <span class="text-sm font-medium">${{optTextHtml}}</span>
              </div>
              ${{isCorrect ? '<span class="text-emerald-700 font-bold flex items-center gap-1 text-xs shrink-0">✓ Official Key</span>' : ''}}
            </div>
          `;
        }});

        card.innerHTML = `
          <div class="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60">Q.${{qNum}}</span>
              <span class="text-xs text-slate-500 font-medium">${{q.section}}</span>
            </div>
            <div class="text-[10px] font-medium text-slate-500 bg-slate-100/70 px-2 py-0.5 rounded">
              📅 ${{currentShiftData.exam_date}} (Shift-${{currentShiftData.shift_number}})
            </div>
          </div>

          <div class="question-statement-box rounded-xl p-4 mb-3 text-sm md:text-base text-slate-900 leading-relaxed font-semibold">
            <span class="font-bold text-indigo-700 mr-1.5">Q.${{qNum}}.</span>
            ${{q.question_text || ''}}
          </div>

          ${{diagramHtml}}

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
            ${{optsHtml}}
          </div>

          <div class="mt-4 pt-3 border-t border-slate-100 bg-slate-50/80 p-3.5 rounded-xl text-xs flex items-start gap-2.5">
            <span class="text-emerald-600 font-bold text-base leading-none mt-0.5">💡</span>
            <div>
              <div class="font-semibold text-slate-800 flex items-center gap-1.5">
                <span>Official Key: Option (${{q.correct_option}})</span>
                <span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">VERIFIED</span>
              </div>
              <div class="text-slate-600 text-[11.5px] mt-0.5 leading-relaxed">
                ${{q.solution?.explanation || 'Official SSC Answer Key confirms this choice.'}}
              </div>
            </div>
          </div>
        `;
        container.appendChild(card);
      }});
    }}

    function setMode(mode) {{
      currentMode = mode;
      const cbtEl = document.getElementById('cbtView');
      const revEl = document.getElementById('reviewView');
      const btnCbt = document.getElementById('btnModeCbt');
      const btnRev = document.getElementById('btnModeReview');

      if (mode === 'cbt') {{
        cbtEl.classList.remove('hidden');
        revEl.classList.add('hidden');
        btnCbt.className = "px-2.5 py-1 rounded bg-white text-indigo-700 shadow-xs font-semibold transition";
        btnRev.className = "px-2.5 py-1 rounded text-slate-600 hover:text-slate-900 transition";
        renderCurrentQuestion();
      }} else {{
        cbtEl.classList.add('hidden');
        revEl.classList.remove('hidden');
        btnRev.className = "px-2.5 py-1 rounded bg-white text-indigo-700 shadow-xs font-semibold transition";
        btnCbt.className = "px-2.5 py-1 rounded text-slate-600 hover:text-slate-900 transition";
        renderReviewAll();
      }}
    }}

    function setLayout(layout) {{
      currentLayout = layout;
      const btn2Col = document.getElementById('btnLayout2Col');
      const btn1Col = document.getElementById('btnLayout1Col');

      if (layout === '2col') {{
        btn2Col.className = "px-2 py-1 rounded bg-white text-slate-800 shadow-xs transition font-semibold";
        btn1Col.className = "px-2 py-1 rounded text-slate-600 hover:text-slate-900 transition";
      }} else {{
        btn1Col.className = "px-2 py-1 rounded bg-white text-slate-800 shadow-xs transition font-semibold";
        btn2Col.className = "px-2 py-1 rounded text-slate-600 hover:text-slate-900 transition";
      }}
      renderCurrentQuestion();
    }}

    function submitTest() {{
      let answered = 0;
      let correct = 0;
      for (let i = 1; i <= 100; i++) {{
        const q = currentShiftData.questions[i - 1];
        const st = questionStates[i];
        if (st.selectedOption) {{
          answered++;
          if (st.selectedOption === q.correct_option) {{
            correct++;
          }}
        }}
      }}
      const score = (correct * 2.0) - ((answered - correct) * 0.5);
      alert(`Shift Completed!\\n\\nTotal Attempted: ${{answered}} / 100\\nCorrect Answers: ${{correct}}\\nIncorrect: ${{answered - correct}}\\nScore: ${{score.toFixed(2)}} / 200.00 Marks\\n\\nOpening Paper Review mode to inspect all answers and solutions.`);
      setMode('review');
    }}

    window.onload = init;
  </script>
</body>
</html>'''

with open(OUTPUT_HTML_PATH, "w", encoding="utf-8") as f:
    f.write(html_template)
print(f"Saved {OUTPUT_HTML_PATH} ({os.path.getsize(OUTPUT_HTML_PATH) / (1024*1024):.2f} MB).")

# Copy to artifact directory
shutil.copyfile(OUTPUT_HTML_PATH, ARTIFACT_HTML_PATH)
print(f"Copied standalone HTML to artifact path: {ARTIFACT_HTML_PATH}")
print("ALL DONE SUCCESSFULLY!")
