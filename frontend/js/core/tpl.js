(function () {
  window.tpl = function (id) {
    const el = document.getElementById(id);
    if (!el) {
      console.error("[tpl] Template not found:", id);
      return "";
    }
    return el.innerHTML;
  };
})();
