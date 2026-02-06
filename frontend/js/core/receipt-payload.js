// frontend/js/core/receipt-payload.js
window.Kiosk = window.Kiosk || {};
Kiosk.receiptPayload = Kiosk.receiptPayload || {};

/**
 * Build printable receipt payload from FINAL order snapshot
 * (order, order_items, order_item_variants)
 *
 * Supports both naming styles:
 * - payment_type / payment_method
 * - total_amount / total
 */
Kiosk.receiptPayload.fromOrder = function (order) {
  if (!order) throw new Error("Order snapshot is required");

  return {
    order_no: order.order_no,
    service_type: order.service_type,

    // ✅ DB column is payment_type; keep compatibility with older naming
    payment_type: order.payment_type || order.payment_method || null,

    // ✅ DB column is total_amount; keep compatibility with older naming
    total: Number(order.total_amount ?? order.total ?? 0),

    items: (order.items || []).map((it) => ({
      name: it.name,
      qty: Number(it.qty || 1),
      base_price: Number(it.base_price || 0),

      variants: (it.variants || []).map((v) => ({
        group_name: v.group_name,
        value_name: v.value_name,
        extra_price: Number(v.extra_price || 0)
      })),

      line_total: Number(it.line_total || 0)
    }))
  };
};
