import os
import glob
import json
import time
import sys

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = "output/cgl_2026_tier1"
BATCH_DIRS = [
    os.path.join(BASE_DIR, "batch_1"),
    os.path.join(BASE_DIR, "batch_2"),
    os.path.join(BASE_DIR, "batch_3"),
    os.path.join(BASE_DIR, "batch_4"),
]
MASTER_JSON_PATH = os.path.join(BASE_DIR, "ssc_cgl_2026_tier1_master_question_bank.json")
AUDIT_REPORT_PATH = os.path.join(BASE_DIR, "cgl_2026_extraction_audit.json")

def merge_and_audit():
    print("=== Scanning all batch directories for extracted shifts ===")
    shift_files = []
    for bdir in BATCH_DIRS:
        if os.path.exists(bdir):
            files = glob.glob(os.path.join(bdir, "shift_*.json"))
            shift_files.extend(files)
            
    shift_files.sort(key=lambda p: int(os.path.basename(p).replace("shift_", "").replace(".json", "")))
    print(f"Total shift files found: {len(shift_files)}")
    
    master_bank = {
        "metadata": {
            "title": "SSC CGL 2026 Tier-1 Official Question Bank (All 53 Shifts)",
            "exam_name": "Staff Selection Commission - Combined Graduate Level (Tier-1)",
            "exam_year": 2026,
            "total_shifts": len(shift_files),
            "expected_shifts": 53,
            "expected_questions": 5300,
            "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "format_spec": "Trstprep Test Series JSON V2.1"
        },
        "shifts": []
    }
    
    total_q_count = 0
    total_diagrams = 0
    section_breakdown = {"GI": 0, "GA": 0, "QA": 0, "EN": 0}
    key_distribution = {"A": 0, "B": 0, "C": 0, "D": 0}
    missing_images = []
    shifts_summary = []
    
    for sf in shift_files:
        with open(sf, "r", encoding="utf-8") as f:
            sdata = json.load(f)
            
        s_idx = sdata["shift_index"]
        s_name = sdata["shift_name"]
        q_list = sdata["questions"]
        q_cnt = len(q_list)
        total_q_count += q_cnt
        
        s_diag = sum(1 for q in q_list if q.get("has_diagram", False))
        total_diagrams += s_diag
        
        # Check images
        shift_parent = os.path.dirname(sf)
        for q in q_list:
            # section count
            sc = q.get("section_code", "UNK")
            section_breakdown[sc] = section_breakdown.get(sc, 0) + 1
            
            # key count
            k = q.get("correct_option", "UNK")
            key_distribution[k] = key_distribution.get(k, 0) + 1
            
            # image check
            img_rel = q.get("question_image")
            if img_rel:
                full_img_p = os.path.join(shift_parent, img_rel)
                if not os.path.exists(full_img_p):
                    missing_images.append(full_img_p)
                    
        shifts_summary.append({
            "shift_index": s_idx,
            "shift_id": sdata["shift_id"],
            "shift_name": s_name,
            "exam_date": sdata["exam_date"],
            "shift_number": sdata["shift_number"],
            "question_count": q_cnt,
            "diagrams_count": s_diag,
            "status": "VERIFIED" if q_cnt == 100 else f"INCOMPLETE ({q_cnt}/100)"
        })
        
        master_bank["shifts"].append(sdata)
        
    master_bank["metadata"]["actual_questions"] = total_q_count
    master_bank["metadata"]["total_diagrams"] = total_diagrams
    master_bank["metadata"]["section_distribution"] = section_breakdown
    master_bank["metadata"]["key_distribution"] = key_distribution
    
    # Save Master JSON
    with open(MASTER_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(master_bank, f, indent=2, ensure_ascii=False)
        
    print(f"\n Master Question Bank written to: {MASTER_JSON_PATH}")
    print(f"File Size: {os.path.getsize(MASTER_JSON_PATH) / (1024*1024):.2f} MB")
    
    # Save Audit Summary
    audit_data = {
        "total_shifts_found": len(shift_files),
        "total_questions_extracted": total_q_count,
        "is_complete_5300": (total_q_count == 5300),
        "missing_images_count": len(missing_images),
        "section_breakdown": section_breakdown,
        "key_distribution": key_distribution,
        "total_questions_with_diagrams": total_diagrams,
        "shifts_summary": shifts_summary
    }
    with open(AUDIT_REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(audit_data, f, indent=2, ensure_ascii=False)
        
    print(f" Audit Report written to: {AUDIT_REPORT_PATH}")
    print(f"Summary: {total_q_count} questions across {len(shift_files)} shifts. Diagrams: {total_diagrams}. Missing images: {len(missing_images)}")

if __name__ == "__main__":
    merge_and_audit()
