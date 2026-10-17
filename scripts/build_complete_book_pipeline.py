import json
import pymupdf
import re
import os
import sys
import subprocess
import html
import time

sys.stdout.reconfigure(encoding='utf-8')

dataset_dir = r"E:\Telegram Desktop\dataset_assets"
master_json_path = os.path.join(dataset_dir, "ssc_steno_2026_master_dataset_2200.json")
scratch_dir = r"E:\Telegram Desktop\scratch_temp\book_build"
os.makedirs(scratch_dir, exist_ok=True)

edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
orig_cleaned_pdf = r"E:\Telegram Desktop\steno_2026_exam_gk_gs_topic_wise_PDF_by_Borderland_ssc_xssc_journey_nowatermark.pdf"

t_start = time.time()
print("=================================================================")
print("SSC STENOGRAPHER 2026 — 2,200 QUESTIONS COMPLETE BOOK GENERATOR")
print("=================================================================")

with open(master_json_path, 'r', encoding='utf-8') as f:
    master_data = json.load(f)

print(f"Loaded master dataset: {len(master_data)} questions.")

def clean_text_for_html(text):
    if not text:
        return ""
    text = re.sub(r'[\uf000-\uffff\u2666\u2022\uf0a7\u25c6\u25cf]', '', text)
    text = re.sub(r'(?:ATTEMPT AS MOCK TEST|CLICK HERE|JOIN HERE)[^\n]*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'^[\|\)\:\s\d]+', '', text)
    return html.escape(text.strip())

