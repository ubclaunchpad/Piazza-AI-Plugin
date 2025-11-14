import hashlib
import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Tuple
import pdfplumber


def sha256_file(path: Path) -> str:
    """File hashing and unique identifier"""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def normalize_whitespace(text: str) -> str:
    """Normalize whitespace while preserving paragraph breaks"""
    # Replace multiple spaces with single space
    text = re.sub(r' +', ' ', text)
    # Preserve double newlines (paragraph breaks), normalize single newlines to spaces
    text = re.sub(r'\n{3,}', '\n\n', text)  # Max 2 newlines
    text = re.sub(r'(?<!\n)\n(?!\n)', ' ', text)  # Single newlines become spaces
    return text.strip()


def repair_hyphenation(text: str) -> str:
    """Repair word breaks at line ends (conservative approach)"""
    # Match hyphen at end of line followed by lowercase letter
    # Only join if the resulting word looks reasonable
    def replace_hyphen(match):
        word_part1 = match.group(1)
        word_part2 = match.group(2)
        # Simple heuristic: join if both parts are alphabetic and reasonable length
        if word_part1.isalpha() and word_part2.isalpha() and len(word_part1) > 2:
            return word_part1 + word_part2
        return match.group(0)
    
    text = re.sub(r'(\w+)-\s*\n\s*([a-z]+)', replace_hyphen, text)
    return text


def infer_block_structure(text: str, font_info: Dict = None) -> str:
    """Infer structure type: heading, paragraph, or list"""
    text_stripped = text.strip()
    
    if not text_stripped:
        return "paragraph"
    
    # Check for list patterns
    list_patterns = [
        r'^\d+[\.)]\s',  # Numbered: "1. " or "1) "
        r'^[a-z][\.)]\s',  # Lettered: "a. " or "a) "
        r'^[•\-\*\+]\s',  # Bullet: "• ", "- ", "* ", "+ "
        r'^\d+\.\d+\s',  # Outline: "1.1 "
    ]
    
    for pattern in list_patterns:
        if re.match(pattern, text_stripped):
            return "list"
    
    # Check for heading indicators
    # Short length (typically < 100 chars)
    if len(text_stripped) < 100:
        # ALL CAPS (with at least 3 words)
        words = text_stripped.split()
        if len(words) >= 2 and text_stripped.isupper():
            return "heading"
        
        # Title Case with no ending punctuation
        if (text_stripped.istitle() or 
            (text_stripped[0].isupper() and not text_stripped.endswith(('.', '!', '?', ',', ';')))):
            # Not a sentence if it's short and has no lowercase words
            if len(words) <= 8:
                return "heading"
    
    # Check font size if available (larger = heading)
    if font_info and 'size' in font_info:
        if font_info['size'] > font_info.get('avg_size', 12):
            return "heading"
    
    return "paragraph"


def split_into_blocks(text: str, page_num: int, doc_uuid: str) -> List[Dict]:
    """Split/label page text into rough blocks (paragraphs, headings, lists)"""
    blocks = []
    
    # Split by double newlines (paragraph boundaries)
    raw_blocks = text.split('\n\n')
    
    for idx, block_text in enumerate(raw_blocks):
        block_text = block_text.strip()
        # Normalize and repair hyphenation first
        block_text = repair_hyphenation(block_text)
        block_text = normalize_whitespace(block_text)
        
        if not block_text:
            continue
        
        # Generate deterministic block ID
        block_key = f"{doc_uuid}:p{page_num}:b{idx}"
        block_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, block_key))
        
        # Infer structure
        structure = infer_block_structure(block_text)
        
        # Calculate metrics
        char_count = len(block_text)
        word_count = len(block_text.split())
        
        block = {
            "type": "block",
            "doc_id": doc_uuid,
            "page": page_num,
            "block_id": block_id,
            "structure": structure,
            "text": block_text,
            "char_count": char_count,
            "word_count": word_count
        }
        
        blocks.append(block)
    
    return blocks


def extract_text_with_layout(page) -> Tuple[str, Dict]:
    """Extract text and attempt to get font information"""
    text = page.extract_text()
    
    font_info = {}
    try:
        # Try to get character details for font size analysis
        chars = page.chars
        if chars:
            sizes = [c.get('size', 12) for c in chars if 'size' in c]
            if sizes:
                font_info['avg_size'] = sum(sizes) / len(sizes)
    except:
        pass
    
    return text, font_info


def pdf_extract(input_path: Path, output_path: Path, page_range=None) -> int:
    """Text extraction with structure labeling and block splitting"""
    
    # Get unique identifier
    doc_hash = sha256_file(input_path)
    doc_uuid = str(uuid.uuid5(uuid.NAMESPACE_URL, doc_hash))
    
    # Track processing status
    skipped_pages = []
    total_blocks = 0
    
    with pdfplumber.open(input_path) as pdf, open(output_path, "w", encoding="utf-8") as fout:
        
        # Write document header
        header = {
            "type": "document",
            "doc_id": doc_uuid,
            "source_path": str(input_path),
            "source_sha256": doc_hash,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "tool_version": "0.1.0",
            "page_count": len(pdf.pages)
        }
        fout.write(json.dumps(header) + "\n")
        
        # Determine page range
        if page_range is not None:
            start, end = int(page_range[0]), int(page_range[1])
            start = max(0, start)
            end = min(len(pdf.pages), end)
            if start >= end:
                start, end = 0, len(pdf.pages)
        else:
            start, end = 0, len(pdf.pages)
        
        # Extract and process pages
        for i, page in enumerate(pdf.pages[start:end], start=start):
            text, font_info = extract_text_with_layout(page)
            
            if not text or not text.strip():
                skipped_pages.append({
                    "page": i,
                    "reason": "no_text_layer"
                })
                continue
            
            # Split page into blocks
            blocks = split_into_blocks(text, i, doc_uuid)
            
            if not blocks:
                skipped_pages.append({
                    "page": i,
                    "reason": "empty_after_normalization"
                })
                continue
            
            # Write all blocks for this page
            for block in blocks:
                fout.write(json.dumps(block) + "\n")
                total_blocks += 1
    
    # Determine exit code
    if skipped_pages:
        if total_blocks == 0:
            return 2  # Fatal: no content extracted
        else:
            # Log skipped pages info
            print(f"Extracted {total_blocks} blocks, skipped {len(skipped_pages)} pages")
            return 1  # Partial success
    
    return 0  # Complete success



