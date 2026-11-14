import os
import sys
import re
import json
import pymupdf
import pytesseract
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
os.environ["TESSDATA_PREFIX"] = os.path.abspath('tessdata_best')

doc = pymupdf.open(r"E:\Telegram Desktop\SSC CGL 2026 TIER 1 ALL 53 SHIFTS SSC COMPILATIONS-HI_cleaned.pdf")

def clean_opt_text(txt):
    if not txt:
        return ""
    txt = re.sub(r"^[A-D✓\.\(\)\s\-:;\"\'\]\[]+", "", txt).strip()
    txt = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", txt)
    lines = [l.strip() for l in txt.splitlines() if l.strip()]
    return " ".join(lines).strip()

def digitize_shift(shift_idx, shift_json_path):
    print(f"=== Digitizing all 100 Questions & Options for Shift {shift_idx} ===")
    with open(shift_json_path, "r", encoding="utf-8") as f:
        shift_data = json.load(f)
        
    start_p = 0 if shift_idx == 1 else None
    end_p = 24 if shift_idx == 1 else None
    
    # We find pages from manifest
    with open("scratch/shifts_manifest.json", "r", encoding="utf-8") as mf:
        manifest = json.load(mf)
    s_info = next(s for s in manifest if s["shift_index"] == shift_idx)
    start_p = s_info["start_page"]
    end_p = s_info["end_page"]
    
    questions_by_num = {q["question_number"]: q for q in shift_data["questions"]}
    
    extracted_opts_count = 0
    
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
            
            # Find option label texts A, B, C, D
            opt_labels = []
            for b in blocks:
                if b["type"] == 0:
                    txt = " ".join("".join(s["text"] for s in line["spans"]) for line in b["lines"]).strip()
                    bbox = b["bbox"]
                    if top_y <= bbox[1] < bot_y:
                        if txt in ["A", "B", "C", "D"]:
                            opt_labels.append((txt, bbox))
                            
            # Find images in question
            q_imgs = []
            for b in blocks:
                if b["type"] == 1:
                    bbox = b["bbox"]
                    if top_y <= bbox[1] < bot_y:
                        q_imgs.append(bbox)
            q_imgs.sort(key=lambda r: r[1])
            
            q_obj = questions_by_num.get(q_num)
            if not q_obj:
                continue
                
            # If question has at least 5 images (1 statement + 4 options)
            if len(q_imgs) >= 5 and len(opt_labels) >= 4:
                # Options are the 4 images corresponding to the options
                opt_imgs = q_imgs[-4:] # last 4 images are the options
                # sort by y, then x
                opt_imgs_sorted = sorted(opt_imgs, key=lambda r: (round(r[1]/15)*15, r[0]))
                
                lang = "eng" if q_obj["section_code"] == "EN" else "hin+eng"
                
                for o_idx, opt_id in enumerate(["A", "B", "C", "D"]):
                    if o_idx < len(opt_imgs_sorted):
                        r = pymupdf.Rect(opt_imgs_sorted[o_idx])
                        # check if option image has reasonable size for text (h < 50)
                        is_visual_diagram = (r.height > 38 and r.width > 38 and r.width < 100 and r.height < 100)
                        
                        pad_r = pymupdf.Rect(r.x0 - 2, r.y0 - 2, r.x1 + 2, r.y1 + 2)
                        pix = page.get_pixmap(clip=pad_r, dpi=300)
                        
                        if is_visual_diagram:
                            # This option is a diagram! Save option diagram image
                            opt_diag_path = f"assets/shift_{shift_idx:02d}/q_{q_num:03d}_opt_{opt_id}.png"
                            full_opt_diag = os.path.join("output/cgl_2026_tier1", opt_diag_path)
                            pix.save(full_opt_diag)
                            q_obj["options"][o_idx]["text"] = ""
                            q_obj["options"][o_idx]["image"] = opt_diag_path
                            q_obj["options"][o_idx]["has_diagram"] = True
                        else:
                            # This option is text! Digitize it!
                            raw_txt = pytesseract.image_to_string(pix.pil_image(), lang=lang, config="--psm 7 --oem 1")
                            clean_t = clean_opt_text(raw_txt)
                            if not clean_t:
                                clean_t = f"Option {opt_id}"
                            q_obj["options"][o_idx]["text"] = clean_t
                            q_obj["options"][o_idx]["image"] = None
                            q_obj["options"][o_idx]["has_diagram"] = False
                            extracted_opts_count += 1
            else:
                # Fallback if options cannot be separated
                for o_idx, opt_id in enumerate(["A", "B", "C", "D"]):
                    if q_obj["options"][o_idx]["text"] in ["विकल्प A", "विकल्प B", "विकल्प C", "विकल्प D"]:
                        q_obj["options"][o_idx]["text"] = f"Option ({opt_id})"
                        
            # Refine has_diagram for the question statement:
            # Question has diagram ONLY if there is an image with height > 50 and not just a text line
            # or if statement has multiple images
            q_stmt_imgs = q_imgs[:-4] if len(q_imgs) >= 5 else q_imgs
            real_diagram_found = False
            diagram_rel_path = None
            for s_img in q_stmt_imgs:
                r = pymupdf.Rect(s_img)
                # If image is boxy / square or large height (> 70) and width < 450
                if r.height > 60 and r.width < 450:
                    real_diagram_found = True
                    # save clean diagram crop
                    diag_pix = page.get_pixmap(clip=r, dpi=300)
                    diagram_rel_path = f"assets/shift_{shift_idx:02d}/q_{q_num:03d}_diagram.png"
                    diag_pix.save(os.path.join("output/cgl_2026_tier1", diagram_rel_path))
                    break
                    
            q_obj["has_diagram"] = real_diagram_found
            q_obj["diagram_image"] = diagram_rel_path
            # Clear statement & options images so we NEVER show question/options as images!
            q_obj["question_image"] = None
            q_obj["options_image"] = None
            
    print(f"Shift {shift_idx}: Successfully digitized options for {extracted_opts_count} option slots!")
    with open(shift_json_path, "w", encoding="utf-8") as f:
        json.dump(shift_data, f, indent=2, ensure_ascii=False)
    return shift_data

if __name__ == "__main__":
    s1_path = "output/cgl_2026_tier1/shifts/shift_01.json"
    digitize_shift(1, s1_path)