def build_section_html(section_title, section_header, questions_list, is_english=False):
    ch_dict = {}
    for q in questions_list:
        ch = q.get('chapter', 'MISCELLANEOUS')
        ch_dict.setdefault(ch, []).append(q)
        
    html_parts = []
    html_parts.append(f'''<!DOCTYPE html>
<html lang="hi">
<head>
<meta charset="UTF-8">
<title>{html.escape(section_title)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Inter:wght@400;600;700;800&display=swap');
  
  @page {{
    size: A4 portrait;
    margin: 8.5mm 8.5mm 9mm 8.5mm;
    border: 2.5px double #334155;
    padding: 3mm 2.5mm;
    @top-center {{
      content: "SSC STENOGRAPHER 2026 — {html.escape(section_header)}";
      font-size: 7.2pt;
      font-family: 'Inter', sans-serif;
      color: #64748b;
      font-weight: 600;
      letter-spacing: 0.25px;
    }}
  }}

  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: 'Noto Sans Devanagari', 'Mangal', 'Inter', sans-serif;
    color: #1e293b;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
  }}

  .content-area {{
    column-count: 2;
    column-gap: 5.5mm;
    column-rule: 1px solid #cbd5e1;
    column-fill: auto;
  }}

  .chapter-header {{
    break-inside: avoid;
    break-after: avoid;
    background: #0f172a;
    color: #ffffff;
    padding: 3px 6px;
    margin: 4px 0 3.5px 0;
    border-radius: 3.5px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-left: 3.5px solid #10b981;
  }}

  .chapter-header:first-child {{
    margin-top: 0;
  }}

  .chapter-title {{
    font-family: 'Inter', sans-serif;
    font-size: 8.2pt;
    font-weight: 700;
    letter-spacing: 0.2px;
    text-transform: uppercase;
  }}

  .chapter-badge {{
    font-family: 'Inter', sans-serif;
    font-size: 6.8pt;
    background: #10b981;
    color: #ffffff;
    padding: 1px 4.5px;
    border-radius: 2.5px;
    font-weight: 600;
    white-space: nowrap;
  }}

  .q-card {{
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    padding: 4px 6px;
    margin-bottom: 4px;
    break-inside: avoid;
    font-size: 8.4pt;
    line-height: 1.30;
  }}

  .q-header-row {{
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 4px;
    margin-bottom: 2px;
  }}

  .q-num {{
    display: inline-block;
    background: #d97706;
    color: #ffffff;
    font-family: 'Inter', sans-serif;
    font-weight: 700;
    font-size: 7.5pt;
    padding: 0.8px 4.5px;
    border-radius: 2.5px;
    letter-spacing: 0.2px;
    flex-shrink: 0;
  }}

  .q-exam-badge {{
    display: inline-block;
    font-family: 'Inter', monospace;
    font-size: 6.0pt;
    font-weight: 600;
    color: #581c87;
    background: #f3e8ff;
    border: 1px solid #d8b4fe;
    border-right: 2.5px solid #9333ea;
    padding: 0.8px 4px;
    border-radius: 2px;
    white-space: nowrap;
    letter-spacing: 0.15px;
  }}

  .q-text {{
    color: #1e3a8a;
    font-weight: 600;
    font-size: 8.3pt;
    text-align: justify;
    margin-bottom: 2.5px;
  }}

  .q-image-container {{
    text-align: center;
    margin: 2px 0 3px 0;
  }}

  .q-image {{
    max-width: 95%;
    max-height: 90px;
    object-fit: contain;
    border: 1px solid #e2e8f0;
    border-radius: 3px;
    background: #ffffff;
  }}

  .q-options {{
    display: flex;
    flex-direction: column;
    gap: 1.2px;
    margin-bottom: 2.5px;
  }}

  .opt-row {{
    display: flex;
    align-items: flex-start;
    gap: 4px;
    font-size: 8.0pt;
    line-height: 1.25;
  }}

  .opt-badge {{
    font-family: 'Inter', sans-serif;
    font-weight: 700;
    color: #2563eb;
    min-width: 17px;
    flex-shrink: 0;
  }}

  .opt-text {{
    color: #334155;
    text-align: justify;
  }}

  .opt-image {{
    max-width: 60px;
    max-height: 45px;
    object-fit: contain;
    border: 1px solid #e2e8f0;
    border-radius: 2px;
  }}

  .q-ans-row {{
    margin-top: 2px;
    padding-top: 2px;
    border-top: 1px dashed #cbd5e1;
    display: flex;
    align-items: baseline;
    gap: 4.5px;
    font-size: 7.6pt;
  }}

  .ans-badge {{
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background: #dcfce7;
    border: 1px solid #86efac;
    padding: 0.5px 4.5px;
    border-radius: 2px;
    flex-shrink: 0;
  }}

  .ans-label {{
    font-weight: 700;
    color: #166534;
    font-size: 7.6pt;
  }}

  .ans-key {{
    font-family: 'Inter', sans-serif;
    font-weight: 800;
    color: #15803d;
    font-size: 7.6pt;
  }}

  .ans-text {{
    color: #14532d;
    font-weight: 600;
    font-size: 7.6pt;
  }}
</style>
</head>
<body>
<div class="content-area">
''')

    ch_num = 1
    for ch_name, q_list in ch_dict.items():
        clean_ch = clean_text_for_html(ch_name)
        html_parts.append(f'''
  <div class="chapter-header">
    <div class="chapter-title">CHAPTER {ch_num}: {clean_ch}</div>
    <div class="chapter-badge">{len(q_list)} Questions</div>
  </div>
''')
        for q in q_list:
            qid = q.get('id', '')
            exam = clean_text_for_html(q.get('exam', ''))
            
            q_eng = clean_text_for_html(q.get('question', {}).get('english', ''))
            q_hin = clean_text_for_html(q.get('question', {}).get('hindi', ''))
            
            if is_english or not q_hin:
                q_display = q_eng
            else:
                q_display = q_hin
                
            q_img = q.get('question', {}).get('image')
            
            opts = q.get('options', {})
            ans_let = q.get('correct_answer', {}).get('letter', 'A')
            ans_val_eng = clean_text_for_html(q.get('correct_answer', {}).get('english', ''))
            ans_val_hin = clean_text_for_html(q.get('correct_answer', {}).get('hindi', ''))
            ans_val = ans_val_hin if (ans_val_hin and not is_english) else ans_val_eng

            html_parts.append(f'''
  <div class="q-card">
    <div class="q-header-row">
      <span class="q-num">Q.{qid}</span>
      <span class="q-exam-badge">{exam}</span>
    </div>
    <div class="q-text">{q_display}</div>
''')
            if q_img:
                img_full_path = os.path.join(r"E:\Telegram Desktop\dataset_assets", q_img).replace('\\', '/')
                html_parts.append(f'''
    <div class="q-image-container"><img class="q-image" src="file:///{img_full_path}"></div>
''')

            html_parts.append('    <div class="q-options">')
            for let in ['A', 'B', 'C', 'D']:
                opt_data = opts.get(let, {})
                opt_eng = clean_text_for_html(opt_data.get('english', ''))
                opt_hin = clean_text_for_html(opt_data.get('hindi', ''))
                opt_text = opt_hin if (opt_hin and not is_english) else opt_eng
                opt_img = opt_data.get('image')
                
                html_parts.append(f'''
      <div class="opt-row">
        <span class="opt-badge">({let})</span>
        <span class="opt-text">{opt_text}</span>
''')
                if opt_img:
                    opt_img_path = os.path.join(r"E:\Telegram Desktop\dataset_assets", opt_img).replace('\\', '/')
                    html_parts.append(f'<img class="opt-image" src="file:///{opt_img_path}">')
                html_parts.append('      </div>')
                
            html_parts.append('    </div>') # end q-options
            
            ans_label = "उत्तर:" if not is_english else "Answer:"
            html_parts.append(f'''
    <div class="q-ans-row">
      <span class="ans-badge">
        <span class="ans-label">{ans_label}</span>
        <span class="ans-key">({ans_let})</span>
      </span>
      <span class="ans-text">{ans_val}</span>
    </div>
  </div>
''')
        ch_num += 1

    html_parts.append('''
</div>
</body>
</html>
''')
    return ''.join(html_parts)

