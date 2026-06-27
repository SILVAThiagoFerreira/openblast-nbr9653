const state = {
  events: []
};

const COLORS = {
  ink: "#38424b",
  muted: "#6c7680",
  grid: "#e3e6ea",
  axis: "#38424b",
  red: "#e20613",
  orange: "#c26a00",
  blue: "#1f4ab8",
  green: "#22c55e"
};

const COMPONENTS = [
  { key: "tran", label: "Transversal", color: COLORS.red, shape: "square" },
  { key: "long", label: "Longitudinal", color: COLORS.blue, shape: "diamond" },
  { key: "vert", label: "Vertical", color: COLORS.green, shape: "triangle" }
];

const sampleCsv = `"EventType","Full Waveform"
"SampleRate","1024 sps"
"Channel","Tran"
"Channel","Vert"
"Channel","Long"
"Channel","Mic"
"Units","mm/s and pa"
"EventTime","11:56:39"
"EventDate","2026-06-10"
"TitleString1","COMUNIDADE DE LAGOA DO MEL"
"SerialNumber","UM22299"
"Calibration","February 11, 2026 by VMA LTDA"
"GpsDistance","1450.5 m"
"TranPPV","0.662 mm/s"
"VertPPV","0.567 mm/s"
"LongPPV","0.465 mm/s"
"TranZCFreq","23.3 Hz"
"VertZCFreq","32.0 Hz"
"LongZCFreq","28.4 Hz"
"PeakVectorSum","0.668 mm/s"
"Microphone","ISEE Linear Microphone"
"MicPSPL","114.6 dB(L)"
"MicZCFreq","5.8 Hz"
"Tran","Vert","Long","MicL"
"0.000","0.000","-0.016","0.03"
"0.024","0.008","-0.008","0.08"
"-0.008","-0.008","-0.008","0.06"`;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const fileInput = $("#fileInput");
const dropzone = $("#dropzone");

fileInput.addEventListener("change", async (event) => {
  await handleFiles([...event.target.files]);
});

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("dragover");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragover");
});

dropzone.addEventListener("drop", async (event) => {
  event.preventDefault();
  dropzone.classList.remove("dragover");
  const files = [...event.dataTransfer.files].filter((file) => file.name.toLowerCase().endsWith(".csv"));
  await handleFiles(files);
});

$("#loadSampleBtn").addEventListener("click", () => {
  const event = parseSismogramCsv(sampleCsv, "exemplo-minimo.csv");
  state.events = [event];
  renderAll();
});

$("#clearBtn").addEventListener("click", () => {
  state.events = [];
  fileInput.value = "";
  renderAll();
});

$("#exportPdfBtn").addEventListener("click", exportExecutiveReportPdf);
$("#exportSummaryBtn").addEventListener("click", exportSummaryCsv);

["reportTitle", "pressureMaxDistance", "pressureLimit", "vibrationMaxY"].forEach((id) => {
  $("#" + id).addEventListener("input", renderAll);
});

document.addEventListener("click", (event) => {
  const svgTarget = event.target.getAttribute("data-download-svg");
  const pngTarget = event.target.getAttribute("data-download-png");

  if (svgTarget) {
    downloadSvg(svgTarget, `${svgTarget}.svg`);
  }

  if (pngTarget) {
    downloadPng(pngTarget, `${pngTarget}.png`);
  }
});

async function handleFiles(files) {
  if (!files.length) return;

  setStatus(`Lendo ${files.length} arquivo(s)...`);
  const parsed = [];
  const errors = [];

  for (const file of files) {
    try {
      const text = await file.text();
      parsed.push(parseSismogramCsv(text, file.name));
    } catch (error) {
      errors.push(`${file.name}: ${error.message}`);
    }
  }

  state.events = parsed;
  renderAll();

  if (errors.length) {
    setStatus(`Alguns arquivos não foram lidos:<br>${errors.map(escapeHtml).join("<br>")}`, true);
  } else {
    setStatus(`${parsed.length} arquivo(s) carregado(s) com sucesso.`);
  }
}

function parseSismogramCsv(text, fileName) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const meta = {};
  let dataStartIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const cells = parseCsvLine(lines[i]);
    const first = normalizeKey(cells[0]);

    if (cells.length >= 4 && first === "tran" && normalizeKey(cells[1]) === "vert" && normalizeKey(cells[2]) === "long") {
      dataStartIndex = i + 1;
      break;
    }

    if (cells.length >= 2) {
      meta[cells[0]] = cells[1];
    }
  }

  const event = {
    fileName,
    location: getMeta(meta, "TitleString1") || getMeta(meta, "Location") || fileName.replace(/\.csv$/i, ""),
    client: getMeta(meta, "TitleString2"),
    company: getMeta(meta, "TitleString3"),
    eventDate: getMeta(meta, "EventDate"),
    eventTime: getMeta(meta, "EventTime"),
    serialNumber: getMeta(meta, "SerialNumber"),
    calibration: getMeta(meta, "Calibration"),
    sampleRate: numberFromText(getMeta(meta, "SampleRate")),
    distance: numberFromText(getMeta(meta, "GpsDistance")) || numberFromScaledDistance(getMeta(meta, "ScaledDistance")),
    tranPpv: numberFromText(getMeta(meta, "TranPPV")),
    vertPpv: numberFromText(getMeta(meta, "VertPPV")),
    longPpv: numberFromText(getMeta(meta, "LongPPV")),
    tranFreq: numberFromText(getMeta(meta, "TranZCFreq")),
    vertFreq: numberFromText(getMeta(meta, "VertZCFreq")),
    longFreq: numberFromText(getMeta(meta, "LongZCFreq")),
    pvs: numberFromText(getMeta(meta, "PeakVectorSum")),
    pspl: numberFromText(getMeta(meta, "MicPSPL")),
    micFreq: numberFromText(getMeta(meta, "MicZCFreq")),
    meta
  };

  if (hasMissingCoreValues(event) && dataStartIndex > 0) {
    enrichFromWaveform(event, lines, dataStartIndex);
  }

  event.components = [
    { axis: "Tran", label: "Transversal", ppv: event.tranPpv, freq: event.tranFreq, color: COLORS.red, shape: "square" },
    { axis: "Vert", label: "Vertical", ppv: event.vertPpv, freq: event.vertFreq, color: COLORS.green, shape: "triangle" },
    { axis: "Long", label: "Longitudinal", ppv: event.longPpv, freq: event.longFreq, color: COLORS.blue, shape: "diamond" }
  ].filter((component) => isFiniteNumber(component.ppv) && isFiniteNumber(component.freq));

  event.pressureStatus = getPressureStatus(event);
  event.vibrationStatus = getVibrationStatus(event);
  event.overallStatus = getOverallStatus(event);

  return event;
}

