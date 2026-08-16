import json

with open('.graphify_detect.json','r',encoding='utf-8') as f:
    d = json.load(f)

docs = d['files'].get('document',[])
papers = d['files'].get('paper',[])
images = d['files'].get('image',[])

print(f'docs: {len(docs)}')
print(f'papers: {len(papers)}')
print(f'images: {len(images)}')

json.dump(docs, open('docs.json','w',encoding='utf-8'), indent=2)
json.dump(papers, open('papers.json','w',encoding='utf-8'), indent=2)
json.dump(images, open('images.json','w',encoding='utf-8'), indent=2)
print('Files written.')
