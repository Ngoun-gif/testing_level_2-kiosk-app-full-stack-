// frontend/js/core/utils.js
window.Kiosk = window.Kiosk || {};
Kiosk.utils = Kiosk.utils || {};

(function () {
  function pad2(n) { return String(n).padStart(2, "0"); }

  function nowLocalDateTime() {
    const d = new Date();
    const Y = d.getFullYear();
    const M = pad2(d.getMonth() + 1);
    const D = pad2(d.getDate());
    const h = pad2(d.getHours());
    const m = pad2(d.getMinutes());
    const s = pad2(d.getSeconds());

    return {
      date: `${Y}-${M}-${D} ${h}:${m}:${s}`,   // YYYY-MM-DD HH:MM:SS
      stamp: `${Y}-${M}-${D}-${h}-${m}-${s}`,  // YYYY-MM-DD-HH-MM-SS
      ymd: `${Y}-${M}-${D}`
    };
  }

  // daily increment: O001, O002,... reset each day
  function nextOrderPrefix() {
    const { ymd } = nowLocalDateTime();
    const key = `kiosk_order_seq_${ymd}`;

    let n = Number(localStorage.getItem(key) || 0) + 1;
    localStorage.setItem(key, String(n));

    return `O${String(n).padStart(3, "0")}`; // O001
  }

  // final order_no format you want: O001-YYYY-MM-DD-HH-MM-SS
  function buildOrderNo() {
    const { stamp } = nowLocalDateTime();
    return `${nextOrderPrefix()}-${stamp}`;
  }

  // build receipt payload in ONE place
  function buildReceiptPayload({ cart, total, paymentMethod }) {
    const dt = nowLocalDateTime();

    // payment labels you requested
    const payment_method = paymentMethod === "qrcode" ? "QR-PAY" : "COUNTER-PAY";

    return {
      shop_name: "Jom-Kopi",
      currency_symbol: "$",

      order_no: buildOrderNo(),
      created_at: dt.date, // local PC time; backend will override if missing

      payment_method,

      // empty => backend uses Windows default printer (W80)
      printer_name: "",
      copies: 1,

      // keep stable order using line_no
      lines: (cart || []).map((i, idx) => ({
        line_no: idx + 1,
        name: i?.name,
        qty: i?.qty ?? 1,
        unit_price: i?.unit_price ?? i?.price ?? 0,
        line_total: i?.line_total ?? 0,
        options: (i?.variants || []).map(v => ({
          name: `${v.group_name}: ${v.value_name}`,
          price: Number(v.extra_price || 0)
        }))
      })),

      subtotal: total,
      discount: 0,
      tax: 0,
      total
    };
  }

  Kiosk.utils.pad2 = pad2;
  Kiosk.utils.nowLocalDateTime = nowLocalDateTime;
  Kiosk.utils.buildOrderNo = buildOrderNo;
  Kiosk.utils.buildReceiptPayload = buildReceiptPayload;
})();