def render_html_to_pdf(html_content, out_pdf_path, temp_name):
    html_f = os.path.join(scratch_dir, f"{temp_name}.html")
    with open(html_f, "w", encoding="utf-8") as f:
        f.write(html_content)

    user_data_dir = os.path.join(scratch_dir, f"edge_tmp_{temp_name}")
    cmd = [
        edge_path,
        "--headless",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--user-data-dir={user_data_dir}",
        f"--print-to-pdf={out_pdf_path}",
        html_f
    ]
    subprocess.run(cmd, check=True)
    doc = pymupdf.open(out_pdf_path)
    p_count = len(doc)
    doc.close()
    return p_count

# Structure the sections
gk_subjects = [
    ("ANCIENT HISTORY", "ANCIENT HISTORY"),
    ("MEDIEVAL HISTORY", "MEDIEVAL HISTORY"),
    ("MODERN HISTORY", "MODERN HISTORY"),
    ("GEOGRAPHY", "GEOGRAPHY"),
    ("POLITY", "POLITY & CONSTITUTION"),
    ("ECONOMICS", "ECONOMICS"),
    ("ENVIRONMENT", "ENVIRONMENT & ECOLOGY"),
    ("PHYSICS", "PHYSICS"),
    ("CHEMISTRY", "CHEMISTRY"),
    ("BIOLOGY", "BIOLOGY"),
    ("STATIC GK", "STATIC GK & CULTURE"),
    ("CURRENT AFFAIRS", "CURRENT AFFAIRS")
]

print("\n--- [Step 1/4] Rendering General Awareness (550 Questions in Parallel) ---")
gk_tasks = []
for subj_id, display_title in gk_subjects:
    q_list = [q for q in master_data if q.get('subject') == subj_id]
    if q_list:
        gk_tasks.append((subj_id, display_title, q_list))

def _render_gk_item(item):
    subj_id, display_title, q_list = item
    pdf_out = os.path.join(scratch_dir, f"section_gk_{subj_id.lower().replace(' ', '_')}.pdf")
    html_c = build_section_html(f"SSC Steno 2026 - {display_title}", display_title, q_list, is_english=False)
    p_cnt = render_html_to_pdf(html_c, pdf_out, f"sec_gk_{subj_id.lower().replace(' ', '_')}")
    return display_title, pdf_out, p_cnt, len(q_list)

import concurrent.futures
gk_pdf_sections = []
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
    # Maintain original ordered list of sections
    futures = [executor.submit(_render_gk_item, item) for item in gk_tasks]
    for future in futures:
        display_title, pdf_out, p_cnt, q_len = future.result()
        print(f"  * {display_title:<25}: {q_len:3d} Qs -> {p_cnt:2d} pages")
        gk_pdf_sections.append((display_title, pdf_out, p_cnt))

