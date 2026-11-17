
import SpeedTest from "@cloudflare/speedtest";
import "./style.css";

const $ = (id) => document.getElementById(id);

const els = {
  status: $("connection-status"),
  state: $("test-state"),
  live: $("live-pill"),
  meter: $("meter-progress"),
  meterLabel: $("meter-label"),
  meterValue: $("meter-value"),
  meterCaption: $("meter-caption"),
  download: $("download-value"),
  upload: $("upload-value"),
  ping: $("ping-value"),
  jitter: $("jitter-value"),
  loadedPing: $("loaded-ping-value"),
  loadedDownload: $("loaded-download-value"),
  loadedUpload: $("loaded-upload-value"),
  quality: $("connection-quality"),
  qualityDescription: $("quality-description"),
  qualityIndicator: $("quality-indicator"),
  ip: $("ip-value"),
  privateIP: $("private-ip-value"),
  isp: $("isp-value"),
  location: $("location-value"),
  button: $("start-button"),
  buttonLabel: $("button-label"),
  history: $("history-list"),
  chart: $("speed-chart"),
  toast: $("toast")
};

const circumference = 2 * Math.PI * 128;

if (els.meter) {
  els.meter.style.strokeDasharray =
    `${circumference * 0.75} ${circumference * 0.25}`;

  els.meter.style.strokeDashoffset =
    `${circumference * 0.76}`;
}

let engine = null;
let active = false;
let phase = "DOWNLOAD";
let chartValues = [];

let lastDownload = null;
let lastUpload = null;
let lastUnloadedPing = null;
let lastLoadedDownloadPing = null;
let lastLoadedUploadPing = null;
let lastJitter = null;
let lastLoadedDownloadJitter = null;
let lastLoadedUploadJitter = null;
let lastAimScores = null;

let toastTimer;

function showToast(message) {
  if (!els.toast) return;

  els.toast.textContent = message;
  els.toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    els.toast.classList.remove("show");
  }, 4200);
}

function formatMbps(bps) {
  if (!Number.isFinite(bps) || bps <= 0) {
    return "—";
  }

  return (bps / 1_000_000).toFixed(2);
}

function formatMs(value) {
  return Number.isFinite(value) && value >= 0
    ? value.toFixed(1)
    : "—";
}

function getValue(fn) {
  try {
    const value = fn();

    return Number.isFinite(value) && value >= 0
      ? value
      : null;
  } catch {
    return null;
  }
}

function getScores(results) {
  try {
    return results?.getScores?.() ?? null;
  } catch (error) {
    console.warn("AIM score unavailable:", error);
    return null;
  }
}

function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

function setMeter(value, label, caption = "") {
  if (!els.meter || !els.meterLabel || !els.meterValue) {
    return;
  }

  els.meterLabel.textContent = label;

  els.meterValue.innerHTML =
    `${value === null ? "—" : value.toFixed(2)}<span></span>`;

  setText(els.meterCaption, caption);

  const normalized =
    value === null ? 0 : Math.min(value / 500, 1);

  const offset =
    circumference * (0.76 - normalized * 0.72);

  els.meter.style.strokeDashoffset = `${offset}`;
}

// --------------------------------------
// PRIVATE IP DETECTION
// --------------------------------------

