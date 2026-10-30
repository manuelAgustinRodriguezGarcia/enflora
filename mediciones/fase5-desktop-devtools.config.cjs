/**
 * Desktop oficial (1350x940, Dense 4G) pero con throttling aplicado en Chrome,
 * para que las duraciones de tareas sean reloj de pared comparable con móvil.
 */
module.exports = {
  extends: "lighthouse:default",
  settings: {
    onlyCategories: ["performance"],
    throttlingMethod: "devtools",
    formFactor: "desktop",
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false,
    },
    emulatedUserAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    throttling: {
      rttMs: 40,
      throughputKbps: 10 * 1024,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    },
  },
};
