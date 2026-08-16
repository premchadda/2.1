import json, sys, traceback
from graphify.extract import extract
from pathlib import Path

with open('.graphify_detect.json', 'r', encoding='utf-8') as f:
    detect = json.load(f)
code_files = [Path(f) for f in detect['files'].get('code', [])[:5]]
print(f'Processing {len(code_files)} files', flush=True)
try:
    result = extract(code_files)
    print('Done. Type:', type(result).__name__)
    if isinstance(result, dict):
        print(f'AST: {len(result.get("nodes", []))} nodes, {len(result.get("edges", []))} edges')
        json.dump(result, open('.graphify_ast.json', 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
        print('Wrote .graphify_ast.json')
except Exception as e:
    traceback.print_exc()
    print(f'ERROR: {e}')
