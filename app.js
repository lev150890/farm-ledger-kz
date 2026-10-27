const STORAGE_KEY = 'amyrzhan-cattle-ledger-v1';
const HERD_KEY = 'amyrzhan-farm-herd-v1';
const CATEGORY_KEY = 'amyrzhan-farm-categories-v1';
const DAILY_RULE_KEY = 'amyrzhan-cattle-daily-rule-v1';
const LIVESTOCK = [
  { id: 'cattle', name: 'Крупный рогатый скот', short: 'КРС', emoji: '🐄', tint: 'green' },
  { id: 'sheep', name: 'Бараны и овцы', short: 'Овцы', emoji: '🐑', tint: 'sand' },
  { id: 'goats', name: 'Козы', short: 'Козы', emoji: '🐐', tint: 'blue' },
  { id: 'chickens', name: 'Куры', short: 'Куры', emoji: '🐔', tint: 'rose' },
  { id: 'horses', name: 'Лошади', short: 'Лошади', emoji: '🐎', tint: 'violet' }
];
const DEFAULT_EXPENSES = [
  { name: 'Сено', emoji: '🌾' },
  { name: 'Корма и зерно', emoji: '🌽' },
  { name: 'Вода', emoji: '💧' },
  { name: 'Ветеринария', emoji: '🩺' },
  { name: 'Сарай и стойло', emoji: '🏚️' },
  { name: 'Оборудование', emoji: '🧰' },
  { name: 'Электричество', emoji: '⚡' },
  { name: 'Транспорт', emoji: '🚜' },
  { name: 'Работа и услуги', emoji: '🧑‍🌾' },
  { name: 'Прочие расходы', emoji: '📦' }
];
const DEFAULT_INCOMES = [
  { name: 'Продажа молока', emoji: '🥛' },
  { name: 'Продажа сливок', emoji: '🧈' },
  { name: 'Сметана и творог', emoji: '🍶' },
  { name: 'Другая молочная продукция', emoji: '🧀' },
  { name: 'Прочие доходы', emoji: '💰' }
];
const months = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
const $ = (s) => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10);
let entries = [];
let EXPENSES = DEFAULT_EXPENSES.map(x => ({ ...x }));
let INCOMES = DEFAULT_INCOMES.map(x => ({ ...x }));
let categoryEditorType = 'expense';
let dailyRule = { enabled:true, category:'Сено', summerStart:'05-01', summerEnd:'09-30', summerRate:350, winterRate:1500 };
let activeFilter = 'all';
let entryType = 'expense';
let multiDateMode = false;
let selectedDates = new Set();
const calendarMonths = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const calendarShortWeekdays = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
let deleteId = null;
let toastTimer;
let herd = { cattle: 0, sheep: 0, goats: 0, chickens: 0, horses: 0 };
try { herd = { ...herd, ...JSON.parse(localStorage.getItem(HERD_KEY) || '{}') }; } catch { /* use empty herd */ }
try {
  const savedCategories = JSON.parse(localStorage.getItem(CATEGORY_KEY) || 'null');
  if (Array.isArray(savedCategories?.expenses) && savedCategories.expenses.length) EXPENSES = savedCategories.expenses.filter(x => x && x.name).map(x => ({name:String(x.name),emoji:String(x.emoji || '📦')}));
  if (Array.isArray(savedCategories?.incomes) && savedCategories.incomes.length) INCOMES = savedCategories.incomes.filter(x => x && x.name).map(x => ({name:String(x.name),emoji:String(x.emoji || '💰')}));
} catch { /* use built-in article lists */ }
try {
  const savedRule=JSON.parse(localStorage.getItem(DAILY_RULE_KEY)||'null');
  if(savedRule&&typeof savedRule==='object')dailyRule={...dailyRule,...savedRule};
} catch { /* use default daily cost settings */ }
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  if (Array.isArray(saved)) entries = saved.filter(x => x && x.id && x.date && Number.isFinite(Number(x.amount)));
} catch { entries = []; }

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }
  catch { showToast('Не удалось сохранить данные в этом браузере.'); }
}
function livestockInfo(id) { return LIVESTOCK.find(x => x.id === id) || { id: 'cattle', name: 'Крупный рогатый скот', short: 'КРС', emoji: '🐄' }; }
function money(value) {
  return new Intl.NumberFormat('ru-KZ', { style:'currency', currency:'KZT', currencyDisplay:'narrowSymbol', maximumFractionDigits:0 }).format(Math.round(Number(value) || 0));
}
function currentYear() { return Number($('#year-select').value) || new Date().getFullYear(); }
function actualEntriesForYear(year = currentYear()) { return entries.filter(e => new Date(`${e.date}T00:00:00`).getFullYear() === year); }
function entriesForYear(year = currentYear()) { return [...actualEntriesForYear(year),...dailyRuleEntries(year)]; }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
function categoryInfo(name, type) { return [...(type === 'income' ? INCOMES : EXPENSES)].find(x => x.name === name) || { name, emoji: type === 'income' ? '＋' : '•' }; }
function saveCategories() {
  try { localStorage.setItem(CATEGORY_KEY, JSON.stringify({expenses:EXPENSES,incomes:INCOMES})); }
  catch { showToast('Не удалось сохранить список статей.'); }
}
function dateLabel(value) { return new Intl.DateTimeFormat('ru-RU', { day:'numeric', month:'short', year:'numeric' }).format(new Date(`${value}T00:00:00`)); }
function isSummerDate(month,day) {
  const current=`${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  return dailyRule.summerStart<=dailyRule.summerEnd ? current>=dailyRule.summerStart&&current<=dailyRule.summerEnd : current>=dailyRule.summerStart||current<=dailyRule.summerEnd;
}
function dailyRuleEntries(year) {
  if(!dailyRule.enabled)return [];
  const perCow=Math.max(0,Number(herd.cattle)||0),category=EXPENSES.some(x=>x.name===dailyRule.category)?dailyRule.category:(EXPENSES[0]?.name||'Ежедневный корм');
  const actual=actualEntriesForYear(year),monthsData=Array.from({length:12},()=>({amount:0,summerDays:0,winterDays:0}));
  for(let month=0;month<12;month++){
    const daysInMonth=new Date(year,month+1,0).getDate();
    for(let day=1;day<=daysInMonth;day++){
      const date=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,summer=isSummerDate(month,day),rate=Math.max(0,Number(summer?dailyRule.summerRate:dailyRule.winterRate)||0),amount=rate*perCow;
      const overridden=actual.some(e=>e.type==='expense'&&e.livestock==='cattle'&&e.category===category&&e.date===date);
      if(amount<=0||overridden)continue;
      monthsData[month].amount+=amount;
      monthsData[month][summer?'summerDays':'winterDays']++;
    }
  }
  return monthsData.flatMap((item,month)=>item.amount>0?[{id:`daily-rule-${year}-${month}`,type:'expense',livestock:'cattle',category,description:`Авто · ${perCow} голов · пастбище ${item.summerDays} дн. × ${money(dailyRule.summerRate)}, стойло ${item.winterDays} дн. × ${money(dailyRule.winterRate)}`,amount:item.amount,date:`${year}-${String(month+1).padStart(2,'0')}-01`,createdAt:new Date(year,month,1).getTime(),autoRecurring:true}]:[]);
}
function showToast(message) {
  const el = $('#toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2300);
}
function buildYears() {
  const now = new Date().getFullYear();
  const years = new Set([now, ...entries.map(e => new Date(`${e.date}T00:00:00`).getFullYear()).filter(Number.isFinite)]);
  const selected = Number($('#year-select').value) || now;
  if (!years.has(selected)) years.add(selected);
  $('#year-select').innerHTML = [...years].sort((a,b) => b-a).map(y => `<option value="${y}">${y}</option>`).join('');
  $('#year-select').value = String(selected);
}
function renderChart(yearEntries) {
  const monthly = Array.from({ length:12 }, () => ({ income:0, expense:0 }));
  yearEntries.forEach(e => { const month = new Date(`${e.date}T00:00:00`).getMonth(); monthly[month][e.type] += Number(e.amount); });
  const max = Math.max(1, ...monthly.flatMap(m => [m.income, m.expense]));
  $('#monthly-chart').innerHTML = monthly.map((m,i) => `<div class="month-col"><div class="bar-pair" title="${months[i]}: доход ${money(m.income)}, расход ${money(m.expense)}"><i class="bar income" style="height:${m.income ? Math.max(3, m.income/max*100) : 0}%"></i><i class="bar expense" style="height:${m.expense ? Math.max(3, m.expense/max*100) : 0}%"></i></div><span class="month-label">${months[i]}</span></div>`).join('');
}
function renderCategories(yearEntries) {
  const totals = new Map();
  yearEntries.filter(e => e.type === 'expense').forEach(e => totals.set(e.category, (totals.get(e.category) || 0) + Number(e.amount)));
  const sorted = [...totals].sort((a,b) => b[1]-a[1]);
  if (!sorted.length) { $('#category-summary').innerHTML = '<div class="category-empty">Расходы появятся после первой записи.</div>'; return; }
  const max = sorted[0][1];
  $('#category-summary').innerHTML = sorted.slice(0,5).map(([name,total]) => {
    const info = categoryInfo(name,'expense');
    return `<div class="category-line"><span class="category-emoji">${escapeHtml(info.emoji)}</span><span class="category-copy"><b>${escapeHtml(name)}</b><span class="category-track"><i class="category-fill" style="width:${Math.max(4,total/max*100)}%"></i></span></span><span class="category-value">${money(total)}</span></div>`;
  }).join('');
}
function renderTable(yearEntries) {
  const shown = yearEntries.filter(e => activeFilter === 'all' || e.type === activeFilter).sort((a,b) => b.date.localeCompare(a.date) || b.createdAt-a.createdAt);
  $('#entries-body').innerHTML = shown.map(e => {
    const info = categoryInfo(e.category,e.type);
    const typeLabel = e.type === 'income' ? 'Доход' : 'Расход';
    const group = livestockInfo(e.livestock);
    const actions=e.autoRecurring?'<span class="auto-label">АВТО</span>':`<button class="row-action" data-edit="${e.id}" title="Изменить запись" aria-label="Изменить">✎</button><button class="row-action" data-delete="${e.id}" title="Удалить запись" aria-label="Удалить">×</button>`;
    return `<tr class="${e.autoRecurring?'auto-row':''}"><td class="date-cell">${dateLabel(e.date)}</td><td><span class="category-cell"><i class="entry-emoji">${escapeHtml(info.emoji)}</i>${escapeHtml(e.category)}</span></td><td><span class="herd-cell">${group.emoji} ${group.short}</span></td><td class="description-cell" title="${escapeHtml(e.description || '')}">${escapeHtml(e.description || '—')}</td><td><span class="kind-pill ${e.type}">${typeLabel}</span></td><td class="amount-cell ${e.type}">${e.type === 'income' ? '+' : '−'} ${money(e.amount)}</td><td class="row-actions">${actions}</td></tr>`;
  }).join('');
  $('#empty-state').hidden = shown.length > 0;
  $('.table-wrap').hidden = shown.length === 0;
}
function render() {
  buildYears();
  const yearEntries = entriesForYear();
  const income = yearEntries.filter(e => e.type === 'income').reduce((sum,e) => sum + Number(e.amount),0);
  const expense = yearEntries.filter(e => e.type === 'expense').reduce((sum,e) => sum + Number(e.amount),0);
  const balance = income - expense;
  $('#income-total').textContent = money(income);
  $('#expense-total').textContent = money(expense);
  $('#balance-total').textContent = `${balance < 0 ? '− ' : ''}${money(Math.abs(balance))}`;
  $('#balance-total').classList.toggle('negative', balance < 0);
  $('#balance-caption').textContent = balance < 0 ? 'Расходы больше доходов' : 'Доходы минус расходы';
  $('#herd-grid').innerHTML = LIVESTOCK.map(animal => `<article class="herd-card ${animal.tint}"><span class="herd-emoji">${animal.emoji}</span><span class="herd-count">${Math.max(0, Number(herd[animal.id]) || 0)}<small>гол.</small></span><span class="herd-name">${animal.name}</span></article>`).join('');
  $('#selected-year-label').textContent = currentYear();
  renderChart(yearEntries); renderCategories(yearEntries); renderTable(yearEntries); renderCategoryEditor();
}
function setType(type) {
  entryType = type;
  document.querySelectorAll('.type-option').forEach(button => button.classList.toggle('selected', button.dataset.type === type));
  if(type==='income'&&multiDateMode)setDateMode(false);
  $('#enable-multi-dates').hidden=type!=='expense'||Boolean($('#entry-form').dataset.editId);
  const options = type === 'income' ? INCOMES : EXPENSES;
  $('#entry-category').innerHTML = options.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.emoji)} ${escapeHtml(c.name)}</option>`).join('');
}
function updateCalendarSummary() {
  const count=selectedDates.size, amount=Number($('#entry-amount').value)||0;
  $('#calendar-selected-count').textContent=count?`Выбрано дат: ${count} · ${money(amount)} за каждую`:'Даты не выбраны';
  $('#calendar-total-preview').textContent=money(count*amount);
}
function renderCalendar() {
  const year=Number($('#calendar-year').value),month=Number($('#calendar-month').value);
  if(!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(month))return;
  const offset=(new Date(year,month,1).getDay()+6)%7,days=new Date(year,month+1,0).getDate();
  const cells=Array.from({length:offset},()=>'<span class="calendar-empty" aria-hidden="true"></span>');
  for(let day=1;day<=days;day++){
    const date=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,selected=selectedDates.has(date);
    cells.push(`<button type="button" class="calendar-day ${selected?'selected':''}" data-calendar-date="${date}" aria-pressed="${selected}" aria-label="${day} ${calendarMonths[month]} ${year}">${selected?'✓':day}</button>`);
  }
  $('#calendar-days').innerHTML=cells.join('');
  updateCalendarSummary();
}
function setDateMode(enabled) {
  multiDateMode=Boolean(enabled)&&entryType==='expense'&&!$('#entry-form').dataset.editId;
  $('#single-date-row').hidden=multiDateMode;
  $('#date-calendar').hidden=!multiDateMode;
  $('#single-date-row').style.display=multiDateMode?'none':'grid';
  $('#date-calendar').style.display=multiDateMode?'grid':'none';
  $('#entry-date').required=!multiDateMode;
  if(multiDateMode){
    if(!selectedDates.size&&$('#entry-date').value)selectedDates.add($('#entry-date').value);
    $('#calendar-year').value=String(Number($('#entry-date').value.slice(0,4))||new Date().getFullYear());
    $('#calendar-month').value=String(Number($('#entry-date').value.slice(5,7))-1);
    renderCalendar();
  }
}
function renderCategoryEditor() {
  const options = categoryEditorType === 'income' ? INCOMES : EXPENSES;
  document.querySelectorAll('[data-category-type]').forEach(button=>button.classList.toggle('active',button.dataset.categoryType===categoryEditorType));
  const annual = entriesForYear().filter(e=>e.type===categoryEditorType).reduce((totals,e)=>{totals[e.category]=(totals[e.category]||0)+Number(e.amount);return totals;},{});
  $('#category-editor-list').innerHTML = options.map((item,index)=>`<div class="category-editor-row"><span class="category-emoji">${escapeHtml(item.emoji)}</span><span class="category-editor-name"><b>${escapeHtml(item.name)}</b><small>За ${currentYear()}: ${money(annual[item.name]||0)}</small></span><button class="row-action" data-category-edit="${index}" title="Изменить статью" aria-label="Изменить">✎</button><button class="row-action category-remove" data-category-remove="${index}" title="Удалить статью" aria-label="Удалить">×</button></div>`).join('') || '<div class="category-empty">Пока нет статей. Добавьте первую.</div>';
  refreshDailyCategoryOptions($('#daily-category').value||dailyRule.category);
}
function localDayString(year,monthDay) { return `${year}-${monthDay}`; }
function normalizeAnnualDay(inputId) { const value=$(inputId).value;return value.length>=10?value.slice(5):''; }
function populateDailyRuleForm() {
  const chosen=dailyRule.category||EXPENSES.find(x=>x.name==='Сено')?.name||EXPENSES[0]?.name||'';
  refreshDailyCategoryOptions(chosen);
  $('#daily-enabled').checked=Boolean(dailyRule.enabled);
  $('#summer-start').value=localDayString(currentYear(),dailyRule.summerStart||'05-01');
  $('#summer-end').value=localDayString(currentYear(),dailyRule.summerEnd||'09-30');
  $('#summer-rate').value=Number(dailyRule.summerRate)||0;
  $('#winter-rate').value=Number(dailyRule.winterRate)||0;
  renderDailyRulePreview();
}
function refreshDailyCategoryOptions(selected=dailyRule.category) {
  $('#daily-category').innerHTML=EXPENSES.map(x=>`<option value="${escapeHtml(x.name)}">${escapeHtml(x.emoji)} ${escapeHtml(x.name)}</option>`).join('');
  const chosen=selected||EXPENSES.find(x=>x.name==='Сено')?.name||EXPENSES[0]?.name||'';
  $('#daily-category').value=EXPENSES.some(x=>x.name===chosen)?chosen:(EXPENSES[0]?.name||'');
}
function renderDailyRulePreview() {
  const year=currentYear(),start=normalizeAnnualDay('#summer-start'),end=normalizeAnnualDay('#summer-end'),headCount=Math.max(0,Number(herd.cattle)||0);
  if(!start||!end){$('#daily-rule-preview').textContent='Выберите даты начала и конца летнего периода.';return;}
  const rule={summerStart:start,summerEnd:end},counts={summer:0,winter:0};
  for(let month=0;month<12;month++)for(let day=1;day<=new Date(year,month+1,0).getDate();day++){
    const key=`${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,summer=rule.summerStart<=rule.summerEnd?key>=rule.summerStart&&key<=rule.summerEnd:key>=rule.summerStart||key<=rule.summerEnd;
    counts[summer?'summer':'winter']++;
  }
  const summerRate=Math.max(0,Number($('#summer-rate').value)||0),winterRate=Math.max(0,Number($('#winter-rate').value)||0),total=headCount*(counts.summer*summerRate+counts.winter*winterRate);
  $('#daily-rule-preview').textContent=$('#daily-enabled').checked?`${year}: ${headCount} кор. · пастбище ${counts.summer} дн. × ${money(summerRate)} + стойло ${counts.winter} дн. × ${money(winterRate)} ≈ ${money(total)}. Ручная запись по этой статье заменит автоначисление за эту дату.`:`Расчёт выключен. При включении: ${headCount} кор. · ${money(total)} за ${year} по текущим ставкам.`;
}
function openCategoryForm(index = -1) {
  const list = categoryEditorType === 'income' ? INCOMES : EXPENSES;
  const item = index >= 0 ? list[index] : null;
  const form = $('#category-form'); form.dataset.editIndex = String(index);
  $('#category-dialog-kind').textContent = categoryEditorType === 'income' ? 'СТАТЬЯ ДОХОДА' : 'СТАТЬЯ РАСХОДА';
  $('#category-dialog-title').textContent = item ? 'Изменить статью' : 'Новая статья';
  $('#category-name').value = item?.name || '';
  $('#category-emoji').value = item?.emoji || (categoryEditorType === 'income' ? '💰' : '📦');
  $('#category-dialog').showModal();
}
function setLivestock(id = 'cattle') {
  $('#entry-livestock').innerHTML = LIVESTOCK.map(x => `<option value="${x.id}">${x.emoji} ${x.name}</option>`).join('');
  $('#entry-livestock').value = LIVESTOCK.some(x => x.id === id) ? id : 'cattle';
}
function openEntry(entry = null) {
  const form = $('#entry-form'); form.reset();
  form.dataset.editId = entry?.id || '';
  multiDateMode=false; selectedDates.clear();
  $('#form-title').textContent = entry ? 'Изменить запись' : 'Новая запись';
  setType(entry?.type || 'expense');
  setLivestock(entry?.livestock || 'cattle');
  $('#entry-date').value = entry?.date || new Date().toISOString().slice(0,10);
  $('#entry-date').required=true;
  $('#single-date-row').hidden=false; $('#date-calendar').hidden=true;
  $('#single-date-row').style.display='grid'; $('#date-calendar').style.display='none';
  $('#calendar-month').value=String(Number($('#entry-date').value.slice(5,7))-1);
  $('#calendar-year').value=$('#entry-date').value.slice(0,4);
  $('#enable-multi-dates').hidden=Boolean(entry)||entry?.type==='income';
  $('#entry-amount').value = entry?.amount || '';
  $('#entry-description').value = entry?.description || '';
  if (entry) $('#entry-category').value = entry.category;
  renderCalendar();
  $('#entry-dialog').showModal();
}
function closeEntry() { $('#entry-dialog').close(); }
function exportCsv() {
  const rows = [['Дата','Группа животных','Тип','Статья','Описание','Сумма, ₸'], ...entriesForYear().sort((a,b)=>a.date.localeCompare(b.date)).map(e=>[e.date,livestockInfo(e.livestock).name,e.type==='income'?'Доход':'Расход',e.category,e.description||'',Number(e.amount).toFixed(0)])];
  const csv = '\uFEFF' + rows.map(row => row.map(value => `"${String(value).replace(/"/g,'""')}"`).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link = document.createElement('a'); link.href=url; link.download=`отчёт-хозяйства-${currentYear()}.csv`; link.click(); URL.revokeObjectURL(url);
  showToast(`Отчёт за ${currentYear()} скачан`);
}