function parseCsvLine(line) {
  const out = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      out.push(value.trim());
      value = "";
    } else {
      value += char;
    }
  }

  out.push(value.trim());
  return out;
}

function normalizeKey(value) {
  return String(value || "").replace(/^"|"$/g, "").trim().toLowerCase();
}

function getMeta(meta, key) {
  return meta[key] || meta[key.toLowerCase()] || "";
}

function numberFromText(value) {
  if (value === null || value === undefined) return NaN;
  const match = String(value).replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function numberFromScaledDistance(value) {
  if (!value) return NaN;
  const inside = String(value).match(/\(([^)]*)\)/);
  if (!inside) return NaN;
  const distanceMatch = inside[1].replace(",", ".").match(/-?\d+(?:\.\d+)?\s*m/i);
  return distanceMatch ? Number(distanceMatch[0].replace(/[^\d.-]/g, "")) : NaN;
}

function hasMissingCoreValues(event) {
  return [
    event.tranPpv,
    event.vertPpv,
    event.longPpv,
    event.pvs,
    event.pspl
  ].some((value) => !isFiniteNumber(value));
}

function enrichFromWaveform(event, lines, dataStartIndex) {
  const max = { tran: 0, vert: 0, long: 0, mic: 0 };

  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;

    const cells = parseCsvLine(line);
    const tran = Math.abs(Number(cells[0]));
    const vert = Math.abs(Number(cells[1]));
    const long = Math.abs(Number(cells[2]));
    const mic = Math.abs(Number(cells[3]));

    if (Number.isFinite(tran)) max.tran = Math.max(max.tran, tran);
    if (Number.isFinite(vert)) max.vert = Math.max(max.vert, vert);
    if (Number.isFinite(long)) max.long = Math.max(max.long, long);
    if (Number.isFinite(mic)) max.mic = Math.max(max.mic, mic);
  }

  if (!isFiniteNumber(event.tranPpv)) event.tranPpv = max.tran;
  if (!isFiniteNumber(event.vertPpv)) event.vertPpv = max.vert;
  if (!isFiniteNumber(event.longPpv)) event.longPpv = max.long;
  if (!isFiniteNumber(event.pvs)) event.pvs = Math.sqrt(max.tran ** 2 + max.vert ** 2 + max.long ** 2);
  if (!isFiniteNumber(event.pspl) && max.mic > 0) event.pspl = 20 * Math.log10(max.mic / 0.00002);
}

function isFiniteNumber(value) {
  return Number.isFinite(value) && !Number.isNaN(value);
}

function getPressureLimit() {
  return Number($("#pressureLimit").value) || 134;
}

function getVibrationMaxY() {
  return Number($("#vibrationMaxY").value) || 60;
}

function getPressureStatus(event) {
  if (!isFiniteNumber(event.pspl)) return { label: "Verificar PSPL", severity: "check" };
  return event.pspl <= getPressureLimit()
    ? { label: "Conforme pressão", severity: "ok" }
    : { label: "Acima pressão", severity: "alert" };
}

function getVibrationLimit(freq) {
  if (!isFiniteNumber(freq)) return NaN;

  if (freq <= 4) return 15;
  if (freq <= 15) return interpolate(freq, 4, 15, 15, 20);
  if (freq <= 40) return interpolate(freq, 15, 40, 20, 50);
  return 50;
}

function getVibrationStatus(event) {
  const components = event.components || [];
  if (!components.length) return { label: "Verificar PPV/Hz", severity: "check" };

  const over = components.some((component) => component.ppv > getVibrationLimit(component.freq));

  return over
    ? { label: "Acima vibração", severity: "alert" }
    : { label: "Conforme vibração", severity: "ok" };
}

function getOverallStatus(event) {
  const pressure = getPressureStatus(event);
  const vibration = getVibrationStatus(event);
  if (pressure.severity === "alert" || vibration.severity === "alert") return { label: "Acima do limite", severity: "alert" };
  if (pressure.severity === "check" || vibration.severity === "check") return { label: "Verificar dados", severity: "check" };
  return { label: "Conforme", severity: "ok" };
}

function interpolate(x, x1, x2, y1, y2) {
  return y1 + ((x - x1) * (y2 - y1)) / (x2 - x1);
}

function renderAll() {
  state.events.forEach((event) => {
    event.pressureStatus = getPressureStatus(event);
    event.vibrationStatus = getVibrationStatus(event);
    event.overallStatus = getOverallStatus(event);
  });

  renderKpis();
  renderTable();

  if (!state.events.length) {
    setEmptyChart("pressureChart", "Suba os arquivos CSV para gerar o gráfico de pressão sonora.");
    setEmptyChart("vibrationNormChart", "Suba os arquivos CSV para gerar o gráfico normativo.");
    setEmptyChart("vibrationZeroChart", "Suba os arquivos CSV para gerar o gráfico personalizado.");
    return;
  }

  drawPressureChart(state.events);
  drawVibrationNormChart(state.events);
  drawVibrationZeroChart(state.events);
}

function renderKpis() {
  const grid = $("#kpiGrid");

  if (!state.events.length) {
    grid.hidden = true;
    return;
  }

  grid.hidden = false;
  const components = state.events.flatMap((event) => event.components || []);
  const maxPpv = Math.max(...components.map((component) => component.ppv).filter(isFiniteNumber), 0);
  const maxPspl = Math.max(...state.events.map((event) => event.pspl).filter(isFiniteNumber), 0);
  const hasAlert = state.events.some((event) => event.overallStatus.severity === "alert");
  const hasCheck = state.events.some((event) => event.overallStatus.severity === "check");

  $("#kpiFiles").textContent = state.events.length;
  $("#kpiPPV").textContent = `${formatNumber(maxPpv, 3)} mm/s`;
  $("#kpiPSPL").textContent = `${formatNumber(maxPspl, 1)} dB`;
  $("#kpiStatus").textContent = hasAlert ? "Acima do limite" : hasCheck ? "Verificar" : "Conforme";
  $("#kpiStatus").className = hasAlert ? "status-alert" : hasCheck ? "status-check" : "status-ok";
}

