"""

pdf extraction and content normalization.

"""

import pdfplumber
import hashlib
import uuid
import json
from pathlib import Path
from datetime import datetime, timezone


def sha256_file(path: Path) -> str:
    """File hashing and unique identifier"""

    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def pdf_extract(input_path: Path, output_path: Path, page_range=None) -> int:
    """Text extraction and metadata assignment"""

    # Get unique identifier
    doc_hash = sha256_file(input_path)
    doc_uuid = str(uuid.uuid5(uuid.NAMESPACE_URL, doc_hash))

    # Create flag for skipped pages
    skipped = False

    # Create pdfpllumber instance and file-write handle
    with pdfplumber.open(input_path) as pdf, open(output_path, "w", encoding="utf-8") as fout:

        header = {
            "type":"document",
            "doc_id":doc_uuid,
            "source_path": str(input_path),
            "created_at":datetime.now(timezone.utc).isoformat(),
            "tool_version": "0.1.0",
            "page_length":len(pdf.pages)
        }

        fout.write(json.dumps(header) + "\n")

        if page_range is None:
            start, end = page_range
        else:
            start, end = 0, len(pdf.pages)

        for i, pages in enumerate(pdf.pages[start:end], start = start):
            text = pdf.pages[i].extract_text()

            if not text:
                skipped = True
                continue
            
            block = {
                "type":"block",
                "text": text
            }

            fout.write(json.dumps(block) + "\n")
    
    return 0
    
