"""

pdf extraction and content normalization.

"""

import pdfplumber
import hashlib
from pathlib import Path

def sha256_file(path: Path) -> str:
    """File hashing and unique identifier"""

    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

