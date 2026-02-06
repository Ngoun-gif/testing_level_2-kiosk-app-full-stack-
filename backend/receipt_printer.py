# backend/receipt_printer.py
from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

try:
    from zoneinfo import ZoneInfo  # py 3.9+
except Exception:
    ZoneInfo = None


def app_root() -> Path:
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parents[1]


def _money(x: Any) -> str:
    try:
        return f"{float(x):,.2f}"
    except Exception:
        return "0.00"


def _safe(s: Any) -> str:
    return str(s or "").replace("\n", " ").strip()


def _now_phnom_penh_str() -> str:
    try:
        if ZoneInfo:
            return datetime.now(ZoneInfo("Asia/Phnom_Penh")).strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        pass
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _normalize_datetime_str(s: Any) -> str:
    s = _safe(s)
    if not s:
        return ""
    s = s.replace("T", " ").replace("Z", "")
    if "." in s:
        s = s.split(".", 1)[0]
    if "+" in s:
        s = s.split("+", 1)[0]
    return s.strip()


def _to_int(x: Any, default: int = 999999) -> int:
    try:
        return int(x)
    except Exception:
        return default


class ReceiptPrinter:
    def __init__(self):
        root = app_root()
        self._sumatra_exe = str(root / "tools" / "SumatraPDF.exe")

    def _get_default_printer(self) -> Optional[str]:
        try:
            import win32print
            name = win32print.GetDefaultPrinter()
            return str(name).strip() if name else None
        except Exception:
            return None

    def print_receipt(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            sumatra_path = Path(self._sumatra_exe)
            if not sumatra_path.exists():
                return {"ok": False, "error": f"SumatraPDF.exe not found. Expected at: {sumatra_path}"}

            printer_name = _safe(payload.get("printer_name")) or self._get_default_printer()
            if not printer_name:
                return {"ok": False, "error": "No default printer found. Please set a default printer in Windows."}

            copies = int(payload.get("copies") or 1)

            with tempfile.TemporaryDirectory(prefix="kiosk_receipt_") as td:
                pdf_path = Path(td) / "receipt.pdf"
                self._build_pdf(payload, pdf_path, width_mm=float(payload.get("paper_width_mm") or 80.0))
                self._silent_print(pdf_path, printer_name=printer_name, copies=copies)

            return {"ok": True, "printer": printer_name}
        except subprocess.CalledProcessError as e:
            msg = ((e.stderr or "") + "\n" + (e.stdout or "")).strip()
            return {"ok": False, "error": msg or str(e)}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def _normalize_payment(self, raw: Any) -> str:
        m = _safe(raw)
        if not m:
            return ""
        low = m.lower().replace("_", "-").strip()

        if low in ("qrcode", "qr", "qr-pay", "qr-payment", "qr-payment-method"):
            return "QR-PAY"
        if low in ("counter", "cash", "counter-pay", "counter-payment"):
            return "COUNTER-PAY"
        return m.upper()

    def _ensure_lines(self, payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        lines = payload.get("lines")
        if isinstance(lines, list) and lines:
            return lines

        items = payload.get("items")
        if isinstance(items, list) and items:
            out: List[Dict[str, Any]] = []
            for i, it in enumerate(items):
                base = float(it.get("base_price") or 0)
                opts = []
                for v in (it.get("variants") or []):
                    opts.append({
                        "name": f"{_safe(v.get('group_name'))}: {_safe(v.get('value_name'))}",
                        "price": float(v.get("extra_price") or 0),
                    })
                out.append({
                    "line_no": i + 1,
                    "name": _safe(it.get("name", "Item")),
                    "qty": float(it.get("qty") or 1),
                    "unit_price": base,
                    "line_total": float(it.get("line_total") or 0),
                    "options": opts
                })
            return out

        return []

    def _build_pdf(self, payload: Dict[str, Any], out_pdf: Path, width_mm: float = 80.0) -> None:
        # ---------------- data ----------------
        shop_name = _safe(payload.get("shop_name", "Jom-Kopi"))
        address = _safe(payload.get("address", ""))
        tel = _safe(payload.get("tel", ""))

        order_no = _safe(payload.get("order_no", ""))
        service_type = _safe(payload.get("service_type", ""))  # dine_in / take_away
        currency = _safe(payload.get("currency_symbol") or "$")

        raw_payment = payload.get("payment_type") or payload.get("payment_method") or ""
        payment_label = self._normalize_payment(raw_payment)

        created_at = _normalize_datetime_str(payload.get("created_at", ""))
        if not created_at:
            created_at = _now_phnom_penh_str()

        remark = _safe(payload.get("remark", ""))

        lines = self._ensure_lines(payload)
        lines.sort(key=lambda it: _to_int(it.get("line_no"), 999999))

        total = float(payload.get("total") or payload.get("total_amount") or 0)
        if total == 0 and lines:
            total = sum(float(it.get("line_total") or 0) for it in lines)

        subtotal = float(payload.get("subtotal") or 0) or total
        discount = float(payload.get("discount") or 0)
        tax = float(payload.get("tax") or 0)

        DARK_MODE = bool(payload.get("dark_mode", False))

        # ✅ Optional printer calibration: + moves right, - moves left
        X_OFFSET_MM = float(payload.get("x_offset_mm") or 0.0)
        X_OFFSET = X_OFFSET_MM * mm

        def money(v: Any) -> str:
            return f"{currency}{_money(v)}"

        # ---------------- layout ----------------
        TITLE_SIZE = 14
        SUBTITLE_SIZE = 12
        META_SIZE = 10
        ITEM_SIZE = 10
        HEAD_SIZE = 10
        TOTAL_SIZE = 11
        SEP_SIZE = 9
        LH = 4.8 * mm

        PRICE_W = 10  # characters
        # DESC_W and COLS will be AUTO computed after we know printable width

        # estimate height
        base_lines = 32
        dyn = 0
        for it in lines:
            name = _safe(it.get("name", "Item"))
            dyn += 2 if len(name) > 28 else 1
            dyn += 1
            opts = it.get("options") or []
            if isinstance(opts, list):
                dyn += len(opts)
            dyn += 1

        height_mm = max(190, (base_lines + dyn) * 4.6 + 45)

        page_w = float(width_mm) * mm
        page_h = float(height_mm) * mm
        c = canvas.Canvas(str(out_pdf), pagesize=(page_w, page_h))

        # margins
        left_margin_mm = float(payload.get("left_margin_mm") or 5.0)
        right_margin_mm = float(payload.get("right_margin_mm") or 5.0)
        x = left_margin_mm * mm
        y = page_h - 12 * mm

        usable_w = page_w - (left_margin_mm + right_margin_mm) * mm
        content_center_x = x + (usable_w / 2) + X_OFFSET

        # ✅ AUTO COLS: make ****** and ------ span the usable width
        # Use the same font used for separators (Courier-Bold, SEP_SIZE)
        char_w = c.stringWidth("0", "Courier-Bold", SEP_SIZE)
        COLS = max(24, int(usable_w / max(char_w, 0.1)))  # safety
        DESC_W = max(8, COLS - PRICE_W)

        def fit(s: str, w: int) -> str:
            s = _safe(s)
            if len(s) <= w:
                return s.ljust(w)
            return s[: max(0, w - 1)] + "…"

        def stars() -> str:
            return "*" * COLS

        def dash() -> str:
            return "-" * COLS

        def down(mult: float = 1.0):
            nonlocal y
            y -= LH * mult

        def dark_draw(fn, *args, **kwargs):
            fn(*args, **kwargs)
            if DARK_MODE:
                c.saveState()
                c.translate(0.2 * mm, 0)
                fn(*args, **kwargs)
                c.restoreState()

        def draw_left(text: str, size: int, bold: bool = True):
            c.setFont("Courier-Bold" if bold else "Courier", size)
            c.drawString(x + X_OFFSET, y, text)

        # ✅ Center headings relative to the CONTENT block, not whole page
        def draw_center(text: str, size: int, bold: bool = True):
            c.setFont("Courier-Bold" if bold else "Courier", size)
            c.drawCentredString(content_center_x, y, text)

        def draw_lr(left: str, right: str, size: int, bold: bool = True):
            l = fit(left, DESC_W)
            r = fit(right, PRICE_W).rjust(PRICE_W)
            c.setFont("Courier-Bold" if bold else "Courier", size)
            c.drawString(x + X_OFFSET, y, l + r)

        # ---------------- HEADER ----------------
        dark_draw(draw_center, shop_name, TITLE_SIZE, True); down(1.1)
        if address:
            dark_draw(draw_center, address, 9, False); down(1.0)
        if tel:
            dark_draw(draw_center, f"Tel: {tel}", 9, False); down(1.0)

        # separators now span full usable width
        dark_draw(draw_left, stars(), SEP_SIZE, True); down(1.0)

        receipt_title = "CASH RECEIPT" if "COUNTER" in payment_label else "QR RECEIPT"
        dark_draw(draw_center, receipt_title, SUBTITLE_SIZE, True); down(1.1)

        dark_draw(draw_left, stars(), SEP_SIZE, True); down(1.2)

        if order_no:
            dark_draw(draw_left, f"Order : {order_no}", META_SIZE, True); down(1.1)

        if service_type:
            st = service_type.replace("_", " ").title()
            dark_draw(draw_left, f"Type  : {st}", META_SIZE, True); down(1.1)

        dark_draw(draw_left, f"Date  : {created_at}", META_SIZE, True); down(1.1)

        if payment_label:
            dark_draw(draw_left, f"Pay   : {payment_label}", META_SIZE, True); down(1.1)

        down(0.6)

        # ---------------- TABLE ----------------
        dark_draw(draw_lr, "Description", "Price", HEAD_SIZE, True); down(1.1)
        dark_draw(draw_left, dash(), SEP_SIZE, True); down(1.0)

        # ---------------- ITEMS ----------------
        for it in lines:
            name = _safe(it.get("name", "Item"))
            qty = float(it.get("qty") or 1)
            unit = float(it.get("unit_price") or it.get("price") or 0)
            line_total = float(it.get("line_total") or (qty * unit))

            if len(name) <= 28:
                dark_draw(draw_lr, name, "", ITEM_SIZE, True); down(1.1)
            else:
                dark_draw(draw_lr, name[:28], "", ITEM_SIZE, True); down(1.1)
                dark_draw(draw_lr, name[28:56], "", ITEM_SIZE, True); down(1.1)

            dark_draw(draw_lr, f"{qty:g} x {money(unit)}", money(line_total), ITEM_SIZE, True); down(1.1)

            opts = it.get("options") or []
            if isinstance(opts, list):
                for op in opts:
                    if isinstance(op, dict):
                        op_name = _safe(op.get("name", ""))
                        op_price = float(op.get("price") or 0)
                        dark_draw(draw_lr, f"  - {op_name}", money(op_price) if op_price > 0 else "", 9, True)
                        down(1.0)
                    else:
                        dark_draw(draw_lr, f"  - {_safe(op)}", "", 9, True)
                        down(1.0)

            down(0.7)

        # ---------------- TOTALS ----------------
        dark_draw(draw_left, stars(), SEP_SIZE, True); down(1.0)

        dark_draw(draw_lr, "Subtotal", money(subtotal), ITEM_SIZE, True); down(1.1)
        if discount:
            dark_draw(draw_lr, "Discount", f"-{money(discount)}", ITEM_SIZE, True); down(1.1)
        if tax:
            dark_draw(draw_lr, "Tax", money(tax), ITEM_SIZE, True); down(1.1)

        dark_draw(draw_left, dash(), SEP_SIZE, True); down(1.0)

        dark_draw(draw_lr, "Total", money(total), TOTAL_SIZE, True); down(1.1)

        dark_draw(draw_left, stars(), SEP_SIZE, True); down(1.0)

        # ✅ Centered headings
        dark_draw(draw_center, "THANK YOU!", SUBTITLE_SIZE, True); down(1.2)
        if remark:
            dark_draw(draw_center, f"Remark: {remark}", 9, True); down(1.0)

        barcode_text = _safe(payload.get("barcode_text", ""))
        if barcode_text:
            dark_draw(draw_center, barcode_text, 10, True); down(1.0)

        c.showPage()
        c.save()

    def _silent_print(self, pdf_path: Path, printer_name: str, copies: int = 1) -> None:
        exe = Path(self._sumatra_exe).resolve()
        pdf_path = pdf_path.resolve()

        settings = f"copies={int(copies)},noscale"
        printer_name = str(printer_name).replace("\n", " ").strip()

        args = [
            str(exe),
            "-silent",
            "-print-to", printer_name,
            "-print-settings", settings,
            str(pdf_path),
        ]

        log_path = Path(tempfile.gettempdir()) / "kiosk_sumatra_cmd.txt"
        log_path.write_text(" ".join(args), encoding="utf-8")

        startupinfo = None
        creationflags = 0
        if os.name == "nt":
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            creationflags = subprocess.CREATE_NO_WINDOW

        subprocess.run(
            args,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            startupinfo=startupinfo,
            creationflags=creationflags,
            text=True,
        )
