# backend/controllers/session_controller.py
from backend.repositories.session_repository import SessionRepository


class SessionController:
    def __init__(self, minutes: int = 7):
        self.repo = SessionRepository(minutes=minutes)

    def start(self):
        try:
            data = self.repo.start()
            return {"status": "ok", "data": data}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def touch(self, session_key: str):
        if not session_key:
            return {"status": "error", "message": "session_key is required"}
        try:
            data = self.repo.touch(session_key)
            if not data:
                return {"status": "error", "message": "session not found"}
            return {"status": "ok", "data": data}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def status(self, session_key: str):
        if not session_key:
            return {"status": "error", "message": "session_key is required"}
        try:
            data = self.repo.status(session_key)
            if not data:
                return {"status": "error", "message": "session not found"}
            return {"status": "ok", "data": data}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def close(self, session_key: str):
        if not session_key:
            return {"status": "error", "message": "session_key is required"}
        try:
            self.repo.close(session_key)
            return {"status": "ok"}
        except Exception as e:
            return {"status": "error", "message": str(e)}
