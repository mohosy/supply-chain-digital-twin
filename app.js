const canvas = document.getElementById("twin");
const ctx = canvas.getContext("2d");

const demandInput = document.getElementById("demandInput");
const riskInput = document.getElementById("riskInput");
const dispatchInput = document.getElementById("dispatchInput");

const demandValue = document.getElementById("demandValue");
const riskValue = document.getElementById("riskValue");
const dispatchValue = document.getElementById("dispatchValue");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const shockBtn = document.getElementById("shockBtn");
const rerouteBtn = document.getElementById("rerouteBtn");
const resetBtn = document.getElementById("resetBtn");

const throughputText = document.getElementById("throughputText");
const delayText = document.getElementById("delayText");
const stockoutText = document.getElementById("stockoutText");
const serviceText = document.getElementById("serviceText");

const nodes = [
  { id: "F1", x: 120, y: 130, type: "factory", inventory: 180 },
  { id: "F2", x: 120, y: 490, type: "factory", inventory: 170 },
  { id: "H1", x: 390, y: 200, type: "hub", inventory: 110 },
  { id: "H2", x: 420, y: 430, type: "hub", inventory: 120 },
  { id: "R1", x: 780, y: 130, type: "retail", inventory: 65 },
  { id: "R2", x: 820, y: 310, type: "retail", inventory: 70 },
  { id: "R3", x: 760, y: 490, type: "retail", inventory: 60 },
];

let edges = [];
let shipments = [];
let running = false;
let throughput = 0;
let delayTotal = 0;
let delayCount = 0;
let stockouts = 0;

function buildEdges() {
  edges = [
    ["F1", "H1", 1],
    ["F2", "H2", 1],
    ["F1", "H2", 1],
    ["F2", "H1", 1],
    ["H1", "R1", 1],
    ["H1", "R2", 1],
    ["H2", "R2", 1],
    ["H2", "R3", 1],
    ["H1", "R3", 1],
  ];
}

function nodeById(id) {
  return nodes.find((n) => n.id === id);
}

function makeShipment(from, to, baseQty) {
  const risk = Number(riskInput.value);
  const disrupted = Math.random() < risk;
  const speed = disrupted ? 0.0035 : 0.0058;
  const qty = Math.max(4, Math.round(baseQty * (0.7 + Math.random() * 0.8)));

  return {
    from,
    to,
    t: 0,
    qty,
    speed,
    delayHours: disrupted ? 8 + Math.random() * 18 : 1 + Math.random() * 4,
    disrupted,
  };
}

function dispatchShipments() {
  const rate = Number(dispatchInput.value);
  const demand = Number(demandInput.value);

  const outbound = [];
  edges.forEach(([a, b, active]) => {
    if (!active) return;
    const na = nodeById(a);
    const nb = nodeById(b);

    if (na.type === "factory" && nb.type === "hub") {
      if (na.inventory > 5) {
        const qty = 6 + Math.random() * 12;
        na.inventory -= qty;
        outbound.push(makeShipment(a, b, qty));
      }
    }

    if (na.type === "hub" && nb.type === "retail") {
      if (na.inventory > 3 && Math.random() < 0.55 * demand) {
        const qty = 4 + Math.random() * 8;
        na.inventory -= qty;
        outbound.push(makeShipment(a, b, qty));
      }
    }
  });

  shipments.push(...outbound.slice(0, rate * 2));
}

function updateShipments() {
  const finished = [];

  shipments.forEach((s) => {
    s.t += s.speed;
    if (s.t >= 1) {
      finished.push(s);
    }
  });

  shipments = shipments.filter((s) => s.t < 1);

  finished.forEach((s) => {
    const dest = nodeById(s.to);
    dest.inventory += s.qty;

    throughput += s.qty;
    delayTotal += s.delayHours;
    delayCount += 1;
  });
}

function consumeRetailDemand() {
  const demand = Number(demandInput.value);
  nodes
    .filter((n) => n.type === "retail")
    .forEach((retail) => {
      const consume = 1.8 * demand + Math.random() * 1.6 * demand;
      retail.inventory -= consume;
      if (retail.inventory < 0) {
        stockouts += 1;
        retail.inventory = 0;
      }
    });

  nodes
    .filter((n) => n.type === "factory")
    .forEach((f) => {
      f.inventory = Math.min(240, f.inventory + 2.8 + Math.random() * 2.1);
    });
}

