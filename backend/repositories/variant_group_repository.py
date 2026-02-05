# backend/repositories/variant_group_repository.py
from backend.db import get_conn

class VariantGroupRepository:
    def list_by_product(self, product_id: int, include_inactive: bool = True):
        sql = """
          SELECT id, product_id, name, is_required, max_select, sort_order,
                 is_active, created_at, updated_at
          FROM variant_groups
          WHERE product_id=?
        """
        params = [int(product_id)]
        if not include_inactive:
            sql += " AND is_active=1"
        sql += " ORDER BY sort_order ASC, id ASC"

        with get_conn() as conn:
            rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]

    def get(self, group_id: int):
        with get_conn() as conn:
            row = conn.execute("""
              SELECT id, product_id, name, is_required, max_select, sort_order,
                     is_active, created_at, updated_at
              FROM variant_groups
              WHERE id=?
            """, (int(group_id),)).fetchone()
        return dict(row) if row else None

    def create(self, payload: dict) -> int:
        with get_conn() as conn:
            cur = conn.execute("""
              INSERT INTO variant_groups(product_id, name, is_required, max_select, sort_order, is_active)
              VALUES (?, ?, ?, ?, ?, ?)
            """, (
                int(payload["product_id"]),
                payload["name"],
                int(payload.get("is_required", 0)),
                int(payload.get("max_select", 1)),
                int(payload.get("sort_order", 0)),
                int(payload.get("is_active", 1)),
            ))
            return cur.lastrowid

    def update(self, group_id: int, payload: dict) -> None:
        with get_conn() as conn:
            conn.execute("""
              UPDATE variant_groups
              SET product_id=?,
                  name=?,
                  is_required=?,
                  max_select=?,
                  sort_order=?,
                  is_active=?,
                  updated_at=datetime('now')
              WHERE id=?
            """, (
                int(payload["product_id"]),
                payload["name"],
                int(payload.get("is_required", 0)),
                int(payload.get("max_select", 1)),
                int(payload.get("sort_order", 0)),
                int(payload.get("is_active", 1)),
                int(group_id)
            ))

    def toggle(self, group_id: int, is_active: int) -> None:
        with get_conn() as conn:
            conn.execute("""
              UPDATE variant_groups
              SET is_active=?,
                  updated_at=datetime('now')
              WHERE id=?
            """, (int(is_active), int(group_id)))

    def delete(self, group_id: int) -> None:
        with get_conn() as conn:
            conn.execute("DELETE FROM variant_groups WHERE id=?", (int(group_id),))
