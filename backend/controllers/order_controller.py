# backend/controllers/order_controller.py
from backend.repositories.order_repository import OrderRepository

class OrderController:
    def __init__(self):
        self.repo = OrderRepository()

    def create_from_cart(self, payload: dict):
        try:
            data = self.repo.create_from_cart(payload or {})
            return {"status": "ok", "data": data}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def set_payment_type(self, order_id: int, payment_type: str):
        try:
            self.repo.set_payment_type(int(order_id), str(payment_type))
            return {"status": "ok"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def mark_paid(self, order_id: int):
        try:
            self.repo.mark_paid(int(order_id))
            return {"status": "ok"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def mark_printed(self, order_id: int):
        try:
            self.repo.mark_printed(int(order_id))
            return {"status": "ok"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def cancel(self, order_id: int):
        try:
            self.repo.cancel(int(order_id))
            return {"status": "ok"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def get_full(self, order_id: int):
        try:
            data = self.repo.get_full(int(order_id))
            if not data:
                return {"status": "error", "message": "order not found"}
            return {"status": "ok", "data": data}
        except Exception as e:
            return {"status": "error", "message": str(e)}
