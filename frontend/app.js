// frontend/app.js
window.Kiosk = window.Kiosk || {};
Kiosk.modules = Kiosk.modules || {};

const { createApp } = Vue;

(function bootstrapKiosk() {
  // ✅ Register idle-warning as a real Vue component (Vue compiles {{ }})
  Kiosk.modules["idle-warning"] = {
    template: tpl("tpl-idle-warning"),
    data() {
      return { router: Kiosk.router, Kiosk };
    }
  };

  const app = createApp({
    data() {
      return { router: Kiosk.router };
    },

    computed: {
      currentView() {
        return Kiosk.modules[this.router.state.route] || Kiosk.modules.splash;
      }
    },

    template: `
      <div class="kiosk-shell">
        <component :is="currentView"></component>

        <!-- ✅ Global overlay (compiled) -->
        <idle-warning></idle-warning>

        <div class="kiosk-footer">{{ router.state.footerMsg }}</div>
      </div>
    `
  });

  // register all modules
  for (const [name, comp] of Object.entries(Kiosk.modules)) {
    app.component(name, comp);
  }

  app.mount("#kioskApp");

  // ✅ start at splash FIRST
  Kiosk.router.go("splash");

  // ✅ mount session system AFTER route is splash
  if (Kiosk.session) Kiosk.session.mount();
})();
