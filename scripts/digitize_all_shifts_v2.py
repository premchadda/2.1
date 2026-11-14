import os
import sys
import re
import json
import time
import argparse
import pymupdf
import pytesseract
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
os.environ["TESSDATA_PREFIX"] = os.path.abspath('tessdata_best')

PDF_PATH = r"E:\Telegram Desktop\SSC CGL 2026 TIER 1 ALL 53 SHIFTS SSC COMPILATIONS-HI_cleaned.pdf"

def clean_opt_text(txt):
    if not txt:
        return ""
    txt = re.sub(r"^[A-D✓\.\(\)\s\-:;\"\'\]\[]+", "", txt).strip()
    txt = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", txt)
    lines = [l.strip() for l in txt.splitlines() if l.strip()]
    return " ".join(lines).strip()

def process_shift(shift_idx, doc, base_output_dir):
    pad_idx = f"shift_{shift_idx:02d}"
    shift_json_path = os.path.join(base_output_dir, "shifts", f"{pad_idx}.json")
    
    if not os.path.exists(shift_json_path):
        print(f"[{pad_idx}] Not found: {shift_json_path}", flush=True)
        return
        
    with open(shift_json_path, "r", encoding="utf-8") as f:
        shift_data = json.load(f)
        
    with open("scratch/shifts_manifest.json", "r", encoding="utf-8") as mf:
        manifest = json.load(mf)
    s_info = next(s for s in manifest if s["shift_index"] == shift_idx)
    start_p = s_info["start_page"]
    end_p = s_info["end_page"]
    
    questions_by_num = {q["question_number"]: q for q in shift_data["questions"]}
    t0 = time.time()
    
    shift_assets_dir = os.path.join(base_output_dir, "assets", pad_idx)
    os.makedirs(shift_assets_dir, exist_ok=True)
    
    opt_digitized = 0
    opt_diagrams = 0
    q_diagrams = 0
    
    for p_idx in range(start_p, end_p + 1):
        page = doc[p_idx]
        blocks = page.get_text("dict")["blocks"]
        
        headers = []
        for b in blocks:
            if b["type"] == 0:
                txt = " ".join("".join(s["text"] for s in line["spans"]) for line in b["lines"]).strip()
                m = re.search(r"(\d{1,3})\s*(?:\n|\s+)\s*QUESTION\s*(?:\n|\s+)\s*KEY\s*([A-D])", txt, re.IGNORECASE)
                if m:
                    headers.append({
                        "q_num": int(m.group(1)),
                        "key": m.group(2).upper(),
                        "y0": b["bbox"][1],
                        "y1": b["bbox"][3]
                    })
        headers.sort(key=lambda h: h["y0"])
        
        for idx, h in enumerate(headers):
            q_num = h["q_num"]
            top_y = h["y1"]
            bot_y = headers[idx+1]["y0"] if idx+1 < len(headers) else (page.rect.height - 40)
            
            q_obj = questions_by_num.get(q_num)
            if not q_obj:
                continue
                
            sec = q_obj["section_code"]
            lang = "eng" if sec == "EN" else "hin+eng"
            
            # Find the 4 option letter anchors
            opt_anchors = {}
            for b in blocks:
                if b["type"] == 0 and (top_y + 4) <= b["bbox"][1] < bot_y:
                    for line in b["lines"]:
                        for s in line["spans"]:
                            t = s["text"].strip()
                            x0 = s["bbox"][0]
                            if t in ["A", "B", "C", "D"] and x0 < 450 and t not in opt_anchors:
                                opt_anchors[t] = s["bbox"]
                                
            # Calculate exact bounding boxes for options
            if len(opt_anchors) == 4:
                is_1col = (opt_anchors["B"][0] < 150)
                if is_1col:
                    opt_boxes = {
                        "A": pymupdf.Rect(opt_anchors["A"][2] + 4, opt_anchors["A"][1] - 3, 580, opt_anchors["B"][1] - 2),
                        "B": pymupdf.Rect(opt_anchors["B"][2] + 4, opt_anchors["B"][1] - 3, 580, opt_anchors["C"][1] - 2),
                        "C": pymupdf.Rect(opt_anchors["C"][2] + 4, opt_anchors["C"][1] - 3, 580, opt_anchors["D"][1] - 2),
                        "D": pymupdf.Rect(opt_anchors["D"][2] + 4, opt_anchors["D"][1] - 3, 580, bot_y - 2)
                    }
                else:
                    col1_right = opt_anchors["B"][0] - 8
                    opt_boxes = {
                        "A": pymupdf.Rect(opt_anchors["A"][2] + 4, opt_anchors["A"][1] - 3, col1_right, opt_anchors["C"][1] - 2),
                        "B": pymupdf.Rect(opt_anchors["B"][2] + 4, opt_anchors["B"][1] - 3, 580, opt_anchors["D"][1] - 2),
                        "C": pymupdf.Rect(opt_anchors["C"][2] + 4, opt_anchors["C"][1] - 3, col1_right, bot_y - 2),
                        "D": pymupdf.Rect(opt_anchors["D"][2] + 4, opt_anchors["D"][1] - 3, 580, bot_y - 2)
                    }
                    
                for o_idx, opt_id in enumerate(["A", "B", "C", "D"]):
                    box = opt_boxes[opt_id]
                    if box.width > 10 and box.height > 8:
                        pix = page.get_pixmap(clip=box, dpi=200)
                        raw_txt = pytesseract.image_to_string(pix.pil_image(), lang=lang, config="--psm 6 --oem 1")
                        clean_t = clean_opt_text(raw_txt)
                        
                        alnum_count = len(re.findall(r"[\w\d]", clean_t))
                        if alnum_count >= 1:
                            q_obj["options"][o_idx]["text"] = clean_t
                            q_obj["options"][o_idx]["image"] = None
                            q_obj["options"][o_idx]["has_diagram"] = False
                            opt_digitized += 1
                        else:
                            # Authentic visual shape diagram in option (e.g. mirror image, dice)
                            opt_rel = f"assets/{pad_idx}/q_{q_num:03d}_opt_{opt_id}.png"
                            pix.save(os.path.join(base_output_dir, opt_rel))
                            q_obj["options"][o_idx]["text"] = ""
                            q_obj["options"][o_idx]["image"] = opt_rel
                            q_obj["options"][o_idx]["has_diagram"] = True
                            opt_diagrams += 1
                            
            # NEVER show statement or options as raster image strips!
            q_obj["question_image"] = None
            q_obj["options_image"] = None
            
            # Check for authentic problem figure/diagram in the question statement
            # Only in GI and QA (never in EN)
            min_opt_y = min(opt_anchors[k][1] for k in opt_anchors) if opt_anchors else bot_y
            has_diag = False
            diag_keywords = ["आव्यूह", "matrix", "तालिका", "चार्ट", "ग्राफ", "दण्ड आरेख", "पाई चार्ट", "वेन आरेख"]
            if sec in ["GI", "QA"] and any(kw in q_obj["question_text"] for kw in diag_keywords):
                diag_rect = pymupdf.Rect(20, top_y + 40, 580, min_opt_y - 4)
                if diag_rect.height > 30:
                    pix = page.get_pixmap(clip=diag_rect, dpi=250)
                    diag_rel = f"assets/{pad_idx}/q_{q_num:03d}_diagram.png"
                    pix.save(os.path.join(base_output_dir, diag_rel))
                    q_obj["has_diagram"] = True
                    q_obj["diagram_image"] = diag_rel
                    has_diag = True
                    q_diagrams += 1
                    
            if not has_diag:
                q_obj["has_diagram"] = False
                q_obj["diagram_image"] = None

    elapsed = time.time() - t0
    with open(shift_json_path, "w", encoding="utf-8") as f:
        json.dump(shift_data, f, indent=2, ensure_ascii=False)
        
    print(f"[{time.strftime('%H:%M:%S')}] Shift {shift_idx:02d} DONE: {opt_digitized} options digitalized ({opt_diagrams} opt diags), {q_diagrams} problem diagrams ({elapsed:.1f}s)", flush=True)

def run_range(start_idx, end_idx, base_dir):
    doc = pymupdf.open(PDF_PATH)
    for s_idx in range(start_idx, end_idx + 1):
        process_shift(s_idx, doc, base_dir)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, required=True)
    parser.add_argument("--end", type=int, required=True)
    parser.add_argument("--base_dir", type=str, default="output/cgl_2026_tier1")
    args = parser.parse_args()
    
    run_range(args.start, args.end, args.base_dir)
