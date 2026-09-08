const state = {
  data: null,
  period: "all"
};

const $ = (selector) => document.querySelector(selector);

const STATION_LABELS = {
  PSS1: "PSS 1",
  PSS2: "PSS 2"
};

function stationLabel(id) {
  return STATION_LABELS[id] || id;
}

function number(value, digits = 0) {
  return new Intl.NumberFormat("en-MY", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(value || 0));
}

function money(value, digits = 2) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(value || 0)).replace("MYR", "RM");
}

function compactMoney(value) {
  const n = Number(value || 0);
  if (Math.abs(n) >= 1000000) return `RM${(n / 1000000).toFixed(2)}m`;
  if (Math.abs(n) >= 1000) return `RM${(n / 1000).toFixed(1)}k`;
  return money(n, 0);
}

function pct(decimal, digits = 1) {
  return `${(Number(decimal || 0) * 100).toFixed(digits)}%`;
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
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kuala_Lumpur"
  }).format(d);
}

function monthName(key, short = false) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    month: short ? "short" : "long",
    year: short ? undefined : "numeric",
    timeZone: "Asia/Kuala_Lumpur"
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function sum(rows, accessor) {
  return rows.reduce((total, row) => total + Number(accessor(row) || 0), 0);
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

function unique(values) {
  return [...new Set(values)];
}

function currentRetail() {
  if (state.period === "all") return state.data.retail;
  return state.data.retail.filter((row) => row.date.startsWith(state.period));
}

function currentControls() {
  if (state.period === "all") return state.data.controls;
  return state.data.controls.filter((row) => row.date.startsWith(state.period));
}

function aggregateObject(rows, field) {
  const totals = {};
  rows.forEach((row) => {
    Object.entries(row[field] || {}).forEach(([key, value]) => {
      totals[key] = (totals[key] || 0) + Number(value || 0);
    });
  });
  return totals;
}

function computeStats(retail, controls) {
  const total = sum(retail, (r) => r.total);
  const cash = sum(retail, (r) => r.cash);
  const credit = sum(retail, (r) => r.credit);

  const stationTotals = {};
  const stationCounts = {};
  retail.forEach((row) => {
    stationTotals[row.station] = (stationTotals[row.station] || 0) + Number(row.total || 0);
    stationCounts[row.station] = (stationCounts[row.station] || 0) + 1;
  });

  const monthlyTotals = {};
  const monthlyStation = {};
  retail.forEach((row) => {
    const month = row.date.slice(0, 7);
    monthlyTotals[month] = (monthlyTotals[month] || 0) + Number(row.total || 0);
    if (!monthlyStation[month]) monthlyStation[month] = {};
    monthlyStation[month][row.station] = (monthlyStation[month][row.station] || 0) + Number(row.total || 0);
  });

  const dailyCombined = {};
  retail.forEach((row) => {
    dailyCombined[row.date] = (dailyCombined[row.date] || 0) + Number(row.total || 0);
  });

  const dailyStation = {};
  retail.forEach((row) => {
    if (!dailyStation[row.date]) dailyStation[row.date] = {};
    dailyStation[row.date][row.station] = Number(row.total || 0);
  });

  const sortedDaily = Object.entries(dailyCombined).sort((a, b) => a[0].localeCompare(b[0]));
  const topDay = sortedDaily.length
    ? sortedDaily.reduce((best, item) => item[1] > best[1] ? item : best, sortedDaily[0])
    : ["", 0];

  const fuelTotals = aggregateObject(retail, "fuelSales");
  const fuelQty = aggregateObject(retail, "fuelQty");
  const paymentTotals = aggregateObject(retail, "payments");

  const controlTotal = sum(controls, (r) => r.debit);
  const controlCredit = sum(controls, (r) => r.credit);
  const controlFuel = sum(controls, (r) => r.fuel);
  const controlKMesra = sum(controls, (r) => r.kMesra);
  const balancedControls = controls.filter((r) => Math.abs(Number(r.difference || 0)) < 0.005).length;
  const maxDifference = controls.length
    ? Math.max(...controls.map((r) => Math.abs(Number(r.difference || 0))))
    : 0;

  const controlMonthlyStation = {};
  controls.forEach((row) => {
    const month = row.date.slice(0, 7);
    if (!controlMonthlyStation[month]) controlMonthlyStation[month] = {};
    controlMonthlyStation[month][row.station] = (controlMonthlyStation[month][row.station] || 0) + Number(row.debit || 0);
  });

  const sortedStations = Object.entries(stationTotals).sort((a, b) => b[1] - a[1]);
  const leadingStation = sortedStations[0] || ["—", 0];
  const secondStation = sortedStations[1] || ["—", 0];

  const stationAverages = {};
  Object.keys(stationTotals).forEach((station) => {
    stationAverages[station] = stationCounts[station]
      ? stationTotals[station] / stationCounts[station]
      : 0;
  });

  return {
    total,
    cash,
    credit,
    cashShare: total ? cash / total : 0,
    creditShare: total ? credit / total : 0,
    stationTotals,
    stationCounts,
    stationAverages,
    monthlyTotals,
    monthlyStation,
    dailyCombined,
    dailyStation,
    sortedDaily,
    topDay,
    fuelTotals,
    fuelQty,
    paymentTotals,
    controlTotal,
    controlCredit,
    controlFuel,
    controlKMesra,
    balancedControls,
    maxDifference,
    controlMonthlyStation,
    leadingStation,
    secondStation,
    retailCount: retail.length,
    controlCount: controls.length
  };
}

function periodText() {
  if (state.period === "all") {
    return `${dateLabel(state.data.meta.coverageStart)} – ${dateLabel(state.data.meta.latestDate)}`;
  }
  const rows = currentRetail();
  const dates = rows.map((r) => r.date).sort();
  if (!dates.length) return monthName(state.period);
  const isLatestMonth = state.data.meta.latestDate.startsWith(state.period);
  return isLatestMonth
    ? `${monthName(state.period)} MTD · through ${dateLabel(dates[dates.length - 1])}`
    : monthName(state.period);
}

function populatePeriodSelect() {
  const select = $("#periodSelect");
  const months = unique(state.data.retail.map((r) => r.date.slice(0, 7))).sort();

  const allLabel = `${monthName(months[0], true)} – ${monthName(months[months.length - 1], true)} 2026`;
  select.innerHTML = `<option value="all">${allLabel}</option>`;

  months.forEach((month) => {
    const latest = state.data.meta.latestDate.startsWith(month);
    const option = document.createElement("option");
    option.value = month;
    option.textContent = `${monthName(month)}${latest ? " MTD" : ""}`;
    select.appendChild(option);
  });

  const params = new URLSearchParams(window.location.search);
  const requested = params.get("period");
  if (requested && ["all", ...months].includes(requested)) {
    state.period = requested;
  }
  select.value = state.period;
}

function renderHero(stats) {
  const meta = state.data.meta;
  const leading = stats.leadingStation;
  const leadShare = stats.total ? leading[1] / stats.total : 0;
  const topDay = stats.topDay;

  let title;
  if (state.period === "all") {
    title = `${compactMoney(stats.total)} of recorded retail activity <em>since July.</em>`;
  } else {
    const isLatest = meta.latestDate.startsWith(state.period);
    title = `${compactMoney(stats.total)} of recorded retail activity in <em>${monthName(state.period, true)}${isLatest ? " MTD" : ""}.</em>`;
  }

  $("#heroTitle").innerHTML = title;

  $("#heroSummary").textContent =
    `SENTINEL has captured ${stats.retailCount} station-day retail records for ${Object.keys(stats.stationTotals).length} stations in the selected period. This page turns the automated station outputs into management analysis; the Automation Control Centre remains the execution and audit-evidence layer.`;

  const retailBooksInScope = state.period === "all"
    ? state.data.meta.retailWorkbookCount
    : Object.keys(stats.stationTotals).length;

  const costBooksInScope = state.period === "all"
    ? state.data.meta.costWorkbookCount
    : Object.keys(stats.stationTotals).length;

  $("#heroMeta").textContent =
    `${periodText()} · ${retailBooksInScope} retail workbooks · ${costBooksInScope} Cost of Sales workbooks`;

  const controlRate = stats.controlCount ? stats.balancedControls / stats.controlCount : 0;
  const heroStats = [
    {
      label: "Leading station share",
      value: pct(leadShare),
      note: `${stationLabel(leading[0])} · ${compactMoney(leading[1])}`,
      className: "blue"
    },
    {
      label: "Credit-side share",
      value: pct(stats.creditShare),
      note: `${compactMoney(stats.credit)} recorded credit value`
    },
    {
      label: "Peak combined day",
      value: topDay[0] ? compactMoney(topDay[1]) : "—",
      note: topDay[0] ? dateLabel(topDay[0]) : "No record"
    },
    {
      label: "Finance controls",
      value: `${stats.balancedControls}/${stats.controlCount}`,
      note: `balanced · max diff ${money(stats.maxDifference)}`,
      className: controlRate === 1 ? "good" : ""
    }
  ];

  $("#heroSide").innerHTML = heroStats.map((item) => `
    <div class="hero-stat">
      <div class="label">${item.label}</div>
      <div class="value ${item.className || ""}">${item.value}</div>
      <div class="note">${item.note}</div>
    </div>
  `).join("");
}

function renderFocus(stats) {
  const lead = stats.leadingStation;
  const second = stats.secondStation;
  const share = stats.total ? lead[1] / stats.total : 0;
  const gap = lead[1] - second[1];

  $("#focusNumber").textContent = pct(share);
  $("#focusLabel").textContent = `OF RECORDED RETAIL VALUE SITS IN ${stationLabel(lead[0])}`;
  $("#focusNote").textContent = `${stationLabel(lead[0])}: ${compactMoney(lead[1])} · ${stationLabel(second[0])}: ${compactMoney(second[1])}`;
  $("#focusInsight").innerHTML =
    `<strong>${stationLabel(lead[0])}</strong> is the larger volume engine in the selected period, ahead by ${compactMoney(gap)}. Its average recorded station-day value is ${compactMoney(stats.stationAverages[lead[0]])}, versus ${compactMoney(stats.stationAverages[second[0]])} for ${stationLabel(second[0])}.`;
}

function renderSignals(stats) {
  const averageStationDay = stats.retailCount ? stats.total / stats.retailCount : 0;
  const signals = [
    {
      label: "Recorded retail value",
      value: compactMoney(stats.total),
      note: `${stats.retailCount} station-day records in scope`,
      cls: "blue"
    },
    {
      label: "Average station-day",
      value: compactMoney(averageStationDay),
      note: "recorded retail value per station-day"
    },
    {
      label: "Credit-side share",
      value: pct(stats.creditShare),
      note: `${pct(stats.cashShare)} recorded as cash`
    },
    {
      label: "Max reconciliation diff",
      value: money(stats.maxDifference),
      note: `${stats.balancedControls}/${stats.controlCount} finance controls balanced`,
      cls: stats.maxDifference < 0.005 ? "good" : ""
    }
  ];

  $("#signals").innerHTML = signals.map((item) => `
    <div class="signal">
      <div class="slabel">${item.label}</div>
      <div class="svalue ${item.cls || ""}">${item.value}</div>
      <div class="snote">${item.note}</div>
    </div>
  `).join("");

  const latestMonth = state.data.meta.latestDate.slice(0, 7);
  $("#snapshotTitle").textContent = state.period === "all"
    ? "Two full months establish the baseline; September is still month-to-date."
    : state.period === latestMonth
      ? "September is a live month-to-date operating view."
      : `${monthName(state.period)} provides a complete monthly operating view.`;
}

function niceMax(value) {
  if (!value || value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  return Math.ceil(value / magnitude) * magnitude;
}

function renderDailyTrend(stats) {
  const target = $("#dailyTrendChart");
  const dates = Object.keys(stats.dailyStation).sort();
  if (!dates.length) {
    target.innerHTML = "";
    return;
  }

  const width = 760;
  const height = 300;
  const margin = { top: 18, right: 18, bottom: 42, left: 58 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const values = dates.flatMap((date) => [
    Number(stats.dailyStation[date].PSS1 || 0),
    Number(stats.dailyStation[date].PSS2 || 0)
  ]);
  const max = niceMax(Math.max(...values, 1));

  const x = (index) => margin.left + (dates.length === 1 ? plotW / 2 : (index / (dates.length - 1)) * plotW);
  const y = (value) => margin.top + plotH - (value / max) * plotH;

  const gridCount = 4;
  const grid = Array.from({ length: gridCount + 1 }, (_, i) => {
    const value = (max / gridCount) * i;
    const py = y(value);
    return `
      <line class="gridline" x1="${margin.left}" y1="${py}" x2="${width - margin.right}" y2="${py}"></line>
      <text class="chart-label" x="${margin.left - 10}" y="${py + 3}" text-anchor="end">${compactMoney(value).replace("RM", "")}</text>
    `;
  }).join("");

  const pss1 = dates.map((date, i) => `${x(i)},${y(stats.dailyStation[date].PSS1 || 0)}`).join(" ");
  const pss2 = dates.map((date, i) => `${x(i)},${y(stats.dailyStation[date].PSS2 || 0)}`).join(" ");

  let tickIndexes;
  if (dates.length <= 7) {
    tickIndexes = dates.map((_, i) => i);
  } else {
    const count = Math.min(5, dates.length);
    tickIndexes = unique(Array.from({ length: count }, (_, i) => Math.round((i / (count - 1)) * (dates.length - 1))));
  }

  const xLabels = tickIndexes.map((i) => `
    <text class="chart-label" x="${x(i)}" y="${height - 10}" text-anchor="middle">${shortDate(dates[i])}</text>
  `).join("");

  const last = dates.length - 1;
  const lastDots = `
    <circle class="dot" cx="${x(last)}" cy="${y(stats.dailyStation[dates[last]].PSS1 || 0)}" r="4"></circle>
    <circle class="dot pss2" cx="${x(last)}" cy="${y(stats.dailyStation[dates[last]].PSS2 || 0)}" r="4"></circle>
  `;

  target.innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily recorded retail value by station">
      ${grid}
      <polyline class="series" points="${pss1}"></polyline>
      <polyline class="series pss2" points="${pss2}"></polyline>
      ${lastDots}
      ${xLabels}
    </svg>
    <div class="legend-row">
      <span class="legend-key"><i></i>PSS 1</span>
      <span class="legend-key pss2"><i></i>PSS 2</span>
    </div>
  `;

  $("#dailyTrendCaption").textContent = `${periodText()} · daily station value extracted from automated retail reports`;
}

function renderTrendCopy(stats) {
  const months = Object.keys(stats.monthlyTotals).sort();
  const peak = stats.topDay;
  let lead = `The strongest combined trading day in scope was ${peak[0] ? dateLabel(peak[0]) : "—"}, at ${compactMoney(peak[1])}.`;
  let paragraph = `Across the selected period, the average combined recorded day is ${compactMoney(stats.sortedDaily.length ? stats.total / stats.sortedDaily.length : 0)} across both stations.`;
  let callout = "Use the daily pattern to separate recurring operating behaviour from one-off peaks before acting on a single date.";

  if (state.period === "all" && months.includes("2026-07") && months.includes("2026-08")) {
    const jul = stats.monthlyTotals["2026-07"] || 0;
    const aug = stats.monthlyTotals["2026-08"] || 0;
    const change = jul ? (aug - jul) / jul : 0;
    lead = `August closed ${pct(Math.abs(change))} ${change >= 0 ? "above" : "below"} July, moving from ${compactMoney(jul)} to ${compactMoney(aug)}.`;
    paragraph = `The full-month baseline is therefore relatively stable, while the highest combined day was ${dateLabel(peak[0])} at ${compactMoney(peak[1])}.`;
    callout = `September is month-to-date through ${dateLabel(state.data.meta.latestDate)}. Its raw total should not be compared directly with completed July or August.`;
  }

  $("#trendCopy").innerHTML = `
    <p class="lead">${lead}</p>
    <p>${paragraph}</p>
    <p>PSS 1 remains the larger station on most of the period, so movement in PSS 1 has the greater effect on the combined retail curve.</p>
    <div class="callout">${callout}</div>
  `;
}

function renderGroupedBars(targetId, groups, series, formatter = compactMoney) {
  const target = $(targetId);
  if (!target || !groups.length) return;

  const width = 720;
  const height = 285;
  const margin = { top: 20, right: 16, bottom: 44, left: 58 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const allValues = groups.flatMap((g) => series.map((s) => Number(g.values[s.key] || 0)));
  const max = niceMax(Math.max(...allValues, 1));
  const y = (v) => margin.top + plotH - (v / max) * plotH;

  const gridCount = 4;
  const grid = Array.from({ length: gridCount + 1 }, (_, i) => {
    const value = (max / gridCount) * i;
    const py = y(value);
    return `
      <line class="gridline" x1="${margin.left}" y1="${py}" x2="${width - margin.right}" y2="${py}"></line>
      <text class="chart-label" x="${margin.left - 10}" y="${py + 3}" text-anchor="end">${compactMoney(value).replace("RM", "")}</text>
    `;
  }).join("");

  const groupW = plotW / groups.length;
  const innerW = Math.min(groupW * .68, 120);
  const barW = Math.min(36, innerW / series.length - 4);

  const bars = groups.map((group, groupIndex) => {
    const center = margin.left + groupW * groupIndex + groupW / 2;
    const totalBarsW = barW * series.length + 8 * (series.length - 1);
    const start = center - totalBarsW / 2;

    const seriesBars = series.map((s, seriesIndex) => {
      const value = Number(group.values[s.key] || 0);
      const bx = start + seriesIndex * (barW + 8);
      const by = y(value);
      const bh = margin.top + plotH - by;
      return `<rect class="${s.className}" x="${bx}" y="${by}" width="${barW}" height="${bh}"></rect>`;
    }).join("");

    return `
      ${seriesBars}
      <text class="chart-label" x="${center}" y="${height - 10}" text-anchor="middle">${group.label}</text>
    `;
  }).join("");

  target.innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img">
      ${grid}
      ${bars}
    </svg>
    <div class="legend-row">
      ${series.map((s) => `<span class="legend-key ${s.legendClass || ""}"><i></i>${s.label}</span>`).join("")}
    </div>
  `;
}

function renderStationSection(stats) {
  const months = Object.keys(stats.monthlyStation).sort();
  const groups = months.map((month) => ({
    label: monthName(month, true),
    values: stats.monthlyStation[month]
  }));

  renderGroupedBars("#stationChart", groups, [
    { key: "PSS1", label: "PSS 1", className: "bar-pss1" },
    { key: "PSS2", label: "PSS 2", className: "bar-pss2", legendClass: "pss2" }
  ]);

  const lead = stats.leadingStation;
  const second = stats.secondStation;
  const leadShare = stats.total ? lead[1] / stats.total : 0;
  const gap = lead[1] - second[1];

  $("#stationTitle").textContent = `${stationLabel(lead[0])} carries ${pct(leadShare)} of recorded retail value.`;
  $("#stationCopy").innerHTML = `
    <p class="lead">${stationLabel(lead[0])} recorded ${compactMoney(lead[1])}, compared with ${compactMoney(second[1])} for ${stationLabel(second[0])}.</p>
    <p>The average station-day is ${compactMoney(stats.stationAverages[lead[0]])} for ${stationLabel(lead[0])} and ${compactMoney(stats.stationAverages[second[0]])} for ${stationLabel(second[0])}.</p>
    <p>The absolute value gap in the selected period is <strong>${compactMoney(gap)}</strong>.</p>
    <div class="callout">The station comparison is volume-based. It does not by itself explain profitability, site capacity, traffic or operating-cost differences.</div>
  `;
  $("#stationCaption").textContent = `${periodText()} · monthly totals from daily station records`;
}

function renderHorizontalBars(targetId, entries, total, limit = 6) {
  const target = $(targetId);
  const sorted = entries.sort((a, b) => b[1] - a[1]).slice(0, limit);
  const max = sorted.length ? sorted[0][1] : 1;

  target.innerHTML = `
    <div class="hbar-list">
      ${sorted.map(([name, value], index) => `
        <div class="hbar-row">
          <div class="hbar-name">${name}</div>
          <div class="hbar-track">
            <div class="hbar-fill ${index > 0 ? "alt" : ""}" style="width:${max ? (value / max) * 100 : 0}%"></div>
          </div>
          <div class="hbar-value">
            ${compactMoney(value)}
            <small>${total ? pct(value / total) : "0.0%"}</small>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderMixSection(stats) {
  const fuelEntries = Object.entries(stats.fuelTotals);
  const fuelTotal = fuelEntries.reduce((sumValue, [, value]) => sumValue + Number(value || 0), 0);
  renderHorizontalBars("#fuelMixChart", fuelEntries, fuelTotal, 8);

  const sorted = [...fuelEntries].sort((a, b) => b[1] - a[1]);
  const first = sorted[0] || ["—", 0];
  const second = sorted[1] || ["—", 0];
  const firstShare = fuelTotal ? first[1] / fuelTotal : 0;
  const secondShare = fuelTotal ? second[1] / fuelTotal : 0;

  $("#mixTitle").textContent = `${first[0]} contributes ${pct(firstShare)} of recorded fuel value.`;
  $("#mixCopy").innerHTML = `
    <p class="lead">${first[0]} is the dominant fuel line at ${compactMoney(first[1])}, followed by ${second[0]} at ${compactMoney(second[1])}.</p>
    <p>Together, the two largest fuel products represent <strong>${pct(firstShare + secondShare)}</strong> of recorded fuel value in scope.</p>
    <p>Across all retail value, cash contributes ${pct(stats.cashShare)} while the credit side contributes ${pct(stats.creditShare)}.</p>
    <div class="callout">Product concentration is useful for demand and assortment monitoring, but the report does not contain margin by product.</div>
  `;
  $("#fuelMixCaption").textContent = `${periodText()} · fuel values aggregated from CASH (Z1) + CREDIT (Z2)`;
}

function renderPaymentSection(stats) {
  const entries = Object.entries(stats.paymentTotals).filter(([, value]) => Number(value || 0) > 0);
  const paymentTotal = entries.reduce((sumValue, [, value]) => sumValue + Number(value || 0), 0);
  renderHorizontalBars("#paymentChart", entries, paymentTotal, 7);

  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const first = sorted[0] || ["—", 0];
  const second = sorted[1] || ["—", 0];
  const topTwoShare = paymentTotal ? (first[1] + second[1]) / paymentTotal : 0;
  const topFour = sorted.slice(0, 4).reduce((sumValue, [, value]) => sumValue + Number(value || 0), 0);

  $("#paymentTitle").textContent = `${first[0]} and ${second[0]} account for ${pct(topTwoShare)} of recorded payment-channel value.`;
  $("#paymentCopy").innerHTML = `
    <p class="lead">${first[0]} is the largest recorded payment channel at ${compactMoney(first[1])}; ${second[0]} follows at ${compactMoney(second[1])}.</p>
    <p>The four largest channels represent <strong>${pct(paymentTotal ? topFour / paymentTotal : 0)}</strong> of captured payment-channel value.</p>
    <p>This view analyses the CREDIT (Z2) payment lines; cash is reported separately in the retail mix.</p>
    <div class="callout">A concentrated payment mix can help focus channel monitoring, reconciliation checks and future customer-payment analysis.</div>
  `;
  $("#paymentCaption").textContent = `${periodText()} · payment-channel values from CREDIT (Z2)`;
}

function renderControlSection(stats) {
  const months = Object.keys(stats.controlMonthlyStation).sort();
  const groups = months.map((month) => ({
    label: monthName(month, true),
    values: stats.controlMonthlyStation[month]
  }));

  renderGroupedBars("#controlChart", groups, [
    { key: "PSS1", label: "PSS 1", className: "bar-cos1" },
    { key: "PSS2", label: "PSS 2", className: "bar-cos2", legendClass: "pss2" }
  ]);

  const fuelShare = stats.controlTotal ? stats.controlFuel / stats.controlTotal : 0;
  const kShare = stats.controlTotal ? stats.controlKMesra / stats.controlTotal : 0;
  const passRate = stats.controlCount ? stats.balancedControls / stats.controlCount : 0;

  $("#controlTitle").textContent = stats.maxDifference < 0.005
    ? `All ${stats.controlCount} selected Cost of Sales records reconcile to zero difference.`
    : `Finance reconciliation requires attention in the selected period.`;

  $("#controlCopy").innerHTML = `
    <p class="lead">The selected Cost of Sales outputs contain ${compactMoney(stats.controlTotal)} of debit postings and the same amount of credit postings.</p>
    <p>Fuel represents <strong>${pct(fuelShare)}</strong> of the Cost of Sales posting value; K-Mesra represents ${pct(kShare)}.</p>
    <p>The maximum debit / credit difference observed is ${money(stats.maxDifference)}.</p>
    <div class="callout green">${stats.balancedControls}/${stats.controlCount} records pass the zero-difference reconciliation check.</div>
  `;

  $("#controlCaption").textContent = `${periodText()} · Cost of Sales debit postings by station`;

  const cells = [
    { label: "Control records", value: number(stats.controlCount), note: "automated Cost of Sales records" },
    { label: "Balanced", value: pct(passRate), note: `${stats.balancedControls}/${stats.controlCount} records`, good: passRate === 1 },
    { label: "Total postings", value: compactMoney(stats.controlTotal), note: "debit value; credits match" },
    { label: "Maximum difference", value: money(stats.maxDifference), note: "debit minus credit", good: stats.maxDifference < 0.005 }
  ];

  $("#controlStrip").innerHTML = cells.map((cell) => `
    <div class="control-cell">
      <div class="label">${cell.label}</div>
      <div class="value ${cell.good ? "good" : ""}">${cell.value}</div>
      <div class="note">${cell.note}</div>
    </div>
  `).join("");
}

function renderManagementReadout(stats) {
  const fuelEntries = Object.entries(stats.fuelTotals).sort((a, b) => b[1] - a[1]);
  const fuelTotal = fuelEntries.reduce((s, [, v]) => s + v, 0);
  const leadingFuel = fuelEntries[0] || ["—", 0];
  const fuelShare = fuelTotal ? leadingFuel[1] / fuelTotal : 0;

  const paymentEntries = Object.entries(stats.paymentTotals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const paymentTotal = paymentEntries.reduce((s, [, v]) => s + v, 0);
  const topTwoPayments = paymentEntries.slice(0, 2);
  const topTwoPaymentShare = paymentTotal
    ? topTwoPayments.reduce((s, [, v]) => s + v, 0) / paymentTotal
    : 0;

  const leadStation = stats.leadingStation;
  const leadStationShare = stats.total ? leadStation[1] / stats.total : 0;

  $("#readoutTitle").innerHTML = `The operating picture is <em>concentrated but controlled.</em>`;
  $("#readoutQuote").textContent = `${stationLabel(leadStation[0])} carries the larger retail volume, ${leadingFuel[0]} dominates fuel value, and the finance outputs remain fully reconciled in the selected period.`;
  $("#readoutCopy").innerHTML = `
    <p>The analysis layer is deliberately different from the Automation Control Centre. The Control Centre proves that SENTINEL executed and generated traceable outputs; this page uses those outputs to identify operating patterns.</p>
    <p>Current concentration is visible at three levels: station volume, fuel-product mix and payment-channel mix. These are useful management signals, but should be interpreted with site capacity, margin and operational context before decisions are made.</p>
  `;

  const actions = [
    {
      kicker: "VOLUME",
      title: `${stationLabel(leadStation[0])} · ${pct(leadStationShare)}`,
      text: "Largest share of recorded retail value. Track whether the station gap remains consistent as more months accumulate."
    },
    {
      kicker: "MIX",
      title: `${leadingFuel[0]} · ${pct(fuelShare)}`,
      text: `Largest fuel-value concentration. Top two payment channels also account for ${pct(topTwoPaymentShare)} of captured payment value.`
    },
    {
      kicker: "CONTROL",
      title: `${stats.balancedControls}/${stats.controlCount} balanced`,
      text: `Maximum debit / credit difference is ${money(stats.maxDifference)} across the selected Cost of Sales records.`
    }
  ];

  $("#readoutActions").innerHTML = actions.map((action) => `
    <div class="action">
      <div class="ak">${action.kicker}</div>
      <h3>${action.title}</h3>
      <p>${action.text}</p>
    </div>
  `).join("");
}

function renderAll() {
  const retail = currentRetail();
  const controls = currentControls();
  const stats = computeStats(retail, controls);

  renderHero(stats);
  renderFocus(stats);
  renderSignals(stats);
  renderDailyTrend(stats);
  renderTrendCopy(stats);
  renderStationSection(stats);
  renderMixSection(stats);
  renderPaymentSection(stats);
  renderControlSection(stats);
  renderManagementReadout(stats);

  $("#footerBasis").textContent = `${stats.retailCount} retail + ${stats.controlCount} control records · ${periodText()}`;
}

function bind() {
  $("#periodSelect").addEventListener("change", (event) => {
    state.period = event.target.value;

    const params = new URLSearchParams(window.location.search);
    params.set("view", "overview");
    if (state.period === "all") params.delete("period");
    else params.set("period", state.period);
    history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);

    renderAll();
  });
}

function applyViewParam() {
  const view = new URLSearchParams(window.location.search).get("view");
  const map = {
    overview: "overview",
    stations: "stations",
    station: "stations",
    sales: "mix",
    mix: "mix",
    payments: "payments",
    controls: "controls",
    trend: "trend"
  };

  const id = map[view];
  if (id && id !== "overview") {
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "auto", block: "start" });
    });
  }
}

async function init() {
  try {
    const response = await fetch("data/retail-analysis.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Retail analysis data request failed: HTTP ${response.status}`);

    state.data = await response.json();
    $("#sourceFolderLink").href = state.data.meta.sourceFolderUrl;

    populatePeriodSelect();
    bind();
    renderAll();
    applyViewParam();
  } catch (error) {
    console.error("SENTINEL Retail Intelligence error:", error);
    $("#analysisTop").hidden = true;
    $("#errorScreen").hidden = false;
    $("#errorMessage").textContent = error.message;
  }
}

init();
