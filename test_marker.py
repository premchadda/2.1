"""Test Marker on the SSC GK PDF — first 5 pages."""
import time

print("Loading Marker models (first run downloads weights)...")
start_load = time.time()

from marker.converters.pdf import PdfConverter
from marker.models import create_model_dict
from marker.config.parser import ConfigParser

# Load models once
artifact_dict = create_model_dict()
print(f"Models loaded in {time.time() - start_load:.1f}s")

# Configure for first 5 pages
config = {
    "page_range": "0-4",
    "output_format": "markdown",
}
config_parser = ConfigParser(config)

converter = PdfConverter(
    artifact_dict=artifact_dict,
    config=config_parser.generate_config_dict(),
    processor_list=config_parser.get_processors(),
    renderer=config_parser.get_renderer(),
)

print("Converting first 5 pages...")
start_conv = time.time()
rendered = converter("SSC GK 2025 Gagan Pratap.pdf")
md_text = rendered.markdown
elapsed = time.time() - start_conv

# Save output
with open("SSC_GK_marker_output.md", "w", encoding="utf-8") as f:
    f.write(md_text)

print(f"Conversion took: {elapsed:.1f}s")
print(f"Output length: {len(md_text)} chars")
print(f"Output lines: {md_text.count(chr(10))}")
print("Saved to SSC_GK_marker_output.md")