$('#add-entry').addEventListener('click',()=>openEntry());
$('#empty-add').addEventListener('click',()=>openEntry());
$('#close-dialog').addEventListener('click',closeEntry); $('#cancel-entry').addEventListener('click',closeEntry);
document.querySelectorAll('.type-option').forEach(button=>button.addEventListener('click',()=>setType(button.dataset.type)));
$('#entry-form').addEventListener('submit',event=>{
  event.preventDefault();
  const amount=Number($('#entry-amount').value);
  if (!Number.isFinite(amount) || amount <= 0) { showToast('Укажите сумму больше нуля'); return; }
  const dates=multiDateMode?[...selectedDates].sort():[$('#entry-date').value];
  if(!dates.length){showToast('Отметьте хотя бы один день в календаре');return;}
  if(dates.some(date=>!/^\d{4}-\d{2}-\d{2}$/.test(date))){showToast('Укажите дату или отметьте дни в календаре');return;}
  const editId=event.currentTarget.dataset.editId;
  if(editId){
    const item={id:editId,type:entryType,livestock:$('#entry-livestock').value,category:$('#entry-category').value,description:$('#entry-description').value.trim(),amount,date:dates[0],createdAt:Date.now()};
    const index=entries.findIndex(e=>e.id===editId);if(index>=0)entries[index]=item;
    persist();closeEntry();render();showToast('Запись обновлена');return;
  }
  const createdAt=Date.now();
  entries.push(...dates.map((date,index)=>({id:uid(),type:entryType,livestock:$('#entry-livestock').value,category:$('#entry-category').value,description:$('#entry-description').value.trim(),amount,date,createdAt:createdAt+index})));
  persist();closeEntry();render();showToast(dates.length>1?`Добавлено записей: ${dates.length}`:'Запись добавлена');
});
$('#enable-multi-dates').addEventListener('click',()=>setDateMode(true));
$('#disable-multi-dates').addEventListener('click',()=>setDateMode(false));
$('#calendar-month').innerHTML=calendarMonths.map((month,index)=>`<option value="${index}">${month}</option>`).join('');
$('#calendar-month').addEventListener('change',renderCalendar);
$('#calendar-year').addEventListener('change',()=>{
  const year=Number($('#calendar-year').value);
  if(!Number.isInteger(year)||year<2000||year>2100){$('#calendar-year').value=String(new Date().getFullYear());}
  const expectedYear=String($('#calendar-year').value);
  if([...selectedDates].some(date=>date.slice(0,4)!==expectedYear)){selectedDates.clear();showToast('Для нового года выберите дни заново.');}
  renderCalendar();
});
$('#calendar-prev').addEventListener('click',()=>{
  let month=Number($('#calendar-month').value)-1,year=Number($('#calendar-year').value);
  if(month<0){month=11;year=Math.max(2000,year-1);}
  if([...selectedDates].some(date=>date.slice(0,4)!==String(year))){selectedDates.clear();showToast('Для нового года выберите дни заново.');}
  $('#calendar-month').value=String(month);$('#calendar-year').value=String(year);renderCalendar();
});
$('#calendar-next').addEventListener('click',()=>{
  let month=Number($('#calendar-month').value)+1,year=Number($('#calendar-year').value);
  if(month>11){month=0;year=Math.min(2100,year+1);}
  if([...selectedDates].some(date=>date.slice(0,4)!==String(year))){selectedDates.clear();showToast('Для нового года выберите дни заново.');}
  $('#calendar-month').value=String(month);$('#calendar-year').value=String(year);renderCalendar();
});
$('#calendar-days').addEventListener('click',event=>{
  const button=event.target.closest('[data-calendar-date]');if(!button)return;
  const date=button.dataset.calendarDate;
  if(selectedDates.has(date))selectedDates.delete(date);else selectedDates.add(date);
  renderCalendar();
});
$('#entry-amount').addEventListener('input',updateCalendarSummary);
document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{
  activeFilter=button.dataset.filter; document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===button)); render();
}));
$('#entries-body').addEventListener('click',event=>{
  const edit=event.target.closest('[data-edit]');
  if(edit){const entry=entries.find(e=>e.id===edit.dataset.edit);if(entry)openEntry(entry);return;}
  const remove=event.target.closest('[data-delete]');
  if(remove){const entry=entries.find(e=>e.id===remove.dataset.delete);if(!entry)return;deleteId=entry.id;$('#delete-description').textContent=`${dateLabel(entry.date)} · ${entry.category} · ${money(entry.amount)}`;$('#delete-dialog').showModal();}
});
function cancelDelete(){deleteId=null;$('#delete-dialog').close();}
$('#close-delete').addEventListener('click',cancelDelete);$('#cancel-delete').addEventListener('click',cancelDelete);
$('#confirm-delete').addEventListener('click',()=>{if(!deleteId)return;entries=entries.filter(e=>e.id!==deleteId);persist();cancelDelete();render();showToast('Запись удалена');});
$('#year-select').addEventListener('change',()=>{
  render();const year=currentYear();
  ['#summer-start','#summer-end'].forEach(selector=>{const value=$(selector).value;if(value.length>=10)$(selector).value=`${year}-${value.slice(5)}`;});
  renderDailyRulePreview();
});
$('#export-button').addEventListener('click',exportCsv);
document.querySelectorAll('[data-category-type]').forEach(button=>button.addEventListener('click',()=>{categoryEditorType=button.dataset.categoryType;renderCategoryEditor();}));
$('#add-category').addEventListener('click',()=>openCategoryForm());
$('#category-editor-list').addEventListener('click',event=>{
  const edit=event.target.closest('[data-category-edit]');
  if(edit){openCategoryForm(Number(edit.dataset.categoryEdit));return;}
  const remove=event.target.closest('[data-category-remove]');
  if(!remove)return;
  const list=categoryEditorType==='income'?INCOMES:EXPENSES,index=Number(remove.dataset.categoryRemove),item=list[index];
  if(entries.some(e=>e.type===categoryEditorType&&e.category===item.name)){showToast('Сначала измените или перенесите записи по этой статье.');return;}
  if(categoryEditorType==='expense'&&dailyRule.enabled&&dailyRule.category===item.name){showToast('Сначала выберите другую статью ежедневного расхода.');return;}
  if(list.length===1){showToast('Оставьте хотя бы одну статью этого типа.');return;}
  list.splice(index,1);if(categoryEditorType==='expense'&&dailyRule.category===item.name){dailyRule.category=list[0].name;localStorage.setItem(DAILY_RULE_KEY,JSON.stringify(dailyRule));}saveCategories();render();renderCategoryEditor();showToast('Статья удалена');
});
function closeCategory(){ $('#category-dialog').close(); }
$('#close-category').addEventListener('click',closeCategory); $('#cancel-category').addEventListener('click',closeCategory);
$('#category-form').addEventListener('submit',event=>{
  event.preventDefault();
  const form=event.currentTarget,list=categoryEditorType==='income'?INCOMES:EXPENSES,index=Number(form.dataset.editIndex),old=list[index];
  const name=$('#category-name').value.trim(),emoji=$('#category-emoji').value.trim();
  if(!name||!emoji)return;
  if(list.some((x,i)=>i!==index&&x.name.toLocaleLowerCase('ru')===name.toLocaleLowerCase('ru'))){showToast('Статья с таким названием уже есть.');return;}
  if(old&&old.name!==name) { entries.forEach(e=>{if(e.type===categoryEditorType&&e.category===old.name)e.category=name;}); if(categoryEditorType==='expense'&&dailyRule.category===old.name){dailyRule.category=name;try{localStorage.setItem(DAILY_RULE_KEY,JSON.stringify(dailyRule));}catch{}} }
  const item={name,emoji};
  if(index>=0)list[index]=item;else list.push(item);
  saveCategories();persist();closeCategory();render();renderCategoryEditor();showToast(index>=0?'Статья обновлена':'Статья добавлена');
});
$('#daily-rule-form').addEventListener('submit',event=>{
  event.preventDefault();
  const start=normalizeAnnualDay('#summer-start'),end=normalizeAnnualDay('#summer-end');
  if(!start||!end){showToast('Укажите начало и конец летнего периода.');return;}
  dailyRule={enabled:$('#daily-enabled').checked,category:$('#daily-category').value,summerStart:start,summerEnd:end,summerRate:Math.max(0,Number($('#summer-rate').value)||0),winterRate:Math.max(0,Number($('#winter-rate').value)||0)};
  try{localStorage.setItem(DAILY_RULE_KEY,JSON.stringify(dailyRule));}catch{showToast('Не удалось сохранить настройку ежедневных расходов.');return;}
  render();renderDailyRulePreview();showToast(dailyRule.enabled?'Ежедневный расход включён':'Автоматический расход выключен');
});
['#daily-enabled','#daily-category','#summer-start','#summer-end','#summer-rate','#winter-rate'].forEach(selector=>$(selector).addEventListener('input',renderDailyRulePreview));
['#summer-start','#summer-end','#daily-category'].forEach(selector=>$(selector).addEventListener('change',renderDailyRulePreview));
document.querySelectorAll('.nav-item[data-target]').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x===button));
  document.getElementById(button.dataset.target).scrollIntoView({behavior:'smooth',block:'start'});
}));
$('#edit-herd').addEventListener('click',()=>{
  $('#herd-fields').innerHTML=LIVESTOCK.map(x=>`<label class="herd-field"><span>${x.emoji} ${x.name}</span><input type="number" min="0" step="1" inputmode="numeric" name="${x.id}" value="${Math.max(0,Number(herd[x.id])||0)}" required /></label>`).join('');
  $('#herd-dialog').showModal();
});
function closeHerd(){ $('#herd-dialog').close(); }
$('#close-herd').addEventListener('click',closeHerd); $('#cancel-herd').addEventListener('click',closeHerd);
$('#herd-form').addEventListener('submit',event=>{
  event.preventDefault();
  for(const x of LIVESTOCK){const value=Number(event.currentTarget.elements[x.id].value);herd[x.id]=Number.isFinite(value)?Math.max(0,Math.floor(value)):0;}
  try{localStorage.setItem(HERD_KEY,JSON.stringify(herd));}catch{showToast('Не удалось сохранить количество животных.');}
  closeHerd();render();renderDailyRulePreview();showToast('Поголовье обновлено');
});
let installPrompt;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('#install-app').hidden=false;});
$('#install-app').addEventListener('click',async()=>{
  if(!installPrompt){showToast('Откройте меню браузера и выберите «Установить приложение»');return;}
  installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#install-app').hidden=true;
});
if('serviceWorker' in navigator && location.protocol!=='file:') window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
render();
populateDailyRuleForm();
renderCategoryEditor();
