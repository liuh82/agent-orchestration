"""File storage service — save, retrieve, delete uploaded files."""
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import UploadFile

UPLOAD_DIR = "uploads"
ALLOWED_EXTENSIONS = {
    ".md", ".txt", ".pdf", ".docx", ".json", ".yaml", ".yml",
    ".py", ".js", ".ts", ".png", ".jpg", ".jpeg", ".gif",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def _sanitize_filename(name: str) -> str:
    """Remove path separators and dangerous characters."""
    name = os.path.basename(name)
    name = re.sub(r"[^\w\.\-]", "_", name)
    return name or "unnamed"


class FileService:
    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = base_dir or UPLOAD_DIR

    def _ensure_dir(self) -> None:
        os.makedirs(self.base_dir, exist_ok=True)

    def _date_subdir(self) -> str:
        now = datetime.now(timezone.utc)
        return os.path.join(str(now.year), str(now.month), str(now.day))

    def save_file(self, file: UploadFile) -> dict:
        """Save an uploaded file and return metadata."""
        self._ensure_dir()

        # Validate extension
        _, ext = os.path.splitext(file.filename or "")
        ext = ext.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise ValueError(f"File extension '{ext}' not allowed")

        # Read and validate size
        content = file.file.read()
        if len(content) > MAX_FILE_SIZE:
            raise ValueError(f"File size exceeds limit ({MAX_FILE_SIZE // (1024*1024)}MB)")

        # Generate path: uploads/{year}/{month}/{day}/{uuid}{ext}
        file_id = str(uuid.uuid4())
        safe_name = _sanitize_filename(file.filename or f"{file_id}{ext}")
        subdir = self._date_subdir()
        rel_path = os.path.join(subdir, f"{file_id}{ext}")
        abs_path = os.path.join(self.base_dir, rel_path)

        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, "wb") as f:
            f.write(content)

        return {
            "file_id": file_id,
            "file_path": rel_path,
            "file_size": len(content),
            "mime_type": file.content_type or "application/octet-stream",
            "file_name": safe_name,
        }

    def get_abs_path(self, file_path: str) -> Optional[str]:
        """Get absolute file path from relative path."""
        abs_path = os.path.join(self.base_dir, file_path)
        if os.path.isfile(abs_path):
            return abs_path
        return None

    def delete_file(self, file_path: str) -> bool:
        """Delete a physical file."""
        abs_path = os.path.join(self.base_dir, file_path)
        if os.path.isfile(abs_path):
            os.remove(abs_path)
            return True
        return False


# Default singleton
file_service = FileService()
