import pymupdf
import re
import os
import sys
import time

sys.stdout.reconfigure(encoding='utf-8')

pattern_artifact = re.compile(r'/Artifact\s*<<[\s\S]*?>>BDC[\s\S]*?EMC\s*', re.MULTILINE)

target_files = [
    {
        'title': 'General Awareness (GK/GS)',
        'input': r'E:\Telegram Desktop\SSC Steno 2026 GK Answer Key Complete PDF.pdf',
        'output': r'E:\Telegram Desktop\SSC Steno 2026 GK Answer Key Complete PDF (No Watermark).pdf',
        'output_alt': r'E:\Telegram Desktop\SSC Steno 2026 GK Answer Key Complete PDF_nowatermark.pdf'
    },
    {
        'title': 'General Intelligence & Reasoning',
        'input': r'E:\Telegram Desktop\SSC Steno 2026 Reasoning Answer Key Complete PDF.pdf',
        'output': r'E:\Telegram Desktop\SSC Steno 2026 Reasoning Answer Key Complete PDF (No Watermark).pdf',
        'output_alt': r'E:\Telegram Desktop\SSC Steno 2026 Reasoning Answer Key Complete PDF_nowatermark.pdf'
    },
    {
        'title': 'English Language & Comprehension',
        'input': r'E:\Telegram Desktop\SSC Steno 2026 English Answer Key Complete PDF.pdf',
        'output': r'E:\Telegram Desktop\SSC Steno 2026 English Answer Key Complete PDF (No Watermark).pdf',
        'output_alt': r'E:\Telegram Desktop\SSC Steno 2026 English Answer Key Complete PDF_nowatermark.pdf'
    }
]

print("=================================================================")
print("JEV HIGH-SPEED PDF SANITIZER: REMOVING ALL WATERMARKS")
print("=================================================================")

t_global_start = time.time()
results = []

for item in target_files:
    in_path = item['input']
    out_path = item['output']
    title = item['title']
    
    if not os.path.exists(in_path):
        print(f"Error: {in_path} not found!")
        continue
        
    t_start = time.time()
    orig_size_mb = os.path.getsize(in_path) / (1024 * 1024)
    print(f"\n[*] Processing {title} ({orig_size_mb:.2f} MB)...")
    doc = pymupdf.open(in_path)
    total_pages = len(doc)
    print(f"    Total pages to sanitize: {total_pages}")
    
    total_artifacts_removed = 0
    total_links_removed = 0
    
    for pno in range(total_pages):
        page = doc[pno]
        
        # 1. Remove promotional link annotations (e.g. Telegram links)
        for l in page.get_links():
            page.delete_link(l)
            total_links_removed += 1
            
        # 2. Strip /Artifact ... EMC watermark blocks from all content streams
        contents = page.get_contents()
        if contents:
            for c_xref in contents:
                stream = doc.xref_stream(c_xref).decode('latin1', errors='ignore')
                new_stream, count = pattern_artifact.subn('', stream)
                if count > 0:
                    total_artifacts_removed += count
                    doc.update_stream(c_xref, new_stream.encode('latin1'))

    # 3. Compact and purge unused watermark objects
    print(f"    Stripped {total_artifacts_removed} watermark artifact blocks.")
    print(f"    Removed {total_links_removed} promotional link annotations.")
    print(f"    Compacting & saving to: {out_path}...")
    
    doc.save(out_path, garbage=3, deflate=True)
    
    # Also save with _nowatermark suffix for convenience
    import shutil
    shutil.copyfile(out_path, item['output_alt'])
    
    doc.close()
    
    new_size_mb = os.path.getsize(out_path) / (1024 * 1024)
    duration = time.time() - t_start
    print(f"    [✓] Done in {duration:.2f}s! Cleaned size: {new_size_mb:.2f} MB")
    
    results.append({
        'title': title,
        'pages': total_pages,
        'artifacts_removed': total_artifacts_removed,
        'links_removed': total_links_removed,
        'orig_size_mb': orig_size_mb,
        'new_size_mb': new_size_mb,
        'path': out_path
    })

t_global_end = time.time()
print("\n=================================================================")
print(f"[SUCCESS] All 3 Answer Key Compilations sanitized in {t_global_end - t_global_start:.2f}s!")
print("=================================================================")
for r in results:
    print(f"  * {r['title']:<35}: {r['pages']} pgs | {r['orig_size_mb']:.1f} MB -> {r['new_size_mb']:.1f} MB | {r['artifacts_removed']} WMs removed")
    print(f"    -> {r['path']}")
