'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../calculators.js');
const W = require('../worksheets.js');
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-10, `${actual} differs from ${expected}`);

test('numeric input rejects partial values, hex, malformed grouping and non-finite numbers', () => {
  for (const value of ['10abc', '0x10', '1,2', '--1', 'Infinity', '1e999']) assert.ok(Number.isNaN(C.parseNumber(value)), value);
  for (const [value, expected] of [['1,234.5', 1234.5], ['.8', .8], ['2e3', 2000], ['0', 0]]) assert.equal(C.parseNumber(value), expected);
  assert.equal(C.parseNumber(''), null);
});
test('all voltage-drop inverse solves and the explicit comparison criterion', () => {
  const inputs = { drop: 3.6, current: 10, length: 20, mvPerAmpPerM: 18, nominal: 230 };
  for (const solveFor of ['drop', 'current', 'length', 'mvPerAmpPerM']) {
    const result = C.solveVoltageDrop({ ...inputs, solveFor });
    assert.equal(result.ok, true); near(result.result, inputs[solveFor]); assert.equal(result.comparison, null); assert.equal(result.steps.length, 2);
  }
  assert.equal(C.solveVoltageDrop({ ...inputs, solveFor: 'drop', limitPct: NaN }).ok, false);
  assert.equal(C.solveVoltageDrop({ ...inputs, solveFor: 'drop', limitPct: 0 }).comparison, false);
});
test('star/delta phase voltage and PF boundary', () => {
  const inputs = { lineVoltage: 400, lineCurrent: 10, powerFactor: 0 };
  const star = C.threePhase({ ...inputs, connection: 'star' });
  const delta = C.threePhase({ ...inputs, connection: 'delta' });
  near(star.phaseVoltage, 400 / Math.sqrt(3)); near(delta.phaseVoltage, 400);
  near(star.apparent, delta.apparent); assert.equal(star.real, 0); near(star.reactive, star.apparent);
});
test('no calculator succeeds with a non-finite result or silently ignores invalid entries', () => {
  assert.equal(C.threePhase({ lineVoltage: 1e308, lineCurrent: 1e308 }).ok, false);
  assert.equal(C.derating({ base: 32, factors: [1, NaN, 1, 1] }).ok, false);
  assert.equal(C.derating({ base: 1e308, factors: [2, 2, 2, 2] }).ok, false);
  assert.equal(C.conduitFill({ internalDiameter: 20, cableDiameters: [5, -2] }).ok, false);
  assert.equal(C.conduitFill({ internalDiameter: 1e-200, cableDiameters: [5] }).ok, false);
});
test('conversions preserve quantity, factor and inverse over every unit pair', () => {
  for (const [group, { units }] of Object.entries(C.UNIT_GROUPS)) for (const from of Object.keys(units)) for (const to of Object.keys(units)) {
    const result = C.convert({ group, from, to, value: 125.5 });
    assert.equal(result.ok, true); near(C.convert({ group, from: to, to: from, value: result.result }).result, 125.5);
  }
  near(C.convert({ group: 'length', from: 'foot', to: 'm', value: 10 }).result, 3.048);
  near(C.convert({ group: 'current', from: 'mA', to: 'A', value: 30 }).result, .03);
  assert.equal(C.convert({ group: 'power', from: 'kW', to: 'kVA', value: 1 }).ok, false);
});
function memoryStorage() {
  const data = new Map(); return { getItem: (key) => data.has(key) ? data.get(key) : null, setItem: (key, value) => data.set(key, value) };
}
const fixture = () => ({ id: 'synthetic-1', name: 'Study example', tool: 'ohms', inputs: { 'ohm-v': '230', 'ohm-i': '10', 'ohm-r': '', 'ohm-p': '' }, notes: 'Synthetic only', updated: '2026-10-16T00:00:00.000Z' });
test('worksheet save/reload/update is idempotent and preserves original inputs', () => {
  const storage = memoryStorage(); const store = new W.Store(storage);
  store.save(fixture()); store.save({ ...fixture(), name: 'Renamed worksheet' });
  const reloaded = new W.Store(storage).list();
  assert.equal(reloaded.length, 1); assert.equal(reloaded[0].name, 'Renamed worksheet'); assert.deepEqual(reloaded[0].inputs, fixture().inputs);
  const inputs = reloaded[0].inputs;
  near(C.solveOhms({ V: C.parseNumber(inputs['ohm-v']), I: C.parseNumber(inputs['ohm-i']) }).P, 2300);
  assert.equal(JSON.parse(store.export()).records.length, 1);
});
test('storage errors, corrupt or newer schemas never overwrite existing worksheets', () => {
  for (const raw of ['{bad json', '{"version":2,"records":[]}', '{"version":1,"records":[null]}']) {
    const storage = memoryStorage(); storage.setItem(W.KEY, raw);
    assert.throws(() => new W.Store(storage).save(fixture())); assert.equal(storage.getItem(W.KEY), raw);
  }
  const storage = memoryStorage(); const store = new W.Store(storage); store.save(fixture()); const before = storage.getItem(W.KEY);
  storage.setItem = () => { throw new Error('quota'); };
  assert.throws(() => store.save({ ...fixture(), id: 'second' }), /could not save/); assert.equal(storage.getItem(W.KEY), before);
});
test('restore validates the whole file before writing and skips existing IDs', () => {
  const storage = memoryStorage(); const store = new W.Store(storage);
  const backup = JSON.stringify({ version: 1, records: [fixture()] });
  assert.deepEqual(store.import(backup), { imported: 1, skipped: 0 });
  assert.deepEqual(store.import(backup), { imported: 0, skipped: 1 });
  store.save({ ...fixture(), notes: 'Newer local notes' });
  store.import(backup); assert.equal(store.list()[0].notes, 'Newer local notes');
  const before = store.export();
  assert.throws(() => store.import(JSON.stringify({ version: 1, records: [{ ...fixture(), id: 'second' }, { id: 'bad' }] })));
  assert.equal(store.export(), before);
});
test('restore rejects unknown selectors before touching existing data', () => {
  const storage = memoryStorage(); const store = new W.Store(storage); store.save(fixture()); const before = store.export();
  const cases = [
    { tool: 'convert', inputs: { 'conv-group': 'not-a-quantity', 'conv-from': 'm', 'conv-to': 'mm', 'conv-value': '1' } },
    { tool: 'convert', inputs: { 'conv-group': 'length', 'conv-from': 'kW', 'conv-to': 'mm', 'conv-value': '1' } },
    { tool: 'vdrop', inputs: { 'vd-solve': 'not-a-mode', 'vd-vd': '', 'vd-i': '1', 'vd-l': '1', 'vd-k': '1', 'vd-nominal': '230', 'vd-limit': '' } },
    { tool: 'three', inputs: { 'tp-vl': '400', 'tp-il': '10', 'tp-pf': '0.8', 'tp-connection': 'unknown' } },
  ];
  for (const data of cases) {
    assert.throws(() => store.import(JSON.stringify({ version: 1, records: [{ ...fixture(), ...data, id: 'bad-selector' }] })));
    assert.equal(store.export(), before);
  }
});
