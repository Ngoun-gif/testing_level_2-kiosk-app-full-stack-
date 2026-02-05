# backend/repositories/variant_value_repository.py
from backend.db import get_conn

class VariantValueRepository:
    def list_by_group(self, group_id: int, include_inactive: bool = True):
        sql = """
          SELECT id, group_id, name, extra_price, sort_order,
                 is_active, created_at, updated_at
          FROM variant_values
          WHERE group_id=?
        """
        params = [int(group_id)]
        if not include_inactive:
            sql += " AND is_active=1"
        sql += " ORDER BY sort_order ASC, id ASC"

        with get_conn() as conn:
            rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]

    def get(self, value_id: int):
        with get_conn() as conn:
            row = conn.execute("""
              SELECT id, group_id, name, extra_price, sort_order,
                     is_active, created_at, updated_at
              FROM variant_values
              WHERE id=?
            """, (int(value_id),)).fetchone()
        return dict(row) if row else None

    def create(self, payload: dict) -> int:
        with get_conn() as conn:
            cur = conn.execute("""
              INSERT INTO variant_values(group_id, name, extra_price, sort_order, is_active)
              VALUES (?, ?, ?, ?, ?)
            """, (
                int(payload["group_id"]),
                payload["name"],
                float(payload.get("extra_price", 0)),
                int(payload.get("sort_order", 0)),
                int(payload.get("is_active", 1)),
            ))
            return cur.lastrowid

    def update(self, value_id: int, payload: dict) -> None:
        with get_conn() as conn:
            conn.execute("""
              UPDATE variant_values
              SET group_id=?,
                  name=?,
                  extra_price=?,
                  sort_order=?,
                  is_active=?,
                  updated_at=datetime('now')
              WHERE id=?
            """, (
                int(payload["group_id"]),
                payload["name"],
                float(payload.get("extra_price", 0)),
                int(payload.get("sort_order", 0)),
                int(payload.get("is_active", 1)),
                int(value_id)
            ))

    def toggle(self, value_id: int, is_active: int) -> None:
        with get_conn() as conn:
            conn.execute("""
              UPDATE variant_values
              SET is_active=?,
                  updated_at=datetime('now')
              WHERE id=?
            """, (int(is_active), int(value_id)))

    def delete(self, value_id: int) -> None:
        with get_conn() as conn:
            conn.execute("DELETE FROM variant_values WHERE id=?", (int(value_id),))
