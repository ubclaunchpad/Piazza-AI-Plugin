"""
    ThreadSense PDF extraction script.
"""


import fitz
import re
import json
import unicodedata
import hashlib

def sha256_file(path: str) -> str:
    """File hashing and unique identifier"""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def normalize_text(text: str) -> str:
    """Normalize Text"""
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("“", '"').replace("”", '"')
    text = text.replace("’", "'")
    text = re.sub(r"[ \t]+", " ", text)             # collapse multi-spaces/tabs
    text = re.sub(r"\n{3,}", "\n\n", text)          # collapse triple(or more) newlines into "\n\n"
    return text.strip()

def fix_hyphens(a: str, b: str) -> str:
    """Hyphen patch"""
    if a.endswith("-") and b[:1].islower():
        return a[:-1] + b
    return a + " " + b

def extract_pdf_pymupdf(path: str, ocr_threshold=40):
    """String to JSON extraction"""
    doc = fitz.open(path) 

    pages_output = []
    full_text_parts = []
    prev_last_line = None

    for i, page in enumerate(doc):

        # 1. Normal PyMuPDF extraction
        text = page.get_text("text")  

        # 2. Trigger OCR fallback
        if len(text.strip()) < ocr_threshold:
            print(f"[PyMuPDF OCR] Page {i+1}: low text → using OCR…")
            text = page.get_text("ocr")  # <-- PyMuPDF OCR using Tesseract

        # 3. Normalize and break into lines
        text = normalize_text(text)
        lines = text.split("\n")

        # ---- Cross-page stitching ----
        if prev_last_line is not None and lines:
            first_line = lines[0]

            # Hyphen repair
            if prev_last_line.endswith("-"):
                stitched = fix_hyphens(prev_last_line, first_line)
                full_text_parts[-1] = stitched
                lines = lines[1:]
            else:
                # Same paragraph detection
                if (prev_last_line.strip() and first_line.strip()
                    and prev_last_line[-1].isalnum()):
                    full_text_parts.append(" ")
                else:
                    full_text_parts.append("\n\n")

        # Save lines
        for line in lines:
            full_text_parts.append(line)

        prev_last_line = full_text_parts[-1] if full_text_parts else None

        pages_output.append({
            "page_num": i + 1,
            "text": "\n".join(lines)
        })

    # Final normalized stitched PDF text
    final_text = "\n".join(full_text_parts)
    final_text = normalize_text(final_text)

    return {
        "text": final_text,
        "pages": pages_output
    }



# ---- Use ----
result = extract_pdf_pymupdf("sample.pdf")
print(json.dumps(result, indent=2))

