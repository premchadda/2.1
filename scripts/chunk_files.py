import json

docs = json.load(open('docs.json','r',encoding='utf-8'))
papers = json.load(open('papers.json','r',encoding='utf-8'))
images = json.load(open('images.json','r',encoding='utf-8'))

# Chunk docs into groups of 22
doc_chunks = []
for i in range(0, len(docs), 22):
    doc_chunks.append(docs[i:i+22])

# Papers + first doc chunk if small enough, otherwise separate
paper_chunk = papers  # only 2 files

# Images - each gets its own chunk
image_chunks = [[img] for img in images]

# Combine: doc chunks + paper chunk + image chunks
all_chunks = doc_chunks + [paper_chunk] + image_chunks

for i, chunk in enumerate(all_chunks):
    print(f'Chunk {i}: {len(chunk)} files')
    for f in chunk:
        print(f'  {f}')

# Save chunks for dispatch
json.dump(all_chunks, open('semantic_chunks.json','w',encoding='utf-8'), indent=2)
print(f'\nTotal chunks: {len(all_chunks)}')
