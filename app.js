const state = {
  data: null,
  auditPage: 1,
  auditPageSize: 18
};


const $ = (selector) =>
  document.querySelector(selector);



/* =========================================================
   HELPERS
========================================================= */


function money(value) {

  return new Intl.NumberFormat(
    "en-MY",
    {
      style: "currency",
      currency: "MYR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  )
    .format(value)
    .replace("MYR", "RM");
}



function dateLabel(
  iso,
  withTime = false
) {

  const date =
    new Date(iso);


  const options =
    withTime
      ? {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Kuala_Lumpur"
        }
      : {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Kuala_Lumpur"
        };


  return new Intl.DateTimeFormat(
    "en-GB",
    options
  )
    .format(date)
    .replace(",", "");
}



function dateOnlyLabel(iso) {

  const date =
    new Date(
      `${iso}T00:00:00+08:00`
    );


  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kuala_Lumpur"
    }
  ).format(date);
}



function daysInclusive(
  start,
  end
) {

  const first =
    new Date(
      `${start}T00:00:00+08:00`
    );


  const last =
    new Date(
      `${end}T00:00:00+08:00`
    );


  return (
    Math.round(
      (last - first) /
      86400000
    ) + 1
  );
}



function monthLabel(key) {

  const month =
    state.data.months.find(
      (item) =>
        item.key === key
    );


  return month
    ? month.label
    : key;
}



function stationName(id) {

  const station =
    state.data.stations.find(
      (item) =>
        item.id === id
    );


  return station
    ? station.name
    : id;
}



function showToast(message) {

  const toast =
    $("#toast");


  if (!toast) {
    return;
  }


  toast.textContent =
    message;


  toast.classList.add(
    "show"
  );


  setTimeout(
    () => {
      toast.classList.remove(
        "show"
      );
    },
    1800
  );
}



/* =========================================================
   METRICS
========================================================= */


function buildMetrics() {

  const {
    meta,
    stations,
    workbooks,
    months,
    latestValidation
  } = state.data;


  const uniqueDays =
    daysInclusive(
      meta.coverageStart,
      meta.latestDataDate
    );


  const stationDays =
    months.reduce(
      (
        total,
        month
      ) => {

        const monthStationDays =
          Object.values(
            month.coverage
          ).reduce(
            (
              sum,
              value
            ) =>
              sum +
              Number(
                value || 0
              ),
            0
          );


        return (
          total +
          monthStationDays
        );
      },
      0
    );


  const differences =
    latestValidation.map(
      (item) =>
        Math.abs(
          Number(
            item.difference || 0
          )
        )
    );


  const maxDifference =
    differences.length
      ? Math.max(
          ...differences
        )
      : 0;


  $("#metricStations").textContent =
    stations.length;


  $("#metricDays").textContent =
    uniqueDays;


  $("#metricStationDays").textContent =
    stationDays;


  $("#metricBooks").textContent =
    workbooks.length;


  $("#metricDifference").textContent =
    money(
      maxDifference
    );


  $("#metricDaysSub").textContent =
    `${dateOnlyLabel(
      meta.coverageStart
    )} – ${dateOnlyLabel(
      meta.latestDataDate
    )}`;


  $("#latestDataDate").textContent =
    dateOnlyLabel(
      meta.latestDataDate
    );


  $("#latestFileUpdate").textContent =
    dateLabel(
      meta.latestFileModifiedAt,
      true
    );


  $("#sourceFolderTop").href =
    meta.sourceFolderUrl;


  $("#snapshotAt").textContent =
    dateLabel(
      meta.dashboardSnapshotAt,
      true
    );


  $("#evidenceBasis").textContent =
    meta.evidenceBasis;


  const latestValidationDate =
    latestValidation.length
      ? latestValidation[0].date
      : meta.latestDataDate;


  $("#validationSubtitle").textContent =
    `Latest Cost of Sales output · ${dateOnlyLabel(
      latestValidationDate
    )}`;


  $("#latestValidationDate").textContent =
    dateOnlyLabel(
      latestValidationDate
    );
}



/* =========================================================
   CHART 1
   MONTHLY VERIFIED STATION-DAY RECORDS

   July      31 + 31 = 62
   August    31 + 31 = 62
   September 7 + 7   = 14

   Total = 138
========================================================= */


