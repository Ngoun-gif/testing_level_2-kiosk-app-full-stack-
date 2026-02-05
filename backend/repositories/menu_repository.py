# backend/repositories/menu_repository.py
from backend.db import get_conn
from backend.paths import to_file_url

class MenuRepository:
    """
    Kiosk read-optimized repository:
    Load ALL active menu data in one call.
    """

    @staticmethod
    def _clean_path(p):
        if not p:
            return None
        # remove leading slashes so DB stays consistent
        return str(p).lstrip("/")

    @staticmethod
    def _add_image_fields(d: dict):
        """
        Add:
          - image_path (cleaned) stays in DB format
          - image_url (file:///...) for frontend
        """
        p = d.get("image_path")
        d["image_path"] = MenuRepository._clean_path(p)
        d["image_url"] = to_file_url(d["image_path"]) if d.get("image_path") else ""
        return d

    def load_all_active(self) -> dict:
        with get_conn() as conn:
            cats = conn.execute("""
                SELECT id, name, image_path, sort_order
                FROM categories
                WHERE is_active = 1
                ORDER BY sort_order ASC, id ASC
            """).fetchall()

            subs = conn.execute("""
                SELECT id, category_id, name, image_path, sort_order
                FROM sub_categories
                WHERE is_active = 1
                ORDER BY sort_order ASC, id ASC
            """).fetchall()

            prods = conn.execute("""
                SELECT id, sub_category_id, sku, name, base_price, image_path, sort_order
                FROM products
                WHERE is_active = 1
                ORDER BY sort_order ASC, id ASC
            """).fetchall()

            groups = conn.execute("""
                SELECT id, product_id, name, is_required, max_select, sort_order
                FROM variant_groups
                WHERE is_active = 1
                ORDER BY sort_order ASC, id ASC
            """).fetchall()

            values = conn.execute("""
                SELECT id, group_id, name, extra_price, sort_order
                FROM variant_values
                WHERE is_active = 1
                ORDER BY sort_order ASC, id ASC
            """).fetchall()

        # ----- categories -----
        categories = []
        for r in cats:
            d = dict(r)
            d["id"] = int(d["id"])
            d["sort_order"] = int(d.get("sort_order") or 0)
            self._add_image_fields(d)   # ✅ add image_url
            categories.append(d)

        # ----- sub categories (group by category_id) -----
        sub_by_cat = {}
        for r in subs:
            d = dict(r)
            d["id"] = int(d["id"])
            d["category_id"] = int(d["category_id"])
            d["sort_order"] = int(d.get("sort_order") or 0)
            self._add_image_fields(d)   # ✅ add image_url
            sub_by_cat.setdefault(d["category_id"], []).append(d)

        # ----- products (group by sub_category_id) -----
        prod_by_sub = {}
        for r in prods:
            d = dict(r)
            d["id"] = int(d["id"])
            d["sub_category_id"] = int(d["sub_category_id"])
            d["sort_order"] = int(d.get("sort_order") or 0)
            d["base_price"] = float(d.get("base_price") or 0)
            self._add_image_fields(d)   # ✅ add image_url
            prod_by_sub.setdefault(d["sub_category_id"], []).append(d)

        # ----- variant groups (group by product_id) -----
        group_by_product = {}
        for r in groups:
            d = dict(r)
            d["id"] = int(d["id"])
            d["product_id"] = int(d["product_id"])
            d["sort_order"] = int(d.get("sort_order") or 0)
            d["is_required"] = int(d.get("is_required") or 0)
            d["max_select"] = int(d.get("max_select") or 1)
            group_by_product.setdefault(d["product_id"], []).append(d)

        # ----- variant values (group by group_id) -----
        value_by_group = {}
        for r in values:
            d = dict(r)
            d["id"] = int(d["id"])
            d["group_id"] = int(d["group_id"])
            d["sort_order"] = int(d.get("sort_order") or 0)
            d["extra_price"] = float(d.get("extra_price") or 0)
            value_by_group.setdefault(d["group_id"], []).append(d)

        return {
            "categories": categories,
            "sub_by_cat": sub_by_cat,
            "prod_by_sub": prod_by_sub,
            "group_by_product": group_by_product,
            "value_by_group": value_by_group
        }
