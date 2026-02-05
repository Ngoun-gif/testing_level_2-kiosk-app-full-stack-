// dashboard/js/core/tpl.js

(function () {
  /**
   * Get HTML template by element ID
   * Usage: tpl("tpl-category")
   */
  window.tpl = function (id) {
    const el = document.getElementById(id);

    if (!el) {
      console.error("[tpl] Template not found:", id);
      return "";
    }

    return el.innerHTML;
  };
})();
