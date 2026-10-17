import fitz, re, subprocess, os, json, sys, time

sys.stdout.reconfigure(encoding='utf-8')

pdf_path = r'E:\Telegram Desktop\SSC Steno 2026 Reasoning Answer Key Complete PDF.pdf'
tess_exe = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
shifts_dir = r'E:\Telegram Desktop\dataset_assets\shifts'
out_dir = r'E:\Telegram Desktop\dataset_assets'
images_dir = os.path.join(out_dir, 'images', 'reasoning')
scratch_temp = r'E:\Telegram Desktop\scratch_temp'
tessdata_dir = r'E:\Telegram Desktop\dataset_assets\tessdata'

os.makedirs(shifts_dir, exist_ok=True)
os.makedirs(out_dir, exist_ok=True)
os.makedirs(images_dir, exist_ok=True)
os.makedirs(scratch_temp, exist_ok=True)

doc = fitz.open(pdf_path)

shift_definitions = [
    (1, 22, "[SSC STENO 09/09/2026 SHIFT 1]", "reasoning_shift_1.json"),
    (23, 45, "[SSC STENO 09/09/2026 SHIFT 2]", "reasoning_shift_2.json"),
    (46, 74, "[SSC STENO 10/09/2026 SHIFT 1]", "reasoning_shift_3.json"),
    (75, 107, "[SSC STENO 10/09/2026 SHIFT 2]", "reasoning_shift_4.json"),
    (108, 132, "[SSC STENO 10/09/2026 SHIFT 3]", "reasoning_shift_5.json"),
    (133, 155, "[SSC STENO 11/09/2026 SHIFT 1]", "reasoning_shift_6.json"),
    (156, 178, "[SSC STENO 11/09/2026 SHIFT 2]", "reasoning_shift_7.json"),
    (179, 201, "[SSC STENO 12/09/2026 SHIFT 1]", "reasoning_shift_8.json"),
    (202, 223, "[SSC STENO 12/09/2026 SHIFT 2]", "reasoning_shift_9.json"),
    (224, 246, "[SSC STENO 15/09/2026 SHIFT 1]", "reasoning_shift_10.json"),
    (247, 271, "[SSC STENO 15/09/2026 SHIFT 2]", "reasoning_shift_11.json")
]

dev = re.compile(r'[\u0900-\u097F]')

def classify_reasoning(text):
    t = text.lower()
    if 'syllogism' in t or 'conclusions:' in t or 'निष्कर्ष' in t or 'all books are' in t or 'statements:' in t or 'कथन:' in t:
        return 'SYLLOGISM'
    elif 'code' in t or 'coded' in t or 'कोडिंग' in t or 'कूट' in t or 'कूटबद्ध' in t:
        return 'CODING-DECODING'
    elif 'brother' in t or 'sister' in t or 'mother' in t or 'father' in t or 'daughter' in t or 'son' in t or 'रक्त संबंध' in t or 'माता' in t or 'पिता' in t or 'भाई' in t or 'बहन' in t or 'पत्नी' in t or 'पति' in t:
        return 'BLOOD RELATIONS'
    elif 'north' in t or 'south' in t or 'east' in t or 'west' in t or 'दिशा' in t or 'दूरी' in t or 'उत्तर' in t or 'दक्षिण' in t or 'पूर्व' in t or 'पश्चिम' in t:
        return 'DIRECTION AND DISTANCE'
    elif '<' in t or '>' in t or '≤' in t or '≥' in t or 'inequalit' in t:
        return 'INEQUALITIES'
    elif 'series' in t or 'sequence' in t or 'श्रृंखला' in t or 'श्रेणी' in t or 'completes the following' in t or 'दी गई श्रृंखला' in t:
        return 'SERIES COMPLETION'
    elif 'analogy' in t or 'related to' in t or 'संबंधित' in t or '::' in t:
        return 'ANALOGY AND SIMILARITY'
    elif 'odd' in t or 'different' in t or 'विषम' in t or 'भिन्न' in t or 'असंगत' in t or 'बेमेल' in t:
        return 'CLASSIFICATION (ODD ONE OUT)'
    elif 'seated' in t or 'circular' in t or 'row' in t or 'बैठक व्यवस्था' in t or 'पंक्ति' in t or 'वृत्त' in t or 'arrangement' in t:
        return 'SEATING ARRANGEMENT'
    elif 'denotes' in t or 'mathematical' in t or 'गणितीय संक्रिया' in t or 'इंटरचेंज' in t or 'interchanged' in t or 'बदल दिया जाए' in t:
        return 'MATHEMATICAL OPERATIONS'
    elif 'diagram' in t or 'venn' in t or 'वेन आरेख' in t or 'आरेख' in t:
        return 'VENN DIAGRAMS'
    elif 'mirror' in t or 'water' in t or 'paper' in t or 'fold' in t or 'embedded' in t or 'दर्पण' in t or 'कागज' in t or 'आकृति' in t or 'छिपी' in t:
        return 'NON-VERBAL REASONING'
    else:
        return 'GENERAL INTELLIGENCE & REASONING MISCELLANEOUS'

