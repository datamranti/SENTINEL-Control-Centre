const state = { data:null, auditPage:1, auditPageSize:18, presentation:false };

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function money(v){
  return new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR',minimumFractionDigits:2,maximumFractionDigits:2}).format(v).replace('MYR','RM');
}
function dateLabel(iso, withTime=false){
  const d = new Date(iso);
  const opt = withTime
    ? {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true,timeZone:'Asia/Kuala_Lumpur'}
    : {day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Kuala_Lumpur'};
  return new Intl.DateTimeFormat('en-GB',opt).format(d).replace(',','');
}
function dateOnlyLabel(iso){
  const d = new Date(`${iso}T00:00:00+08:00`);
  return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Kuala_Lumpur'}).format(d);
}
function daysInclusive(start,end){
  const a = new Date(`${start}T00:00:00+08:00`), b = new Date(`${end}T00:00:00+08:00`);
  return Math.round((b-a)/86400000)+1;
}
function monthLabel(key){
  const m = state.data.months.find(x=>x.key===key); return m ? m.label : key;
}
function stationName(id){
  const s = state.data.stations.find(x=>x.id===id); return s ? s.name : id;
}
function showToast(msg){
  const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1800);
}

function buildMetrics(){
  const {meta,stations,workbooks,months}=state.data;
  const uniqueDays=daysInclusive(meta.coverageStart,meta.latestDataDate);
  const stationDays=months.reduce((sum,m)=>sum+Object.values(m.coverage).reduce((a,b)=>a+b,0),0);
  $('#metricStations').textContent=stations.length;
  $('#metricDays').textContent=uniqueDays;
  $('#metricStationDays').textContent=stationDays;
  $('#metricBooks').textContent=workbooks.length;
  $('#metricDaysSub').textContent=`${dateOnlyLabel(meta.coverageStart)} – ${dateOnlyLabel(meta.latestDataDate)}`;
  $('#latestDataDate').textContent=dateOnlyLabel(meta.latestDataDate);
  $('#latestFileUpdate').textContent=dateLabel(meta.latestFileModifiedAt,true);
  $('#heroSubtitle').textContent=state.data.meta.subtitle;
  $('#sourceFolderTop').href=meta.sourceFolderUrl;
  $('#snapshotAt').textContent=`Snapshot built ${dateLabel(meta.dashboardSnapshotAt,true)}`;
  $('#evidenceBasis').textContent=meta.evidenceBasis;
}

function buildCoverage(){
  const wrap=$('#coverageGrid'); wrap.innerHTML='';
  state.data.months.forEach(m=>{
    const card=document.createElement('article'); card.className='month-card';
    const maxCovered=Math.max(...Object.values(m.coverage));
    card.innerHTML=`
      <div class="month-card-header">
        <div><h3>${m.label}</h3><small>${m.status==='complete'?'Full month verified':`Evidence through day ${maxCovered}`}</small></div>
        <span class="month-status ${m.status}">${m.status==='complete'?'Complete':'Active'}</span>
      </div>
      ${state.data.stations.map(s=>{
        const through=m.coverage[s.id]||0;
        const cells=Array.from({length:m.daysInMonth},(_,i)=>{
          const day=i+1, done=day<=through;
          return `<span class="day-cell ${done?'done':'future'}" title="${m.label} day ${day}: ${done?'verified dated record':'not yet due / not loaded'}">${day}</span>`;
        }).join('');
        return `<div class="station-coverage">
          <div class="station-row-head"><strong>${s.name}</strong><span>${through} / ${m.status==='active'?through:m.daysInMonth} days verified</span></div>
          <div class="day-grid">${cells}</div>
        </div>`;
      }).join('')}`;
    wrap.appendChild(card);
  });
}

function buildValidation(){
  const wrap=$('#validationGrid'); wrap.innerHTML='';
  state.data.latestValidation.forEach(v=>{
    const card=document.createElement('article'); card.className='validation-card';
    card.innerHTML=`
      <div class="validation-station">
        <div class="station-badge">${stationName(v.station)}</div>
        <h3>${stationName(v.station)}</h3>
        <small>${dateOnlyLabel(v.date)} · Cost of Sales</small>
      </div>
      <div class="validation-values">
        <div class="value-row"><span>Fuel</span><strong>${money(v.fuel)}</strong></div>
        <div class="value-row"><span>K-Mesra</span><strong>${money(v.kMesra)}</strong></div>
        <div class="value-row total"><span>Total</span><strong>${money(v.total)}</strong></div>
        <div class="reconcile-strip"><span>Debit / Credit reconciliation</span><strong>✓ Diff ${money(v.difference)}</strong></div>
      </div>`;
    wrap.appendChild(card);
  });
}

function populateFilters(){
  const monthOptions=state.data.months.map(m=>`<option value="${m.key}">${m.label}</option>`).join('');
  $('#monthFilter').insertAdjacentHTML('beforeend',monthOptions);
  $('#auditMonthFilter').insertAdjacentHTML('beforeend',monthOptions);
  $('#stationFilter').insertAdjacentHTML('beforeend',state.data.stations.map(s=>`<option value="${s.id}">${s.name}</option>`).join(''));
}

