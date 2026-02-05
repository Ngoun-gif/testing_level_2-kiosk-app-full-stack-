# backend/controllers/variant_value_controller.py
import sqlite3
from backend.repositories.variant_value_repository import VariantValueRepository

class VariantValueController:
    def __init__(self):
        self.repo = VariantValueRepository()

    def list_by_group(self, group_id: int, include_inactive=True):
        return {"status": "ok", "data": self.repo.list_by_group(int(group_id), bool(include_inactive))}

    def get(self, value_id: int):
        v = self.repo.get(int(value_id))
        if not v:
            return {"status": "error", "message": "Variant value not found"}
        return {"status": "ok", "data": v}

    def create(self, payload: dict):
        if not payload.get("group_id"):
            return {"status": "error", "message": "group_id is required"}
        if not payload.get("name"):
            return {"status": "error", "message": "name is required"}

        try:
            payload["extra_price"] = float(payload.get("extra_price", 0))
        except Exception:
            return {"status": "error", "message": "extra_price must be a number"}

        try:
            new_id = self.repo.create(payload)
            return {"status": "ok", "id": new_id}
        except sqlite3.IntegrityError:
            return {"status": "error", "message": "Duplicate value name for this group or invalid FK"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def update(self, value_id: int, payload: dict):
        if not payload.get("group_id"):
            return {"status": "error", "message": "group_id is required"}
        if not payload.get("name"):
            return {"status": "error", "message": "name is required"}

        try:
            payload["extra_price"] = float(payload.get("extra_price", 0))
        except Exception:
            return {"status": "error", "message": "extra_price must be a number"}

        try:
            self.repo.update(int(value_id), payload)
            return {"status": "ok"}
        except sqlite3.IntegrityError:
            return {"status": "error", "message": "Duplicate value name for this group or invalid FK"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def toggle(self, value_id: int, is_active: int):
        try:
            self.repo.toggle(int(value_id), int(is_active))
            return {"status": "ok"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def delete(self, value_id: int):
        try:
            self.repo.delete(int(value_id))
            return {"status": "ok"}
        except Exception as e:
            return {"status": "error", "message": str(e)}
