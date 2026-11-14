import json
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

MASTER_PATH = "output/cgl_2026_tier1/ssc_cgl_2026_tier1_master_question_bank.json"

with open(MASTER_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

shifts = data.get("shifts", [])
total_questions = sum(len(s.get("questions", [])) for s in shifts)

print(f"Total Shifts: {len(shifts)}")
print(f"Total Questions: {total_questions}")

empty_q_text = 0
short_q_text = 0 # < 15 chars
ocr_error_count = 0
placeholder_options_count = 0
digitized_options_count = 0
diagrams_count = 0

sample_questions = []

for s in shifts:
    for q in s.get("questions", []):
        txt = (q.get("question_text") or "").strip()
        if not txt:
            empty_q_text += 1
        elif len(txt) < 15:
            short_q_text += 1
        if "[OCR" in txt or "Error" in txt:
            ocr_error_count += 1
            
        opts = q.get("options", [])
        is_placeholder = all(o.get("text") in ["विकल्प A", "विकल्प B", "विकल्प C", "विकल्प D", "Option A", "Option B", "Option C", "Option D"] for o in opts)
        if is_placeholder:
            placeholder_options_count += 1
        else:
            digitized_options_count += 1
            
        if q.get("has_diagram"):
            diagrams_count += 1

print("\n=== DIGITALIZATION AUDIT RESULTS ===")
print(f"1. Question Statement Text:")
print(f"   - Total Questions: {total_questions}")
print(f"   - Non-empty Question Text: {total_questions - empty_q_text} ({(total_questions - empty_q_text)/total_questions*100:.1f}%)")
print(f"   - Empty Question Text: {empty_q_text}")
print(f"   - Suspiciously Short Text (<15 chars): {short_q_text}")
print(f"   - OCR Error Tags: {ocr_error_count}")

print(f"\n2. Options Text:")
print(f"   - Questions with Placeholder Options ('विकल्प A/B/C/D'): {placeholder_options_count} ({placeholder_options_count/total_questions*100:.1f}%)")
print(f"   - Fully Digitized Options: {digitized_options_count} ({digitized_options_count/total_questions*100:.1f}%)")

print(f"\n3. Diagrams & Problem Figures:")
print(f"   - Questions Flagged as Having Diagrams: {diagrams_count} ({diagrams_count/total_questions*100:.1f}%)")
print(f"   - Text-Only Questions: {total_questions - diagrams_count} ({(total_questions - diagrams_count)/total_questions*100:.1f}%)")

# Inspect first shift sample questions
print("\n=== SAMPLE QUESTIONS (Shift 1, Q1 to Q5) ===")
for q in shifts[0]["questions"][:5]:
    print(f"\nQ.{q['question_number']} [{q['section_code']}] Diagram: {q['has_diagram']}")
    print(f"Statement: {q['question_text']}")
    print(f"Options: {[o['text'] for o in q['options']]}")
    print(f"Key: {q['correct_option']}")
    print(f"Image: {q['question_image']} | Opts Image: {q['options_image']}")
