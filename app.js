'use strict';
const $ = (id) => document.getElementById(id);
const C = SparkitCalculators;
const n = (id) => C.parseNumber($(id).value);
const fmt = (v) => v.toLocaleString('en-AU', { maximumSignificantDigits: 9 });
const names = { ohms: 'Ohm’s Law', vdrop: 'Voltage Drop', three: 'Three-Phase', conduit: 'Conduit Fill', derate: 'Corrected Capacity', convert: 'Unit Conversion' };
const fields = {
  ohms: ['ohm-v', 'ohm-i', 'ohm-r', 'ohm-p'],
  vdrop: ['vd-solve', 'vd-vd', 'vd-i', 'vd-l', 'vd-k', 'vd-nominal', 'vd-limit'],
  three: ['tp-vl', 'tp-il', 'tp-pf', 'tp-connection'],
  conduit: ['cf-id'], derate: ['dr-base', 'dr-load', 'dr-ka', 'dr-kg', 'dr-ki', 'dr-ko'],
  convert: ['conv-group', 'conv-from', 'conv-to', 'conv-value'],
};
const snapshots = new Map();
let editingWorksheet = null;
let saveTool = null;
let worksheetStore;
try { worksheetStore = new SparkitWorksheets.Store(localStorage); } catch { /* Storage may be disabled. Calculators still work. */ }
function getStore() {
  if (!worksheetStore) throw new Error('Browser storage is unavailable. Calculations still work; worksheets could not be saved.');
  return worksheetStore;
}
function navigate(screen) {
  document.querySelectorAll('[data-screen]').forEach((s) => { s.hidden = s.id !== screen; });
  document.querySelectorAll('[data-go]').forEach((b) => {
    b.classList.toggle('active', b.dataset.go === screen);
    if (b.dataset.go === screen) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  if (screen === 'saved') renderSaved();
  window.scrollTo(0, 0);
}
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.go)));
function capture(tool) {
  const inputs = Object.fromEntries(fields[tool].map((id) => [id, $(id).value]));
  if (tool === 'conduit') inputs.cables = [...document.querySelectorAll('.cf-d')].map((el) => el.value);
  return inputs;
}
function invalidate(tool) {
  snapshots.delete(tool);
  document.querySelector(`[data-save="${tool}"]`).disabled = true;
  const output = $(`${tool}-result`);
  if (output.textContent) { output.textContent = 'Inputs changed — calculate again to update the result.'; output.className = 'result'; }
}
function display(tool, result, summary, state = '') {
  const output = $(`${tool}-result`);
  output.replaceChildren(); output.className = `result ${result.ok ? state : 'bad'}`;
  if (!result.ok) { output.textContent = result.message; snapshots.delete(tool); document.querySelector(`[data-save="${tool}"]`).disabled = true; return; }
  const headline = document.createElement('strong'); headline.textContent = summary; output.append(headline);
  const working = document.createElement('details'); working.open = true;
  const heading = document.createElement('summary'); heading.textContent = 'See the working'; working.append(heading);
  result.steps.forEach((step) => { const line = document.createElement('p'); line.textContent = step; working.append(line); });
  output.append(working);
  const assumptions = document.createElement('p'); assumptions.className = 'assumptions'; assumptions.textContent = result.assumptions; output.append(assumptions);
  snapshots.set(tool, { tool, inputs: capture(tool), summary, steps: result.steps, assumptions: result.assumptions, calculationVersion: '0.2.0' });
  document.querySelector(`[data-save="${tool}"]`).disabled = false;
}
function calculate(tool) {
  if (tool === 'ohms') {
    const r = C.solveOhms({ V: n('ohm-v'), I: n('ohm-i'), R: n('ohm-r'), P: n('ohm-p') });
    display(tool, r, r.ok ? `${fmt(r.V)} V · ${fmt(r.I)} A · ${fmt(r.R)} Ω · ${fmt(r.P)} W` : '', 'ok');
  } else if (tool === 'vdrop') {
    const solveFor = $('vd-solve').value;
    const r = C.solveVoltageDrop({ solveFor, drop: n('vd-vd'), current: n('vd-i'), length: n('vd-l'), mvPerAmpPerM: n('vd-k'), nominal: n('vd-nominal'), limitPct: n('vd-limit') });
    const label = { drop: 'Voltage drop', current: 'Current', length: 'Route length', mvPerAmpPerM: 'Cable value' }[solveFor];
    const unit = { drop: 'V', current: 'A', length: 'm', mvPerAmpPerM: 'mV/A/m' }[solveFor];
    let text = r.ok ? `${label}: ${fmt(r.result)} ${unit}` : '';
    if (r.percentage !== null && r.ok) text += ` · ${fmt(r.percentage)}% drop`;
    if (r.comparison !== null && r.ok) text += r.comparison ? ' · within your comparison limit' : ' · exceeds your comparison limit';
    display(tool, r, text, r.comparison === false ? 'bad' : '');
  } else if (tool === 'three') {
    const r = C.threePhase({ lineVoltage: n('tp-vl'), lineCurrent: n('tp-il'), powerFactor: n('tp-pf'), connection: $('tp-connection').value });
    display(tool, r, r.ok ? `${fmt(r.apparent / 1000)} kVA${r.real === null ? '' : ` · ${fmt(r.real / 1000)} kW · ${fmt(r.reactive / 1000)} kVAR`} · phase ${fmt(r.phaseVoltage)} V` : '', 'ok');
  } else if (tool === 'conduit') {
    const r = C.conduitFill({ internalDiameter: n('cf-id'), cableDiameters: [...document.querySelectorAll('.cf-d')].map((el) => C.parseNumber(el.value)) });
    display(tool, r, r.ok ? `${fmt(r.fillPercent)}% geometric fill` : '');
  } else if (tool === 'derate') {
    const r = C.derating({ base: n('dr-base'), load: n('dr-load'), factors: ['dr-ka', 'dr-kg', 'dr-ki', 'dr-ko'].map(n) });
    display(tool, r, r.ok ? `${fmt(r.capacity)} A corrected capacity${r.comparison === null ? '' : r.comparison ? ' · meets or exceeds entered load' : ' · below entered load'}` : '', r.comparison === false ? 'bad' : '');
  } else if (tool === 'convert') {
    const r = C.convert({ group: $('conv-group').value, value: n('conv-value'), from: $('conv-from').value, to: $('conv-to').value });
    display(tool, r, r.ok ? `${fmt(r.result)} ${r.unit}` : '', 'ok');
  }
}
document.querySelectorAll('[data-tool]').forEach((form) => {
  form.addEventListener('submit', (e) => { e.preventDefault(); calculate(form.dataset.tool); });
  form.addEventListener('input', () => invalidate(form.dataset.tool));
  form.addEventListener('change', () => invalidate(form.dataset.tool));
  const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'save-btn'; clear.textContent = 'Clear inputs';
  clear.addEventListener('click', () => {
    const tool = form.dataset.tool;
    const defaults = { 'vd-solve': 'drop', 'vd-nominal': '230', 'tp-connection': 'star', 'dr-ka': '1', 'dr-kg': '1', 'dr-ki': '1', 'dr-ko': '1', 'conv-group': 'length' };
    fields[tool].forEach((id) => { $(id).value = defaults[id] ?? ''; });
    if (tool === 'conduit') { $('cf-cables').replaceChildren(); addCable(); }
    if (tool === 'convert') populateUnits();
    if (tool === 'vdrop') updateUnknown();
    if (editingWorksheet?.tool === tool) editingWorksheet = null;
    invalidate(tool); $(`${tool}-result`).replaceChildren();
  });
  form.append(clear);
});
function updateUnknown() {
  const key = { drop: 'vd-vd', current: 'vd-i', length: 'vd-l', mvPerAmpPerM: 'vd-k' }[$('vd-solve').value];
  ['vd-vd', 'vd-i', 'vd-l', 'vd-k'].forEach((id) => { $(id).disabled = id === key; $(id).placeholder = id === key ? 'calculated below' : ''; });
}
$('vd-solve').addEventListener('change', updateUnknown); updateUnknown();
function addCable(value = '') {
  const row = document.createElement('div'); row.className = 'cable-row';
  const label = document.createElement('label'); label.textContent = 'Cable overall diameter (mm)';
  const input = document.createElement('input'); input.inputMode = 'decimal'; input.className = 'cf-d'; input.value = value; label.append(input);
  const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Remove cable');
  remove.addEventListener('click', () => { row.remove(); invalidate('conduit'); }); row.append(label, remove); $('cf-cables').append(row);
}
addCable();
$('cf-add').addEventListener('click', () => { addCable(); invalidate('conduit'); });
function populateUnits() {
  const units = C.UNIT_GROUPS[$('conv-group').value].units;
  for (const id of ['conv-from', 'conv-to']) {
    $(id).replaceChildren(); Object.entries(units).forEach(([key, [name]]) => $(id).add(new Option(name, key)));
  }
  $('conv-to').selectedIndex = Math.min(2, Object.keys(units).length - 1);
}
Object.entries(C.UNIT_GROUPS).forEach(([key, group]) => $('conv-group').add(new Option(group.label, key))); populateUnits();
$('conv-group').addEventListener('change', populateUnits);
$('conv-swap').addEventListener('click', () => {
  const from = $('conv-from').value; $('conv-from').value = $('conv-to').value; $('conv-to').value = from; invalidate('convert');
});
const examples = {
  ohms: { 'ohm-v': '230', 'ohm-i': '10', 'ohm-r': '', 'ohm-p': '' },
  vdrop: { 'vd-solve': 'drop', 'vd-vd': '', 'vd-i': '10', 'vd-l': '20', 'vd-k': '18', 'vd-nominal': '230', 'vd-limit': '' },
  three: { 'tp-connection': 'star', 'tp-vl': '400', 'tp-il': '10', 'tp-pf': '0.8' },
  conduit: { 'cf-id': '20', cables: ['5', '5'] },
  derate: { 'dr-base': '32', 'dr-load': '20', 'dr-ka': '0.9', 'dr-kg': '0.8', 'dr-ki': '1', 'dr-ko': '1' },
};
function restore(tool, inputs) {
  if (tool === 'convert') { $('conv-group').value = inputs['conv-group']; populateUnits(); }
  fields[tool].forEach((id) => { $(id).value = inputs[id] ?? ''; });
  if (tool === 'conduit') { $('cf-cables').replaceChildren(); (inputs.cables || ['']).forEach(addCable); }
  if (tool === 'vdrop') updateUnknown();
}
document.querySelectorAll('[data-example]').forEach((button) => button.addEventListener('click', () => {
  editingWorksheet = null; const tool = button.dataset.example; restore(tool, examples[tool]); calculate(tool);
}));
document.querySelectorAll('[data-save]').forEach((button) => button.addEventListener('click', () => {
  saveTool = button.dataset.save;
  if (!snapshots.has(saveTool)) return;
  const record = editingWorksheet?.tool === saveTool ? editingWorksheet : null;
  $('save-name').value = record?.name || names[saveTool]; $('save-notes').value = record?.notes || ''; $('save-status').textContent = '';
  $('save-heading').textContent = 'Save worksheet'; $('save-update').hidden = !record; $('save-dialog').showModal(); $('save-name').focus();
}));
$('save-cancel').addEventListener('click', () => $('save-dialog').close());
$('save-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const snapshot = snapshots.get(saveTool);
  if (!snapshot) { $('save-status').textContent = 'Recalculate before saving.'; return; }
  try {
    const current = e.submitter?.id === 'save-update' && editingWorksheet?.tool === saveTool ? editingWorksheet : null;
    const record = { id: current?.id || crypto.randomUUID(), ...snapshot, name: $('save-name').value.trim(), notes: $('save-notes').value.trim(), updated: new Date().toISOString() };
    getStore().save(record); editingWorksheet = null; $('save-dialog').close(); navigate('saved');
    $('saved-status').textContent = 'Worksheet saved on this device.';
  } catch (err) { $('save-status').textContent = err.message; }
});
function renderSaved() {
  const list = $('saved-list'); list.replaceChildren(); $('saved-status').textContent = '';
  try {
    const q = $('saved-search').value.trim().toLowerCase();
    const records = getStore().list().filter((r) => [r.name, r.notes, names[r.tool]].join(' ').toLowerCase().includes(q));
    if (!records.length) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = q ? 'No worksheets match your search.' : 'Your next calculation can become your first worksheet. Calculate, then tap Save worksheet.'; list.append(p); }
    records.forEach((record) => {
      const card = document.createElement('article'); card.className = 'card worksheet';
      const title = document.createElement('h2'); title.textContent = record.name;
      const meta = document.createElement('p'); meta.className = 'clause'; meta.textContent = `${names[record.tool]} · ${new Date(record.updated).toLocaleDateString('en-AU')}`;
      const summary = document.createElement('p'); summary.textContent = typeof record.summary === 'string' ? record.summary : 'Open to recalculate.';
      const notes = document.createElement('p'); notes.className = 'clause'; notes.textContent = record.notes;
      const open = document.createElement('button'); open.type = 'button'; open.className = 'save-btn'; open.textContent = 'Open & recalculate';
      open.addEventListener('click', () => {
        try { restore(record.tool, record.inputs); editingWorksheet = record; navigate(record.tool === 'derate' ? 'conduit' : record.tool); calculate(record.tool); }
        catch { $('saved-status').textContent = 'This worksheet cannot be opened by this version. Its saved data is preserved.'; }
      });
      card.append(title, meta, summary, notes, open); list.append(card);
    });
  } catch (err) { $('saved-status').textContent = err.message; }
}
$('saved-search').addEventListener('input', renderSaved);
$('saved-export').addEventListener('click', () => {
  try {
    const blob = new Blob([getStore().export()], { type: 'application/json' }); const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'sparkit-worksheets.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) { $('saved-status').textContent = err.message; }
});
$('saved-import').addEventListener('click', () => $('saved-file').click());
$('saved-file').addEventListener('change', async () => {
  const file = $('saved-file').files[0]; if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error('Choose a worksheet backup smaller than 2 MB.');
    const result = getStore().import(await file.text()); renderSaved();
    $('saved-status').textContent = `${result.imported} worksheets restored; ${result.skipped} already present (existing copies kept).`;
  } catch (err) { $('saved-status').textContent = err.message; }
  finally { $('saved-file').value = ''; }
});
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
