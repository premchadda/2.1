import json
prog = json.load(open('.graphify_ast_progress.json','r',encoding='utf-8'))
json.dump({
    'nodes': prog['nodes'],
    'edges': prog['edges'],
    'input_tokens': 0,
    'output_tokens': 0,
}, open('.graphify_ast.json','w',encoding='utf-8'), indent=2, ensure_ascii=False)
print(f'AST: {len(prog["nodes"])} nodes, {len(prog["edges"])} edges')
