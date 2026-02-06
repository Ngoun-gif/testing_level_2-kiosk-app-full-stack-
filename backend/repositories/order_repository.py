# backend/repositories/order_repository.py
import datetime
from typing import Dict, List, Tuple
from backend.db import get_conn


class OrderRepository:
    # -----------------------------
    # Order No
    # -----------------------------
    def _gen_order_no(self, conn) -> str:
        day = datetime.datetime.now().strftime("%Y%m%d")
        prefix = f"K-{day}-"

        row = conn.execute("""
          SELECT order_no
          FROM orders
          WHERE order_no LIKE ?
          ORDER BY id DESC
          LIMIT 1
        """, (prefix + "%",)).fetchone()

        if not row:
            return prefix + "0001"

        last = (row["order_no"] or "").split("-")[-1]
        try:
            n = int(last) + 1
        except Exception:
            n = 1
        return prefix + str(n).zfill(4)

    # -----------------------------
    # Session check (ACTIVE + not expired)
    # -----------------------------
    def _require_active_session(self, conn, session_key: str):
        row = conn.execute("""
          SELECT status,
                 CAST((julianday(expires_at) - julianday('now')) * 86400 AS INTEGER) AS left_sec
          FROM sessions
          WHERE session_key=?
        """, (session_key,)).fetchone()

        if not row:
            raise ValueError("session not found")

        status = row["status"]
        left_sec = int(row["left_sec"] or 0)

        if status == "ACTIVE" and left_sec <= 0:
            conn.execute("""
              UPDATE sessions
              SET status='EXPIRED', closed_at=datetime('now')
              WHERE session_key=? AND status='ACTIVE'
            """, (session_key,))
            raise ValueError("session expired")

        if status != "ACTIVE":
            raise ValueError(f"session not ACTIVE: {status}")

    # -----------------------------
    # DB lookups
    # -----------------------------
    def _get_product(self, conn, product_id: int):
        return conn.execute("""
          SELECT id, name, base_price, image_path, is_active
          FROM products
          WHERE id=?
        """, (product_id,)).fetchone()

    def _get_active_groups(self, conn, product_id: int):
        return conn.execute("""
          SELECT id, name, is_required, max_select, is_active
          FROM variant_groups
          WHERE product_id=?
          ORDER BY sort_order ASC, id ASC
        """, (product_id,)).fetchall()

    def _get_values_by_groups(self, conn, group_ids: List[int]) -> Dict[int, List[dict]]:
        if not group_ids:
            return {}
        marks = ",".join(["?"] * len(group_ids))
        rows = conn.execute(f"""
          SELECT id, group_id, name, extra_price, is_active
          FROM variant_values
          WHERE group_id IN ({marks})
          ORDER BY sort_order ASC, id ASC
        """, tuple(group_ids)).fetchall()

        out: Dict[int, List[dict]] = {}
        for r in rows:
            gid = int(r["group_id"])
            out.setdefault(gid, []).append({
                "id": int(r["id"]),
                "group_id": gid,
                "name": r["name"],
                "extra_price": float(r["extra_price"] or 0),
                "is_active": int(r["is_active"] or 0),
            })
        return out

    def _make_value_lookup(self, values_by_group: Dict[int, List[dict]]) -> Dict[int, Tuple[int, dict]]:
        lookup: Dict[int, Tuple[int, dict]] = {}
        for gid, vals in values_by_group.items():
            for v in vals:
                lookup[int(v["id"])] = (int(gid), v)
        return lookup

    # -----------------------------
    # Create from items (SECURE)
    # -----------------------------
    def create_from_cart(self, payload: dict) -> dict:
        session_key = str(payload.get("session_key") or "").strip()
        service_type = str(payload.get("service_type") or "").strip()
        items_in = payload.get("items") or []

        if not session_key:
            raise ValueError("session_key is required")
        if service_type not in ("dine_in", "take_away"):
            raise ValueError("service_type must be dine_in or take_away")
        if not isinstance(items_in, list) or len(items_in) == 0:
            raise ValueError("items is empty")

        norm_items = []
        for it in items_in:
            pid = int(it.get("product_id") or 0)
            qty = int(it.get("qty") or 0)

            raw_ids = it.get("variant_value_ids") or []
            vv_ids = []
            for x in raw_ids:
                try:
                    vv_ids.append(int(x))
                except Exception:
                    pass
            vv_ids = sorted(list(set(vv_ids)))

            if pid <= 0 or qty <= 0:
                continue
            qty = max(1, min(99, qty))

            norm_items.append({
                "product_id": pid,
                "qty": qty,
                "variant_value_ids": vv_ids
            })

        if not norm_items:
            raise ValueError("items is empty")

        with get_conn() as conn:
            self._require_active_session(conn, session_key)

            order_no = self._gen_order_no(conn)

            cur = conn.execute("""
              INSERT INTO orders(session_key, order_no, service_type, status, total_amount)
              VALUES(?, ?, ?, 'CREATED', 0)
            """, (session_key, order_no, service_type))
            order_id = int(cur.lastrowid)

            order_total = 0.0

            for it in norm_items:
                pid = int(it["product_id"])
                qty = int(it["qty"])
                vv_ids = it["variant_value_ids"]

                p = self._get_product(conn, pid)
                if not p:
                    raise ValueError(f"product not found: {pid}")
                if int(p["is_active"] or 0) != 1:
                    raise ValueError(f"product inactive: {pid}")

                base_price = float(p["base_price"] or 0)

                groups = self._get_active_groups(conn, pid)
                active_groups = [g for g in groups if int(g["is_active"] or 0) == 1]
                group_ids = [int(g["id"]) for g in active_groups]

                values_by_group = self._get_values_by_groups(conn, group_ids)
                lookup = self._make_value_lookup(values_by_group)

                selected_by_group: Dict[int, List[int]] = {}
                for vid in vv_ids:
                    if vid not in lookup:
                        raise ValueError(f"invalid variant_value_id {vid} for product {pid}")
                    gid, v = lookup[vid]
                    if int(v["is_active"] or 0) != 1:
                        raise ValueError(f"variant_value inactive: {vid}")
                    selected_by_group.setdefault(gid, []).append(vid)

                for g in active_groups:
                    gid = int(g["id"])
                    req = int(g["is_required"] or 0)
                    mx = int(g["max_select"] or 1)
                    picked = selected_by_group.get(gid, [])

                    if req == 1 and len(picked) == 0:
                        raise ValueError(f"missing required group '{g['name']}' for product {pid}")
                    if mx > 0 and len(picked) > mx:
                        raise ValueError(f"too many selections for group '{g['name']}' (max {mx})")

                extras_total = 0.0
                for vids in selected_by_group.values():
                    for vid in vids:
                        _, v = lookup[vid]
                        extras_total += float(v["extra_price"] or 0)

                line_total = (base_price + extras_total) * qty
                order_total += line_total

                cur_it = conn.execute("""
                  INSERT INTO order_items(order_id, product_id, name, qty, base_price, line_total, image_path, image_url)
                  VALUES(?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    int(order_id),
                    int(p["id"]),
                    str(p["name"] or ""),
                    int(qty),
                    float(base_price),
                    float(line_total),
                    p["image_path"],
                    None,
                ))
                order_item_id = int(cur_it.lastrowid)

                for g in active_groups:
                    gid = int(g["id"])
                    vids = selected_by_group.get(gid, [])
                    for vid in vids:
                        _, v = lookup[vid]
                        conn.execute("""
                          INSERT INTO order_item_variants(
                            order_item_id, group_id, group_name, value_id, value_name, extra_price
                          ) VALUES(?, ?, ?, ?, ?, ?)
                        """, (
                            int(order_item_id),
                            gid,
                            g["name"],
                            int(v["id"]),
                            v["name"],
                            float(v["extra_price"] or 0),
                        ))

            conn.execute("""
              UPDATE orders
              SET total_amount=?
              WHERE id=?
            """, (float(order_total), int(order_id)))

        return {
            "order_id": int(order_id),
            "order_no": order_no,
            "total_amount": float(order_total),
            "status": "CREATED"
        }

    # -----------------------------
    # Updates
    # -----------------------------
    def set_payment_type(self, order_id: int, payment_type: str):
        if payment_type not in ("counter", "qr"):
            raise ValueError("payment_type must be counter or qr")

        with get_conn() as conn:
            conn.execute("""
              UPDATE orders
              SET payment_type=?
              WHERE id=? AND status='CREATED'
            """, (payment_type, int(order_id)))

    def mark_paid(self, order_id: int):
        with get_conn() as conn:
            conn.execute("""
              UPDATE orders
              SET status='PAID', paid_at=datetime('now')
              WHERE id=? AND status='CREATED'
            """, (int(order_id),))

    def mark_printed(self, order_id: int):
        with get_conn() as conn:
            conn.execute("""
              UPDATE orders
              SET status='PRINTED', printed_at=datetime('now')
              WHERE id=? AND status IN ('PAID','CREATED')
            """, (int(order_id),))

    def cancel(self, order_id: int):
        with get_conn() as conn:
            conn.execute("""
              UPDATE orders
              SET status='CANCELLED', cancelled_at=datetime('now')
              WHERE id=? AND status IN ('CREATED','PAID')
            """, (int(order_id),))

    # -----------------------------
    # Get full snapshot (UTC + LOCAL aliases)
    # -----------------------------
    def get_full(self, order_id: int):
        with get_conn() as conn:
            o = conn.execute("""
              SELECT
                o.*,
                datetime(o.created_at, 'localtime')   AS created_at_local,
                datetime(o.paid_at, 'localtime')      AS paid_at_local,
                datetime(o.printed_at, 'localtime')   AS printed_at_local,
                datetime(o.cancelled_at, 'localtime') AS cancelled_at_local
              FROM orders o
              WHERE o.id=?
            """, (int(order_id),)).fetchone()

            if not o:
                return None

            items = conn.execute("""
              SELECT * FROM order_items
              WHERE order_id=?
              ORDER BY id ASC
            """, (int(order_id),)).fetchall()

            out_items = []
            for it in items:
                vars_ = conn.execute("""
                  SELECT group_id, group_name, value_id, value_name, extra_price
                  FROM order_item_variants
                  WHERE order_item_id=?
                  ORDER BY id ASC
                """, (int(it["id"]),)).fetchall()

                out_items.append({**dict(it), "variants": [dict(v) for v in vars_]})

            return {**dict(o), "items": out_items}
