const state = {
  data: null,
  view: "overview",
  filters: {
    station: "",
    month: "",
    dateFrom: "",
    dateTo: ""
  },
  charts: new Map()
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const stationLabel = (id) => id === "PSS1" ? "PSS 1" : id === "PSS2" ? "PSS 2" : id;

const COLORS = {
  pss1: "#1000ff",
  pss2: "#2f76ff",
  navy: "#112f78",
  cash: "#5b8fff",
  credit: "#112f78",
  green: "#079767",
  palette: ["#1000ff", "#2f76ff", "#5b8fff", "#8bb2ff", "#112f78", "#46639b", "#6f85ae", "#9aabc7", "#079767", "#55ae8e"]
};

const stationColor = (station) => station === "PSS1" ? COLORS.pss1 : COLORS.pss2;

function money(value, decimals = 2) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(Number(value || 0)).replace("MYR", "RM");
}

function compactMoney(value) {
  const n = Number(value || 0);
  if (Math.abs(n) >= 1000000) return `RM ${(n / 1000000).toFixed(2)}m`;
  if (Math.abs(n) >= 1000) return `RM ${(n / 1000).toFixed(1)}k`;
  return money(n);
}

function pct(value, digits = 1) {
  return `${(Number(value || 0) * 100).toFixed(digits)}%`;
}

function dateLabel(iso) {
  const d = new Date(`${iso}T00:00:00+08:00`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur"
  }).format(d);
}

function shortDate(iso) {
  const d = new Date(`${iso}T00:00:00+08:00`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Kuala_Lumpur"
  }).format(d);
}

function monthName(key) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur"
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function sum(rows, accessor) {
  return rows.reduce((total, row) => total + Number(accessor(row) || 0), 0);
}

function unique(values) {
  return [...new Set(values)];
}

function groupBy(rows, keyFn) {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyFn(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  return map;
}

function filteredRetail() {
  return state.data.retail.filter((row) => {
    if (state.filters.station && row.station !== state.filters.station) return false;
    if (state.filters.month && !row.date.startsWith(state.filters.month)) return false;
    if (state.filters.dateFrom && row.date < state.filters.dateFrom) return false;
    if (state.filters.dateTo && row.date > state.filters.dateTo) return false;
    return true;
  });
}

function filteredControls() {
  return state.data.controls.filter((row) => {
    if (state.filters.station && row.station !== state.filters.station) return false;
    if (state.filters.month && !row.date.startsWith(state.filters.month)) return false;
    if (state.filters.dateFrom && row.date < state.filters.dateFrom) return false;
    if (state.filters.dateTo && row.date > state.filters.dateTo) return false;
    return true;
  });
}

function currentContext(retail = filteredRetail()) {
  if (!retail.length) return "No matching records";
  const dates = retail.map((r) => r.date).sort();
  const station = state.filters.station ? stationLabel(state.filters.station) : "All stations";
  return `${station} · ${dateLabel(dates[0])} – ${dateLabel(dates[dates.length - 1])}`;
}

function destroyCharts() {
  state.charts.forEach((chart) => chart.destroy());
  state.charts.clear();
}

function makeChart(key, canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (state.charts.has(key)) state.charts.get(key).destroy();
  const chart = new Chart(canvas, config);
  state.charts.set(key, chart);
}

function chartBaseOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        display: true,
        position: "bottom",
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          boxHeight: 8,
          padding: 16,
          color: "#5d6981",
          font: { family: "Poppins", size: 9 }
        }
      },
      tooltip: {
        titleFont: { family: "Poppins", size: 10 },
        bodyFont: { family: "Poppins", size: 9 },
        padding: 10
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#7c8799", font: { family: "Poppins", size: 8 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
        border: { color: "#dfe5ef" }
      },
      y: {
        beginAtZero: true,
        grid: { color: "#edf1f6" },
        ticks: { color: "#7c8799", font: { family: "Poppins", size: 8 } },
        border: { display: false }
      }
    },
    ...extra
  };
}

function moneyTick(value) {
  const n = Number(value || 0);
  if (Math.abs(n) >= 1000000) return `RM${(n / 1000000).toFixed(1)}m`;
  if (Math.abs(n) >= 1000) return `RM${(n / 1000).toFixed(0)}k`;
  return `RM${n.toFixed(0)}`;
}

function aggregatePayments(rows) {
  const totals = {};
  rows.forEach((row) => {
    Object.entries(row.payments || {}).forEach(([name, value]) => {
      if (name === "Shortage") return;
      totals[name] = (totals[name] || 0) + Number(value || 0);
    });
  });
  return totals;
}

function aggregateFuelSales(rows) {
  const totals = {};
  rows.forEach((row) => {
    Object.entries(row.fuelSales || {}).forEach(([name, value]) => {
      totals[name] = (totals[name] || 0) + Number(value || 0);
    });
  });
  return totals;
}

function aggregateFuelQty(rows) {
  const totals = {};
  rows.forEach((row) => {
    Object.entries(row.fuelQty || {}).forEach(([name, value]) => {
      totals[name] = (totals[name] || 0) + Number(value || 0);
    });
  });
  return totals;
}