function isPrivateIPv4(ip) {
  const parts = ip.split(".").map(Number);

  if (
    parts.length !== 4 ||
    parts.some(part =>
      !Number.isInteger(part) ||
      part < 0 ||
      part > 255
    )
  ) {
    return false;
  }

  const [a, b] = parts;

  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

async function loadPrivateIP() {
  setText(els.privateIP, "Checking…");

  const RTCPeer =
    window.RTCPeerConnection ||
    window.webkitRTCPeerConnection;

  if (!RTCPeer) {
    setText(els.privateIP, "Not available");
    return;
  }

  let pc;

  try {
    pc = new RTCPeer({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
      ]
    });

    pc.createDataChannel("pulse");

    const privateIPs = new Set();

    const findPrivateIP = (candidate) => {
      if (!candidate) return;

      const candidateText = candidate.candidate || "";

      if (!/\styp host(?:\s|$)/.test(candidateText)) {
        return;
      }

      const matches = candidateText.match(
        /(?:\d{1,3}\.){3}\d{1,3}/g
      );

      if (!matches) return;

      for (const ip of matches) {
        if (isPrivateIPv4(ip)) {
          privateIPs.add(ip);
        }
      }
    };

    const result = await new Promise(async (resolve) => {
      let completed = false;

      const finish = () => {
        if (completed) return;

        completed = true;

        resolve(
          privateIPs.size
            ? [...privateIPs][0]
            : null
        );
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          findPrivateIP(event.candidate);
        } else {
          finish();
        }
      };

      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === "complete") {
          finish();
        }
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
      } catch {
        finish();
      }

      setTimeout(finish, 3000);
    });

    setText(
      els.privateIP,
      result || "Not available"
    );

  } catch (error) {
    console.warn("Private IP detection:", error);
    setText(els.privateIP, "Not available");

  } finally {
    if (pc) {
      pc.close();
    }
  }
}

// --------------------------------------
// LOADED PING
// --------------------------------------

function getCombinedLoadedPing() {
  const values = [
    lastLoadedDownloadPing,
    lastLoadedUploadPing
  ].filter(value => value !== null);

  if (!values.length) return null;

  return values.reduce(
    (sum, value) => sum + value,
    0
  ) / values.length;
}

function getCombinedLoadedJitter() {
  const values = [
    lastLoadedDownloadJitter,
    lastLoadedUploadJitter
  ].filter(value => value !== null);

  if (!values.length) return null;

  return values.reduce(
    (sum, value) => sum + value,
    0
  ) / values.length;
}

// --------------------------------------
// CONNECTION QUALITY
// --------------------------------------

function updateConnectionQuality() {
  const loadedPing = getCombinedLoadedPing();
  const loadedJitter = getCombinedLoadedJitter();

  const unloadedPing = lastUnloadedPing;
  const jitter = lastJitter;

  if (
    unloadedPing === null ||
    loadedPing === null ||
    jitter === null
  ) {
    setText(els.quality, "Not tested");

    setText(
      els.qualityDescription,
      "Waiting for complete network measurements."
    );

    if (els.quality) {
      els.quality.className = "quality-name";
    }

    if (els.qualityIndicator) {
      els.qualityIndicator.className =
        "quality-indicator";
    }

    return;
  }

  // If loaded jitter is unavailable, do not invent a value.
  const effectiveJitter =
    loadedJitter === null
      ? jitter
      : Math.max(jitter, loadedJitter);

  let quality = "Poor";

  let description =
    "High latency or jitter detected.";

  if (
    unloadedPing <= 50 &&
    loadedPing <= 100 &&
    effectiveJitter <= 10
  ) {
    quality = "Excellent";

    description =
      "Very responsive connection. Great for gaming and video calls.";

  } else if (
    unloadedPing <= 100 &&
    loadedPing <= 200 &&
    effectiveJitter <= 30
  ) {
    quality = "Good";

    description =
      "Good connection for everyday browsing, streaming and calls.";
  }

  setText(els.quality, quality);
  setText(els.qualityDescription, description);

  if (els.quality) {
    els.quality.className =
      `quality-name quality-${quality.toLowerCase()}`;
  }

  if (els.qualityIndicator) {
    els.qualityIndicator.className =
      `quality-indicator quality-${quality.toLowerCase()}`;
  }
}

// --------------------------------------
// UPDATE SPEED TEST RESULTS
// --------------------------------------