t_start = time.time()
img_temp = os.path.join(scratch_temp, 'temp_reas.png')
txt_temp = os.path.join(scratch_temp, 'temp_reas')

all_reasoning_questions = []
global_id = 1

for s_idx, (start_p, end_p, shift_name, filename) in enumerate(shift_definitions):
    out_shift_file = os.path.join(shifts_dir, filename)
    
    # If already cached, load
    if os.path.exists(out_shift_file):
        try:
            with open(out_shift_file, 'r', encoding='utf-8') as f_cached:
                cached_data = json.load(f_cached)
            if len(cached_data) == 50:
                print(f"[{s_idx+1}/11] Loading {shift_name} from cache (50 Qs)...")
                for q in cached_data:
                    q['id'] = global_id
                    all_reasoning_questions.append(q)
                    global_id += 1
                continue
        except Exception:
            pass

    print(f"\n[{s_idx+1}/11] Processing {shift_name} (Pages {start_p} to {end_p})...")
    
    questions_loc = []
    for pno in range(start_p - 1, end_p):
        page = doc[pno]
        rects = page.search_for('Q.No')
        for r in rects:
            t = page.get_text('text', clip=fitz.Rect(r.x0, r.y0-2, r.x0+60, r.y1+4))
            m = re.search(r'(\d+)', t)
            if m:
                questions_loc.append({
                    'qnum': int(m.group(1)),
                    'pno': pno,
                    'y0': r.y0
                })
                
    questions_loc.sort(key=lambda x: (x['pno'], x['y0']))
    print(f"  * Located {len(questions_loc)} question markers.")
    
    shift_questions = []
    for i, q_info in enumerate(questions_loc):
        qnum = q_info['qnum']
        pno = q_info['pno']
        y0 = q_info['y0']
        page = doc[pno]
        
        if i + 1 < len(questions_loc) and questions_loc[i+1]['pno'] == pno:
            y1 = questions_loc[i+1]['y0'] - 5
        else:
            y1 = page.rect.height - 25
            
        h_lines = sorted(list(set(round(d['rect'].y0, 1) for d in page.get_drawings() 
                                   if d['rect'].width > 200 and d['rect'].height < 2.0 and y0 - 10 <= d['rect'].y0 <= y1 + 5)))
        
        # Detect correct answer from green/yellow vector fills
        correct_let = None
        for d in page.get_drawings():
            f = d.get('fill')
            r = d['rect']
            if f and r.x0 < 10 and r.width < 80 and y0 - 10 <= r.y0 <= y1 + 5:
                is_green = (f[1] > 0.4 and f[0] < 0.2 and f[2] < 0.2)
                is_yellow = (f[0] > 0.8 and f[1] > 0.8 and f[2] < 0.3)
                if is_green or is_yellow:
                    for opt_idx in range(1, min(5, len(h_lines))):
                        if h_lines[opt_idx-1] - 4 <= r.y0 <= h_lines[opt_idx] + 4:
                            correct_let = ['A', 'B', 'C', 'D'][opt_idx-1]
                            break
                            
        # Detect and extract diagram figures
        q_diagram_img = None
        opt_diagram_imgs = {'A': None, 'B': None, 'C': None, 'D': None}
        
        for img_info in page.get_image_info(xrefs=True):
            xref = img_info['xref']
            bbox = img_info['bbox']
            if xref > 0 and (y0 - 10 <= bbox[1] <= y1):
                try:
                    b = doc.extract_image(xref)
                    w, h = b['width'], b['height']
                    if h >= 50 and w >= 50 and 0.4 <= (w / h) <= 3.0 and not (w == 178 and h == 167):
                        img_filename = f'reasoning_s{s_idx+1}_q{qnum}_xref{xref}.png'
                        img_save_path = os.path.join(images_dir, img_filename)
                        if not os.path.exists(img_save_path):
                            with open(img_save_path, 'wb') as f_img:
                                f_img.write(b['image'])
                        rel_path = f'images/reasoning/{img_filename}'
                        
                        if len(h_lines) >= 2 and bbox[1] < h_lines[1]:
                            q_diagram_img = rel_path
                        elif len(h_lines) >= 5:
                            for o_idx in range(1, 5):
                                if h_lines[o_idx-1] - 4 <= bbox[1] <= h_lines[o_idx] + 4:
                                    let = ['A', 'B', 'C', 'D'][o_idx-1]
                                    opt_diagram_imgs[let] = rel_path
                                    break
                except Exception:
                    pass

        # Crop and OCR question block using single reusable temp image on E:
        crop_box = fitz.Rect(45, max(0, y0 - 5), page.rect.width - 20, min(page.rect.height, y1))
        pix = page.get_pixmap(clip=crop_box, dpi=180)
        pix.save(img_temp)
        
        subprocess.run([tess_exe, img_temp, txt_temp, '--tessdata-dir', tessdata_dir, '--oem', '1', '-l', 'eng+hin'],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        try:
            with open(f'{txt_temp}.txt', 'r', encoding='utf-8', errors='ignore') as f:
                raw_ocr = f.read().strip()
        except:
            raw_ocr = ""
            
        lines = [l.strip() for l in raw_ocr.split('\n') if l.strip()]
        lines = [l for l in lines if not any(p in l.upper() for p in ['CLICK HERE', 'JOIN', 'CHALLENGE', 'ACHIEVERS'])]
        
        if len(lines) >= 5:
            opt_d = lines[-1]
            opt_c = lines[-2]
            opt_b = lines[-3]
            opt_a = lines[-4]
            q_stmt = ' '.join(lines[:-4])
        elif len(lines) == 4:
            opt_d = lines[-1]
            opt_c = lines[-2]
            opt_b = lines[-3]
            opt_a = lines[1] if len(lines) > 1 else ''
            q_stmt = lines[0]
        else:
            q_stmt = ' '.join(lines)
            opt_a, opt_b, opt_c, opt_d = '', '', '', ''
            
        q_stmt = re.sub(r'^[\|\)\:\s\d]+', '', q_stmt).strip()
        opt_a = re.sub(r'^[\|\s\:\-]+', '', opt_a).strip()
        opt_b = re.sub(r'^[\|\s\:\-]+', '', opt_b).strip()
        opt_c = re.sub(r'^[\|\s\:\-]+', '', opt_c).strip()
        opt_d = re.sub(r'^[\|\s\:\-]+', '', opt_d).strip()
        
        # Split English & Hindi
        eng_q = q_stmt
        hin_q = None
        if '/' in q_stmt:
            p_parts = q_stmt.split('/')
            eng_q = p_parts[0].strip()
            hin_q = p_parts[1].strip()
        elif dev.search(q_stmt):
            m_dev = dev.search(q_stmt)
            eng_q = q_stmt[:m_dev.start()].strip()
            hin_q = q_stmt[m_dev.start():].strip()
            
        def split_opt(val):
            if '/' in val:
                ps = val.split('/')
                return ps[0].strip(), ps[1].strip()
            m_d = dev.search(val)
            if m_d:
                return val[:m_d.start()].strip(), val[m_d.start():].strip()
            return val.strip(), None
            
        oa_eng, oa_hin = split_opt(opt_a)
        ob_eng, ob_hin = split_opt(opt_b)
        oc_eng, oc_hin = split_opt(opt_c)
        od_eng, od_hin = split_opt(opt_d)
        
        topic = classify_reasoning(q_stmt)
        ans_key = correct_let or 'A'
        
        opts_eng = {'A': oa_eng, 'B': ob_eng, 'C': oc_eng, 'D': od_eng}
        opts_hin = {'A': oa_hin, 'B': ob_hin, 'C': oc_hin, 'D': od_hin}
        
        record = {
            'id': global_id,
            'question_no': qnum,
            'subject': 'GENERAL INTELLIGENCE & REASONING',
            'chapter': topic,
            'exam': shift_name,
            'question': {
                'english': eng_q,
                'hindi': hin_q,
                'image': q_diagram_img
            },
            'options': {
                'A': {'english': oa_eng, 'hindi': oa_hin, 'image': opt_diagram_imgs['A']},
                'B': {'english': ob_eng, 'hindi': ob_hin, 'image': opt_diagram_imgs['B']},
                'C': {'english': oc_eng, 'hindi': oc_hin, 'image': opt_diagram_imgs['C']},
                'D': {'english': od_eng, 'hindi': od_hin, 'image': opt_diagram_imgs['D']},
            },
            'correct_answer': {
                'letter': ans_key,
                'english': opts_eng.get(ans_key, ''),
                'hindi': opts_hin.get(ans_key, '')
            }
        }
        shift_questions.append(record)
        all_reasoning_questions.append(record)
        global_id += 1
        
    print(f"  * Extracted {len(shift_questions)} questions. Correct answers: {sum(1 for q in shift_questions if q['correct_answer']['letter'])}/50")
    with open(out_shift_file, 'w', encoding='utf-8') as f_out:
        json.dump(shift_questions, f_out, ensure_ascii=False, indent=2)

# Cleanup reusable temp files
for tf in [img_temp, f'{txt_temp}.txt']:
    if os.path.exists(tf):
        try: os.remove(tf)
        except: pass

t_end = time.time()
print(f"\n=======================================================")
print(f"TOTAL REASONING QUESTIONS EXTRACTED: {len(all_reasoning_questions)} / 550")
print(f"Time Taken: {t_end - t_start:.2f} seconds.")

out_json = os.path.join(out_dir, 'ssc_steno_2026_reasoning_550.json')
with open(out_json, 'w', encoding='utf-8') as f:
    json.dump(all_reasoning_questions, f, ensure_ascii=False, indent=2)

print(f"Successfully saved complete Reasoning dataset to: {out_json}")