function drawNetwork() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  edges.forEach(([a, b, active]) => {
    const na = nodeById(a);
    const nb = nodeById(b);
    ctx.strokeStyle = active ? "rgba(130,180,255,0.3)" : "rgba(255,120,120,0.35)";
    ctx.lineWidth = active ? 2 : 1.6;
    ctx.beginPath();
    ctx.moveTo(na.x, na.y);
    ctx.lineTo(nb.x, nb.y);
    ctx.stroke();
  });

  shipments.forEach((s) => {
    const from = nodeById(s.from);
    const to = nodeById(s.to);
    const x = from.x + (to.x - from.x) * s.t;
    const y = from.y + (to.y - from.y) * s.t;

    ctx.beginPath();
    ctx.arc(x, y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = s.disrupted ? "#ff7f93" : "#7dc3ff";
    ctx.fill();
  });

  nodes.forEach((n) => {
    let color = "#7dc3ff";
    if (n.type === "factory") color = "#8dffd3";
    if (n.type === "retail") color = "#ffd166";

    ctx.beginPath();
    ctx.arc(n.x, n.y, 18, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.strokeStyle = "rgba(8,15,25,0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#04101b";
    ctx.font = "bold 12px monospace";
    ctx.fillText(n.id, n.x - 11, n.y + 4);

    ctx.fillStyle = "#d8e9ff";
    ctx.font = "11px monospace";
    ctx.fillText(`${Math.round(n.inventory)}`, n.x - 12, n.y + 30);
  });
}

function updateMetrics() {
  const avgDelay = delayCount ? delayTotal / delayCount : 0;
  const targetDemand = Number(demandInput.value) * 140;
  const service = Math.max(0, 100 - (stockouts / Math.max(1, targetDemand)) * 100);

  throughputText.textContent = Math.round(throughput).toString();
  delayText.textContent = `${avgDelay.toFixed(1)}h`;
  stockoutText.textContent = stockouts.toString();
  serviceText.textContent = `${service.toFixed(1)}%`;
}

function step() {
  if (!running) return;

  dispatchShipments();
  updateShipments();
  consumeRetailDemand();
  drawNetwork();
  updateMetrics();

  requestAnimationFrame(step);
}

function resetScenario() {
  nodes.forEach((n) => {
    if (n.type === "factory") n.inventory = 170 + Math.random() * 30;
    if (n.type === "hub") n.inventory = 95 + Math.random() * 35;
    if (n.type === "retail") n.inventory = 55 + Math.random() * 25;
  });
  shipments = [];
  throughput = 0;
  delayTotal = 0;
  delayCount = 0;
  stockouts = 0;
  buildEdges();
  drawNetwork();
  updateMetrics();
}

function reroute() {
  edges = edges.map(([a, b]) => [a, b, 1]);
  // deactivate one risky lane and activate alternatives
  const riskyIndex = Math.floor(Math.random() * edges.length);
  edges[riskyIndex][2] = 0;
}

function demandShock() {
  demandInput.value = (Math.min(2.2, Number(demandInput.value) + 0.5)).toFixed(1);
  syncLabels();
}

function syncLabels() {
  demandValue.textContent = Number(demandInput.value).toFixed(1);
  riskValue.textContent = Number(riskInput.value).toFixed(2);
  dispatchValue.textContent = dispatchInput.value;
}

[demandInput, riskInput, dispatchInput].forEach((el) => {
  el.addEventListener("input", syncLabels);
});

startBtn.addEventListener("click", () => {
  if (running) return;
  running = true;
  step();
});

pauseBtn.addEventListener("click", () => {
  running = false;
});

shockBtn.addEventListener("click", demandShock);
rerouteBtn.addEventListener("click", reroute);
resetBtn.addEventListener("click", () => {
  running = false;
  resetScenario();
});

syncLabels();
resetScenario();