function updateFromResults(results, finished = false) {
  if (!results) return;

  const down = getValue(
    () => results.getDownloadBandwidth()
  );

  const up = getValue(
    () => results.getUploadBandwidth()
  );

  const unloaded = getValue(
    () => results.getUnloadedLatency()
  );

  const jitter = getValue(
    () => results.getUnloadedJitter()
  );

  const loadedDownload = getValue(
    () => results.getDownLoadedLatency()
  );

  const loadedUpload = getValue(
    () => results.getUpLoadedLatency()
  );

  const loadedDownloadJitter = getValue(
    () => results.getDownLoadedJitter()
  );

  const loadedUploadJitter = getValue(
    () => results.getUpLoadedJitter()
  );

  if (down !== null) {
    lastDownload = down;

    if (els.download) {
      els.download.innerHTML =
        `${formatMbps(down)} <em>Mbps</em>`;
    }
  }

  if (up !== null) {
    lastUpload = up;

    if (els.upload) {
      els.upload.innerHTML =
        `${formatMbps(up)} <em>Mbps</em>`;
    }
  }

  if (unloaded !== null) {
    lastUnloadedPing = unloaded;

    if (els.ping) {
      els.ping.innerHTML =
        `${formatMs(unloaded)}<small> ms</small>`;
    }
  }

  if (jitter !== null) {
    lastJitter = jitter;

    if (els.jitter) {
      els.jitter.innerHTML =
        `${formatMs(jitter)}<small> ms</small>`;
    }
  }

  if (loadedDownload !== null) {
    lastLoadedDownloadPing = loadedDownload;

    setText(
      els.loadedDownload,
      `${formatMs(loadedDownload)} ms`
    );
  }

  if (loadedUpload !== null) {
    lastLoadedUploadPing = loadedUpload;

    setText(
      els.loadedUpload,
      `${formatMs(loadedUpload)} ms`
    );
  }

  if (loadedDownloadJitter !== null) {
    lastLoadedDownloadJitter = loadedDownloadJitter;
  }

  if (loadedUploadJitter !== null) {
    lastLoadedUploadJitter = loadedUploadJitter;
  }

  const loadedPing = getCombinedLoadedPing();

  if (loadedPing !== null) {
    setText(
      els.loadedPing,
      `${formatMs(loadedPing)} ms`
    );
  }

  updateConnectionQuality();

  // Main meter always displays Download Speed.
  if (lastDownload !== null) {
    setMeter(
      lastDownload / 1_000_000,
      "DOWNLOAD",
      finished
        ? "Final measured download"
        : phase === "UPLOAD"
          ? "Download speed · Upload test running"
          : "Measuring download speed"
    );
  }

  if (down !== null || up !== null) {
    chartValues.push({
      down: down !== null ? down / 1_000_000 : 0,
      up: up !== null ? up / 1_000_000 : 0
    });

    if (chartValues.length > 45) {
      chartValues.shift();
    }

    drawChart();
  }
}

// --------------------------------------
// LIVE CHART
// --------------------------------------

