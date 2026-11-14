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

def process_shift_options(shift_idx, doc, base_output_dir):
    pad_idx = f"shift_{shift_idx:02d}"
    shift_json_path = os.path.join(base_output_dir, "shifts", f"{pad_idx}.json")
    
    if not os.path.exists(shift_json_path):
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
    
    digitized_count = 0
    diagrams_count = 0
    
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
                
            # Filter all option images in this question
            # Option images have: y between top_y and bot_y-10, width < 350
            q_opt_imgs = [b["bbox"] for b in blocks if b["type"] == 1 and top_y <= b["bbox"][1] < (bot_y - 8) and (b["bbox"][2] - b["bbox"][0]) < 350]
            
            # Sort into 2 rows: row1 (y < mid_y), row2 (y >= mid_y)
            if len(q_opt_imgs) >= 4:
                # determine vertical cutoff between top 2 options and bottom 2 options
                y_coords = sorted(set(round(b[1]) for b in q_opt_imgs))
                mid_y = (min(b[1] for b in q_opt_imgs) + max(b[1] for b in q_opt_imgs)) / 2
                
                row1 = sorted([b for b in q_opt_imgs if b[1] < mid_y], key=lambda b: b[0])
                row2 = sorted([b for b in q_opt_imgs if b[1] >= mid_y], key=lambda b: b[0])
                
                opt_map = {
                    "A": row1[0] if len(row1) > 0 else None,
                    "B": row1[1] if len(row1) > 1 else None,
                    "C": row2[0] if len(row2) > 0 else None,
                    "D": row2[1] if len(row2) > 1 else None,
                }
                
                lang = "eng" if q_obj["section_code"] == "EN" else "hin+eng"
                
                for o_idx, opt_id in enumerate(["A", "B", "C", "D"]):
                    bbox = opt_map.get(opt_id)
                    if bbox:
                        r = pymupdf.Rect(bbox)
                        # Check if visual option diagram (square box with significant dimensions)
                        is_visual_opt = (r.height > 35 and r.width > 35 and r.width < 110 and r.height < 110 and abs(r.width - r.height) < 25)
                        pad_r = pymupdf.Rect(r.x0 - 2, r.y0 - 2, r.x1 + 2, r.y1 + 2)
                        pix = page.get_pixmap(clip=pad_r, dpi=300)
                        
                        if is_visual_opt:
                            opt_diag_path = f"assets/{pad_idx}/q_{q_num:03d}_opt_{opt_id}.png"
                            pix.save(os.path.join(base_output_dir, opt_diag_path))
                            q_obj["options"][o_idx]["text"] = ""
                            q_obj["options"][o_idx]["image"] = opt_diag_path
                            q_obj["options"][o_idx]["has_diagram"] = True
                        else:
                            raw_txt = pytesseract.image_to_string(pix.pil_image(), lang=lang, config="--psm 7 --oem 1")
                            clean_t = clean_opt_text(raw_txt)
                            if not clean_t:
                                clean_t = f"Option ({opt_id})"
                            q_obj["options"][o_idx]["text"] = clean_t
                            q_obj["options"][o_idx]["image"] = None
                            q_obj["options"][o_idx]["has_diagram"] = False
                            digitized_count += 1
                            
            # Check for authentic problem figure/diagram in the question statement
            # A real diagram has width < 450, height > 60, and is not an option
            all_q_imgs = [b["bbox"] for b in blocks if b["type"] == 1 and top_y <= b["bbox"][1] < (bot_y - 8)]
            real_diag_bbox = None
            for ib in all_q_imgs:
                w = ib[2] - ib[0]
                h = ib[3] - ib[1]
                # If width < 450, height > 55, and height/width > 0.25 (not a wide text banner)
                if 55 < h < 350 and 60 < w < 450 and (h / w) > 0.2:
                    # check if this is not an option
                    if not any(abs(ib[1] - ob[1]) < 5 and abs(ib[0] - ob[0]) < 5 for ob in q_opt_imgs):
                        real_diag_bbox = ib
                        break
                        
            if real_diag_bbox:
                diag_r = pymupdf.Rect(real_diag_bbox)
                diag_pix = page.get_pixmap(clip=diag_r, dpi=300)
                diag_rel = f"assets/{pad_idx}/q_{q_num:03d}_diagram.png"
                diag_pix.save(os.path.join(base_output_dir, diag_rel))
                q_obj["has_diagram"] = True
                q_obj["diagram_image"] = diag_rel
                diagrams_count += 1
            else:
                q_obj["has_diagram"] = False
                q_obj["diagram_image"] = None
                
            # NEVER show question or options as raster image strips!
            q_obj["question_image"] = None
            q_obj["options_image"] = None

    elapsed = time.time() - t0
    with open(shift_json_path, "w", encoding="utf-8") as f:
        json.dump(shift_data, f, indent=2, ensure_ascii=False)
        
    print(f"[{time.strftime('%H:%M:%S')}] Shift {shift_idx:02d}: Digitized {digitized_count} options, {diagrams_count} real diagrams in {elapsed:.1f}s")
    return shift_data

def run_range(start_idx, end_idx, base_dir):
    doc = pymupdf.open(PDF_PATH)
    for s_idx in range(start_idx, end_idx + 1):
        process_shift_options(s_idx, doc, base_dir)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, required=True)
    parser.add_argument("--end", type=int, required=True)
    parser.add_argument("--base_dir", type=str, default="output/cgl_2026_tier1")
    args = parser.parse_args()
    
    run_range(args.start, args.end, args.base_dir)