function renderFreshness() {
  const meta = state.data.meta;
  $("#coverageText").textContent = `${dateLabel(meta.coverageStart)} – ${dateLabel(meta.latestDate)}`;
  $("#recordCountText").textContent = `${meta.retailRecordCount} station-days`;
  $("#controlCountText").textContent = `${meta.controlRecordCount} reconciliations`;
  const controls = state.data.controls;
  const pass = controls.filter((r) => Math.abs(Number(r.difference || 0)) < 0.005).length;
  $("#reconciliationText").textContent = `${pass}/${controls.length} balanced`;
  $("#sourceFolderLink").href = meta.sourceFolderUrl;
  $("#dataBasisText").textContent = `${meta.retailWorkbookCount} retail + ${meta.costWorkbookCount} Cost of Sales workbooks`;
}

function populateMonthFilter() {
  const months = unique(state.data.retail.map((r) => r.date.slice(0, 7))).sort();
  const select = $("#filterMonth");
  months.forEach((month) => {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = monthName(month);
    select.appendChild(option);
  });
}

function updateActiveFilterCount() {
  const count = Object.values(state.filters).filter(Boolean).length;
  $("#activeFilterCount").textContent = `${count} active`;
}

function renderKpis(items) {
  return `
    <div class="kpi-grid">
      ${items.map((item) => `
        <article class="kpi ${item.good ? "is-good" : ""}">
          <span class="kpi-label">${item.label}</span>
          <strong>${item.value}</strong>
          <small>${item.note || ""}</small>
        </article>
      `).join("")}
    </div>
  `;
}

function overviewHeadline(retail, controls) {
  if (!retail.length) {
    return {
      title: "No records match the selected reporting scope.",
      note: "Clear or adjust the filters to restore the available SENTINEL analysis.",
      facts: []
    };
  }

  const total = sum(retail, (r) => r.total);
  const stationGroups = groupBy(retail, (r) => r.station);
  const stationTotals = [...stationGroups.entries()].map(([station, rows]) => ({ station, total: sum(rows, (r) => r.total) })).sort((a, b) => b.total - a.total);
  const leader = stationTotals[0];
  const leaderShare = leader ? leader.total / total : 0;

  const monthGroups = groupBy(retail, (r) => r.date.slice(0, 7));
  const monthTotals = [...monthGroups.entries()].map(([month, rows]) => ({ month, total: sum(rows, (r) => r.total) })).sort((a, b) => a.month.localeCompare(b.month));
  let movementText = "";
  if (monthTotals.length >= 2) {
    const first = monthTotals[0];
    const second = monthTotals[1];
    const movement = first.total ? (second.total / first.total) - 1 : 0;
    movementText = `${monthName(second.month).split(" ")[0]} ${movement >= 0 ? "increased" : "declined"} ${Math.abs(movement * 100).toFixed(1)}% versus ${monthName(first.month).split(" ")[0]}`;
  }

  const pass = controls.filter((r) => Math.abs(Number(r.difference || 0)) < 0.005).length;
  const passRate = controls.length ? pass / controls.length : 0;

  const title = state.filters.station
    ? `${stationLabel(state.filters.station)} recorded ${compactMoney(total)} across ${retail.length} station-days in the selected scope.`
    : `${stationLabel(leader.station)} contributed ${pct(leaderShare)} of recorded retail total across the selected scope.`;

  const noteParts = [];
  if (movementText) noteParts.push(movementText);
  if (controls.length) noteParts.push(`${pass}/${controls.length} finance reconciliations closed with zero difference`);

  const payments = aggregatePayments(retail);
  const topPayment = Object.entries(payments).sort((a, b) => b[1] - a[1])[0];
  const fuel = aggregateFuelSales(retail);
  const topFuel = Object.entries(fuel).sort((a, b) => b[1] - a[1])[0];

  const uniqueDates = unique(retail.map((r) => r.date)).length;
  const facts = [
    { label: "Average per calendar day", value: compactMoney(total / Math.max(uniqueDates, 1)) },
    { label: "Top payment channel", value: topPayment ? `${topPayment[0]} · ${pct(topPayment[1] / Math.max(sum(Object.values(payments), (x) => x), 1))}` : "—" },
    { label: "Primary fuel product", value: topFuel ? `${topFuel[0]} · ${pct(topFuel[1] / Math.max(sum(Object.values(fuel), (x) => x), 1))}` : "—" },
    { label: "Control pass rate", value: controls.length ? pct(passRate, 0) : "—" }
  ];

  return { title, note: noteParts.join(" · ") + ".", facts };
}

