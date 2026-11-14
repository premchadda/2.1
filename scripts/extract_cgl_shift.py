import os
import re
import sys
import json
import time
import pymupdf
import pytesseract
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

# Configure Tesseract
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
    # Remove obvious noise artifacts
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", cleaned)
    return cleaned.strip()

def process_shift(shift_info, doc, output_base_dir, perform_ocr=True):
    shift_idx = shift_info["shift_index"]
    shift_id = shift_info["shift_id"]
    date_str = shift_info["date"]
    shift_num = shift_info["shift"]
    start_p = shift_info["start_page"]
    end_p = shift_info["end_page"]
    
    shift_dir_name = f"shift_{shift_idx:02d}"
    assets_dir = os.path.join(output_base_dir, "assets", shift_dir_name)
    os.makedirs(assets_dir, exist_ok=True)
    
    t0 = time.time()
    
    # 1. Parse all pages of this shift
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
                # Keep small padding
                statement_rect = pymupdf.Rect(20, q_top + 1, page.rect.width - 20, max(q_top + 10, opt_y_min - 2))
                options_rect = pymupdf.Rect(20, opt_y_min - 2, page.rect.width - 20, q_bottom)
            else:
                statement_rect = pymupdf.Rect(20, q_top + 1, page.rect.width - 20, q_bottom)
                options_rect = None
            
            # Crop statement image
            stmt_img_rel = f"assets/{shift_dir_name}/q_{q_num:03d}_stmt.png"
            stmt_img_path = os.path.join(output_base_dir, stmt_img_rel)
            
            pix_stmt = page.get_pixmap(clip=statement_rect, dpi=200)
            pix_stmt.save(stmt_img_path)
            
            # Check if has diagram: height of statement > 65 pt
            has_diagram = (statement_rect.height > 65)
            
            # Crop options image if available
            opts_img_rel = None
            if options_rect and options_rect.height > 10:
                opts_img_rel = f"assets/{shift_dir_name}/q_{q_num:03d}_opts.png"
                opts_img_path = os.path.join(output_base_dir, opts_img_rel)
                pix_opts = page.get_pixmap(clip=options_rect, dpi=200)
                pix_opts.save(opts_img_path)
            
            # OCR Question Text
            q_text = ""
            if perform_ocr:
                try:
                    lang = "eng" if current_sec_code == "EN" else "hin+eng"
                    # PSM 6: Assume a single uniform block of text
                    raw_ocr = pytesseract.image_to_string(pix_stmt.pil_image(), lang=lang, config="--psm 6")
                    q_text = clean_ocr_text(raw_ocr)
                except Exception as e:
                    q_text = f"[OCR Extraction Error: {str(e)}]"
            
            # Section determination based on Q number if not yet updated
            sec_name, sec_code = current_sec_name, current_sec_code
            if 1 <= q_num <= 25:
                sec_name, sec_code = "General Intelligence and Reasoning", "GI"
            elif 26 <= q_num <= 50:
                sec_name, sec_code = "General Awareness", "GA"
            elif 51 <= q_num <= 75:
                sec_name, sec_code = "Quantitative Aptitude", "QA"
            elif 76 <= q_num <= 100:
                sec_name, sec_code = "English Comprehension", "EN"
                
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
            
    # Sort by question number
    questions.sort(key=lambda q: q["question_number"])
    
    elapsed = time.time() - t0
    
    # Standard Trstprep Shift Test Object
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
    
    # Save JSON
    shift_json_path = os.path.join(output_base_dir, f"shift_{shift_idx:02d}.json")
    with open(shift_json_path, "w", encoding="utf-8") as f:
        json.dump(shift_test_data, f, indent=2, ensure_ascii=False)
        
    print(f"Shift {shift_idx:02d} ({shift_id}): Extracted {len(questions)} questions in {elapsed:.1f}s -> {shift_json_path}")
    return shift_test_data

if __name__ == "__main__":
    with open("scratch/shifts_manifest.json", "r", encoding="utf-8") as f:
        manifest = json.load(f)
        
    doc = pymupdf.open(PDF_PATH)
    test_shift = manifest[0]
    out_dir = "output/cgl_2026_test"
    res = process_shift(test_shift, doc, out_dir, perform_ocr=True)
    print("Test Shift 1 complete! Total questions:", len(res["questions"]))
    for q in res["questions"][:3]:
        print(f"Q{q['question_number']} [{q['section_code']}] Key: {q['correct_option']}")
        print(f"  Text: {q['question_text'][:80]}...")
