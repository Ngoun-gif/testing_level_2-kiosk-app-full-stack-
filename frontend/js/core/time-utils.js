window.Kiosk = window.Kiosk || {};
Kiosk.time = Kiosk.time || {};

/**
 * Convert SQLite UTC datetime → Asia/Phnom_Penh time
 * Input: "YYYY-MM-DD HH:MM:SS"
 */
Kiosk.time.toPhnomPenh = function (dt) {
  if (!dt) return "";

  // SQLite stores UTC
  const iso = String(dt).replace(" ", "T") + "Z";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Phnom_Penh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(d);
};

/**
 * Short format (receipt / compact UI)
 * Example: 06/02 11:46
 */
Kiosk.time.toPhnomPenhShort = function (dt) {
  if (!dt) return "";

  const iso = String(dt).replace(" ", "T") + "Z";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Phnom_Penh",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
};