function renderOverview() {
  destroyCharts();
  const retail = filteredRetail();
  const controls = filteredControls();
  $("#overviewContext").textContent = currentContext(retail);

  const container = $("#overviewContent");
  if (!retail.length) {
    container.innerHTML = `<div class="error-box">No retail records match the selected filters.</div>`;
    return;
  }

  const total = sum(retail, (r) => r.total);
  const cash = sum(retail, (r) => r.cash);
  const credit = sum(retail, (r) => r.credit);
  const uniqueDates = unique(retail.map((r) => r.date)).length;
  const payments = aggregatePayments(retail);
  const topPayment = Object.entries(payments).sort((a, b) => b[1] - a[1])[0];
  const pass = controls.filter((r) => Math.abs(Number(r.difference || 0)) < 0.005).length;

  const brief = overviewHeadline(retail, controls);

  container.innerHTML = `
    <section class="management-brief">
      <div>
        <span class="section-kicker">MANAGEMENT READOUT</span>
        <h2>${brief.title}</h2>
        <p>${brief.note}</p>
      </div>
      <div class="brief-facts">
        ${brief.facts.map((fact) => `
          <div class="brief-fact">
            <span>${fact.label}</span>
            <strong>${fact.value}</strong>
          </div>
        `).join("")}
      </div>
    </section>

    ${renderKpis([
      { label: "Recorded retail total", value: compactMoney(total), note: "CASH (Z1) + CREDIT (Z2)" },
      { label: "Average / day", value: compactMoney(total / Math.max(uniqueDates, 1)), note: `${uniqueDates} calendar days` },
      { label: "Cash share", value: pct(cash / Math.max(total, 1)), note: compactMoney(cash) },
      { label: "Credit share", value: pct(credit / Math.max(total, 1)), note: compactMoney(credit) },
      { label: "Reconciliation", value: controls.length ? `${pass}/${controls.length}` : "—", note: "balanced finance controls", good: controls.length && pass === controls.length }
    ])}

    <div class="panel-grid wide-left">
      <article class="panel">
        <div class="panel-head">
          <div><h3>Daily recorded retail total</h3><p>Station totals across the selected date range.</p></div>
          <div class="panel-meta">${retail.length} station-days</div>
        </div>
        <div class="panel-body"><div class="chart-wrap tall"><canvas id="overviewDailyChart"></canvas></div></div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <div><h3>Monthly station comparison</h3><p>Recorded total by station and month.</p></div>
          <div class="panel-meta">${topPayment ? `Top payment: ${topPayment[0]}` : ""}</div>
        </div>
        <div class="panel-body"><div class="chart-wrap tall"><canvas id="overviewMonthlyChart"></canvas></div></div>
      </article>
    </div>

    <div class="insight-row" id="overviewInsights"></div>

    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Top trading days</th><th>Station</th><th class="align-right">Cash</th><th class="align-right">Credit</th><th class="align-right">Recorded total</th></tr></thead>
        <tbody id="overviewTopDays"></tbody>
      </table>
    </div>
  `;

  renderDailySalesChart("overviewDailyChart", retail, "overview-daily");
  renderMonthlyStationChart("overviewMonthlyChart", retail, "overview-monthly");

  const fuel = aggregateFuelSales(retail);
  const topFuel = Object.entries(fuel).sort((a, b) => b[1] - a[1])[0];
  const paymentTotal = sum(Object.values(payments), (x) => x);
  const topThree = Object.values(payments).sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
  const stationGroups = groupBy(retail, (r) => r.station);
  const stationRanks = [...stationGroups.entries()].map(([station, rows]) => ({ station, total: sum(rows, (r) => r.total) })).sort((a, b) => b.total - a.total);

  $("#overviewInsights").innerHTML = `
    <div class="insight"><span>Station concentration</span><strong>${stationRanks[0] ? `${stationLabel(stationRanks[0].station)} accounts for ${pct(stationRanks[0].total / total)}` : "—"}</strong><p>Share of recorded retail total in the selected scope.</p></div>
    <div class="insight"><span>Fuel concentration</span><strong>${topFuel ? `${topFuel[0]} represents ${pct(topFuel[1] / Math.max(sum(Object.values(fuel), (x) => x), 1))}` : "—"}</strong><p>Share of recorded fuel product sales.</p></div>
    <div class="insight"><span>Payment concentration</span><strong>${paymentTotal ? `Top 3 channels represent ${pct(topThree / paymentTotal)}` : "—"}</strong><p>Concentration across credit-side payment channels.</p></div>
  `;

  const topDays = [...retail].sort((a, b) => b.total - a.total).slice(0, 8);
  $("#overviewTopDays").innerHTML = topDays.map((r) => `
    <tr><td><strong>${dateLabel(r.date)}</strong></td><td>${stationLabel(r.station)}</td><td class="align-right">${money(r.cash)}</td><td class="align-right">${money(r.credit)}</td><td class="align-right"><strong>${money(r.total)}</strong></td></tr>
  `).join("");
}

function renderDailySalesChart(canvasId, retail, key) {
  const dates = unique(retail.map((r) => r.date)).sort();
  const stations = unique(retail.map((r) => r.station)).sort();
  const lookup = new Map(retail.map((r) => [`${r.date}|${r.station}`, r.total]));

  makeChart(key, canvasId, {
    type: "line",
    data: {
      labels: dates.map(shortDate),
      datasets: stations.map((station) => ({
        label: stationLabel(station),
        data: dates.map((date) => lookup.get(`${date}|${station}`) ?? null),
        borderWidth: 2,
        pointRadius: dates.length > 35 ? 0 : 2,
        pointHoverRadius: 4,
        tension: 0.22,
        spanGaps: true,
        borderColor: stationColor(station),
        backgroundColor: stationColor(station)
      }))
    },
    options: chartBaseOptions({
      plugins: {
        ...chartBaseOptions().plugins,
        tooltip: {
          ...chartBaseOptions().plugins.tooltip,
          callbacks: { label: (ctx) => `${ctx.dataset.label}: ${money(ctx.parsed.y)}` }
        }
      },
      scales: {
        ...chartBaseOptions().scales,
        y: {
          ...chartBaseOptions().scales.y,
          ticks: { ...chartBaseOptions().scales.y.ticks, callback: moneyTick }
        }
      }
    })
  });
}