function drawChart() {
  const canvas = els.chart;

  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();

  if (!rect.width) return;

  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(118 * dpr);

  const ctx = canvas.getContext("2d");

  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const w = rect.width;
  const h = 118;
  const pad = 8;

  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(145,163,195,.12)";
  ctx.lineWidth = 1;

  for (let i = 1; i <= 3; i++) {
    const y = (h - pad * 2) * i / 4 + pad;

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  if (chartValues.length < 2) return;

  const max = Math.max(
    10,
    ...chartValues.flatMap(v => [v.down, v.up])
  ) * 1.15;

  const drawLine = (key, color) => {
    ctx.beginPath();

    chartValues.forEach((v, i) => {
      const x =
        pad + (w - pad * 2) * i /
        (chartValues.length - 1);

      const y =
        h - pad -
        (Math.min(v[key], max) / max) *
        (h - pad * 2);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  };

  drawLine("down", "#54ddf4");
  drawLine("up", "#8c8aff");
}

// --------------------------------------
// HISTORY
// --------------------------------------

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function loadHistory() {
  if (!els.history) return;

  let history = [];

  try {
    history = JSON.parse(
      localStorage.getItem("pulse-history") || "[]"
    );

    if (!Array.isArray(history)) {
      history = [];
    }
  } catch {
    history = [];
  }

  if (!history.length) {
    els.history.innerHTML = `
      <div class="empty-history">
        Your completed tests will appear here.
      </div>
    `;

    return;
  }

  els.history.innerHTML = history.slice(0, 6).map(item => `
    <div class="history-item">
      <span class="history-date">
        ${escapeHtml(item.date)}
      </span>

      <span class="history-metric">
        <b>↓ ${escapeHtml(item.down)}</b>
        <small>Mbps</small>
      </span>

      <span class="history-metric">
        <b>↑ ${escapeHtml(item.up)}</b>
        <small>Mbps</small>
      </span>

      <span class="history-ping">
        ${escapeHtml(item.ping)} ms ping
      </span>
    </div>
  `).join("");
}

function saveHistory(item) {
  let history = [];

  try {
    history = JSON.parse(
      localStorage.getItem("pulse-history") || "[]"
    );

    if (!Array.isArray(history)) {
      history = [];
    }
  } catch {
    history = [];
  }

  history.unshift(item);

  localStorage.setItem(
    "pulse-history",
    JSON.stringify(history.slice(0, 6))
  );

  loadHistory();
}

// --------------------------------------
// PUBLIC IP / ISP / LOCATION
// --------------------------------------

async function loadNetworkInfo() {
  const CACHE_KEY = "pulse-network-info";
  const CACHE_TIME = 30 * 60 * 1000;

  try {
    const cached = JSON.parse(
      localStorage.getItem(CACHE_KEY) || "null"
    );

    if (
      cached &&
      cached.data &&
      Date.now() - cached.time < CACHE_TIME
    ) {
      displayNetworkInfo(cached.data);
      return;
    }
  } catch {}

  try {
    const response = await fetch(
      "https://ipinfo.io/json",
      {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        `IPinfo API Error: ${response.status}`
      );
    }

    const data = await response.json();

    if (!data.ip) {
      throw new Error("IP address not found");
    }

    const networkInfo = {
      ip: data.ip,
      isp: data.org || "Unavailable",
      city: data.city || "",
      region: data.region || "",
      country: data.country || ""
    };

    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          time: Date.now(),
          data: networkInfo
        })
      );
    } catch {}

    displayNetworkInfo(networkInfo);

  } catch (error) {
    console.error("Network information error:", error);

    setText(els.ip, "Unavailable");
    setText(els.isp, "Unavailable");
    setText(els.location, "Unavailable");
  }
}

function displayNetworkInfo(data) {
  setText(els.ip, data.ip || "Unavailable");
  setText(els.isp, data.isp || "Unavailable");

  setText(
    els.location,
    [
      data.city,
      data.region,
      data.country
    ].filter(Boolean).join(", ") || "Unavailable"
  );
}

// --------------------------------------
// RESET METRICS
// --------------------------------------

function resetNewMetrics() {
  lastUnloadedPing = null;
  lastLoadedDownloadPing = null;
  lastLoadedUploadPing = null;
  lastJitter = null;

  lastLoadedDownloadJitter = null;
  lastLoadedUploadJitter = null;

  lastAimScores = null;

  setText(els.loadedPing, "— ms");
  setText(els.loadedDownload, "— ms");
  setText(els.loadedUpload, "— ms");

  setText(els.quality, "Not tested");

  setText(
    els.qualityDescription,
    "Waiting for network measurements."
  );

  if (els.quality) {
    els.quality.className = "quality-name";
  }

  if (els.qualityIndicator) {
    els.qualityIndicator.className =
      "quality-indicator";
  }
}

// --------------------------------------
// START SPEED TEST
// --------------------------------------