function buildCoverageTrendChart() {

  const target =
    $("#coverageTrendChart");


  if (!target) {
    return;
  }


  const data =
    state.data.months.map(
      (month) => {

        const monthTotal =
          Object.values(
            month.coverage
          ).reduce(
            (
              sum,
              value
            ) =>
              sum +
              Number(
                value || 0
              ),
            0
          );


        return {
          label:
            month.label.replace(
              " 2026",
              ""
            ),

          value:
            monthTotal
        };
      }
    );


  const totalVerified =
    data.reduce(
      (
        sum,
        item
      ) =>
        sum +
        item.value,
      0
    );


  $("#coverageTrendTotal").textContent =
    totalVerified.toLocaleString(
      "en-MY"
    );


  const width =
    720;


  const height =
    250;


  const margin = {
    top: 28,
    right: 30,
    bottom: 45,
    left: 48
  };


  const plotWidth =
    width -
    margin.left -
    margin.right;


  const plotHeight =
    height -
    margin.top -
    margin.bottom;


  const maxValue =
    Math.max(
      ...data.map(
        (item) =>
          item.value
      ),
      1
    );


  const chartMax =
    Math.max(
      10,
      Math.ceil(
        maxValue / 10
      ) * 10
    );


  const x =
    (index) => {

      if (
        data.length === 1
      ) {

        return (
          margin.left +
          plotWidth / 2
        );
      }


      return (
        margin.left +
        (
          plotWidth /
          (
            data.length -
            1
          )
        ) *
        index
      );
    };


  const y =
    (value) =>
      margin.top +
      plotHeight -
      (
        value /
        chartMax
      ) *
      plotHeight;



  /* GRID */


  const gridCount =
    4;


  const gridLines =
    Array.from(
      {
        length:
          gridCount + 1
      },
      (
        _,
        index
      ) => {

        const value =
          Math.round(
            (
              chartMax /
              gridCount
            ) *
            index
          );


        const py =
          y(value);


        return `
          <line
            class="chart-grid-line"
            x1="${margin.left}"
            y1="${py}"
            x2="${width - margin.right}"
            y2="${py}"
          />

          <text
            class="chart-axis-text"
            x="${margin.left - 10}"
            y="${py + 4}"
            text-anchor="end"
          >
            ${value}
          </text>
        `;
      }
    ).join("");



  /* POINTS */


  const points =
    data.map(
      (
        item,
        index
      ) =>
        `${x(index)},${y(
          item.value
        )}`
    );



  /* AREA */


  const areaPoints = [

    `${x(0)},${
      margin.top +
      plotHeight
    }`,

    ...points,

    `${
      x(
        data.length - 1
      )
    },${
      margin.top +
      plotHeight
    }`

  ].join(" ");



  /* X LABELS */


  const labels =
    data.map(
      (
        item,
        index
      ) => `

        <text
          class="chart-month-text"
          x="${x(index)}"
          y="${height - 14}"
          text-anchor="middle"
        >
          ${item.label}
        </text>

      `
    ).join("");



  /* DATA LABELS */


  const markers =
    data.map(
      (
        item,
        index
      ) => `

        <circle
          class="chart-point"
          cx="${x(index)}"
          cy="${y(item.value)}"
          r="5"
        />


        <text
          class="chart-point-value"
          x="${x(index)}"
          y="${
            y(item.value) -
            13
          }"
          text-anchor="middle"
        >
          ${item.value}
        </text>

      `
    ).join("");



  target.innerHTML = `

    <svg
      viewBox="0 0 ${width} ${height}"
      role="img"
      aria-label="Verified station-day records by month"
    >

      ${gridLines}


      <polygon
        class="chart-area"
        points="${areaPoints}"
      />


      <polyline
        class="chart-line"
        points="${points.join(
          " "
        )}"
      />


      ${markers}

      ${labels}

    </svg>

  `;
}



/* =========================================================
   CHART 2
   LATEST VALIDATED FINANCE TOTALS
========================================================= */