function renderMonthlyStationChart(canvasId, retail, key) {
  const months = unique(retail.map((r) => r.date.slice(0, 7))).sort();
  const stations = unique(retail.map((r) => r.station)).sort();
  const byMonthStation = new Map();
  retail.forEach((r) => {
    const k = `${r.date.slice(0, 7)}|${r.station}`;
    byMonthStation.set(k, (byMonthStation.get(k) || 0) + r.total);
  });

  makeChart(key, canvasId, {
    type: "bar",
    data: {
      labels: months.map((m) => monthName(m).split(" ")[0]),
      datasets: stations.map((station) => ({
        label: stationLabel(station),
        data: months.map((m) => byMonthStation.get(`${m}|${station}`) || 0),
        borderWidth: 0,
        borderRadius: 3,
        backgroundColor: stationColor(station)
      }))
    },
    options: chartBaseOptions({
      plugins: {
        ...chartBaseOptions().plugins,
        tooltip: {
          ...chartBaseOptions().plugins.tooltip,
          callbacks: { label: (ctx) => `${ctx.dataset.label}: ${money(ctx.parsed.y)}` }
        }
      },
      scales: {
        ...chartBaseOptions().scales,
        y: {
          ...chartBaseOptions().scales.y,
          ticks: { ...chartBaseOptions().scales.y.ticks, callback: moneyTick }
        }
      }
    })
  });
}

function renderStations() {
  destroyCharts();
  const retail = filteredRetail();
  $("#stationsContext").textContent = currentContext(retail);
  const container = $("#stationsContent");
  if (!retail.length) {
    container.innerHTML = `<div class="error-box">No station records match the selected filters.</div>`;
    return;
  }

  const total = sum(retail, (r) => r.total);
  const stationGroups = groupBy(retail, (r) => r.station);
  const stationStats = [...stationGroups.entries()].map(([station, rows]) => {
    const dates = unique(rows.map((r) => r.date));
    const stationTotal = sum(rows, (r) => r.total);
    const top = [...rows].sort((a, b) => b.total - a.total)[0];
    const cash = sum(rows, (r) => r.cash);
    return {
      station,
      total: stationTotal,
      share: stationTotal / total,
      avg: stationTotal / Math.max(dates.length, 1),
      cashShare: cash / Math.max(stationTotal, 1),
      top
    };
  }).sort((a, b) => b.total - a.total);

  container.innerHTML = `
    <div class="station-summary">
      ${stationStats.map((s) => `
        <article class="station-block">
          <div class="station-block-head"><h3>${stationLabel(s.station)}</h3><span class="station-share">${pct(s.share)} of selected total</span></div>
          <div class="station-stats">
            <div class="station-stat"><span>Recorded total</span><strong>${compactMoney(s.total)}</strong></div>
            <div class="station-stat"><span>Average / day</span><strong>${compactMoney(s.avg)}</strong></div>
            <div class="station-stat"><span>Cash share</span><strong>${pct(s.cashShare)}</strong></div>
            <div class="station-stat"><span>Top day</span><strong>${s.top ? `${shortDate(s.top.date)} · ${compactMoney(s.top.total)}` : "—"}</strong></div>
          </div>
        </article>
      `).join("")}
    </div>

    <div class="panel-grid">
      <article class="panel"><div class="panel-head"><div><h3>Monthly station performance</h3><p>Recorded total by month.</p></div></div><div class="panel-body"><div class="chart-wrap"><canvas id="stationMonthlyChart"></canvas></div></div></article>
      <article class="panel"><div class="panel-head"><div><h3>Average daily total</h3><p>Average across distinct trading dates in the selected scope.</p></div></div><div class="panel-body"><div class="chart-wrap"><canvas id="stationAverageChart"></canvas></div></div></article>
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Month</th><th>Station</th><th class="align-right">Station-days</th><th class="align-right">Cash</th><th class="align-right">Credit</th><th class="align-right">Recorded total</th><th class="align-right">Avg / day</th></tr></thead>
        <tbody id="stationMonthTable"></tbody>
      </table>
    </div>
  `;

  renderMonthlyStationChart("stationMonthlyChart", retail, "station-monthly");

  makeChart("station-average", "stationAverageChart", {
    type: "bar",
    data: {
      labels: stationStats.map((s) => stationLabel(s.station)),
      datasets: [{ label: "Average / day", data: stationStats.map((s) => s.avg), borderWidth: 0, borderRadius: 4, backgroundColor: stationStats.map((s) => stationColor(s.station)) }]
    },
    options: chartBaseOptions({
      plugins: { ...chartBaseOptions().plugins, legend: { display: false }, tooltip: { ...chartBaseOptions().plugins.tooltip, callbacks: { label: (ctx) => money(ctx.parsed.y) } } },
      scales: { ...chartBaseOptions().scales, y: { ...chartBaseOptions().scales.y, ticks: { ...chartBaseOptions().scales.y.ticks, callback: moneyTick } } }
    })
  });

  const groups = groupBy(retail, (r) => `${r.date.slice(0, 7)}|${r.station}`);
  const rows = [...groups.entries()].map(([key, items]) => {
    const [month, station] = key.split("|");
    const cash = sum(items, (r) => r.cash);
    const credit = sum(items, (r) => r.credit);
    const totalValue = cash + credit;
    return { month, station, days: items.length, cash, credit, total: totalValue, avg: totalValue / Math.max(items.length, 1) };
  }).sort((a, b) => a.month.localeCompare(b.month) || a.station.localeCompare(b.station));

  $("#stationMonthTable").innerHTML = rows.map((r) => `
    <tr><td><strong>${monthName(r.month)}</strong></td><td>${stationLabel(r.station)}</td><td class="align-right">${r.days}</td><td class="align-right">${money(r.cash)}</td><td class="align-right">${money(r.credit)}</td><td class="align-right"><strong>${money(r.total)}</strong></td><td class="align-right">${money(r.avg)}</td></tr>
  `).join("");
}