function startTest() {
  if (active) return;

  if (!navigator.onLine) {
    showToast("You are offline. Check your internet connection.");
    return;
  }

  active = true;
  phase = "DOWNLOAD";

  chartValues = [];

  lastDownload = null;
  lastUpload = null;

  resetNewMetrics();
  drawChart();

  if (els.download) {
    els.download.innerHTML = "— <em>Mbps</em>";
  }

  if (els.upload) {
    els.upload.innerHTML = "— <em>Mbps</em>";
  }

  if (els.ping) {
    els.ping.innerHTML = "—<small> ms</small>";
  }

  if (els.jitter) {
    els.jitter.innerHTML = "—<small> ms</small>";
  }

  setText(
    els.state,
    "Connecting to measurement network…"
  );

  els.live?.classList.add("visible");

  if (els.button) {
    els.button.disabled = true;
  }

  setText(els.buttonLabel, "Testing connection…");

  const buttonIcon = els.button?.querySelector(".button-icon");

  if (buttonIcon) {
    buttonIcon.textContent = "◌";
  }

  setMeter(
    null,
    "DOWNLOAD",
    "Measuring your connection"
  );

  try {
    engine = new SpeedTest({
      autoStart: false,
      measureDownloadLoadedLatency: true,
      measureUploadLoadedLatency: true
    });

    engine.onRunningChange = (running) => {
      if (running) {
        setText(
          els.state,
          "Measuring real network traffic"
        );
      }
    };

    engine.onResultsChange = (change) => {
      if (change?.type === "upload") {
        phase = "UPLOAD";
      }

      if (
        change?.type === "download" &&
        phase !== "UPLOAD"
      ) {
        phase = "DOWNLOAD";
      }

      updateFromResults(engine.results);
    };

    engine.onError = (error, status) => {
      console.warn(
        "Measurement warning:",
        error,
        status
      );

      showToast(
        "A measurement request failed. Available real results will still be shown."
      );
    };

    engine.onFinish = (results) => {
      active = false;

      updateFromResults(results, true);

      // AIM scores are only available after completion.
      lastAimScores = getScores(results);

      if (lastAimScores !== null) {
        console.log("Cloudflare AIM Scores:", lastAimScores);
      }

      setText(els.state, "Test completed");

      els.live?.classList.remove("visible");

      if (els.button) {
        els.button.disabled = false;
      }

      setText(els.buttonLabel, "Run test again");

      if (buttonIcon) {
        buttonIcon.textContent = "↻";
      }

      const down = getValue(
        () => results.getDownloadBandwidth()
      );

      const up = getValue(
        () => results.getUploadBandwidth()
      );

      const ping = getValue(
        () => results.getUnloadedLatency()
      );

      if (down !== null || up !== null) {
        saveHistory({
          date: new Date().toLocaleString(),
          down: down === null ? "N/A" : formatMbps(down),
          up: up === null ? "N/A" : formatMbps(up),
          ping: ping === null ? "N/A" : formatMs(ping)
        });

        setText(
          els.meterCaption,
          "Test complete · real measurement"
        );

      } else {
        setText(
          els.state,
          "No usable measurement received"
        );

        setText(
          els.meterCaption,
          "Could not measure a valid result"
        );

        showToast(
          "No valid speed result was returned. Check your connection and try again."
        );
      }
    };

    engine.play();

  } catch (error) {
    console.error(error);

    active = false;

    setText(els.state, "Could not start test");

    els.live?.classList.remove("visible");

    if (els.button) {
      els.button.disabled = false;
    }

    setText(els.buttonLabel, "Try again");

    showToast(
      "Could not start the speed test. Refresh the page and try again."
    );
  }
}

// --------------------------------------
// EVENT LISTENERS
// --------------------------------------

els.button?.addEventListener("click", startTest);

$("clear-history")?.addEventListener("click", () => {
  localStorage.removeItem("pulse-history");
  loadHistory();
});

window.addEventListener("resize", drawChart);

window.addEventListener("online", () => {
  setText(els.status, "Internet connected");

  els.status?.previousElementSibling
    ?.classList.remove("offline");
});

window.addEventListener("offline", () => {
  setText(els.status, "Offline");

  els.status?.previousElementSibling
    ?.classList.add("offline");
});

// --------------------------------------
// INITIALIZE
// --------------------------------------

setText(
  els.status,
  navigator.onLine
    ? "Internet connected"
    : "Offline"
);

if (!navigator.onLine) {
  els.status?.previousElementSibling
    ?.classList.add("offline");
}

loadHistory();
loadNetworkInfo();
loadPrivateIP();
drawChart();
