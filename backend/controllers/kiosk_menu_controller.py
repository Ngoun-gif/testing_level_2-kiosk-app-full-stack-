# backend/controllers/kiosk_menu_controller.py
from backend.repositories.menu_repository import MenuRepository

class KioskMenuController:
    def __init__(self):
        self.repo = MenuRepository()

    def load_all(self):
        try:
            data = self.repo.load_all_active()
            return {"status": "ok", "data": data}
        except Exception as e:
            return {"status": "error", "message": str(e)}