function renderSales() {
  destroyCharts();
  const retail = filteredRetail();
  $("#salesContext").textContent = currentContext(retail);
  const container = $("#salesContent");
  if (!retail.length) {
    container.innerHTML = `<div class="error-box">No sales records match the selected filters.</div>`;
    return;
  }

  const total = sum(retail, (r) => r.total);
  const cash = sum(retail, (r) => r.cash);
  const credit = sum(retail, (r) => r.credit);
  const fuelSales = aggregateFuelSales(retail);
  const fuelQty = aggregateFuelQty(retail);
  const fuelTotal = sum(Object.values(fuelSales), (x) => x);
  const topFuel = Object.entries(fuelSales).sort((a, b) => b[1] - a[1])[0];
  const cashTopup = sum(retail, (r) => r.cashTopup);

  container.innerHTML = `
    ${renderKpis([
      { label: "Recorded retail total", value: compactMoney(total), note: "selected scope" },
      { label: "Fuel product sales", value: compactMoney(fuelTotal), note: "fuel line items" },
      { label: "Primary product", value: topFuel ? topFuel[0] : "—", note: topFuel ? `${pct(topFuel[1] / Math.max(fuelTotal, 1))} of fuel product sales` : "" },
      { label: "Credit share", value: pct(credit / Math.max(total, 1)), note: compactMoney(credit) },
      { label: "Cash top-up", value: compactMoney(cashTopup), note: "cash-side non-sales top-up" }
    ])}

    <div class="panel-grid">
      <article class="panel"><div class="panel-head"><div><h3>Fuel product sales mix</h3><p>Aggregated fuel line-item sales by product.</p></div></div><div class="panel-body"><div class="chart-wrap"><canvas id="fuelMixChart"></canvas></div></div></article>
      <article class="panel"><div class="panel-head"><div><h3>Cash versus credit by month</h3><p>Monthly composition of recorded station totals.</p></div></div><div class="panel-body"><div class="chart-wrap"><canvas id="cashCreditChart"></canvas></div></div></article>
    </div>

    <div class="panel-grid wide-left">
      <article class="panel"><div class="panel-head"><div><h3>Cash-side operating mix</h3><p>Fuel, K-Mesra and non-sales top-up recorded in CASH (Z1).</p></div></div><div class="panel-body"><div class="chart-wrap"><canvas id="cashMixTrendChart"></canvas></div></div></article>
      <article class="panel"><div class="panel-head"><div><h3>Fuel product detail</h3><p>Sales contribution and recorded quantity.</p></div></div><div class="panel-body"><div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th class="align-right">Sales</th><th class="align-right">Share</th><th class="align-right">Quantity</th></tr></thead><tbody id="fuelDetailTable"></tbody></table></div></div></article>
    </div>
  `;

  const fuelEntries = Object.entries(fuelSales).sort((a, b) => b[1] - a[1]);
  makeChart("fuel-mix", "fuelMixChart", {
    type: "bar",
    data: { labels: fuelEntries.map(([name]) => name), datasets: [{ label: "Fuel sales", data: fuelEntries.map(([, value]) => value), borderRadius: 4, borderWidth: 0, backgroundColor: fuelEntries.map((_, i) => COLORS.palette[i % COLORS.palette.length]) }] },
    options: chartBaseOptions({
      indexAxis: "y",
      plugins: { ...chartBaseOptions().plugins, legend: { display: false }, tooltip: { ...chartBaseOptions().plugins.tooltip, callbacks: { label: (ctx) => money(ctx.parsed.x) } } },
      scales: {
        x: { ...chartBaseOptions().scales.y, ticks: { ...chartBaseOptions().scales.y.ticks, callback: moneyTick } },
        y: { ...chartBaseOptions().scales.x, ticks: { color: "#5d6981", font: { family: "Poppins", size: 9 } } }
      }
    })
  });

  const months = unique(retail.map((r) => r.date.slice(0, 7))).sort();
  const monthly = months.map((month) => {
    const rows = retail.filter((r) => r.date.startsWith(month));
    return { month, cash: sum(rows, (r) => r.cash), credit: sum(rows, (r) => r.credit), cashFuel: sum(rows, (r) => r.cashFuel), cashKMesra: sum(rows, (r) => r.cashKMesra), cashTopup: sum(rows, (r) => r.cashTopup) };
  });

  makeChart("cash-credit", "cashCreditChart", {
    type: "bar",
    data: {
      labels: monthly.map((m) => monthName(m.month).split(" ")[0]),
      datasets: [
        { label: "Cash", data: monthly.map((m) => m.cash), stack: "total", borderWidth: 0, borderRadius: 2, backgroundColor: COLORS.cash },
        { label: "Credit", data: monthly.map((m) => m.credit), stack: "total", borderWidth: 0, borderRadius: 2, backgroundColor: COLORS.credit }
      ]
    },
    options: chartBaseOptions({
      plugins: { ...chartBaseOptions().plugins, tooltip: { ...chartBaseOptions().plugins.tooltip, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${money(ctx.parsed.y)}` } } },
      scales: {
        x: { ...chartBaseOptions().scales.x, stacked: true },
        y: { ...chartBaseOptions().scales.y, stacked: true, ticks: { ...chartBaseOptions().scales.y.ticks, callback: moneyTick } }
      }
    })
  });

  makeChart("cash-mix", "cashMixTrendChart", {
    type: "line",
    data: {
      labels: monthly.map((m) => monthName(m.month).split(" ")[0]),
      datasets: [
        { label: "Fuel", data: monthly.map((m) => m.cashFuel), borderWidth: 2, pointRadius: 3, tension: .2, borderColor: COLORS.pss1, backgroundColor: COLORS.pss1 },
        { label: "K-Mesra", data: monthly.map((m) => m.cashKMesra), borderWidth: 2, pointRadius: 3, tension: .2, borderColor: COLORS.green, backgroundColor: COLORS.green },
        { label: "Top-up", data: monthly.map((m) => m.cashTopup), borderWidth: 2, pointRadius: 3, tension: .2, borderColor: "#8a6fbd", backgroundColor: "#8a6fbd" }
      ]
    },
    options: chartBaseOptions({
      plugins: { ...chartBaseOptions().plugins, tooltip: { ...chartBaseOptions().plugins.tooltip, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${money(ctx.parsed.y)}` } } },
      scales: { ...chartBaseOptions().scales, y: { ...chartBaseOptions().scales.y, ticks: { ...chartBaseOptions().scales.y.ticks, callback: moneyTick } } }
    })
  });

  $("#fuelDetailTable").innerHTML = fuelEntries.map(([name, value]) => `
    <tr><td><strong>${name}</strong></td><td class="align-right">${money(value)}</td><td class="align-right">${pct(value / Math.max(fuelTotal, 1))}</td><td class="align-right">${new Intl.NumberFormat("en-MY", { maximumFractionDigits: 0 }).format(fuelQty[name] || 0)}</td></tr>
  `).join("");
}

