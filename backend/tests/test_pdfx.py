import json

from app.pdfx.pdfx import extract_pdf_pymupdf


def test_extract_basic_pdf():
    result = extract_pdf_pymupdf("tests/pdfx_docs/bourdain.pdf")

    assert not result["skipped"]
    assert "text" in result
    assert len(result["pages"]) == result["page_count"]
    assert result["total_word_count"] >= 0


def test_output_integrity(tmp_path):
    from app.pdfx.pdfx import run_extraction

    out_dir = tmp_path
    result = run_extraction("tests/pdfx_docs/bourdain.pdf", out_dir)

    saved_file = out_dir / f"{result['doc_uuid']}.json"
    assert saved_file.exists()

    data = json.loads(saved_file.read_text())
    assert "text" in data
    assert "pages" in data
    assert "page_count" in data
    assert "doc_uuid" in data
    assert "created_at" in data


def test_ranged_extraction(tmp_path):
    from app.pdfx.pdfx import run_extraction

    out_dir = tmp_path
    result = run_extraction("tests/pdfx_docs/bourdain.pdf", out_dir, (3, 5))

    saved_file = out_dir / f"{result['doc_uuid']}.json"
    assert saved_file.exists()

    data = json.loads(saved_file.read_text())
    assert "text" in data
    assert "pages" in data
    assert "page_count" in data
    assert len(data["pages"]) == 3
    assert data["pages"][0]["page_num"] == 3
    assert data["pages"][2]["page_num"] == 5
