import json
from pathlib import Path

from app.pdfx.pdfx import extract_pdf_pymupdf, run_extraction

OCR_PATH = "tests/pdfx_docs/ocr.pdf"


def test_ocr_basic_extraction():
    # Force OCR by using a very high threshold so extractor falls back to OCR path
    result = extract_pdf_pymupdf(OCR_PATH, ocr_threshold=100000)

    assert not result["skipped"]
    assert "text" in result
    assert len(result["pages"]) == result["page_count"]
    # At least one page should have used OCR for an OCR test file
    assert any(p.get("used_ocr", False) for p in result["pages"])
    assert result["total_word_count"] >= 0


def test_ocr_output_integrity(tmp_path):
    out_dir = tmp_path
    result = run_extraction(OCR_PATH, out_dir)

    saved_file = Path(out_dir) / f"{result['doc_uuid']}.json"
    assert saved_file.exists()

    data = json.loads(saved_file.read_text(encoding="utf-8"))
    assert "text" in data
    assert "pages" in data
    assert "page_count" in data
    assert "doc_uuid" in data
    assert "created_at" in data


def test_ocr_ranged_extraction(tmp_path):
    out_dir = tmp_path
    # Request only pages 1-2 (adjust if the test PDF is shorter)
    result = run_extraction(OCR_PATH, out_dir, (1, 2))

    saved_file = Path(out_dir) / f"{result['doc_uuid']}.json"
    assert saved_file.exists()

    data = json.loads(saved_file.read_text(encoding="utf-8"))
    assert "pages" in data
    # Expect two pages saved (or fewer if doc shorter); ensure they have correct page_num order
    assert len(data["pages"]) == min(2, data["page_count"])
    if len(data["pages"]) >= 1:
        assert data["pages"][0]["page_num"] == 1
    if len(data["pages"]) >= 2:
        assert data["pages"][1]["page_num"] == 2
