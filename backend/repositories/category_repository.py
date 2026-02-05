# backend/repositories/category_repository.py
from backend.db import get_conn

class CategoryRepository:
    def list(self, include_inactive: bool = True):
        sql = """
          SELECT id, name, image_path, sort_order, is_active, created_at, updated_at
          FROM categories
        """
        if not include_inactive:
            sql += " WHERE is_active=1"
        sql += " ORDER BY sort_order ASC, id ASC"

        with get_conn() as conn:
            rows = conn.execute(sql).fetchall()
        return [dict(r) for r in rows]

    def get_image_path(self, category_id: int):
        with get_conn() as conn:
            row = conn.execute(
                "SELECT image_path FROM categories WHERE id=?",
                (category_id,)
            ).fetchone()
        return row["image_path"] if row else None

    def create(self, payload: dict) -> int:
        with get_conn() as conn:
            cur = conn.execute("""
              INSERT INTO categories(name, image_path, sort_order, is_active)
              VALUES (?, ?, ?, ?)
            """, (
                payload["name"],
                payload.get("image_path"),
                int(payload.get("sort_order", 0)),
                int(payload.get("is_active", 1)),
            ))
            return cur.lastrowid

    def update(self, category_id: int, payload: dict) -> None:
        with get_conn() as conn:
            conn.execute("""
              UPDATE categories
              SET name=?,
                  image_path=COALESCE(?, image_path),
                  sort_order=?,
                  is_active=?,
                  updated_at=datetime('now')
              WHERE id=?
            """, (
                payload["name"],
                payload.get("image_path"),
                int(payload.get("sort_order", 0)),
                int(payload.get("is_active", 1)),
                int(category_id),
            ))

    def toggle(self, category_id: int, is_active: int) -> None:
        with get_conn() as conn:
            conn.execute("""
              UPDATE categories
              SET is_active=?, updated_at=datetime('now')
              WHERE id=?
            """, (int(is_active), int(category_id)))

    def delete(self, category_id: int) -> None:
        with get_conn() as conn:
            conn.execute("DELETE FROM categories WHERE id=?", (int(category_id),))
