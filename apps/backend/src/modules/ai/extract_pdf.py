import sys
import pymupdf4llm

def extract(pdf_path):
    try:
        md_text = pymupdf4llm.to_markdown(pdf_path)
        print(md_text)
    except Exception as e:
        print(f"Error during PDF extraction: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python extract_pdf.py <pdf_path>", file=sys.stderr)
        sys.exit(1)
    # Ensure stdout uses utf-8 encoding on Windows
    sys.stdout.reconfigure(encoding='utf-8')
    extract(sys.argv[1])
