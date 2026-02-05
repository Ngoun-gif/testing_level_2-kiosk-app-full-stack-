# backend/controllers/variant_group_controller.py
import sqlite3
from backend.repositories.variant_group_repository import VariantGroupRepository
from backend.repositories.variant_value_repository import VariantValueRepository

class VariantGroupController:
    def __init__(self):
        self.repo = VariantGroupRepository()
        self.value_repo = VariantValueRepository()

    def list_by_product(self, product_id: int, include_inactive=True):
        return {"status": "ok", "data": self.repo.list_by_product(int(product_id), bool(include_inactive))}

    def get(self, group_id: int):
        g = self.repo.get(int(group_id))
        if not g:
            return {"status": "error", "message": "Variant group not found"}
        return {"status": "ok", "data": g}

    def create(self, payload: dict):
        if not payload.get("product_id"):
            return {"status": "error", "message": "product_id is required"}
        if not payload.get("name"):
            return {"status": "error", "message": "name is required"}

        # normalize rules
        payload["is_required"] = 1 if int(payload.get("is_required", 0)) else 0
        payload["max_select"] = int(payload.get("max_select", 1))
        if payload["max_select"] < 1:
            return {"status": "error", "message": "max_select must be >= 1"}

        try:
            new_id = self.repo.create(payload)
            return {"status": "ok", "id": new_id}
        except sqlite3.IntegrityError as e:
            return {"status": "error", "message": "Duplicate group name for this product or invalid FK"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def update(self, group_id: int, payload: dict):
        if not payload.get("product_id"):
            return {"status": "error", "message": "product_id is required"}
        if not payload.get("name"):
            return {"status": "error", "message": "name is required"}

        payload["is_required"] = 1 if int(payload.get("is_required", 0)) else 0
        payload["max_select"] = int(payload.get("max_select", 1))
        if payload["max_select"] < 1:
            return {"status": "error", "message": "max_select must be >= 1"}

        try:
            self.repo.update(int(group_id), payload)
            return {"status": "ok"}
        except sqlite3.IntegrityError:
            return {"status": "error", "message": "Duplicate group name for this product or invalid FK"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def toggle(self, group_id: int, is_active: int):
        try:
            self.repo.toggle(int(group_id), int(is_active))
            return {"status": "ok"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def delete(self, group_id: int):
        """
        Hard delete group.
        NOTE: Only safe if you do NOT have order history referencing values.
        For now it's fine during development.
        """
        try:
            self.repo.delete(int(group_id))
            return {"status": "ok"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def list_groups_with_values(self, product_id: int, include_inactive=True):
        """
        Useful for kiosk:
        returns groups + each group's values in one call
        """
        groups = self.repo.list_by_product(int(product_id), bool(include_inactive))
        for g in groups:
            g["values"] = self.value_repo.list_by_group(g["id"], bool(include_inactive))
        return {"status": "ok", "data": groups}