print("\n--- [Step 2/4] Rendering Reasoning (550 Questions) ---")
reas_q_list = [q for q in master_data if q.get('subject') == 'GENERAL INTELLIGENCE & REASONING']
reas_pdf_path = os.path.join(scratch_dir, "section_reasoning_550.pdf")
reas_html = build_section_html("SSC Steno 2026 - Reasoning", "REASONING & GENERAL INTELLIGENCE", reas_q_list, is_english=False)
reas_pages = render_html_to_pdf(reas_html, reas_pdf_path, "sec_reasoning_550")
print(f"  * REASONING COMPLETE: {len(reas_q_list)} Qs -> {reas_pages} pages")

print("\n--- [Step 3/4] Rendering English (1,100 Questions) ---")
# To prevent Chromium print memory issues with 1,100 questions in a single job, split English into 2 balanced volumes (550 Qs each)
eng_all = [q for q in master_data if q.get('subject') == 'ENGLISH LANGUAGE']
eng_part1_qs = eng_all[:550]
eng_part2_qs = eng_all[550:]

eng_pdf1 = os.path.join(scratch_dir, "section_english_part1.pdf")
eng_html1 = build_section_html("SSC Steno 2026 - English Part 1", "ENGLISH LANGUAGE & COMPREHENSION (PART 1)", eng_part1_qs, is_english=True)
eng_p1_cnt = render_html_to_pdf(eng_html1, eng_pdf1, "sec_eng_part1")
print(f"  * ENGLISH PART 1: {len(eng_part1_qs)} Qs -> {eng_p1_cnt} pages")

eng_pdf2 = os.path.join(scratch_dir, "section_english_part2.pdf")
eng_html2 = build_section_html("SSC Steno 2026 - English Part 2", "ENGLISH LANGUAGE & COMPREHENSION (PART 2)", eng_part2_qs, is_english=True)
eng_p2_cnt = render_html_to_pdf(eng_html2, eng_pdf2, "sec_eng_part2")
print(f"  * ENGLISH PART 2: {len(eng_part2_qs)} Qs -> {eng_p2_cnt} pages")

print("\n--- [Step 4/4] Assembling Complete Master Omnibus PDF Book ---")
doc_orig = pymupdf.open(orig_cleaned_pdf)
master_book = pymupdf.open()

# 4.1 Front matter from original PDF (Cover, Partner, Syllabus Weightage)
master_book.insert_pdf(doc_orig, from_page=0, to_page=2)
toc = [
    [1, "COVER PAGE", 1],
    [1, "EXAM WEIGHTAGE & SYLLABUS ANALYSIS", 3],
    [1, "PART 1: GENERAL AWARENESS (550 QUESTIONS)", 4]
]

# 4.2 Insert GK sections with original syllabus index pages interleaved!
orig_gk_indices = {
    "ANCIENT HISTORY": 3,
    "MEDIEVAL HISTORY": 4,
    "MODERN HISTORY": 5,
    "GEOGRAPHY": 6,
    "POLITY & CONSTITUTION": 7,
    "ECONOMICS": 8,
    "ENVIRONMENT & ECOLOGY": 9,
    "PHYSICS": 10,
    "CHEMISTRY": 11,
    "STATIC GK & CULTURE": 12,
    "CURRENT AFFAIRS": 13,
    "BIOLOGY": 14
}

for title, sec_pdf, p_cnt in gk_pdf_sections:
    # Insert syllabus index page for this GK module
    orig_idx = orig_gk_indices.get(title)
    if orig_idx is not None and orig_idx < len(doc_orig):
        master_book.insert_pdf(doc_orig, from_page=orig_idx, to_page=orig_idx)
        cur_p = len(master_book)
        toc.append([2, f"{title} — SYLLABUS INDEX", cur_p])
        
    start_q_p = len(master_book) + 1
    doc_s = pymupdf.open(sec_pdf)
    
    # Extract chapter titles for TOC
    seen_c = set()
    for p_off in range(len(doc_s)):
        txt = doc_s[p_off].get_text()
        matches = re.finditer(r'(CHAPTER\s*\d+:\s*[^\n]+)', txt, flags=re.IGNORECASE)
        for m in matches:
            ct = re.sub(r'\s*\d+\s*Questions.*', '', m.group(1), flags=re.I).strip()
            if ct not in seen_c:
                seen_c.add(ct)
                toc.append([3, ct, start_q_p + p_off])
                
    master_book.insert_pdf(doc_s)
    doc_s.close()

