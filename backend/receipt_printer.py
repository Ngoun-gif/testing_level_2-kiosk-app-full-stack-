# backend/receipt_printer.py
from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from zoneinfo import ZoneInfo
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


def app_root() -> Path:
    """
    dev: project folder
    exe (--onefile): sys._MEIPASS extracted folder
    """
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


class ReceiptPrinter:
    """
    L1 receipt printing:
      - Build 80mm PDF
      - Silent print via SumatraPDF.exe
      - Prints to Windows default printer unless payload printer_name provided
    """

    def __init__(self):
        root = app_root()
        # keep as str to avoid pywebview introspection issues
        self._sumatra_exe = str(root / "tools" / "SumatraPDF.exe")

    def _get_default_printer(self) -> Optional[str]:
        try:
            import win32print  # pywin32
            name = win32print.GetDefaultPrinter()
            return str(name).strip() if name else None
        except Exception:
            return None

    def print_receipt(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            sumatra_path = Path(self._sumatra_exe)
            if not sumatra_path.exists():
                return {"ok": False, "error": f"SumatraPDF.exe not found. Expected at: {sumatra_path}"}

            # printer: payload -> default
            printer_name = _safe(payload.get("printer_name")) or self._get_default_printer()
            if not printer_name:
                return {"ok": False, "error": "No default printer found. Please set a default printer in Windows."}

            copies = int(payload.get("copies") or 1)

            with tempfile.TemporaryDirectory(prefix="kiosk_receipt_") as td:
                pdf_path = Path(td) / "receipt.pdf"
                self._build_pdf(payload, pdf_path, width_mm=80.0)
                self._silent_print(pdf_path, printer_name=printer_name, copies=copies)

            return {"ok": True, "printer": printer_name}
        except subprocess.CalledProcessError as e:
            msg = ((e.stderr or "") + "\n" + (e.stdout or "")).strip()
            return {"ok": False, "error": msg or str(e)}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def _normalize_payment(self, raw: Any) -> str:
        """
        Prints clean values.
        Supports:
          - QR-PAY / COUNTER-PAY (your new values)
          - qrcode / counter / QR_PAYMENT / COUNTER_PAYMENT (old)
        """
        m = _safe(raw)
        if not m:
            return ""

        low = m.lower().replace("_", "-").strip()

        if low in ("qrcode", "qr", "qr-pay", "qr-payment"):
            return "QR-PAY"
        if low in ("counter", "cash", "counter-pay", "counter-payment"):
            return "COUNTER-PAY"

        # fallback
        return m.upper()

    def _build_pdf(self, payload: Dict[str, Any], out_pdf: Path, width_mm: float = 80.0) -> None:
        # ---------------- data ----------------
        shop_name = _safe(payload.get("shop_name", "SHOP NAME"))
        address = _safe(payload.get("address", ""))   # optional
        tel = _safe(payload.get("tel", ""))           # optional

        order_no = _safe(payload.get("order_no", ""))
        currency = _safe(payload.get("currency_symbol") or "$")

        payment_label = self._normalize_payment(payload.get("payment_method", ""))

        created_at = _safe(payload.get("created_at"))
        if not created_at:
            created_at = datetime.now(ZoneInfo("Asia/Phnom_Penh")).strftime("%Y-%m-%d %H:%M:%S")

        lines: List[Dict[str, Any]] = list(payload.get("lines") or [])
        lines.sort(key=lambda it: int(it.get("line_no", 999999)))

        subtotal = float(payload.get("subtotal") or 0)
        discount = float(payload.get("discount") or 0)
        tax = float(payload.get("tax") or 0)
        total = float(payload.get("total") or 0)

        # extra-dark mode (optional)
        # payload["dark_mode"]=True if you want even heavier by double-print
        DARK_MODE = bool(payload.get("dark_mode", False))

        def money(v: Any) -> str:
            return f"{currency}{_money(v)}"

        # ---------------- layout ----------------
        # Monospace columns for W80
        COLS = 42
        PRICE_W = 10
        DESC_W = COLS - PRICE_W

        # sizes (heavier ink)
        TITLE_SIZE = 14
        SUBTITLE_SIZE = 12
        META_SIZE = 10        # Order/Date/Pay
        ITEM_SIZE = 10        # qty line, subtotal line
        HEAD_SIZE = 10
        TOTAL_SIZE = 12

        # line height
        LH = 4.8 * mm

        def fit(s: str, w: int) -> str:
            s = _safe(s)
            if len(s) <= w:
                return s.ljust(w)
            return s[: max(0, w - 1)] + "…"

        def stars() -> str:
            return "*" * COLS

        def dash() -> str:
            return "-" * COLS

        # estimate height
        base_lines = 28
        dyn = 0
        for it in lines:
            name = _safe(it.get("name", "Item"))
            dyn += 2 if len(name) > 28 else 1
            dyn += 1  # qty line
            opts = it.get("options") or []
            if isinstance(opts, list):
                dyn += len(opts)
            dyn += 1  # blank spacer

        est_lines = base_lines + dyn
        height_mm = max(190, est_lines * 4.6 + 45)

        page_w = width_mm * mm
        page_h = height_mm * mm
        c = canvas.Canvas(str(out_pdf), pagesize=(page_w, page_h))

        x = 5 * mm
        y = page_h - 12 * mm

        def down(mult: float = 1.0):
            nonlocal y
            y -= LH * mult

        # ---- bold-by-default writers (more ink) ----
        def draw_left(text: str, size: int, bold: bool = True):
            c.setFont("Courier-Bold" if bold else "Courier", size)
            c.drawString(x, y, text)

        def draw_center(text: str, size: int, bold: bool = True):
            c.setFont("Courier-Bold" if bold else "Courier", size)
            c.drawCentredString(page_w / 2, y, text)

        def draw_lr(left: str, right: str, size: int, bold: bool = True):
            l = fit(left, DESC_W)
            r = fit(right, PRICE_W).rjust(PRICE_W)
            text = l + r
            c.setFont("Courier-Bold" if bold else "Courier", size)
            c.drawString(x, y, text)

        # ---- extra-dark printing (draw twice slightly offset) ----
        def dark_draw(fn, *args, **kwargs):
            """If DARK_MODE True: draw twice with tiny offset to look darker on thermal."""
            fn(*args, **kwargs)
            if DARK_MODE:
                # tiny offsets (0.2mm) makes strokes thicker
                c.saveState()
                c.translate(0.2 * mm, 0)
                fn(*args, **kwargs)
                c.restoreState()

        # ---------------- HEADER ----------------
        dark_draw(draw_center, shop_name, TITLE_SIZE, True); down(1.1)

        if address:
            dark_draw(draw_center, address, 9, False); down(1.0)
        if tel:
            dark_draw(draw_center, f"Tel: {tel}", 9, False); down(1.0)

        dark_draw(draw_left, stars(), 9, True); down(1.0)

        receipt_title = "CASH RECEIPT" if "COUNTER" in payment_label or "CASH" in payment_label else "QR RECEIPT"
        dark_draw(draw_center, receipt_title, SUBTITLE_SIZE, True); down(1.1)

        dark_draw(draw_left, stars(), 9, True); down(1.2)

        # Meta lines (BOLD + bigger to avoid blur)
        if order_no:
            dark_draw(draw_left, f"Order: {order_no}", META_SIZE, True); down(1.1)
        dark_draw(draw_left, f"Date : {created_at}", META_SIZE, True); down(1.1)
        if payment_label:
            dark_draw(draw_left, f"Pay  : {payment_label}", META_SIZE, True); down(1.1)

        down(0.6)

        # ---------------- TABLE HEADER ----------------
        dark_draw(draw_lr, "Description", "Price", HEAD_SIZE, True); down(1.1)
        dark_draw(draw_left, dash(), 9, True); down(1.0)

        # ---------------- ITEMS ----------------
        for it in lines:
            name = _safe(it.get("name", "Item"))
            qty = float(it.get("qty") or 1)
            unit = float(it.get("unit_price") or it.get("price") or 0)
            line_total = float(it.get("line_total") or (qty * unit))

            # item name (bold)
            if len(name) <= 28:
                dark_draw(draw_lr, name, "", ITEM_SIZE, True); down(1.1)
            else:
                dark_draw(draw_lr, name[:28], "", ITEM_SIZE, True); down(1.1)
                dark_draw(draw_lr, name[28:56], "", ITEM_SIZE, True); down(1.1)

            # qty line (bold + larger)
            dark_draw(draw_lr, f"{qty:g} x {money(unit)}", money(line_total), ITEM_SIZE, True); down(1.1)

            # options (still readable: bold False but size 9)
            opts = it.get("options") or []
            if isinstance(opts, list):
                for op in opts:
                    if isinstance(op, dict):
                        op_name = _safe(op.get("name", ""))
                        op_price = float(op.get("price") or 0)
                        dark_draw(draw_lr, f"  - {op_name}", money(op_price) if op_price > 0 else "", 9, False)
                        down(1.0)
                    else:
                        dark_draw(draw_lr, f"  - {_safe(op)}", "", 9, False)
                        down(1.0)

            down(0.7)

        # ---------------- TOTALS ----------------
        dark_draw(draw_left, stars(), 9, True); down(1.0)

        # subtotal/discount/tax in bold to be readable
        dark_draw(draw_lr, "Subtotal", money(subtotal), ITEM_SIZE, True); down(1.1)
        if discount:
            dark_draw(draw_lr, "Discount", f"-{money(discount)}", ITEM_SIZE, True); down(1.1)
        if tax:
            dark_draw(draw_lr, "Tax", money(tax), ITEM_SIZE, True); down(1.1)

        dark_draw(draw_left, dash(), 9, True); down(1.0)

        # total is already bold big
        dark_draw(draw_lr, "Total", money(total), TOTAL_SIZE, True); down(1.2)

        dark_draw(draw_left, stars(), 9, True); down(1.0)

        dark_draw(draw_center, "THANK YOU!", SUBTITLE_SIZE, True); down(1.2)

        # optional barcode text
        barcode_text = _safe(payload.get("barcode_text", ""))  # optional
        if barcode_text:
            dark_draw(draw_center, barcode_text, 10, True); down(1.0)

        c.showPage()
        c.save()

    def _silent_print(self, pdf_path: Path, printer_name: str, copies: int = 1) -> None:
        exe = Path(self._sumatra_exe).resolve()
        pdf_path = pdf_path.resolve()

        # for 80mm receipts, noscale is usually best
        settings = f"copies={int(copies)},noscale"

        printer_name = str(printer_name).replace("\n", " ").strip()

        args = [
            str(exe),
            "-silent",
            "-print-to", printer_name,
            "-print-settings", settings,
            str(pdf_path),
        ]

        # debug: write exact command
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
