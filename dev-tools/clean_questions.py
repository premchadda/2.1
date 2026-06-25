import json
import os

filepath = os.path.join("E:\\Tech\\Testprep\\Trstprep V2.1", "questions_uploadable.json")

print(f"Reading {filepath}...")
with open(filepath, "r", encoding="utf-8") as f:
    questions = json.load(f)

print(f"Loaded {len(questions)} questions.")

cleaned_count = 0
for q in questions:
    # 1. Inject CGL metrics
    q["marks"] = 2
    q["negativeMarks"] = 0.5
    
    # 2. Clean prefixes for Q5 and Q6
    q_num = q.get("questionNumber")
    if q_num in [5, 6]:
        # Clean English text
        q_text = q.get("questionText", "")
        if q_text.startswith("<p>5 "):
            q["questionText"] = q_text.replace("<p>5 ", "<p>", 1)
            print(f"Cleaned prefix in English for Q{q_num}")
            
        # Clean Hindi text
        q_text_hi = q.get("questionTextHi", "")
        if q_text_hi.startswith("<p>5 "):
            q["questionTextHi"] = q_text_hi.replace("<p>5 ", "<p>", 1)
            print(f"Cleaned prefix in Hindi for Q{q_num}")
            
    # 3. Repair math formatting for Q73
    if q_num == 73:
        q["questionText"] = "<p>Simplify: \\( 7\\frac{1}{4} - \\left[ \\frac{5}{6} \\div \\left\\{ \\frac{1}{3} - \\frac{1}{2} \\left( \\frac{3}{4} - \\frac{1}{4} \\right) \\right\\} \\right] \\)</p>"
        q["questionTextHi"] = "<p>सरल करें: \\( 7\\frac{1}{4} - \\left[ \\frac{5}{6} \\div \\left\\{ \\frac{1}{3} - \\frac{1}{2} \\left( \\frac{3}{4} - \\frac{1}{4} \\right) \\right\\} \\right] \\)</p>"
        print("Repaired equation math for Q73 (English & Hindi)")

print("Writing changes back...")
with open(filepath, "w", encoding="utf-8") as f:
    json.dump(questions, f, ensure_ascii=False, indent=2)

print("questions_uploadable.json successfully updated and formatted!")
