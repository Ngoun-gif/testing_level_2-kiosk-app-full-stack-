# backend/repositories/session_repository.py
import secrets
from backend.db import get_conn


class SessionRepository:
    def __init__(self, minutes: int = 7):
        self.minutes = int(minutes)

    def start(self):
        session_key = secrets.token_hex(16)  # 32 chars

        with get_conn() as conn:
            conn.execute("""
              INSERT INTO sessions(session_key, expires_at)
              VALUES(?, datetime('now', ?))
            """, (session_key, f'+{self.minutes} minutes'))

        return {"session_key": session_key, "expires_in_sec": self.minutes * 60}

    def touch(self, session_key: str):
        """
        Extend expiry if ACTIVE and not expired by time.
        If expired by time, mark EXPIRED and refuse extension.
        """
        with get_conn() as conn:
            row = conn.execute("""
                               SELECT status,
                                      CAST((julianday(expires_at) - julianday('now')) * 86400 AS INTEGER) AS left_sec
                               FROM sessions
                               WHERE session_key = ?
                               """, (session_key,)).fetchone()

            if not row:
                return None  # not found

            status = row["status"]
            left_sec = int(row["left_sec"] or 0)

            # Expired by time but still ACTIVE -> expire it now
            if status == "ACTIVE" and left_sec <= 0:
                conn.execute("""
                             UPDATE sessions
                             SET status='EXPIRED',
                                 closed_at=datetime('now')
                             WHERE session_key = ?
                               AND status = 'ACTIVE'
                             """, (session_key,))
                return {"status": "EXPIRED", "expires_in_sec": 0}

            # Not active -> no extension
            if status != "ACTIVE":
                return {"status": status, "expires_in_sec": 0}

            # Extend expiry
            conn.execute("""
                         UPDATE sessions
                         SET last_seen_at=datetime('now'),
                             expires_at=datetime('now', ?)
                         WHERE session_key = ?
                           AND status = 'ACTIVE'
                         """, (f'+{self.minutes} minutes', session_key))

        return {"status": "ACTIVE", "expires_in_sec": self.minutes * 60}

    def status(self, session_key: str):
        """
        Return current status + left_sec.
        If expired, mark EXPIRED.
        """
        with get_conn() as conn:
            row = conn.execute("""
              SELECT status,
                     CAST((julianday(expires_at) - julianday('now')) * 86400 AS INTEGER) AS left_sec
              FROM sessions
              WHERE session_key=?
            """, (session_key,)).fetchone()

            if not row:
                return None

            status = row["status"]
            left_sec = int(row["left_sec"] or 0)

            if status == "ACTIVE" and left_sec <= 0:
                conn.execute("""
                  UPDATE sessions
                  SET status='EXPIRED', closed_at=datetime('now')
                  WHERE session_key=? AND status='ACTIVE'
                """, (session_key,))
                return {"status": "EXPIRED", "left_sec": 0}

            return {"status": status, "left_sec": max(0, left_sec)}

    def close(self, session_key: str):
        with get_conn() as conn:
            conn.execute("""
              UPDATE sessions
              SET status='CLOSED', closed_at=datetime('now')
              WHERE session_key=? AND status='ACTIVE'
            """, (session_key,))
