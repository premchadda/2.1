import json, pymupdf, re, os, sys, subprocess, html

sys.stdout.reconfigure(encoding='utf-8')

dataset_dir = r"E:\Telegram Desktop\dataset_assets"
gk_path = os.path.join(dataset_dir, "ssc_steno_2026_gk_550.json")
reas_path = os.path.join(dataset_dir, "ssc_steno_2026_reasoning_550.json")
eng_path = os.path.join(dataset_dir, "ssc_steno_2026_english_1100.json")

scratch_dir = r"E:\Telegram Desktop\scratch_temp\book_build"
os.makedirs(scratch_dir, exist_ok=True)

edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
final_book_pdf = r"E:\Telegram Desktop\SSC_Steno_2026_Complete_Question_Bank_2200_Questions.pdf"
orig_pdf_gk = r"E:\Telegram Desktop\steno_2026_exam_gk_gs_topic_wise_PDF_by_Borderland_ssc_xssc_journey_nowatermark.pdf"

def clean_text_for_html(text):
    if not text:
        return ""
    text = re.sub(r'[\uf000-\uffff\u2666\u2022\uf0a7\u25c6\u25cf]', '', text)
    text = re.sub(r'(?:ATTEMPT AS MOCK TEST|CLICK HERE|JOIN HERE)[^\n]*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'^[\|\)\:\s\d]+', '', text)
    return html.escape(text.strip())

def build_section_html(section_title, section_header, questions_list, is_english=False):
    # Group questions by chapter
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
    margin: 8mm 8mm 8.5mm 8mm;
    border: 2px solid #1e293b;
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
            
            # Question text
            q_eng = clean_text_for_html(q.get('question', {}).get('english', ''))
            q_hin = clean_text_for_html(q.get('question', {}).get('hindi', ''))
            
            if is_english or not q_hin:
                q_display = q_eng
            else:
                q_display = q_hin
                
            q_img = q.get('question', {}).get('image')
            
            # Options
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
            
            # Answer row
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

print("PDF generator module loaded successfully.")