function buildValidationTotalsChart() {

  const target =
    $("#validationTotalsChart");


  if (!target) {
    return;
  }


  const values =
    state.data.latestValidation.map(
      (item) => ({
        station:
          stationName(
            item.station
          ),

        total:
          Number(
            item.total || 0
          )
      })
    );


  const width =
    600;


  const height =
    250;


  const left =
    90;


  const right =
    25;


  const barArea =
    width -
    left -
    right;


  const maxValue =
    Math.max(
      ...values.map(
        (item) =>
          item.total
      ),
      1
    );


  const rows =
    values.map(
      (
        item,
        index
      ) => {

        const rowY =
          58 +
          index * 85;


        const barWidth =
          (
            item.total /
            maxValue
          ) *
          barArea;


        return `

          <text
            class="chart-bar-label"
            x="0"
            y="${rowY + 18}"
          >
            ${item.station}
          </text>


          <rect
            class="chart-bar-bg"
            x="${left}"
            y="${rowY}"
            width="${barArea}"
            height="18"
            rx="3"
          />


          <rect
            class="chart-bar"
            x="${left}"
            y="${rowY}"
            width="${barWidth}"
            height="18"
            rx="3"
          />


          <text
            class="chart-bar-value"
            x="${left}"
            y="${rowY - 11}"
          >
            ${money(
              item.total
            )}
          </text>

        `;
      }
    ).join("");


  target.innerHTML = `

    <svg
      viewBox="0 0 ${width} ${height}"
      role="img"
      aria-label="Latest validated Cost of Sales totals by station"
    >

      ${rows}

    </svg>

  `;
}



/* =========================================================
   COVERAGE CALENDAR
========================================================= */


function buildCoverage() {

  const wrap =
    $("#coverageGrid");


  if (!wrap) {
    return;
  }


  wrap.innerHTML =
    "";


  state.data.months.forEach(
    (month) => {


      const card =
        document.createElement(
          "article"
        );


      card.className =
        "month-card";


      const coverageValues =
        Object.values(
          month.coverage
        ).map(
          (value) =>
            Number(
              value || 0
            )
        );


      const maxCovered =
        coverageValues.length
          ? Math.max(
              ...coverageValues
            )
          : 0;



      card.innerHTML = `

        <div class="month-card-header">

          <div>

            <h3>
              ${month.label}
            </h3>

            <small>

              ${
                month.status ===
                "complete"

                  ? "Full month present"

                  : `Records through day ${maxCovered}`
              }

            </small>

          </div>


          <span
            class="month-status ${month.status}"
          >

            ${
              month.status ===
              "complete"

                ? "Complete"

                : "Current month"
            }

          </span>

        </div>



        ${state.data.stations
          .map(
            (station) => {


              const through =
                Number(
                  month.coverage[
                    station.id
                  ] || 0
                );


              const cells =
                Array.from(
                  {
                    length:
                      month.daysInMonth
                  },
                  (
                    _,
                    index
                  ) => {


                    const day =
                      index + 1;


                    const done =
                      day <=
                      through;


                    return `

                      <span
                        class="day-cell ${
                          done
                            ? "done"
                            : "future"
                        }"

                        title="${
                          month.label
                        } day ${day}: ${
                          done
                            ? "dated record present"
                            : "record not loaded"
                        }"
                      >

                        ${day}

                      </span>

                    `;
                  }
                ).join("");


              return `

                <div class="station-coverage">


                  <div class="station-row-head">

                    <strong>
                      ${station.name}
                    </strong>


                    <span>
                      ${through} dated records
                    </span>

                  </div>


                  <div class="day-grid">

                    ${cells}

                  </div>


                </div>

              `;
            }
          )
          .join("")}

      `;


      wrap.appendChild(
        card
      );

    }
  );
}



/* =========================================================
   VALIDATION
========================================================= */


function buildValidation() {

  const wrap =
    $("#validationGrid");


  if (!wrap) {
    return;
  }


  wrap.innerHTML =
    "";


  state.data.latestValidation.forEach(
    (validation) => {


      const card =
        document.createElement(
          "article"
        );


      card.className =
        "validation-card";


      card.innerHTML = `

        <div class="validation-station">


          <div class="station-badge">

            ${stationName(
              validation.station
            )}

          </div>


          <h3>

            ${stationName(
              validation.station
            )}

          </h3>


          <small>

            ${dateOnlyLabel(
              validation.date
            )}

            · Cost of Sales

          </small>


        </div>



        <div class="validation-values">


          <div class="value-row">

            <span>
              Fuel
            </span>

            <strong>
              ${money(
                validation.fuel
              )}
            </strong>

          </div>



          <div class="value-row">

            <span>
              K-Mesra
            </span>

            <strong>
              ${money(
                validation.kMesra
              )}
            </strong>

          </div>



          <div class="value-row total">

            <span>
              Total
            </span>

            <strong>
              ${money(
                validation.total
              )}
            </strong>

          </div>



          <div class="reconcile-strip">

            <span>
              Debit / Credit reconciliation
            </span>

            <strong>

              Diff ${money(
                validation.difference
              )}

            </strong>

          </div>


        </div>

      `;


      wrap.appendChild(
        card
      );

    }
  );
}



