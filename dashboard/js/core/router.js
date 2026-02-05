// dashboard/js/core/router.js
// Requires Vue already loaded (vue.global.prod.js)

window.Dashboard = window.Dashboard || {};

Dashboard.router = {
  state: Vue.reactive({
    route: "dashboard",
    sidebarOpen: false,
    footerMsg: "Ready"
  }),

  go(name) {
    this.state.route = name;
    this.state.sidebarOpen = false;
    this.state.footerMsg = `Open: ${name}`;
  },

  toggleSidebar() {
    this.state.sidebarOpen = !this.state.sidebarOpen;
  },

  setFooter(msg) {
    this.state.footerMsg = msg;
  }
};