function renderArchive(){
  const month=$('#monthFilter').value, station=$('#stationFilter').value;
  const rows=state.data.workbooks
    .filter(w=>(month==='all'||w.month===month)&&(station==='all'||w.station===station))
    .sort((a,b)=>b.month.localeCompare(a.month)||a.station.localeCompare(b.station)||a.type.localeCompare(b.type));
  $('#archiveBody').innerHTML=rows.map(w=>`<tr>
    <td><strong>${monthLabel(w.month)}</strong></td>
    <td>${stationName(w.station)}</td>
    <td>${w.type}</td>
    <td><a class="file-link" href="${w.url}" target="_blank" rel="noreferrer"><span class="file-icon">▤</span><span>${w.title}</span><span class="external">↗</span></a></td>
    <td>${dateLabel(w.modifiedAt,true)}</td>
    <td><span class="status-chip">Available</span></td>
  </tr>`).join('');
}

function getAuditRows(){
  const rows=[];
  state.data.months.forEach(m=>{
    state.data.stations.forEach(s=>{
      const through=m.coverage[s.id]||0;
      for(let day=1;day<=through;day++){
        const [y,mo]=m.key.split('-');
        const date=`${y}-${mo}-${String(day).padStart(2,'0')}`;
        const report=state.data.workbooks.find(w=>w.month===m.key&&w.station===s.id&&w.type==='Monthly Retail Report');
        rows.push({date,station:s.id,month:m.key,url:report?.url||state.data.meta.sourceFolderUrl});
      }
    });
  });
  return rows.sort((a,b)=>b.date.localeCompare(a.date)||a.station.localeCompare(b.station));
}

function renderAudit(){
  const filter=$('#auditMonthFilter').value;
  const all=getAuditRows().filter(r=>filter==='all'||r.month===filter);
  const pages=Math.max(1,Math.ceil(all.length/state.auditPageSize));
  state.auditPage=Math.min(state.auditPage,pages);
  const start=(state.auditPage-1)*state.auditPageSize;
  const rows=all.slice(start,start+state.auditPageSize);
  $('#auditBody').innerHTML=rows.map(r=>`<tr>
    <td><strong>${dateOnlyLabel(r.date)}</strong></td>
    <td>${stationName(r.station)}</td>
    <td><a class="file-link" href="${r.url}" target="_blank" rel="noreferrer"><span class="file-icon">✓</span><span>Dated record present</span><span class="external">↗</span></a></td>
    <td>Daily station record → Monthly Retail Report</td>
    <td><span class="status-chip">Verified</span></td>
  </tr>`).join('');
  $('#auditCount').textContent=`${all.length} station-day evidence records`;
  $('#pageLabel').textContent=`${state.auditPage} / ${pages}`;
  $('#prevPage').disabled=state.auditPage<=1; $('#nextPage').disabled=state.auditPage>=pages;
}

function downloadAuditCsv(){
  const rows=getAuditRows();
  const csv=['Date,Station,Evidence,Output Scope,Verification',...rows.map(r=>`${r.date},${stationName(r.station)},Dated record present,Daily station record to Monthly Retail Report,Verified`)].join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='sentinel-audit-trail.csv'; a.click(); URL.revokeObjectURL(url);
  showToast('Audit CSV downloaded');
}

function bind(){
  $('#monthFilter').addEventListener('change',renderArchive);
  $('#stationFilter').addEventListener('change',renderArchive);
  $('#auditMonthFilter').addEventListener('change',()=>{state.auditPage=1;renderAudit()});
  $('#prevPage').addEventListener('click',()=>{state.auditPage--;renderAudit()});
  $('#nextPage').addEventListener('click',()=>{state.auditPage++;renderAudit()});
  $('#downloadCsvBtn').addEventListener('click',downloadAuditCsv);
  $('#presentationBtn').addEventListener('click',()=>{
    state.presentation=!state.presentation;
    document.body.classList.toggle('presentation-mode',state.presentation);
    $('#presentationBtn').textContent=state.presentation?'Exit presentation':'Presentation view';
    showToast(state.presentation?'Presentation view enabled':'Presentation view disabled');
  });
}

async function init(){
  try{
    const res=await fetch('data/sentinel-data.json',{cache:'no-store'});
    if(!res.ok) throw new Error('Unable to load evidence data');
    state.data=await res.json();
    buildMetrics(); buildCoverage(); buildValidation(); populateFilters(); renderArchive(); renderAudit(); bind();
  }catch(err){
    console.error(err);
    document.body.innerHTML=`<main style="font-family:Arial;padding:40px"><h1>SENTINEL</h1><p>Unable to load data/sentinel-data.json.</p><pre>${err.message}</pre></main>`;
  }
}
init();
