"""
    ThreadSense PDF extraction script.
"""

from datetime import datetime, timezone
import sys
import uuid
import fitz
import re
import json
import unicodedata
import hashlib
import argparse
import os

TOOL_VERSION = "0.1.0"

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

    doc_hash = sha256_file(path)
    doc_uuid = str(uuid.uuid5(uuid.NAMESPACE_URL, doc_hash))
    doc = fitz.open(path) 

    total_word_count = 0
    skipped = False
    pages_output = []
    full_text_parts = []
    skipped_pages = []
    prev_last_line = None

    for i, page in enumerate(doc):
        used_ocr = False

        # 1. Normal PyMuPDF extraction
        text = page.get_text("text") 
        page_wc = len(page.get_text("words")) 
        total_word_count += page_wc

        # 2. Trigger OCR fallback
        if len(text.strip()) < ocr_threshold:
            print(f"[PyMuPDF OCR] Page {i+1}: low text → using OCR…")
            used_ocr = True
            text = page.get_text("ocr")  # <-- PyMuPDF OCR using Tesseract

        # 2.5 Skip process if empty extraction and update flag
        if len(text) == 0:
            skipped = True
            skipped_pages.append(i+1)
            continue

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
            "word_count": page_wc,
            "used_ocr": used_ocr,
            "text": "\n".join(lines)
        })

    # Final normalized stitched PDF text
    final_text = "\n".join(full_text_parts)
    final_text = normalize_text(final_text)
    print(final_text)
    return {
        "doc_uuid": doc_uuid,
        "page_count": doc.page_count,
        "total_word_count": total_word_count,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "tool_version": TOOL_VERSION,
        "skipped":skipped,
        "skipped_pages":skipped_pages,
        "text": final_text,
        "pages": pages_output
    }


def run_extraction(input_path, out_dir, page_range=None):
    """Extraction wrapper for CLI"""
    result = extract_pdf_pymupdf(input_path)

    # Apply page range slicing if requested
    if page_range:
        start, end = page_range
        result["pages"] = [
            p for p in result["pages"] 
            if start <= p["page_num"] <= end
        ]

    # Output filename = doc_uuid.json
    out_path = f"{out_dir}/{result['doc_uuid']}.json"

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"✔ Saved: {out_path}")
    return result



def parse_page_range(r):
    """Convert '5-10' into (5,10)."""
    try:
        a, b = r.split("-")
        return int(a), int(b)
    except:
        raise argparse.ArgumentTypeError("Page range must be like 5-12")


def main():
    """Script Input"""
    parser = argparse.ArgumentParser(prog="pdfx", description="ThreadSense PDF Extractor")

    sub = parser.add_subparsers(dest="command", required=True)

    # pdfx extract ...
    p_extract = sub.add_parser("extract", help="Extract text from a PDF")
    p_extract.add_argument("input", help="Input PDF path")
    p_extract.add_argument("--out", required=True, help="Output directory")
    p_extract.add_argument("--page-range", type=parse_page_range, help="e.g. 3-10")

    args = parser.parse_args()

    if args.command == "extract":
        if not os.path.exists(args.out):
            os.makedirs(args.out, exist_ok=True)

        result = None
        return_code = 0

        try:
            result = run_extraction(
                input_path=args.input,
                out_dir=args.out,
                page_range=args.page_range
            )

            # Decide return code
            if not result or "text" not in result:
                return_code = 2
            elif result.get("skipped", False):
                return_code = 1
            else:
                return_code = 0

        except Exception as e:
            print(f"Fatal error: {e}", file=sys.stderr)
            return_code = 2

        # Print result only if it exists
        if result is not None:
            print(json.dumps(result, indent=2))
        else:
            print(json.dumps({
                "error": "Fatal error before producing any output"
            }, indent=2), file=sys.stderr)

        sys.exit(return_code)

if __name__ == "__main__":
    main()



