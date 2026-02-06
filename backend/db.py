# backend/db.py
import sqlite3
from contextlib import contextmanager
from backend.paths import app_root

DB_PATH = app_root() / "identifier.sqlite"

def init_db():
    """
    Create DB + tables if not exist.
    Safe to call every start.
    """
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("PRAGMA foreign_keys = ON;")

        conn.executescript("""
        PRAGMA foreign_keys = ON;

        -- =========================
        -- Categories
        -- =========================
        CREATE TABLE IF NOT EXISTS categories (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL UNIQUE,
            image_path  TEXT,
            sort_order  INTEGER NOT NULL DEFAULT 0,
            is_active   INTEGER NOT NULL DEFAULT 1,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at  TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_categories_active
        ON categories (is_active);

        -- =========================
        -- Sub Categories
        -- =========================
        CREATE TABLE IF NOT EXISTS sub_categories (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL,
            name        TEXT NOT NULL,
            image_path  TEXT,
            sort_order  INTEGER NOT NULL DEFAULT 0,
            is_active   INTEGER NOT NULL DEFAULT 1,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at  TEXT,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_sub_categories_active
        ON sub_categories (is_active);

        CREATE UNIQUE INDEX IF NOT EXISTS uq_sub_categories_cat_name
        ON sub_categories (category_id, name);

        -- =========================
        -- Products
        -- =========================
        CREATE TABLE IF NOT EXISTS products (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            sub_category_id INTEGER NOT NULL,
            sku             TEXT UNIQUE,
            name            TEXT NOT NULL,
            base_price      REAL NOT NULL DEFAULT 0,
            image_path      TEXT,
            sort_order      INTEGER NOT NULL DEFAULT 0,
            is_active       INTEGER NOT NULL DEFAULT 1,
            created_at      TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at      TEXT,
            FOREIGN KEY (sub_category_id) REFERENCES sub_categories(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_products_active
        ON products (is_active);

        -- =========================
        -- Variant Groups
        -- =========================
        CREATE TABLE IF NOT EXISTS variant_groups (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id  INTEGER NOT NULL,
            name        TEXT NOT NULL,
            is_required INTEGER NOT NULL DEFAULT 0,
            max_select  INTEGER NOT NULL DEFAULT 1,
            sort_order  INTEGER DEFAULT 0,
            is_active   INTEGER DEFAULT 1,
            created_at  TEXT DEFAULT (datetime('now')),
            updated_at  TEXT,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_variant_groups_active
        ON variant_groups (is_active);

        CREATE UNIQUE INDEX IF NOT EXISTS uq_variant_groups_product_name
        ON variant_groups (product_id, name);

        -- =========================
        -- Variant Values
        -- =========================
        CREATE TABLE IF NOT EXISTS variant_values (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id    INTEGER NOT NULL,
            name        TEXT NOT NULL,
            extra_price REAL NOT NULL DEFAULT 0,
            sort_order  INTEGER DEFAULT 0,
            is_active   INTEGER DEFAULT 1,
            created_at  TEXT DEFAULT (datetime('now')),
            updated_at  TEXT,
            FOREIGN KEY (group_id) REFERENCES variant_groups(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_variant_values_active
        ON variant_values (is_active);

        CREATE UNIQUE INDEX IF NOT EXISTS uq_variant_values_group_name
        ON variant_values (group_id, name);
        
        -- =========================
        -- Sessions
        -- =========================
        CREATE TABLE IF NOT EXISTS sessions (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            session_key  TEXT NOT NULL UNIQUE,
            status       TEXT NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE, EXPIRED, CLOSED
            started_at   TEXT NOT NULL DEFAULT (datetime('now')),
            last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
            expires_at   TEXT NOT NULL,
            closed_at    TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_status_expires
        ON sessions (status, expires_at);
        
        -- =========================
        -- Orders (Level 2)
        -- =========================
        CREATE TABLE IF NOT EXISTS orders (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          session_key  TEXT,
          order_no     TEXT UNIQUE,
          service_type TEXT NOT NULL,      -- dine_in / take_away
          payment_type TEXT,               -- counter / qr
          status       TEXT NOT NULL DEFAULT 'CREATED',  -- CREATED, PAID, PRINTED, CANCELLED
          total_amount REAL NOT NULL DEFAULT 0,
          created_at   TEXT DEFAULT (datetime('now')),
          paid_at      TEXT,
          printed_at   TEXT,
          cancelled_at TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_orders_status
        ON orders(status);
        
        CREATE INDEX IF NOT EXISTS idx_orders_created
        ON orders(created_at);
        
        -- =========================
        -- Order Items
        -- =========================
        CREATE TABLE IF NOT EXISTS order_items (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id    INTEGER NOT NULL,
          product_id  INTEGER,
          name        TEXT NOT NULL,
          qty         INTEGER NOT NULL DEFAULT 1,
          base_price  REAL NOT NULL DEFAULT 0,
          line_total  REAL NOT NULL DEFAULT 0,
          image_path  TEXT,
          image_url   TEXT,
          FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_order_items_order
        ON order_items(order_id);
        
        -- =========================
        -- Order Item Variants
        -- =========================
        CREATE TABLE IF NOT EXISTS order_item_variants (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          order_item_id INTEGER NOT NULL,
          group_id      INTEGER,
          group_name    TEXT,
          value_id      INTEGER,
          value_name    TEXT,
          extra_price   REAL NOT NULL DEFAULT 0,
          FOREIGN KEY(order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_oiv_item
        ON order_item_variants(order_item_id);


        """)

        conn.commit()
    finally:
        conn.close()

@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