function renderTable() {
  const tbody = $("#summaryTable tbody");
  tbody.innerHTML = "";

  if (!state.events.length) {
    tbody.innerHTML = `<tr><td colspan="12" class="muted-row">Nenhum CSV carregado.</td></tr>`;
    return;
  }

  for (const event of state.events) {
    const statusClass = `status-${event.overallStatus.severity}`;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td title="${escapeAttr(event.fileName)}">${escapeHtml(truncate(event.fileName, 38))}</td>
      <td>${escapeHtml(event.location || "-")}</td>
      <td>${escapeHtml(event.eventDate || "-")}</td>
      <td>${escapeHtml(event.eventTime || "-")}</td>
      <td>${formatNullable(event.distance, 1)}</td>
      <td>${escapeHtml(event.serialNumber || "-")}</td>
      <td>${formatPair(event.tranPpv, event.tranFreq)}</td>
      <td>${formatPair(event.vertPpv, event.vertFreq)}</td>
      <td>${formatPair(event.longPpv, event.longFreq)}</td>
      <td>${formatNullable(event.pspl, 1)}</td>
      <td>${formatNullable(event.pvs, 3)}</td>
      <td class="${statusClass}">${escapeHtml(event.overallStatus.label)}</td>
    `;
    tbody.appendChild(row);
  }
}

function setEmptyChart(id, message) {
  const target = $("#" + id);
  target.className = "chart-shell empty-state";
  target.textContent = message;
}

function setStatus(message, isError = false) {
  const panel = $("#statusPanel");
  panel.hidden = false;
  panel.innerHTML = message;
  panel.style.borderColor = isError ? "rgba(226, 6, 19, 0.35)" : "";
}

function drawPressureChart(events) {
  const title = `Pressão Sonora em ${$("#reportTitle").value || "Eventos Sismográficos"} - ABNT NBR 9653:2018`;
  const limit = getPressureLimit();
  const configuredMax = Number($("#pressureMaxDistance").value) || 6000;
  const maxDistance = Math.max(configuredMax, ...events.map((event) => event.distance || 0)) * 1.02;
  const yMax = Math.max(160, limit + 20, ...events.map((event) => event.pspl || 0).map((v) => Math.ceil((v + 10) / 20) * 20));

  const chart = chartBase({ title, yLabel: "Pressão Acústica (dB)", xLabel: "Distância (m)", width: 1180, height: 610 });
  const { svg, plot, sxLinear, syLinear } = chart;
  const sx = sxLinear(0, maxDistance);
  const sy = syLinear(0, yMax);

  addGridLinear(svg, plot, sx, sy, {
    xTicks: niceTicks(0, maxDistance, 6),
    yTicks: niceTicks(0, yMax, 8),
    xFormat: (value) => Math.round(value).toString(),
    yFormat: (value) => Math.round(value).toString()
  });

  const limitY = sy(limit);
  svg.appendChild(line(sx(0), limitY, sx(maxDistance), limitY, { stroke: COLORS.axis, width: 4 }));
  addText(svg, sx(0) - 8, limitY + 5, String(limit), { anchor: "end", size: 13 });
  addText(svg, sx(maxDistance) + 8, limitY + 5, String(limit), { anchor: "start", size: 13, boxed: true });

  for (const event of events) {
    if (!isFiniteNumber(event.distance) || !isFiniteNumber(event.pspl)) continue;
    const x = sx(event.distance);
    const y = sy(event.pspl);
    svg.appendChild(circle(x, y, 6, COLORS.red));
  }

  drawCollisionAwareLabels(
    svg,
    events
      .filter((event) => isFiniteNumber(event.distance) && isFiniteNumber(event.pspl))
      .map((event) => ({
        x: sx(event.distance),
        y: sy(event.pspl),
        text: formatNumber(event.pspl, 1),
        size: 13,
        fill: COLORS.ink,
        weight: 600,
        type: "pressure"
      })),
    plot,
    "pressure"
  );

  addLegend(svg, plot.right + 30, plot.top + 180, [
    { type: "line", label: `Limite de ${limit} dB`, color: COLORS.axis },
    { type: "circle", label: "Pressão Sonora (dB)", color: COLORS.red }
  ]);

  mountChart("pressureChart", svg);
}

function drawVibrationNormChart(events) {
  const title = `Vibração em ${$("#reportTitle").value || "Eventos Sismográficos"} - ABNT NBR 9653:2018`;
  const xMin = 1;
  const xMax = 1000;
  const yMax = getVibrationMaxY();

  const chart = chartBase({ title, yLabel: "PPV (mm/s)", xLabel: "Frequência (Hz)", width: 1180, height: 610 });
  const { svg, plot, syLinear } = chart;
  const sx = sxLog(xMin, xMax, plot);
  const sy = syLinear(0, yMax);

  addGridLog(svg, plot, sx, sy, {
    xMajor: [1, 4, 10, 15, 40, 100, 1000],
    yTicks: niceTicks(0, yMax, 6)
  });

  addNormGuides(svg, sx, sy, plot, xMax);
  addVibrationPoints(svg, events, sx, sy, plot);

  addLegend(svg, plot.right + 28, plot.top + 200, [
    { type: "square", label: "Transversal (mm/s)", color: COLORS.red },
    { type: "diamond", label: "Longitudinal (mm/s)", color: COLORS.blue },
    { type: "triangle", label: "Vertical (mm/s)", color: COLORS.green }
  ]);

  mountChart("vibrationNormChart", svg);
}

function drawVibrationZeroChart(events) {
  const title = `Vibração Personalizada em ${$("#reportTitle").value || "Eventos Sismográficos"} - Eixos partindo de zero`;
  const maxFreq = Math.max(60, ...events.flatMap((event) => (event.components || []).map((component) => component.freq || 0)));
  const xMax = Math.ceil((maxFreq * 1.25) / 10) * 10;
  const yMax = getVibrationMaxY();

  const chart = chartBase({ title, yLabel: "PPV (mm/s)", xLabel: "Frequência (Hz)", width: 1180, height: 610 });
  const { svg, plot, sxLinear, syLinear } = chart;
  const sx = sxLinear(0, xMax);
  const sy = syLinear(0, yMax);

  addGridLinear(svg, plot, sx, sy, {
    xTicks: niceTicks(0, xMax, 8),
    yTicks: niceTicks(0, yMax, 6),
    xFormat: (value) => Math.round(value).toString(),
    yFormat: (value) => Math.round(value).toString()
  });

  addNormGuides(svg, sx, sy, plot, xMax);
  addVibrationPoints(svg, events, sx, sy, plot);

  addLegend(svg, plot.right + 28, plot.top + 200, [
    { type: "square", label: "Transversal (mm/s)", color: COLORS.red },
    { type: "diamond", label: "Longitudinal (mm/s)", color: COLORS.blue },
    { type: "triangle", label: "Vertical (mm/s)", color: COLORS.green }
  ]);

  mountChart("vibrationZeroChart", svg);
}

function chartBase({ title, yLabel, xLabel, width, height }) {
  const svg = createSvg(width, height);
  const plot = {
    left: 92,
    right: width - 260,
    top: 78,
    bottom: height - 82
  };

  addText(svg, width / 2, 34, title, { anchor: "middle", size: 18, fill: COLORS.muted, weight: 500 });
  addText(svg, (plot.left + plot.right) / 2, height - 24, xLabel, { anchor: "middle", size: 13, fill: COLORS.muted });
  addRotatedText(svg, 24, (plot.top + plot.bottom) / 2, yLabel);

  svg.appendChild(line(plot.left, plot.bottom, plot.right, plot.bottom, { stroke: COLORS.axis, width: 1.2 }));
  svg.appendChild(line(plot.left, plot.top, plot.left, plot.bottom, { stroke: COLORS.axis, width: 1.2 }));

  return {
    svg,
    plot,
    sxLinear: (xMin, xMax) => (value) => plot.left + ((value - xMin) / (xMax - xMin)) * (plot.right - plot.left),
    syLinear: (yMin, yMax) => (value) => plot.bottom - ((value - yMin) / (yMax - yMin)) * (plot.bottom - plot.top)
  };
}

function addGridLinear(svg, plot, sx, sy, { xTicks, yTicks, xFormat, yFormat }) {
  for (const tick of xTicks) {
    const x = sx(tick);
    svg.appendChild(line(x, plot.top, x, plot.bottom, { stroke: COLORS.grid, width: 1 }));
    addText(svg, x, plot.bottom + 24, xFormat(tick), { anchor: "middle", size: 12, fill: COLORS.muted });
  }

  for (const tick of yTicks) {
    const y = sy(tick);
    svg.appendChild(line(plot.left, y, plot.right, y, { stroke: COLORS.grid, width: 1 }));
    addText(svg, plot.left - 12, y + 4, yFormat(tick), { anchor: "end", size: 12, fill: COLORS.muted });
  }
}

function addGridLog(svg, plot, sx, sy, { xMajor, yTicks }) {
  const minorTicks = [];
  for (const decade of [1, 10, 100]) {
    for (let n = 1; n < 10; n++) {
      const value = decade * n;
      if (value >= 1 && value <= 1000) minorTicks.push(value);
    }
  }

  for (const tick of minorTicks) {
    const x = sx(tick);
    const isMajor = xMajor.includes(tick);
    svg.appendChild(line(x, plot.top, x, plot.bottom, {
      stroke: isMajor ? "#aeb4bd" : COLORS.grid,
      width: isMajor ? 1.15 : 0.75
    }));
  }

  for (const tick of xMajor) {
    const x = sx(tick);
    addText(svg, x, plot.bottom + 24, String(tick), {
      anchor: "middle",
      size: tick === 15 || tick === 40 || tick === 4 ? 12 : 12,
      fill: tick === 15 || tick === 40 || tick === 4 ? COLORS.red : COLORS.muted,
      weight: tick === 15 || tick === 40 || tick === 4 ? 760 : 400
    });
  }

  for (const tick of yTicks) {
    const y = sy(tick);
    svg.appendChild(line(plot.left, y, plot.right, y, { stroke: COLORS.grid, width: 1 }));
    addText(svg, plot.left - 12, y + 4, String(Math.round(tick)), { anchor: "end", size: 12, fill: COLORS.muted });
  }

  for (const value of [15]) {
    if (value <= yTicks[yTicks.length - 1]) {
      const y = sy(value);
      addText(svg, plot.left - 12, y + 4, String(value), { anchor: "end", size: 12, fill: COLORS.red, weight: 760 });
    }
  }
}

function addNormGuides(svg, sx, sy, plot, xMax) {
  const curve = [
    [4, 15],
    [15, 20],
    [40, 50],
    [xMax, 50]
  ].filter(([x]) => x <= xMax);

  if (xMax > 40 && !curve.some(([x]) => x === xMax)) {
    curve.push([xMax, 50]);
  }

  const path = curve.map(([x, y], index) => `${index ? "L" : "M"} ${sx(x)} ${sy(y)}`).join(" ");
  svg.appendChild(pathEl(path, { stroke: COLORS.axis, width: 4, fill: "none" }));

  const guides = [
    { x: 4, y: 15 },
    { x: 15, y: 20 },
    { x: 40, y: 50 }
  ].filter((guide) => guide.x <= xMax);

  for (const guide of guides) {
    svg.appendChild(line(sx(guide.x), sy(0), sx(guide.x), sy(guide.y), { stroke: COLORS.red, width: 2, dash: "9 8" }));
    svg.appendChild(line(plot.left, sy(guide.y), sx(guide.x), sy(guide.y), { stroke: COLORS.red, width: 2, dash: "9 8" }));
  }
}

function addVibrationPoints(svg, events, sx, sy, plot) {
  const jitter = { Tran: -4, Long: 0, Vert: 4 };
  const labels = [];

  for (const event of events) {
    const visibleComponents = (event.components || []).filter((component) => isFiniteNumber(component.ppv) && isFiniteNumber(component.freq));
    const primaryComponent = visibleComponents.reduce((best, component) => {
      if (!best) return component;
      return component.ppv > best.ppv ? component : best;
    }, null);

    for (const component of event.components || []) {
      const x = sx(component.freq);
      const y = sy(component.ppv) + (jitter[component.axis] || 0);
      addMarker(svg, x, y, component.shape, component.color, 7);
      if (primaryComponent && component.axis === primaryComponent.axis) {
        labels.push({
          x,
          y,
          text: formatNumber(component.ppv, 2),
          size: 11,
          fill: COLORS.ink,
          weight: 600,
          type: "vibration",
          axis: component.axis,
          color: component.color
        });
      }
    }
  }

  drawCompactLabels(svg, labels, plot);
}

function sxLog(xMin, xMax, plot) {
  const min = Math.log10(xMin);
  const max = Math.log10(xMax);
  return (value) => {
    const safeValue = Math.max(value, xMin);
    return plot.left + ((Math.log10(safeValue) - min) / (max - min)) * (plot.right - plot.left);
  };
}

function niceTicks(min, max, count) {
  const span = max - min;
  const raw = span / Math.max(count, 1);
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const steps = [1, 2, 5, 10].map((step) => step * power);
  const step = steps.find((candidate) => raw <= candidate) || steps[steps.length - 1];
  const ticks = [];
  const start = Math.ceil(min / step) * step;

  for (let value = start; value <= max + step * 0.4; value += step) {
    ticks.push(Number(value.toFixed(10)));
  }

  if (!ticks.includes(min)) ticks.unshift(min);
  return ticks;
}

function mountChart(id, svg) {
  const target = $("#" + id);
  target.className = "chart-shell";
  target.innerHTML = "";
  target.appendChild(svg);
}

function createSvg(width, height) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const bg = document.createElementNS(svg.namespaceURI, "rect");
  bg.setAttribute("x", 0);
  bg.setAttribute("y", 0);
  bg.setAttribute("width", width);
  bg.setAttribute("height", height);
  bg.setAttribute("fill", "#ffffff");
  svg.appendChild(bg);

  return svg;
}

function line(x1, y1, x2, y2, options = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "line");
  el.setAttribute("x1", x1);
  el.setAttribute("y1", y1);
  el.setAttribute("x2", x2);
  el.setAttribute("y2", y2);
  el.setAttribute("stroke", options.stroke || COLORS.axis);
  el.setAttribute("stroke-width", options.width || 1);
  if (options.dash) el.setAttribute("stroke-dasharray", options.dash);
  return el;
}

function pathEl(d, options = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
  el.setAttribute("d", d);
  el.setAttribute("stroke", options.stroke || COLORS.axis);
  el.setAttribute("stroke-width", options.width || 1);
  el.setAttribute("fill", options.fill || "none");
  el.setAttribute("stroke-linecap", "round");
  el.setAttribute("stroke-linejoin", "round");
  return el;
}

function circle(cx, cy, r, fill) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  el.setAttribute("cx", cx);
  el.setAttribute("cy", cy);
  el.setAttribute("r", r);
  el.setAttribute("fill", fill);
  return el;
}

function addMarker(svg, x, y, shape, color, size) {
  if (shape === "square") {
    const rect = document.createElementNS(svg.namespaceURI, "rect");
    rect.setAttribute("x", x - size / 2);
    rect.setAttribute("y", y - size / 2);
    rect.setAttribute("width", size);
    rect.setAttribute("height", size);
    rect.setAttribute("fill", color);
    svg.appendChild(rect);
    return;
  }

  if (shape === "diamond") {
    const points = [
      [x, y - size],
      [x + size, y],
      [x, y + size],
      [x - size, y]
    ].map((point) => point.join(",")).join(" ");
    const polygon = document.createElementNS(svg.namespaceURI, "polygon");
    polygon.setAttribute("points", points);
    polygon.setAttribute("fill", color);
    svg.appendChild(polygon);
    return;
  }

  if (shape === "triangle") {
    const points = [
      [x, y - size],
      [x + size, y + size],
      [x - size, y + size]
    ].map((point) => point.join(",")).join(" ");
    const polygon = document.createElementNS(svg.namespaceURI, "polygon");
    polygon.setAttribute("points", points);
    polygon.setAttribute("fill", color);
    svg.appendChild(polygon);
    return;
  }

  svg.appendChild(circle(x, y, size, color));
}

function addText(svg, x, y, text, options = {}) {
  if (options.boxed) {
    const paddingX = 5;
    const paddingY = 3;
    const estimatedWidth = String(text).length * (options.size || 12) * 0.58 + paddingX * 2;
    const estimatedHeight = (options.size || 12) + paddingY * 2;
    let rectX = x;
    if (options.anchor === "middle") rectX = x - estimatedWidth / 2;
    if (options.anchor === "end") rectX = x - estimatedWidth;

    const rect = document.createElementNS(svg.namespaceURI, "rect");
    rect.setAttribute("x", rectX);
    rect.setAttribute("y", y - estimatedHeight + 4);
    rect.setAttribute("width", estimatedWidth);
    rect.setAttribute("height", estimatedHeight);
    rect.setAttribute("fill", "#ffffff");
    rect.setAttribute("stroke", "#c9cdd4");
    rect.setAttribute("rx", "2");
    svg.appendChild(rect);
  }

  const el = document.createElementNS(svg.namespaceURI, "text");
  el.setAttribute("x", x);
  el.setAttribute("y", y);
  el.setAttribute("text-anchor", options.anchor || "start");
  el.setAttribute("font-size", options.size || 12);
  el.setAttribute("fill", options.fill || COLORS.axis);
  el.setAttribute("font-weight", options.weight || 500);
  el.textContent = text;
  svg.appendChild(el);
  return el;
}

function addRotatedText(svg, x, y, text) {
  const el = document.createElementNS(svg.namespaceURI, "text");
  el.setAttribute("x", x);
  el.setAttribute("y", y);
  el.setAttribute("transform", `rotate(-90 ${x} ${y})`);
  el.setAttribute("text-anchor", "middle");
  el.setAttribute("font-size", 13);
  el.setAttribute("fill", COLORS.muted);
  el.textContent = text;
  svg.appendChild(el);
}

function addLegend(svg, x, y, items) {
  items.forEach((item, index) => {
    const yPos = y + index * 48;

    if (item.type === "line") {
      svg.appendChild(line(x, yPos, x + 34, yPos, { stroke: item.color, width: 4 }));
    } else if (item.type === "circle") {
      svg.appendChild(circle(x + 17, yPos, 6, item.color));
    } else {
      addMarker(svg, x + 17, yPos, item.type, item.color, 8);
    }

    addText(svg, x + 44, yPos + 5, item.label, { size: 13, fill: COLORS.muted, weight: 520 });
  });
}

function drawCollisionAwareLabels(svg, labels, plot, chartType) {
  const occupied = [];
  const sorted = [...labels].sort((a, b) => a.x - b.x || a.y - b.y || String(a.text).localeCompare(String(b.text)));

  for (const label of sorted) {
    const placement = placeLabel(label, plot, occupied, chartType);
    if (!placement) continue;

    renderLabel(svg, label, placement);
    occupied.push(inflateBox(placement.box, 4));
  }
}

function drawCompactLabels(svg, labels, plot) {
  const sorted = [...labels].sort((a, b) => a.x - b.x || a.y - b.y || String(a.text).localeCompare(String(b.text)));
  if (!sorted.length) return;

  const occupied = [];

  for (const label of sorted) {
    const placement = placeCompactLabel(label, plot, occupied);
    if (!placement) continue;

    placement.leader = false;
    renderLabel(svg, label, placement);
    occupied.push(inflateBox(placement.box, 3));
  }
}

function placeCompactLabel(label, plot, occupied) {
  const metrics = estimateLabelMetrics(label.text, label.size || 11);
  const candidates = buildCompactLabelCandidates(label, metrics, plot);

  for (const candidate of candidates) {
    const score = labelPlacementScore(candidate.box, plot, occupied);
    if (score === 0) {
      return candidate;
    }
  }

  return null;
}

function buildCompactLabelCandidates(label, metrics, plot) {
  const gap = 6;
  const midpointX = (plot.left + plot.right) / 2;
  const midpointY = (plot.top + plot.bottom) / 2;
  const preferRight = label.x <= midpointX;
  const preferAbove = label.y >= midpointY;
  const primarySide = preferRight ? "right" : "left";
  const secondarySide = primarySide === "right" ? "left" : "right";
  const primaryVertical = preferAbove ? "above" : "below";
  const secondaryVertical = primaryVertical === "above" ? "below" : "above";
  const laneOffsets = [0, -10, 10, -20, 20];
  const patterns = [
    { side: primarySide, vertical: primaryVertical },
    { side: primarySide, vertical: secondaryVertical },
    { side: secondarySide, vertical: primaryVertical },
    { side: "center", vertical: primaryVertical },
    { side: "center", vertical: secondaryVertical }
  ];
  const candidates = [];

  for (const pattern of patterns) {
    for (const laneOffset of laneOffsets) {
      const box = buildLabelBox(label.x, label.y, metrics, pattern.side, pattern.vertical, gap, laneOffset);
      candidates.push({
        box,
        anchor: box.anchor,
        leader: false
      });
    }
  }

  return candidates;
}

function placeLabel(label, plot, occupied, chartType) {
  const metrics = estimateLabelMetrics(label.text, label.size || 11);
  const candidates = buildLabelCandidates(label, metrics, plot, chartType);
  let bestInside = null;
  let bestOutside = null;

  for (const candidate of candidates) {
    const score = labelPlacementScore(candidate.box, plot, occupied);
    const inside = isBoxWithinPlot(candidate.box, plot, 4);
    if (score === 0) {
      return candidate;
    }

    if (inside) {
      if (!bestInside || score < bestInside.score) {
        bestInside = { ...candidate, score };
      }
    } else if (!bestOutside || score < bestOutside.score) {
      bestOutside = { ...candidate, score };
    }
  }

  return bestInside || bestOutside;
}

function renderLabel(svg, label, placement) {
  const metrics = estimateLabelMetrics(label.text, label.size || 11);
  const textX = placement.box.left + (placement.anchor === "middle" ? metrics.width / 2 : placement.anchor === "end" ? metrics.width : 0);
  const textY = placement.box.top + metrics.height - 4;
  const textEl = addText(svg, textX, textY, label.text, {
    anchor: placement.anchor,
    size: label.size || 11,
    fill: label.fill || COLORS.ink,
    weight: label.weight || 600,
    boxed: true
  });

  if (textEl) {
    textEl.dataset.labelBoxLeft = String(roundLabelValue(placement.box.left));
    textEl.dataset.labelBoxTop = String(roundLabelValue(placement.box.top));
    textEl.dataset.labelBoxRight = String(roundLabelValue(placement.box.right));
    textEl.dataset.labelBoxBottom = String(roundLabelValue(placement.box.bottom));
    textEl.dataset.labelType = label.type || "";
    if (label.axis) textEl.dataset.labelAxis = label.axis;
  }

  if (placement.leader) {
    const target = leaderTargetPoint(label.x, label.y, placement.box);
    svg.appendChild(line(label.x, label.y, target.x, target.y, { stroke: "#aeb4bd", width: 0.9 }));
  }
}

function buildLabelCandidates(label, metrics, plot, chartType) {
  const gap = chartType === "pressure" ? 7 : 6;
  const midpoint = (plot.left + plot.right) / 2;
  const preferRight = label.x <= midpoint;
  const primarySide = chartType === "pressure"
    ? preferRight
      ? "right"
      : "left"
    : label.axis === "Tran"
      ? (preferRight ? "right" : "left")
      : label.axis === "Vert"
        ? (preferRight ? "right" : "left")
        : preferRight
          ? "right"
          : "left";

  const oppositeSide = primarySide === "right" ? "left" : "right";

  const patterns = chartType === "pressure"
    ? [
        { side: primarySide, vertical: "above" },
        { side: primarySide, vertical: "below" },
        { side: "center", vertical: "above" },
        { side: "center", vertical: "below" },
        { side: oppositeSide, vertical: "above" },
        { side: oppositeSide, vertical: "below" }
      ]
    : label.axis === "Tran"
      ? [
          { side: "left", vertical: "above" },
          { side: "right", vertical: "above" },
          { side: "left", vertical: "below" },
          { side: "right", vertical: "below" },
          { side: "center", vertical: "above" },
          { side: "center", vertical: "below" }
        ]
      : label.axis === "Vert"
        ? [
            { side: "right", vertical: "above" },
            { side: "left", vertical: "above" },
            { side: "right", vertical: "below" },
            { side: "left", vertical: "below" },
            { side: "center", vertical: "above" },
            { side: "center", vertical: "below" }
          ]
        : [
            { side: "left", vertical: "below" },
            { side: "right", vertical: "below" },
            { side: "left", vertical: "above" },
            { side: "right", vertical: "above" },
            { side: "center", vertical: "above" },
            { side: "center", vertical: "below" }
          ];

  const laneOffsetsByVertical = {
    above: [0, -12, -24, -36],
    below: [0, 12, 24, 36],
    center: [0, -12, 12, -24, 24]
  };
  const candidates = [];

  for (const pattern of patterns) {
    const laneOffsets = laneOffsetsByVertical[pattern.vertical] || [0];

    for (const laneOffset of laneOffsets) {
      const box = buildLabelBox(label.x, label.y, metrics, pattern.side, pattern.vertical, gap, laneOffset);
      candidates.push({
        box,
        anchor: box.anchor,
        leader: Math.abs(box.left - label.x) > 4 || Math.abs(box.top - label.y) > 4
      });
    }
  }

  return candidates;
}

function buildLabelBox(pointX, pointY, metrics, side, vertical, gap, laneOffset) {
  const width = metrics.width;
  const height = metrics.height;
  let left = pointX;
  let top = pointY;
  let anchor = "start";

  if (side === "center") {
    left = pointX - width / 2;
    anchor = "middle";
  } else if (side === "right") {
    left = pointX + gap;
    anchor = "start";
  } else if (side === "left") {
    left = pointX - width - gap;
    anchor = "end";
  }

  if (vertical === "above") {
    top = pointY - height - gap + laneOffset;
  } else if (vertical === "below") {
    top = pointY + gap + laneOffset;
  } else {
    top = pointY - height / 2 + laneOffset;
  }

  const box = {
    left,
    top,
    right: left + width,
    bottom: top + height
  };
  box.anchor = anchor;
  return box;
}

function estimateLabelMetrics(text, size = 11) {
  const paddingX = 5;
  const paddingY = 3;
  const width = String(text).length * size * 0.58 + paddingX * 2;
  const height = size + paddingY * 2;
  return { width, height };
}

function labelPlacementScore(box, plot, occupied) {
  const overlap = totalOverlapArea(box, occupied);
  const horizontalOverflow = Math.max(0, plot.left + 4 - box.left) + Math.max(0, box.right - (plot.right - 4));
  const verticalOverflow = Math.max(0, plot.top + 4 - box.top) + Math.max(0, box.bottom - (plot.bottom - 4));
  return overlap * 1000 + horizontalOverflow * boxHeight(box) * 25 + verticalOverflow * boxWidth(box) * 25;
}

function boxWidth(box) {
  return box.right - box.left;
}

function boxHeight(box) {
  return box.bottom - box.top;
}

function totalOverlapArea(box, occupied) {
  let total = 0;
  for (const other of occupied) {
    total += overlapArea(box, other);
  }
  return total;
}

function overlapArea(a, b) {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return width * height;
}

function inflateBox(box, padding) {
  return {
    left: box.left - padding,
    top: box.top - padding,
    right: box.right + padding,
    bottom: box.bottom + padding
  };
}

function leaderTargetPoint(pointX, pointY, box) {
  const candidates = [
    { x: box.left, y: clamp(pointY, box.top, box.bottom), distance: Math.abs(pointX - box.left) },
    { x: box.right, y: clamp(pointY, box.top, box.bottom), distance: Math.abs(pointX - box.right) },
    { x: clamp(pointX, box.left, box.right), y: box.top, distance: Math.abs(pointY - box.top) },
    { x: clamp(pointX, box.left, box.right), y: box.bottom, distance: Math.abs(pointY - box.bottom) }
  ];

  return candidates.reduce((best, candidate) => (candidate.distance < best.distance ? candidate : best), candidates[0]);
}

function isBoxWithinPlot(box, plot, padding = 4) {
  return box.left >= plot.left + padding && box.right <= plot.right - padding && box.top >= plot.top + padding && box.bottom <= plot.bottom - padding;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundLabelValue(value) {
  return Number(value.toFixed(2));
}

function downloadSvg(containerId, fileName) {
  const svg = $("#" + containerId + " svg");
  if (!svg) return;

  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svg);
  downloadBlob(new Blob([source], { type: "image/svg+xml;charset=utf-8" }), fileName);
}

function downloadPng(containerId, fileName) {
  const svg = $("#" + containerId + " svg");
  if (!svg) return;

  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svg);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();

  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = image.width || 1180;
    canvas.height = image.height || 610;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    URL.revokeObjectURL(url);

    canvas.toBlob((pngBlob) => {
      if (pngBlob) downloadBlob(pngBlob, fileName);
    }, "image/png", 1);
  };

  image.src = url;
}

function downloadBlob(blob, fileName) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportSummaryCsv() {
  if (!state.events.length) return;

  const rows = [
    [
      "arquivo",
      "ponto",
      "data",
      "hora",
      "distancia_m",
      "serial",
      "tran_ppv_mm_s",
      "tran_hz",
      "vert_ppv_mm_s",
      "vert_hz",
      "long_ppv_mm_s",
      "long_hz",
      "pspl_db",
      "pvs_mm_s",
      "status"
    ],
    ...state.events.map((event) => [
      event.fileName,
      event.location,
      event.eventDate,
      event.eventTime,
      formatRaw(event.distance),
      event.serialNumber,
      formatRaw(event.tranPpv),
      formatRaw(event.tranFreq),
      formatRaw(event.vertPpv),
      formatRaw(event.vertFreq),
      formatRaw(event.longPpv),
      formatRaw(event.longFreq),
      formatRaw(event.pspl),
      formatRaw(event.pvs),
      event.overallStatus.label
    ])
  ];

  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "resumo-openblast-nbr9653.csv");
}

async function exportExecutiveReportPdf() {
  if (!state.events.length) {
    setStatus("Carregue ao menos um CSV para exportar o relatório em PDF.", true);
    return;
  }

  const reportWindow = window.open("", "_blank", "width=1280,height=900");
  if (!reportWindow) {
    setStatus("O navegador bloqueou a abertura da janela de relatório PDF.", true);
    return;
  }

  reportWindow.document.open();
  reportWindow.document.write("<!doctype html><title>Preparando relatório PDF</title><p style='font-family:Arial,Helvetica,sans-serif;padding:24px;color:#333'>Preparando relatório PDF...</p>");
  reportWindow.document.close();
  reportWindow.focus();

  try {
    const logoUrl = new URL("assets/logo-openblast.png", location.href).href;
    let logoDataUrl = logoUrl;

    try {
      logoDataUrl = await loadImageDataUrl(logoUrl);
    } catch {
      logoDataUrl = logoUrl;
    }

    const html = buildExecutiveReportHtml({ logoDataUrl });
    reportWindow.document.open();
    reportWindow.document.write(html);
    reportWindow.document.close();
    reportWindow.focus();
    setStatus("Relatório PDF pronto. Use a janela aberta para salvar como PDF.");
  } catch (error) {
    reportWindow.close();
    setStatus(`Não foi possível preparar o relatório PDF: ${escapeHtml(error.message)}`, true);
  }
}

function buildExecutiveReportHtml({ logoDataUrl }) {
  const title = $("#reportTitle").value || "Eventos Sismográficos";
  const generatedAt = new Date().toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short"
  });

  const components = state.events.flatMap((event) => event.components || []);
  const maxPpv = Math.max(...components.map((component) => component.ppv).filter(isFiniteNumber), 0);
  const maxPspl = Math.max(...state.events.map((event) => event.pspl).filter(isFiniteNumber), 0);
  const hasAlert = state.events.some((event) => event.overallStatus.severity === "alert");
  const hasCheck = state.events.some((event) => event.overallStatus.severity === "check");
  const overallStatus = hasAlert ? "Acima do limite" : hasCheck ? "Verificar" : "Conforme";

  const pressureChart = getChartMarkup("pressureChart");
  const vibrationNormChart = getChartMarkup("vibrationNormChart");
  const vibrationZeroChart = getChartMarkup("vibrationZeroChart");

  const reportTitle = escapeHtml(title);
  const reportNote = `Gerado em ${escapeHtml(generatedAt)} · Processamento local no navegador`;

  const kpis = [
    { label: "Arquivos", value: String(state.events.length) },
    { label: "Maior PPV", value: `${formatNumber(maxPpv, 3)} mm/s` },
    { label: "Maior PSPL", value: `${formatNumber(maxPspl, 1)} dB` },
    { label: "Status", value: overallStatus }
  ];

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Relatório PDF - ${reportTitle}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #38424b;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      min-height: 100vh;
    }

    .sheet {
      position: relative;
    }

    .report-logo {
      position: fixed;
      top: 12mm;
      right: 12mm;
      width: 14mm;
      height: 14mm;
      object-fit: contain;
      z-index: 2;
    }

    .header {
      padding: 0 0 7mm;
      margin-bottom: 6mm;
      border-bottom: 1px solid #e3e6ea;
    }

    .eyebrow {
      margin: 0 0 3mm;
      color: #e20613;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      font-size: 8pt;
      font-weight: 700;
    }

    h1,
    h2,
    p {
      margin: 0;
    }

    h1 {
      font-size: 20pt;
      line-height: 1.06;
      letter-spacing: -0.03em;
      max-width: 150mm;
    }

    .subtitle {
      margin-top: 2.5mm;
      max-width: 152mm;
      color: #6c7680;
      font-size: 9.5pt;
      line-height: 1.45;
    }

    .meta-line {
      margin-top: 2.5mm;
      color: #6c7680;
      font-size: 8pt;
    }

    .summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 4mm;
      margin-bottom: 6mm;
    }

    .summary-card {
      border: 1px solid #e3e6ea;
      border-radius: 2.5mm;
      padding: 4mm 4.5mm;
      min-height: 22mm;
    }

    .summary-card span {
      display: block;
      color: #6c7680;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
    }

    .summary-card strong {
      display: block;
      margin-top: 2.2mm;
      font-size: 16pt;
      line-height: 1.02;
      letter-spacing: -0.03em;
      font-weight: 700;
    }

    .chart-block {
      border: 1px solid #e3e6ea;
      border-radius: 2.5mm;
      padding: 4mm;
      margin-bottom: 6mm;
      break-inside: avoid;
      page-break-inside: avoid;
      background: #fff;
    }

    .chart-break {
      break-before: page;
      page-break-before: always;
    }

    .chart-heading {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 4mm;
      margin-bottom: 3mm;
    }

    .chart-heading h2 {
      font-size: 11pt;
      line-height: 1.15;
      letter-spacing: -0.02em;
    }

    .chart-heading span {
      color: #6c7680;
      font-size: 8pt;
      white-space: nowrap;
    }

    .chart-shell {
      border: 0;
      border-radius: 0;
      overflow: visible;
    }

    .chart-shell svg {
      min-width: 0;
      width: 100%;
      height: auto;
    }

    .footer {
      display: flex;
      justify-content: space-between;
      gap: 8mm;
      margin-top: 6mm;
      padding-top: 3mm;
      border-top: 1px solid #e3e6ea;
      color: #6c7680;
      font-size: 7.5pt;
    }

    @media screen {
      body {
        background: #efefef;
        padding: 8mm 0;
      }

      .sheet {
        width: 190mm;
        margin: 0 auto;
        background: #fff;
        padding: 12mm;
        box-shadow: 0 16px 50px rgba(0, 0, 0, 0.08);
      }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <img class="report-logo" src="${escapeAttr(logoDataUrl)}" alt="Logo OpenBlast" />

    <header class="header">
      <p class="eyebrow">OpenBlast / ABNT NBR 9653:2018</p>
      <h1>${reportTitle}</h1>
      <p class="subtitle">Gráficos dos sismogramas carregados.</p>
      <p class="meta-line">${reportNote}</p>
    </header>

    <section class="summary">
      ${kpis
        .map(
          (item) => `<div class="summary-card"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`
        )
        .join("")}
    </section>

    <section class="chart-block">
      <div class="chart-heading">
        <h2>Pressão sonora</h2>
        <span>ABNT NBR 9653:2018</span>
      </div>
      ${pressureChart}
    </section>

    <section class="chart-block chart-break">
      <div class="chart-heading">
        <h2>Vibração em eventos sismográficos</h2>
        <span>ABNT NBR 9653:2018</span>
      </div>
      ${vibrationNormChart}
    </section>

    <section class="chart-block chart-break">
      <div class="chart-heading">
        <h2>Vibração com eixos lineares partindo de zero</h2>
        <span>ABNT NBR 9653:2018</span>
      </div>
      ${vibrationZeroChart}
    </section>

    <footer class="footer">
      <span>OpenBlast</span>
      <span>ABNT NBR 9653:2018</span>
    </footer>
  </div>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => window.print(), 250);
    });
  </script>
</body>
</html>`;
}

function getChartMarkup(containerId) {
  const svg = $("#" + containerId + " svg");
  if (!svg) return "";

  const clone = svg.cloneNode(true);
  clone.removeAttribute("style");
  clone.style.minWidth = "0";
  clone.style.width = "100%";
  clone.style.height = "auto";
  return clone.outerHTML;
}

async function loadImageDataUrl(url) {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Falha ao carregar a imagem ${url}`);
  }

  const blob = await response.blob();
  return await blobToDataUrl(blob);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Falha ao converter imagem"));
    reader.readAsDataURL(blob);
  });
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function formatPair(ppv, freq) {
  const ppvText = isFiniteNumber(ppv) ? formatNumber(ppv, 3) : "-";
  const freqText = isFiniteNumber(freq) ? formatNumber(freq, 1) : "-";
  return `${ppvText} / ${freqText}`;
}

function formatNullable(value, digits) {
  return isFiniteNumber(value) ? formatNumber(value, digits) : "-";
}

function formatRaw(value) {
  return isFiniteNumber(value) ? String(value).replace(".", ",") : "";
}

function formatNumber(value, digits = 2) {
  if (!isFiniteNumber(value)) return "-";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function truncate(value, max) {
  const text = String(value || "");
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

renderAll();