# 4.3 Insert Reasoning Section
part2_start = len(master_book) + 1
toc.append([1, "PART 2: GENERAL INTELLIGENCE & REASONING (550 QUESTIONS)", part2_start])
doc_reas = pymupdf.open(reas_pdf_path)
seen_c = set()
for p_off in range(len(doc_reas)):
    txt = doc_reas[p_off].get_text()
    matches = re.finditer(r'(CHAPTER\s*\d+:\s*[^\n]+)', txt, flags=re.IGNORECASE)
    for m in matches:
        ct = re.sub(r'\s*\d+\s*Questions.*', '', m.group(1), flags=re.I).strip()
        if ct not in seen_c:
            seen_c.add(ct)
            toc.append([2, ct, part2_start + p_off])
master_book.insert_pdf(doc_reas)
doc_reas.close()

# 4.4 Insert English Sections
part3_start = len(master_book) + 1
toc.append([1, "PART 3: ENGLISH LANGUAGE & COMPREHENSION (1,100 QUESTIONS)", part3_start])

for eng_sub_pdf, sub_label in [(eng_pdf1, "ENGLISH SECTION PART 1"), (eng_pdf2, "ENGLISH SECTION PART 2")]:
    cur_p = len(master_book) + 1
    toc.append([2, sub_label, cur_p])
    doc_eng = pymupdf.open(eng_sub_pdf)
    seen_c = set()
    for p_off in range(len(doc_eng)):
        txt = doc_eng[p_off].get_text()
        matches = re.finditer(r'(CHAPTER\s*\d+:\s*[^\n]+)', txt, flags=re.IGNORECASE)
        for m in matches:
            ct = re.sub(r'\s*\d+\s*Questions.*', '', m.group(1), flags=re.I).strip()
            if ct not in seen_c:
                seen_c.add(ct)
                toc.append([3, ct, cur_p + p_off])
    master_book.insert_pdf(doc_eng)
    doc_eng.close()

# Clean all hyperlinks and stamp continuous page numbering
print(f"Total Master Book Pages: {len(master_book)}")
print("Applying bookmarks, continuous page numbers, and stripping hyperlinks...")

links_removed = 0
total_p = len(master_book)

for pno in range(total_p):
    page = master_book[pno]
    for l in page.get_links():
        page.delete_link(l)
        links_removed += 1
        
    # Stamp footer on pages after front matter (page 4 onwards)
    if pno >= 3:
        w = page.rect.width
        h = page.rect.height
        footer_text = f"Page {pno + 1} of {total_p}"
        rect_footer = pymupdf.Rect(w/2 - 70, h - 22, w/2 + 70, h - 7)
        page.draw_rect(rect_footer, color=None, fill=(1, 1, 1))
        page.insert_text(
            pymupdf.Point(w/2 - 25, h - 12),
            footer_text,
            fontname="helv",
            fontsize=7.5,
            color=(0.35, 0.45, 0.55)
        )

# Set Table of Contents bookmarks
master_book.set_toc(toc)

final_book_path = r"E:\Telegram Desktop\SSC_Steno_2026_Complete_Question_Bank_2200_Questions.pdf"
master_book.save(final_book_path, garbage=3, deflate=True)
master_book.close()
doc_orig.close()

t_end = time.time()
size_mb = os.path.getsize(final_book_path) / (1024 * 1024)
print("\n=================================================================")
print(f"[SUCCESS] Master 2,200 Question Book generated successfully!")
print(f"  * Output PDF : {final_book_path}")
print(f"  * Total Pages: {total_p}")
print(f"  * File Size  : {size_mb:.2f} MB")
print(f"  * TOC Entries: {len(toc)} bookmarks added")
print(f"  * Time Taken : {t_end - t_start:.2f} seconds")
print("=================================================================")