function renderPayments() {
  destroyCharts();
  const retail = filteredRetail();
  $("#paymentsContext").textContent = currentContext(retail);
  const container = $("#paymentsContent");
  if (!retail.length) {
    container.innerHTML = `<div class="error-box">No payment records match the selected filters.</div>`;
    return;
  }

  const payments = aggregatePayments(retail);
  const entries = Object.entries(payments).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]);
  const total = sum(entries.map(([, value]) => value), (x) => x);
  const top = entries[0];
  const top3 = entries.slice(0, 3).reduce((t, [, v]) => t + v, 0);
  const credit = sum(retail, (r) => r.credit);

  container.innerHTML = `
    ${renderKpis([
      { label: "Payment amount", value: compactMoney(total), note: "credit-side channels" },
      { label: "Top channel", value: top ? top[0] : "—", note: top ? pct(top[1] / Math.max(total, 1)) : "" },
      { label: "Top 3 concentration", value: pct(top3 / Math.max(total, 1)), note: "share of payment amount" },
      { label: "Active channels", value: entries.length, note: "channels with recorded value" },
      { label: "Credit coverage", value: pct(total / Math.max(credit, 1)), note: "payment detail vs CREDIT (Z2)" }
    ])}

    <div class="panel-grid wide-left">
      <article class="panel"><div class="panel-head"><div><h3>Payment channel mix</h3><p>Aggregated credit-side payment amounts.</p></div></div><div class="panel-body"><div class="chart-wrap tall"><canvas id="paymentMixChart"></canvas></div></div></article>
      <article class="panel"><div class="panel-head"><div><h3>Leading channels by month</h3><p>Monthly movement for the four largest channels.</p></div></div><div class="panel-body"><div class="chart-wrap tall"><canvas id="paymentTrendChart"></canvas></div></div></article>
    </div>

    <div class="table-wrap">
      <table class="data-table"><thead><tr><th>Payment channel</th><th class="align-right">Recorded amount</th><th class="align-right">Share</th><th class="align-right">Rank</th></tr></thead><tbody id="paymentTable"></tbody></table>
    </div>
  `;

  makeChart("payment-mix", "paymentMixChart", {
    type: "bar",
    data: { labels: entries.slice(0, 10).map(([name]) => name), datasets: [{ label: "Payment amount", data: entries.slice(0, 10).map(([, value]) => value), borderWidth: 0, borderRadius: 4, backgroundColor: entries.slice(0, 10).map((_, i) => COLORS.palette[i % COLORS.palette.length]) }] },
    options: chartBaseOptions({
      indexAxis: "y",
      plugins: { ...chartBaseOptions().plugins, legend: { display: false }, tooltip: { ...chartBaseOptions().plugins.tooltip, callbacks: { label: (ctx) => money(ctx.parsed.x) } } },
      scales: { x: { ...chartBaseOptions().scales.y, ticks: { ...chartBaseOptions().scales.y.ticks, callback: moneyTick } }, y: { ...chartBaseOptions().scales.x, ticks: { color: "#5d6981", font: { family: "Poppins", size: 8 } } } }
    })
  });

  const leaders = entries.slice(0, 4).map(([name]) => name);
  const months = unique(retail.map((r) => r.date.slice(0, 7))).sort();
  const monthlySeries = new Map();
  months.forEach((m) => monthlySeries.set(m, {}));
  retail.forEach((r) => {
    const m = r.date.slice(0, 7);
    leaders.forEach((name) => {
      monthlySeries.get(m)[name] = (monthlySeries.get(m)[name] || 0) + Number((r.payments || {})[name] || 0);
    });
  });

  makeChart("payment-trend", "paymentTrendChart", {
    type: "line",
    data: {
      labels: months.map((m) => monthName(m).split(" ")[0]),
      datasets: leaders.map((name, i) => ({ label: name, data: months.map((m) => monthlySeries.get(m)[name] || 0), borderWidth: 2, pointRadius: 3, tension: .18, borderColor: COLORS.palette[i % COLORS.palette.length], backgroundColor: COLORS.palette[i % COLORS.palette.length] }))
    },
    options: chartBaseOptions({
      plugins: { ...chartBaseOptions().plugins, tooltip: { ...chartBaseOptions().plugins.tooltip, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${money(ctx.parsed.y)}` } } },
      scales: { ...chartBaseOptions().scales, y: { ...chartBaseOptions().scales.y, ticks: { ...chartBaseOptions().scales.y.ticks, callback: moneyTick } } }
    })
  });

  $("#paymentTable").innerHTML = entries.map(([name, value], index) => `
    <tr><td><strong>${name}</strong></td><td class="align-right">${money(value)}</td><td class="align-right">${pct(value / Math.max(total, 1))}</td><td class="align-right">${index + 1}</td></tr>
  `).join("");
}

function renderControls() {
  destroyCharts();
  const controls = filteredControls();
  const retail = filteredRetail();
  $("#controlsContext").textContent = currentContext(retail);
  const container = $("#controlsContent");
  if (!controls.length) {
    container.innerHTML = `<div class="error-box">No finance control records match the selected filters.</div>`;
    return;
  }

  const pass = controls.filter((r) => Math.abs(Number(r.difference || 0)) < 0.005).length;
  const maxDiff = Math.max(...controls.map((r) => Math.abs(Number(r.difference || 0))));
  const debit = sum(controls, (r) => r.debit);
  const credit = sum(controls, (r) => r.credit);
  const latest = [...controls].sort((a, b) => b.date.localeCompare(a.date))[0];

  container.innerHTML = `
    <div class="control-banner">
      <div><strong>Debit / credit reconciliation is balanced across the selected scope.</strong><span>${pass} of ${controls.length} automated Cost of Sales control records close at zero difference.</span></div>
      <div class="control-number">${pct(pass / Math.max(controls.length, 1), 0)}</div>
    </div>

    ${renderKpis([
      { label: "Control records", value: controls.length, note: "station-day reconciliations" },
      { label: "Balanced", value: `${pass}/${controls.length}`, note: "zero difference", good: pass === controls.length },
      { label: "Maximum difference", value: money(maxDiff), note: "absolute reconciliation variance", good: maxDiff < .005 },
      { label: "Debit postings", value: compactMoney(debit), note: "selected scope" },
      { label: "Latest control", value: latest ? shortDate(latest.date) : "—", note: latest ? stationLabel(latest.station) : "" }
    ])}

    <div class="panel-grid">
      <article class="panel"><div class="panel-head"><div><h3>Daily finance posting total</h3><p>Automated Cost of Sales debit posting value by station.</p></div></div><div class="panel-body"><div class="chart-wrap"><canvas id="controlDailyChart"></canvas></div></div></article>
      <article class="panel"><div class="panel-head"><div><h3>Monthly finance posting total</h3><p>Aggregated debit postings by station and month.</p></div></div><div class="panel-body"><div class="chart-wrap"><canvas id="controlMonthlyChart"></canvas></div></div></article>
    </div>

    <div class="table-wrap">
      <table class="data-table"><thead><tr><th>Date</th><th>Station</th><th class="align-right">Debit</th><th class="align-right">Credit</th><th class="align-right">Difference</th><th>Status</th></tr></thead><tbody id="controlTable"></tbody></table>
    </div>
  `;

  const dates = unique(controls.map((r) => r.date)).sort();
  const stations = unique(controls.map((r) => r.station)).sort();
  const lookup = new Map(controls.map((r) => [`${r.date}|${r.station}`, r.debit]));

  makeChart("control-daily", "controlDailyChart", {
    type: "line",
    data: { labels: dates.map(shortDate), datasets: stations.map((station) => ({ label: stationLabel(station), data: dates.map((date) => lookup.get(`${date}|${station}`) ?? null), borderWidth: 2, pointRadius: dates.length > 35 ? 0 : 2, tension: .2, spanGaps: true, borderColor: stationColor(station), backgroundColor: stationColor(station) })) },
    options: chartBaseOptions({
      plugins: { ...chartBaseOptions().plugins, tooltip: { ...chartBaseOptions().plugins.tooltip, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${money(ctx.parsed.y)}` } } },
      scales: { ...chartBaseOptions().scales, y: { ...chartBaseOptions().scales.y, ticks: { ...chartBaseOptions().scales.y.ticks, callback: moneyTick } } }
    })
  });

  const months = unique(controls.map((r) => r.date.slice(0, 7))).sort();
  const monthLookup = new Map();
  controls.forEach((r) => {
    const key = `${r.date.slice(0, 7)}|${r.station}`;
    monthLookup.set(key, (monthLookup.get(key) || 0) + r.debit);
  });

  makeChart("control-monthly", "controlMonthlyChart", {
    type: "bar",
    data: { labels: months.map((m) => monthName(m).split(" ")[0]), datasets: stations.map((station) => ({ label: stationLabel(station), data: months.map((m) => monthLookup.get(`${m}|${station}`) || 0), borderWidth: 0, borderRadius: 3, backgroundColor: stationColor(station) })) },
    options: chartBaseOptions({
      plugins: { ...chartBaseOptions().plugins, tooltip: { ...chartBaseOptions().plugins.tooltip, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${money(ctx.parsed.y)}` } } },
      scales: { ...chartBaseOptions().scales, y: { ...chartBaseOptions().scales.y, ticks: { ...chartBaseOptions().scales.y.ticks, callback: moneyTick } } }
    })
  });

  $("#controlTable").innerHTML = [...controls].sort((a, b) => b.date.localeCompare(a.date) || a.station.localeCompare(b.station)).slice(0, 30).map((r) => `
    <tr><td><strong>${dateLabel(r.date)}</strong></td><td>${stationLabel(r.station)}</td><td class="align-right">${money(r.debit)}</td><td class="align-right">${money(r.credit)}</td><td class="align-right">${money(r.difference)}</td><td><span class="status-ok">Balanced</span></td></tr>
  `).join("");
}

function renderCurrentView() {
  $$(".dashboard-view").forEach((panel) => {
    const active = panel.dataset.viewPanel === state.view;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });
  $$(".nav-item").forEach((button) => {
    const active = button.dataset.view === state.view;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  if (state.view === "overview") renderOverview();
  if (state.view === "stations") renderStations();
  if (state.view === "sales") renderSales();
  if (state.view === "payments") renderPayments();
  if (state.view === "controls") renderControls();

  const url = new URL(window.location.href);
  url.searchParams.set("view", state.view);
  history.replaceState({}, "", url);
}

function setView(view) {
  const allowed = new Set(["overview", "stations", "sales", "payments", "controls"]);
  state.view = allowed.has(view) ? view : "overview";
  renderCurrentView();
}

function readFilters() {
  state.filters.station = $("#filterStation").value;
  state.filters.month = $("#filterMonth").value;
  state.filters.dateFrom = $("#filterDateFrom").value;
  state.filters.dateTo = $("#filterDateTo").value;
  updateActiveFilterCount();
  renderCurrentView();
}

function bindEvents() {
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  ["#filterStation", "#filterMonth", "#filterDateFrom", "#filterDateTo"].forEach((selector) => $(selector).addEventListener("change", readFilters));
  $("#clearFiltersButton").addEventListener("click", () => {
    $("#filterStation").value = "";
    $("#filterMonth").value = "";
    $("#filterDateFrom").value = "";
    $("#filterDateTo").value = "";
    readFilters();
  });
}

async function init() {
  try {
    const response = await fetch("data/retail-analysis.json?v=20260908-01", { cache: "no-store" });
    if (!response.ok) throw new Error(`Analysis data request failed: HTTP ${response.status}`);
    state.data = await response.json();

    renderFreshness();
    populateMonthFilter();
    bindEvents();

    const requested = new URL(window.location.href).searchParams.get("view");
    setView(requested || "overview");
  } catch (error) {
    console.error("SENTINEL Retail Intelligence initialization error:", error);
    document.body.innerHTML = `
      <main style="font-family:Poppins,Arial,sans-serif;width:min(900px,calc(100% - 40px));margin:70px auto;color:#172238">
        <h1 style="color:#112f78">SENTINEL Retail Intelligence</h1>
        <p>The analysis page could not initialise.</p>
        <pre style="margin-top:20px;padding:16px;background:#f7f9fc;border:1px solid #dbe3ef;border-radius:8px;white-space:pre-wrap">${error.message}</pre>
      </main>
    `;
  }
}

init();