/* =========================================================
   FILTERS
========================================================= */


function populateFilters() {

  const monthOptions =
    state.data.months
      .map(
        (month) =>
          `
            <option value="${month.key}">
              ${month.label}
            </option>
          `
      )
      .join("");


  $("#monthFilter")
    .insertAdjacentHTML(
      "beforeend",
      monthOptions
    );


  $("#auditMonthFilter")
    .insertAdjacentHTML(
      "beforeend",
      monthOptions
    );


  const stationOptions =
    state.data.stations
      .map(
        (station) =>
          `
            <option value="${station.id}">
              ${station.name}
            </option>
          `
      )
      .join("");


  $("#stationFilter")
    .insertAdjacentHTML(
      "beforeend",
      stationOptions
    );
}



/* =========================================================
   OUTPUT ARCHIVE
========================================================= */


function renderArchive() {

  const month =
    $("#monthFilter").value;


  const station =
    $("#stationFilter").value;


  const rows =
    state.data.workbooks
      .filter(
        (workbook) => {

          const monthMatch =
            month === "all" ||
            workbook.month === month;


          const stationMatch =
            station === "all" ||
            workbook.station ===
              station;


          return (
            monthMatch &&
            stationMatch
          );
        }
      )
      .sort(
        (
          first,
          second
        ) =>

          second.month.localeCompare(
            first.month
          ) ||

          first.station.localeCompare(
            second.station
          ) ||

          first.type.localeCompare(
            second.type
          )
      );


  $("#archiveBody").innerHTML =
    rows.map(
      (workbook) => `

        <tr>


          <td>

            <strong>
              ${monthLabel(
                workbook.month
              )}
            </strong>

          </td>


          <td>

            ${stationName(
              workbook.station
            )}

          </td>


          <td>

            ${workbook.type}

          </td>


          <td>

            <a
              class="file-link"
              href="${workbook.url}"
              target="_blank"
              rel="noreferrer"
            >

              <span class="file-icon">
                ▤
              </span>


              <span>
                ${workbook.title}
              </span>


              <span class="external">
                ↗
              </span>

            </a>

          </td>


          <td>

            ${dateLabel(
              workbook.modifiedAt,
              true
            )}

          </td>


          <td>

            <span class="status-chip">
              Available
            </span>

          </td>


        </tr>

      `
    ).join("");
}



/* =========================================================
   AUDIT DATA
========================================================= */


function getAuditRows() {

  const rows =
    [];


  state.data.months.forEach(
    (month) => {


      state.data.stations.forEach(
        (station) => {


          const through =
            Number(
              month.coverage[
                station.id
              ] || 0
            );


          for (
            let day = 1;
            day <= through;
            day++
          ) {


            const [
              year,
              monthNumber
            ] =
              month.key.split(
                "-"
              );


            const date =
              `${year}-${monthNumber}-${String(
                day
              ).padStart(
                2,
                "0"
              )}`;


            const report =
              state.data.workbooks.find(
                (workbook) =>

                  workbook.month ===
                    month.key &&

                  workbook.station ===
                    station.id &&

                  workbook.type ===
                    "Monthly Retail Report"
              );


            rows.push({

              date,

              station:
                station.id,

              month:
                month.key,

              url:
                report?.url ||
                state.data.meta
                  .sourceFolderUrl

            });

          }

        }
      );

    }
  );


  return rows.sort(
    (
      first,
      second
    ) =>

      second.date.localeCompare(
        first.date
      ) ||

      first.station.localeCompare(
        second.station
      )
  );
}



/* =========================================================
   AUDIT TABLE
========================================================= */


