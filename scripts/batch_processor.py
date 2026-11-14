import os
import re
import sys
import json
import time
import argparse
import pymupdf
import pytesseract
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

TESSERACT_CMD = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
TESSDATA_DIR = os.path.abspath('tessdata')
pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
os.environ["TESSDATA_PREFIX"] = TESSDATA_DIR

PDF_PATH = r"E:\Telegram Desktop\SSC CGL 2026 TIER 1 ALL 53 SHIFTS SSC COMPILATIONS-HI_cleaned.pdf"

Q_HEADER_RE = re.compile(r"(\d{1,3})\s*(?:\n|\s+)\s*QUESTION\s*(?:\n|\s+)\s*KEY\s*([A-D])", re.IGNORECASE)
SECTION_RE = re.compile(r"ANSWER KEY PART-([A-D])\s*\((.*?)\)", re.IGNORECASE)

SECTION_MAP = {
    "A": ("General Intelligence and Reasoning", "GI"),
    "B": ("General Awareness", "GA"),
    "C": ("Quantitative Aptitude", "QA"),
    "D": ("English Comprehension", "EN"),
}

def clean_ocr_text(text):
    if not text:
        return ""
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    cleaned = "\n".join(lines)
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", cleaned)
    return cleaned.strip()

def process_single_shift(shift_info, doc, output_dir):
    shift_idx = shift_info["shift_index"]
    shift_id = shift_info["shift_id"]
    date_str = shift_info["date"]
    shift_num = shift_info["shift"]
    start_p = shift_info["start_page"]
    end_p = shift_info["end_page"]
    
    shift_dir_name = f"shift_{shift_idx:02d}"
    assets_dir = os.path.join(output_dir, "assets", shift_dir_name)
    os.makedirs(assets_dir, exist_ok=True)
    
    t0 = time.time()
    current_sec_name = "General Intelligence and Reasoning"
    current_sec_code = "GI"
    
    questions = []
    
    for page_idx in range(start_p, end_p + 1):
        page = doc[page_idx]
        text = page.get_text("text")
        page_dict = page.get_text("dict")
        blocks = page_dict.get("blocks", [])
        
        # Check section change
        sec_m = SECTION_RE.search(text)
        if sec_m:
            sec_part = sec_m.group(1).upper()
            if sec_part in SECTION_MAP:
                current_sec_name, current_sec_code = SECTION_MAP[sec_part]
        
        # Find all question headers on this page
        headers = []
        for b in blocks:
            if b.get("type") == 0:
                txt = " ".join("".join(span["text"] for span in line["spans"]) for line in b.get("lines", [])).strip()
                m = Q_HEADER_RE.search(txt)
                if not m:
                    lines = [s["text"].strip() for line in b.get("lines", []) for s in line.get("spans", []) if s["text"].strip()]
                    m = Q_HEADER_RE.search(" ".join(lines))
                if m:
                    headers.append({
                        "q_num": int(m.group(1)),
                        "key": m.group(2).upper(),
                        "bbox": pymupdf.Rect(b["bbox"])
                    })
        
        headers.sort(key=lambda h: h["bbox"].y0)
        footer_y = page.rect.height - 35
        
        for idx, h in enumerate(headers):
            q_num = h["q_num"]
            key = h["key"]
            q_top = h["bbox"].y1
            q_bottom = headers[idx + 1]["bbox"].y0 if idx + 1 < len(headers) else footer_y
            
            # Find options region
            opt_blocks = []
            for b in blocks:
                if b.get("type") == 0:
                    txt = " ".join("".join(span["text"] for span in line["spans"]) for line in b.get("lines", [])).strip()
                    bbox = pymupdf.Rect(b["bbox"])
                    if q_top <= bbox.y0 < q_bottom:
                        if txt in ["A", "B", "C", "D", "A B", "C D", "A B ✓", "C D ✓", "A ✓", "B ✓", "C ✓", "D ✓"]:
                            opt_blocks.append((txt, bbox))
            
            if opt_blocks:
                opt_y_min = min(b[1].y0 for b in opt_blocks)
                statement_rect = pymupdf.Rect(20, q_top + 1, page.rect.width - 20, max(q_top + 10, opt_y_min - 2))
                options_rect = pymupdf.Rect(20, opt_y_min - 2, page.rect.width - 20, q_bottom)
            else:
                statement_rect = pymupdf.Rect(20, q_top + 1, page.rect.width - 20, q_bottom)
                options_rect = None
            
            # Crop statement image (dpi=180 gives optimal speed & crystal clear fidelity)
            stmt_img_rel = f"assets/{shift_dir_name}/q_{q_num:03d}_stmt.png"
            stmt_img_path = os.path.join(output_dir, stmt_img_rel)
            pix_stmt = page.get_pixmap(clip=statement_rect, dpi=180)
            pix_stmt.save(stmt_img_path)
            
            has_diagram = (statement_rect.height > 65)
            
            opts_img_rel = None
            if options_rect and options_rect.height > 10:
                opts_img_rel = f"assets/{shift_dir_name}/q_{q_num:03d}_opts.png"
                opts_img_path = os.path.join(output_dir, opts_img_rel)
                pix_opts = page.get_pixmap(clip=options_rect, dpi=180)
                pix_opts.save(opts_img_path)
            
            # Section determination based on Q number
            sec_name, sec_code = current_sec_name, current_sec_code
            if 1 <= q_num <= 25:
                sec_name, sec_code = "General Intelligence and Reasoning", "GI"
            elif 26 <= q_num <= 50:
                sec_name, sec_code = "General Awareness", "GA"
            elif 51 <= q_num <= 75:
                sec_name, sec_code = "Quantitative Aptitude", "QA"
            elif 76 <= q_num <= 100:
                sec_name, sec_code = "English Comprehension", "EN"
            
            # Perform OCR
            q_text = ""
            try:
                lang = "eng" if sec_code == "EN" else "hin+eng"
                raw_ocr = pytesseract.image_to_string(pix_stmt.pil_image(), lang=lang, config="--psm 6")
                q_text = clean_ocr_text(raw_ocr)
            except Exception as e:
                q_text = f"[OCR Error: {str(e)}]"
                
            q_obj = {
                "question_number": q_num,
                "section": sec_name,
                "section_code": sec_code,
                "page_number": page_idx + 1,
                "question_text": q_text,
                "question_image": stmt_img_rel,
                "options_image": opts_img_rel,
                "has_diagram": has_diagram,
                "options": [
                    {"id": "A", "text": "विकल्प A", "is_correct": (key == "A")},
                    {"id": "B", "text": "विकल्प B", "is_correct": (key == "B")},
                    {"id": "C", "text": "विकल्प C", "is_correct": (key == "C")},
                    {"id": "D", "text": "विकल्प D", "is_correct": (key == "D")}
                ],
                "correct_option": key,
                "marks": 2.0,
                "negative_marks": 0.5,
                "solution": {
                    "correct_option": key,
                    "explanation": f"Official SSC CGL 2026 Tier-1 Answer Key confirms Option ({key}) as the correct answer."
                }
            }
            questions.append(q_obj)
            
    questions.sort(key=lambda q: q["question_number"])
    elapsed = time.time() - t0
    
    shift_test_data = {
        "test_series": "SSC CGL 2026 Tier-1",
        "shift_id": f"CGL-2026-T1-S{shift_idx:02d}",
        "shift_name": f"SSC CGL 2026 Tier-1 ({date_str} - Shift {shift_num})",
        "exam_date": date_str,
        "shift_number": shift_num,
        "shift_index": shift_idx,
        "total_questions": len(questions),
        "total_marks": 200,
        "duration_minutes": 60,
        "sections": [
            {"section_name": "General Intelligence and Reasoning", "section_code": "GI", "total_questions": 25, "total_marks": 50},
            {"section_name": "General Awareness", "section_code": "GA", "total_questions": 25, "total_marks": 50},
            {"section_name": "Quantitative Aptitude", "section_code": "QA", "total_questions": 25, "total_marks": 50},
            {"section_name": "English Comprehension", "section_code": "EN", "total_questions": 25, "total_marks": 50}
        ],
        "questions": questions
    }
    
    shift_json_path = os.path.join(output_dir, f"shift_{shift_idx:02d}.json")
    with open(shift_json_path, "w", encoding="utf-8") as f:
        json.dump(shift_test_data, f, indent=2, ensure_ascii=False)
        
    print(f"[{time.strftime('%H:%M:%S')}] Shift {shift_idx:02d}/{shift_info['total_shifts_in_batch']} ({shift_id}): 100 questions in {elapsed:.1f}s -> {shift_json_path}")
    return shift_test_data

def run_batch(start_shift_idx, end_shift_idx, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    with open("scratch/shifts_manifest.json", "r", encoding="utf-8") as f:
        manifest = json.load(f)
        
    shifts_to_process = [s for s in manifest if start_shift_idx <= s["shift_index"] <= end_shift_idx]
    print(f"=== Starting Batch: Shifts {start_shift_idx} to {end_shift_idx} ({len(shifts_to_process)} shifts, {len(shifts_to_process)*100} questions) ===")
    print(f"Target Output Directory: {output_dir}")
    
    doc = pymupdf.open(PDF_PATH)
    t_start = time.time()
    
    completed = 0
    for s in shifts_to_process:
        s["total_shifts_in_batch"] = len(shifts_to_process)
        process_single_shift(s, doc, output_dir)
        completed += 1
        
    t_total = time.time() - t_start
    print(f"=== Batch Complete! Processed {completed} shifts ({completed*100} questions) in {t_total/60:.2f} mins ===")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, required=True, help="Start shift index (1-based)")
    parser.add_argument("--end", type=int, required=True, help="End shift index (inclusive)")
    parser.add_argument("--out", type=str, required=True, help="Output directory")
    args = parser.parse_args()
    
    run_batch(args.start, args.end, args.out)
