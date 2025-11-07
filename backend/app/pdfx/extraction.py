"""

pdf extraction and content normalization.

"""

import pdfplumber
import hashlib
import uuid
import json
import re
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

        # Check for page parameter (page_range is expected as (start, end) or None)
        if page_range is not None:
            start, end = int(page_range[0]), int(page_range[1])
            # clamp to valid page indexes
            start = max(0, start)
            end = min(len(pdf.pages), end)
            # if invalid range, fall back to full document
            if start >= end:
                start, end = 0, len(pdf.pages)
        else:
            start, end = 0, len(pdf.pages)

        # Begin Extraction
        for i, pages in enumerate(pdf.pages[start:end], start = start):
            
            text = pages.extract_text()

            if not text:
                skipped = True
                continue

            # Isolate double newline based blocks
            blocks = re.split(r"\n\s*\n", text)
        
            # Process each block
            for j in range(len(blocks)):

                structure = infer_structure(blocks[j])
                # Normalize
                normalized = normalize(blocks[j])

                block = {
                    "type":"block",
                    "structure:": structure,
                    "doc_id":doc_uuid,
                    "block":j,
                    "page":i,
                    "text": normalized
                }

                fout.write(json.dumps(block) + "\n")   
             
            
    return 0

def normalize(s:str) ->str:
    """String normalization helper"""
    text = s.strip()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"(\w+)-\s+(\w+)", r"\1\2", text)
    text = text.replace("“", '"').replace("”", '"').replace("–", "-")
    return text

def infer_structure(text: str) -> str:
    """Simple structure inference based on heuristics"""
    # 
    lines = text.strip().splitlines()
    if not lines:
        return "paragraph"

    first_line = lines[0].strip()

    if first_line.isupper() and len(first_line.split()) <= 6:
        return "heading"
    elif any(re.match(r"^(\d+\.|\*|-|•)\s+", line.strip()) for line in lines[:3]):
        return "list"
    else:
        return "paragraph"
    
def extract_blocks(page):
    words = page.extract_words(x_tolerance=2, y_tolerance=3)
    if not words:
        return []

    # Sort by vertical then horizontal position
    words.sort(key=lambda w: (-float(w['top']), float(w['xmin'])))

    lines = []
    current_line = [words[0]]
    for w in words[1:]:
        if abs(float(w['top']) - float(current_line[-1]['top'])) < 3:
            current_line.append(w)
        else:
            lines.append(current_line)
            current_line = [w]
    lines.append(current_line)

    # Group lines into blocks based on spacing
    blocks = []
    current_block = [lines[0]]
    for line in lines[1:]:
        prev_bottom = float(current_block[-1][-1]['bottom'])
        curr_top = float(line[0]['top'])
        if prev_bottom - curr_top > 15:  # big vertical gap
            blocks.append(current_block)
            current_block = [line]
        else:
            current_block.append(line)
    blocks.append(current_block)

    # Convert block objects back to text
    return [" ".join([w['text'] for line in block for w in line]) for block in blocks]