function renderAudit() {

  const filter =
    $("#auditMonthFilter").value;


  const all =
    getAuditRows().filter(
      (row) =>

        filter === "all" ||
        row.month === filter
    );


  const pages =
    Math.max(
      1,
      Math.ceil(
        all.length /
        state.auditPageSize
      )
    );


  state.auditPage =
    Math.min(
      state.auditPage,
      pages
    );


  const start =
    (
      state.auditPage -
      1
    ) *
    state.auditPageSize;


  const rows =
    all.slice(
      start,
      start +
      state.auditPageSize
    );


  $("#auditBody").innerHTML =
    rows.map(
      (row) => `

        <tr>


          <td>

            <strong>
              ${dateOnlyLabel(
                row.date
              )}
            </strong>

          </td>


          <td>

            ${stationName(
              row.station
            )}

          </td>


          <td>

            <a
              class="file-link"
              href="${row.url}"
              target="_blank"
              rel="noreferrer"
            >

              <span class="file-icon">
                ✓
              </span>


              <span>
                Dated record present
              </span>


              <span class="external">
                ↗
              </span>

            </a>

          </td>


          <td>

            Daily station record
            → Monthly Retail Report

          </td>


          <td>

            <span class="status-chip">
              Verified
            </span>

          </td>


        </tr>

      `
    ).join("");


  $("#auditCount").textContent =
    `${all.length} station-day evidence records`;


  $("#pageLabel").textContent =
    `${state.auditPage} / ${pages}`;


  $("#prevPage").disabled =
    state.auditPage <= 1;


  $("#nextPage").disabled =
    state.auditPage >= pages;
}



/* =========================================================
   CSV EXPORT
========================================================= */


function downloadAuditCsv() {

  const rows =
    getAuditRows();


  const csv = [

    "Date,Station,Evidence,Output Scope,Verification",

    ...rows.map(
      (row) =>

        `${row.date},${stationName(
          row.station
        )},Dated record present,Daily station record to Monthly Retail Report,Verified`
    )

  ].join("\n");


  const blob =
    new Blob(
      [csv],
      {
        type:
          "text/csv;charset=utf-8"
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      "a"
    );


  link.href =
    url;


  link.download =
    "sentinel-audit-trail.csv";


  link.click();


  URL.revokeObjectURL(
    url
  );


  showToast(
    "Audit CSV downloaded"
  );
}



/* =========================================================
   EVENTS
========================================================= */


function bind() {

  $("#monthFilter")
    .addEventListener(
      "change",
      renderArchive
    );


  $("#stationFilter")
    .addEventListener(
      "change",
      renderArchive
    );


  $("#auditMonthFilter")
    .addEventListener(
      "change",
      () => {

        state.auditPage =
          1;


        renderAudit();

      }
    );


  $("#prevPage")
    .addEventListener(
      "click",
      () => {

        state.auditPage--;


        renderAudit();

      }
    );


  $("#nextPage")
    .addEventListener(
      "click",
      () => {

        state.auditPage++;


        renderAudit();

      }
    );


  $("#downloadCsvBtn")
    .addEventListener(
      "click",
      downloadAuditCsv
    );
}



/* =========================================================
   INIT
========================================================= */


async function init() {

  try {


    const response =
      await fetch(
        "data/sentinel-data.json",
        {
          cache:
            "no-store"
        }
      );


    if (
      !response.ok
    ) {

      throw new Error(
        `Evidence data request failed: HTTP ${response.status}`
      );

    }


    state.data =
      await response.json();



    buildMetrics();


    buildCoverageTrendChart();


    buildValidationTotalsChart();


    buildCoverage();


    buildValidation();


    populateFilters();


    renderArchive();


    renderAudit();


    bind();


  } catch (error) {


    console.error(
      "SENTINEL initialization error:",
      error
    );


    document.body.innerHTML = `

      <main
        style="
          font-family:
            Poppins,
            Arial,
            sans-serif;

          width:
            min(
              900px,
              calc(
                100% - 40px
              )
            );

          margin:
            70px auto;

          color:
            #172238;
        "
      >


        <h1
          style="
            color:
              #112f78;

            margin-bottom:
              10px;
          "
        >

          SENTINEL

        </h1>


        <p>

          The control centre
          could not initialise.

        </p>


        <pre
          style="
            margin-top:
              20px;

            padding:
              16px;

            background:
              #f7f9fc;

            border:
              1px solid
              #dbe3ef;

            border-radius:
              8px;

            white-space:
              pre-wrap;
          "
        >${error.message}</pre>


      </main>

    `;

  }
}


init();
