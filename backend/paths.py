# backend/paths.py
import sys
from pathlib import Path

APP_NAME = "KioskApp"  # not used in portable mode, but keep for clarity

def app_root() -> Path:
    """
    PORTABLE MODE:
    - In EXE: use folder that contains kiosk.exe/dashboard.exe  (dist/)
    - In dev: use project root
    """
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent
    return Path(__file__).resolve().parents[1]

def to_file_url(rel_path: str) -> str:
    """
    Convert DB relative path (uploads/...png) -> file:///C:/.../uploads/...png
    """
    if not rel_path:
        return ""
    return (app_root() / rel_path).resolve().as_uri()

# uploads
UPLOAD_BASE = app_root() / "uploads"
UPLOAD_CATEGORIES = UPLOAD_BASE / "categories"
UPLOAD_PRODUCTS   = UPLOAD_BASE / "products"
UPLOAD_SUBCATEGORIES = UPLOAD_BASE / "sub_categories"

UPLOAD_CATEGORIES.mkdir(parents=True, exist_ok=True)
UPLOAD_PRODUCTS.mkdir(parents=True, exist_ok=True)
UPLOAD_SUBCATEGORIES.mkdir(parents=True, exist_ok=True)
