import json, sys, os, traceback
from graphify.extract import extract, collect_files
from pathlib import Path

if __name__ == '__main__':
    OUT = '.graphify_ast.json'
    PROG = '.graphify_ast_progress.json'

    start_offset = 0
    existing_nodes = []
    existing_edges = []
    if os.path.exists(PROG):
        try:
            prog = json.load(open(PROG, 'r', encoding='utf-8'))
            existing_nodes = prog.get('nodes', [])
            existing_edges = prog.get('edges', [])
            start_offset = prog.get('next', 0)
            print(f'Resuming from offset {start_offset} with {len(existing_nodes)} cached nodes', flush=True)
        except Exception:
            pass

    with open('.graphify_detect.json', 'r', encoding='utf-8') as f:
        detect = json.load(f)
    code_files = [Path(f) for f in detect['files'].get('code', [])]
    total = len(code_files)
    print(f'Total code files: {total}', flush=True)

    CHUNK = 50
    for i in range(start_offset, total, CHUNK):
        chunk_files = code_files[i:i+CHUNK]
        print(f'[{i}/{total}] processing {len(chunk_files)} files...', flush=True)
        try:
            result = extract(chunk_files)
            if isinstance(result, dict):
                existing_nodes.extend(result.get('nodes', []))
                existing_edges.extend(result.get('edges', []))
                json.dump({
                    'nodes': existing_nodes,
                    'edges': existing_edges,
                    'next': i + CHUNK,
                }, open(PROG, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
                print(f'  -- chunk done: +{len(result.get("nodes", []))} nodes', flush=True)
        except Exception as e:
            print(f'  ERROR in chunk {i}: {e}', flush=True)
            traceback.print_exc()
            continue

    json.dump({
        'nodes': existing_nodes,
        'edges': existing_edges,
        'input_tokens': 0,
        'output_tokens': 0,
    }, open(OUT, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
    print(f'Final AST: {len(existing_nodes)} nodes, {len(existing_edges)} edges -> {OUT}', flush=True)
