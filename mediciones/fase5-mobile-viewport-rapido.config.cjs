/**
 * Viewport móvil (Moto G Power) con CPU y red sin ralentizar.
 * Separa el costo del viewport del throttling Slow 4G / CPU 4x.
 */
module.exports = {
  extends: "lighthouse:default",
  settings: {
    onlyCategories: ["performance"],
    throttlingMethod: "devtools",
    formFactor: "mobile",
    screenEmulation: {
      mobile: true,
      width: 412,
      height: 823,
      deviceScaleFactor: 1.75,
      disabled: false,
    },
    emulatedUserAgent:
      "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36",
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
