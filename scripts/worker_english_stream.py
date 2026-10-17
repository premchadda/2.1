import fitz, re, subprocess, os, json, sys, time

sys.stdout.reconfigure(encoding='utf-8')

pdf_path = r'E:\Telegram Desktop\SSC Steno 2026 English Answer Key Complete PDF.pdf'
tess_exe = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
shifts_dir = r'E:\Telegram Desktop\dataset_assets\shifts'
out_dir = r'E:\Telegram Desktop\dataset_assets'
scratch_temp = r'E:\Telegram Desktop\scratch_temp'

os.makedirs(shifts_dir, exist_ok=True)
os.makedirs(scratch_temp, exist_ok=True)

doc = fitz.open(pdf_path)

shift_definitions = [
    (1, 38, "[SSC STENO 09/09/2026 SHIFT 1]", "english_shift_1.json"),
    (39, 80, "[SSC STENO 09/09/2026 SHIFT 2]", "english_shift_2.json"),
    (81, 114, "[SSC STENO 10/09/2026 SHIFT 1]", "english_shift_3.json"),
    (115, 155, "[SSC STENO 10/09/2026 SHIFT 2]", "english_shift_4.json"),
    (156, 192, "[SSC STENO 10/09/2026 SHIFT 3]", "english_shift_5.json"),
    (193, 234, "[SSC STENO 11/09/2026 SHIFT 1]", "english_shift_6.json"),
    (235, 272, "[SSC STENO 11/09/2026 SHIFT 2]", "english_shift_7.json"),
    (273, 310, "[SSC STENO 12/09/2026 SHIFT 1]", "english_shift_8.json"),
    (311, 352, "[SSC STENO 12/09/2026 SHIFT 2]", "english_shift_9.json"),
    (353, 386, "[SSC STENO 15/09/2026 SHIFT 1]", "english_shift_10.json"),
    (387, 423, "[SSC STENO 15/09/2026 SHIFT 2]", "english_shift_11.json")
]

def classify_english(text):
    t = text.lower()
    if 'active' in t or 'passive' in t:
        return 'ACTIVE AND PASSIVE VOICE'
    elif 'direct' in t or 'indirect' in t or 'speech' in t:
        return 'DIRECT AND INDIRECT SPEECH'
    elif 'error' in t or 'grammatical' in t or 'divided into parts' in t:
        return 'SPOTTING THE ERROR'
    elif 'substitute' in t or 'underlined' in t or 'improvement' in t:
        return 'SENTENCE IMPROVEMENT'
    elif 'blank' in t or 'fill in' in t:
        return 'FILL IN THE BLANKS'
    elif 'synonym' in t or 'most similar' in t:
        return 'SYNONYMS'
    elif 'antonym' in t or 'opposite' in t:
        return 'ANTONYMS'
    elif 'idiom' in t or 'phrase' in t or 'proverb' in t:
        return 'IDIOMS AND PHRASES'
    elif 'spelt' in t or 'spelling' in t or 'misspelt' in t:
        return 'SPELLING TEST'
    elif 'passage' in t and ('deleted' in t or 'cloze' in t):
        return 'CLOZE TEST'
    elif 'passage' in t or 'comprehension' in t:
        return 'READING COMPREHENSION'
    elif 'one word' in t or 'substitute for the given' in t:
        return 'ONE WORD SUBSTITUTION'
    elif 'parajumble' in t or 'jumbled' in t or 'rearrange' in t:
        return 'PARAJUMBLES'
    else:
        return 'GRAMMAR AND VOCABULARY'

t_start = time.time()
img_temp = os.path.join(scratch_temp, 'temp_eng.png')
txt_temp = os.path.join(scratch_temp, 'temp_eng')

all_english_questions = []
global_id = 1

for s_idx, (start_p, end_p, shift_name, filename) in enumerate(shift_definitions):
    out_shift_file = os.path.join(shifts_dir, filename)
    
    # If already processed, load from cache
    if os.path.exists(out_shift_file):
        try:
            with open(out_shift_file, 'r', encoding='utf-8') as f_cached:
                cached_data = json.load(f_cached)
            if len(cached_data) == 100:
                print(f"[{s_idx+1}/11] Loading {shift_name} from cache (100 Qs)...")
                for q in cached_data:
                    q['id'] = global_id
                    all_english_questions.append(q)
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
                            
        crop_box = fitz.Rect(45, max(0, y0 - 5), page.rect.width - 20, min(page.rect.height, y1))
        pix = page.get_pixmap(clip=crop_box, dpi=180)
        pix.save(img_temp)
        
        subprocess.run([tess_exe, img_temp, txt_temp, '--oem', '1', '-l', 'eng'],
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
        
        topic = classify_english(q_stmt)
        ans_key = correct_let or 'A'
        
        opts = {'A': opt_a, 'B': opt_b, 'C': opt_c, 'D': opt_d}
        
        record = {
            'id': global_id,
            'question_no': qnum,
            'subject': 'ENGLISH LANGUAGE',
            'chapter': topic,
            'exam': shift_name,
            'question': {
                'english': q_stmt,
                'hindi': None,
                'image': None
            },
            'options': {
                'A': {'english': opt_a, 'hindi': None, 'image': None},
                'B': {'english': opt_b, 'hindi': None, 'image': None},
                'C': {'english': opt_c, 'hindi': None, 'image': None},
                'D': {'english': opt_d, 'hindi': None, 'image': None},
            },
            'correct_answer': {
                'letter': ans_key,
                'english': opts.get(ans_key, ''),
                'hindi': None
            }
        }
        shift_questions.append(record)
        all_english_questions.append(record)
        global_id += 1
        
    print(f"  * Extracted {len(shift_questions)} questions. Correct answers: {sum(1 for q in shift_questions if q['correct_answer']['letter'])}/100")
    with open(out_shift_file, 'w', encoding='utf-8') as f_out:
        json.dump(shift_questions, f_out, ensure_ascii=False, indent=2)

# Cleanup reusable temp files
for tf in [img_temp, f'{txt_temp}.txt']:
    if os.path.exists(tf):
        try: os.remove(tf)
        except: pass

t_end = time.time()
print(f"\n=======================================================")
print(f"TOTAL ENGLISH QUESTIONS EXTRACTED: {len(all_english_questions)} / 1100")
print(f"Time Taken: {t_end - t_start:.2f} seconds.")

out_json = os.path.join(out_dir, 'ssc_steno_2026_english_1100.json')
with open(out_json, 'w', encoding='utf-8') as f:
    json.dump(all_english_questions, f, ensure_ascii=False, indent=2)

print(f"Successfully saved complete English dataset to: {out_json}")
