# backend/controllers/product_controller.py
import base64, re, uuid, sqlite3
from backend.repositories.product_repository import ProductRepository
from backend.paths import UPLOAD_PRODUCTS, app_root, to_file_url

class ProductController:
    def __init__(self):
        self.repo = ProductRepository()
        self.upload_dir = UPLOAD_PRODUCTS  # ✅ portable uploads folder

    # -------------------------
    # Queries
    # -------------------------
    def list_by_sub_category(self, sub_category_id: int, include_inactive=True):
        rows = self.repo.list_by_sub_category(int(sub_category_id), bool(include_inactive))
        for r in rows:
            r["image_url"] = to_file_url(r["image_path"]) if r.get("image_path") else ""
        return {"status": "ok", "data": rows}

    def get(self, product_id: int):
        p = self.repo.get(int(product_id))
        if not p:
            return {"status": "error", "message": "Product not found"}
        p["image_url"] = to_file_url(p["image_path"]) if p.get("image_path") else ""
        return {"status": "ok", "data": p}

    # -------------------------
    # Mutations
    # -------------------------
    def create(self, payload: dict):
        if not payload.get("sub_category_id"):
            return {"status": "error", "message": "sub_category_id is required"}
        if not payload.get("name"):
            return {"status": "error", "message": "name is required"}

        try:
            payload["base_price"] = float(payload.get("base_price", 0))
        except Exception:
            return {"status": "error", "message": "base_price must be a number"}

        try:
            if payload.get("image_base64"):
                payload["image_path"] = self._save_dataurl_image(payload["image_base64"])

            new_id = self.repo.create(payload)
            return {"status": "ok", "id": new_id}

        except sqlite3.IntegrityError:
            return {"status": "error", "message": "SKU already exists (must be unique)"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def update(self, product_id: int, payload: dict):
        if not payload.get("sub_category_id"):
            return {"status": "error", "message": "sub_category_id is required"}
        if not payload.get("name"):
            return {"status": "error", "message": "name is required"}

        try:
            payload["base_price"] = float(payload.get("base_price", 0))
        except Exception:
            return {"status": "error", "message": "base_price must be a number"}

        try:
            if payload.get("image_base64"):
                old = self.repo.get_image_path(int(product_id))
                new_path = self._save_dataurl_image(payload["image_base64"])
                payload["image_path"] = new_path
                self._delete_image_if_exists(old)

            self.repo.update(int(product_id), payload)
            return {"status": "ok"}

        except sqlite3.IntegrityError:
            return {"status": "error", "message": "SKU already exists (must be unique)"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def toggle(self, product_id: int, is_active: int):
        try:
            self.repo.toggle(int(product_id), int(is_active))
            return {"status": "ok"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def delete(self, product_id: int):
        try:
            old = self.repo.get_image_path(int(product_id))
            self.repo.delete(int(product_id))
            self._delete_image_if_exists(old)
            return {"status": "ok"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    # -------------------------
    # Image helpers
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

        filename = f"prd_{uuid.uuid4().hex}.{ext}"
        (self.upload_dir / filename).write_bytes(raw)

        # ✅ store portable relative path
        return f"uploads/products/{filename}"

    def _delete_image_if_exists(self, image_path: str):
        if not image_path:
            return
        file_path = app_root() / image_path
        if file_path.exists():
            try:
                file_path.unlink()
            except Exception:
                pass
