# backend/controllers/sub_category_controller.py
import base64, re, uuid, sqlite3
from backend.repositories.sub_category_repository import SubCategoryRepository
from backend.paths import UPLOAD_SUBCATEGORIES, app_root, to_file_url

class SubCategoryController:
    def __init__(self):
        self.repo = SubCategoryRepository()
        self.upload_dir = UPLOAD_SUBCATEGORIES  # ✅ consistent with category/product

    def list_by_category(self, category_id: int, include_inactive=True):
        rows = self.repo.list_by_category(int(category_id), bool(include_inactive))
        for r in rows:
            r["image_url"] = to_file_url(r["image_path"]) if r.get("image_path") else ""
        return {"status": "ok", "data": rows}

    def get(self, sub_category_id: int):
        sc = self.repo.get(int(sub_category_id))
        if not sc:
            return {"status": "error", "message": "Sub-category not found"}
        sc["image_url"] = to_file_url(sc["image_path"]) if sc.get("image_path") else ""
        return {"status": "ok", "data": sc}

    def create(self, payload: dict):
        if not payload.get("category_id"):
            return {"status": "error", "message": "category_id is required"}
        if not payload.get("name"):
            return {"status": "error", "message": "name is required"}

        try:
            if payload.get("image_base64"):
                payload["image_path"] = self._save_dataurl_image(payload["image_base64"])

            new_id = self.repo.create(payload)
            return {"status": "ok", "id": new_id}

        except sqlite3.IntegrityError:
            return {"status": "error", "message": "Sub-category name already exists in this category"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def update(self, sub_category_id: int, payload: dict):
        if not payload.get("category_id"):
            return {"status": "error", "message": "category_id is required"}
        if not payload.get("name"):
            return {"status": "error", "message": "name is required"}

        try:
            if payload.get("image_base64"):
                old = self.repo.get_image_path(int(sub_category_id))
                new_path = self._save_dataurl_image(payload["image_base64"])
                payload["image_path"] = new_path
                self._delete_image_if_exists(old)

            self.repo.update(int(sub_category_id), payload)
            return {"status": "ok"}

        except sqlite3.IntegrityError:
            return {"status": "error", "message": "Sub-category name already exists in this category"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def toggle(self, sub_category_id: int, is_active: int):
        try:
            self.repo.toggle(int(sub_category_id), int(is_active))
            return {"status": "ok"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def delete(self, sub_category_id: int):
        try:
            old = self.repo.get_image_path(int(sub_category_id))
            self.repo.delete(int(sub_category_id))
            self._delete_image_if_exists(old)
            return {"status": "ok"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    # -------------------------
    # image helpers
    # -------------------------
    def _save_dataurl_image(self, data_url: str) -> str:
        m = re.match(r"^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$", data_url)
        if not m:
            raise ValueError("Invalid image data")

        mime = m.group(1)
        b64 = m.group(2)

        ext_map = {
            "image/png": "png",
            "image/jpeg": "jpg",
            "image/jpg": "jpg",
            "image/webp": "webp",
        }
        ext = ext_map.get(mime)
        if not ext:
            raise ValueError("Unsupported image type (png/jpg/webp only)")

        raw = base64.b64decode(b64)
        if len(raw) > 2 * 1024 * 1024:
            raise ValueError("Image too large (max 2MB)")

        filename = f"sub_{uuid.uuid4().hex}.{ext}"
        (self.upload_dir / filename).write_bytes(raw)

        # ✅ store portable relative path
        return f"uploads/sub_categories/{filename}"

    def _delete_image_if_exists(self, image_path: str):
        if not image_path:
            return
        file_path = app_root() / image_path
        if file_path.exists():
            try:
                file_path.unlink()
            except Exception:
                pass
