'use strict';
(function (root, factory) {
  const api = factory(root.SparkitCalculators || (typeof module !== 'undefined' && module.exports ? require('./calculators.js') : null));
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SparkitWorksheets = api;
}(globalThis, (calculators) => {
  const KEY = 'sparkit.worksheets.v1';
  const TOOLS = ['ohms', 'vdrop', 'three', 'conduit', 'derate', 'convert'];
  const requiredFields = {
    ohms: ['ohm-v', 'ohm-i', 'ohm-r', 'ohm-p'], vdrop: ['vd-solve', 'vd-vd', 'vd-i', 'vd-l', 'vd-k', 'vd-nominal', 'vd-limit'],
    three: ['tp-vl', 'tp-il', 'tp-pf', 'tp-connection'], conduit: ['cf-id'],
    derate: ['dr-base', 'dr-load', 'dr-ka', 'dr-kg', 'dr-ki', 'dr-ko'], convert: ['conv-group', 'conv-from', 'conv-to', 'conv-value'],
  };
  function validate(record) {
    if (!record || typeof record !== 'object' || !TOOLS.includes(record.tool) || typeof record.id !== 'string' || !record.id || typeof record.name !== 'string' || !record.name.trim() || record.name.length > 80 || typeof record.notes !== 'string' || record.notes.length > 1000 || typeof record.updated !== 'string' || !Number.isFinite(Date.parse(record.updated))) throw new Error('A saved worksheet has an unsupported format. Your stored data has not been changed.');
    if (!record.inputs || typeof record.inputs !== 'object' || Array.isArray(record.inputs) || Object.values(record.inputs).some((v) => typeof v !== 'string' && !(Array.isArray(v) && v.every((x) => typeof x === 'string')))) throw new Error('The worksheet inputs are not valid.');
    if (requiredFields[record.tool].some((key) => typeof record.inputs[key] !== 'string' || record.inputs[key].length > 100)) throw new Error('The worksheet is missing expected input fields.');
    if (record.tool === 'conduit' && (!Array.isArray(record.inputs.cables) || record.inputs.cables.length > 100 || record.inputs.cables.some((v) => typeof v !== 'string' || v.length > 100))) throw new Error('The saved cable inputs are invalid.');
    if (record.tool === 'vdrop' && !['drop', 'current', 'length', 'mvPerAmpPerM'].includes(record.inputs['vd-solve'])) throw new Error('Unsupported voltage-drop solve mode.');
    if (record.tool === 'three' && !['star', 'delta'].includes(record.inputs['tp-connection'])) throw new Error('Unsupported three-phase connection.');
    if (record.tool === 'convert') {
      const group = record.inputs['conv-group'];
      const units = Object.hasOwn(calculators.UNIT_GROUPS, group) ? calculators.UNIT_GROUPS[group].units : null;
      if (!units || !Object.hasOwn(units, record.inputs['conv-from']) || !Object.hasOwn(units, record.inputs['conv-to'])) throw new Error('Unsupported conversion quantity or units.');
    }
    return record;
  }
  class Store {
    constructor(storage) { this.storage = storage; }
    list() {
      const raw = this.storage.getItem(KEY);
      if (raw === null) return [];
      let data;
      try { data = JSON.parse(raw); } catch { throw new Error('Saved worksheets could not be read. The original data has been preserved.'); }
      if (data?.version !== 1 || !Array.isArray(data.records)) throw new Error('Unsupported worksheet version. The original data has been preserved.');
      return data.records.map(validate).sort((a, b) => b.updated.localeCompare(a.updated));
    }
    save(record) {
      validate(record);
      const records = this.list();
      const index = records.findIndex((r) => r.id === record.id);
      if (index < 0) records.push(record); else records[index] = record;
      this.write(records);
      return record;
    }
    write(records) {
      if (records.length > 500) throw new Error('This version supports up to 500 worksheets per device. Export your worksheets to keep a backup.');
      try { this.storage.setItem(KEY, JSON.stringify({ version: 1, records })); } catch { throw new Error('This device could not save the worksheet. Export existing worksheets or check browser storage.'); }
    }
    import(text) {
      let data;
      try { data = JSON.parse(text); } catch { throw new Error('Choose a valid Sparkit JSON backup. Nothing was imported.'); }
      if (data?.version !== 1 || !Array.isArray(data.records) || data.records.length > 500) throw new Error('This backup format is not supported. Nothing was imported.');
      data.records.forEach(validate);
      const records = this.list(); const ids = new Set(records.map((record) => record.id)); let imported = 0;
      for (const record of data.records) {
        if (ids.has(record.id)) continue;
        records.push(record); ids.add(record.id); imported++;
      }
      this.write(records);
      return { imported, skipped: data.records.length - imported };
    }
    export() { return JSON.stringify({ version: 1, records: this.list() }, null, 2); }
  }
  return { Store, KEY, TOOLS, validate };
}));
