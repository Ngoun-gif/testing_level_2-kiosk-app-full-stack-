// frontend/js/core/receipt-payload.js
window.Kiosk = window.Kiosk || {};
Kiosk.receiptPayload = Kiosk.receiptPayload || {};

/**
 * Build printable receipt payload from FINAL DB order snapshot:
 *   orders + order_items + order_item_variants
 *
 * Output format matches backend/receipt_printer.py expectations:
 *   - payment_method
 *   - created_at
 *   - lines: [{ name, qty, unit_price, line_total, options:[{name, price}] }]
 *   - subtotal/discount/tax/total
 *
 * Also keeps your DB fields:
 *   - payment_type, service_type, order_no
 */
Kiosk.receiptPayload.fromOrder = function (order) {
  if (!order) throw new Error("Order snapshot is required");

  const payment_type = order.payment_type || order.payment_method || ""; // DB column
  const payment_method = payment_type; // printer expects payment_method

  // Build printer "lines" from order.items
  const lines = (order.items || []).map((it, idx) => {
    const base = Number(it.base_price || 0);

    // options from variants
    const options = (it.variants || []).map(v => ({
      name: `${v.group_name}: ${v.value_name}`,
      price: Number(v.extra_price || 0)
    }));

    // unit_price in receipt printer is used for "qty x unit_price"
    // We show base_price as unit price, then options as extra rows.
    // Total is line_total from DB (trusted).
    return {
      line_no: idx + 1,
      name: it.name,
      qty: Number(it.qty || 1),
      unit_price: base,
      line_total: Number(it.line_total || 0),
      options
    };
  });

  const total = Number(order.total_amount ?? order.total ?? 0);

  // Your DB time (recommended) — shows local string already if you store localtime in sqlite
  const created_at = order.created_at || "";

  // Remark (requested): pay to counter / scan qr
  const remark =
    String(payment_type).toLowerCase() === "counter"
      ? "Remark: Please Pay to Counter"
      : String(payment_type).toLowerCase() === "qr"
      ? "Remark: Payment via QR Code Already"
      : "";

  return {
    // printer header fields
    order_no: order.order_no,
    service_type: order.service_type,

    // keep both (future safe)
    payment_type,
    payment_method,

    created_at,

    // totals for printer
    subtotal: total,
    discount: 0,
    tax: 0,
    total,

    // lines for printer
    lines,

    // optional footer remark printed as barcode_text (your printer already supports it)
    barcode_text: remark
  };
};
