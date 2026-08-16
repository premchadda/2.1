import time
import sys

print("Loading Docling models...")
start_load = time.time()
try:
    from docling.document_converter import DocumentConverter
    converter = DocumentConverter()
except Exception as e:
    print(f"Error loading Docling: {e}")
    sys.exit(1)

print(f"Models loaded in {time.time() - start_load:.1f}s")

print("Converting PDF with Docling...")
start_conv = time.time()
try:
    result = converter.convert("SSC GK 2025 Gagan Pratap.pdf")
    md_text = result.document.export_to_markdown()
    elapsed = time.time() - start_conv
    
    with open("SSC_GK_docling_output.md", "w", encoding="utf-8") as f:
        f.write(md_text)
    print(f"Conversion took: {elapsed:.1f}s")
    print(f"Output length: {len(md_text)} chars")
    print("Saved to SSC_GK_docling_output.md")
except Exception as e:
    print(f"Error during conversion: {e}")
