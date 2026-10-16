'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SparkitCalculators = api;
}(globalThis, () => {
  const finite = Number.isFinite;
  const positive = (n) => finite(n) && n > 0;
  const absent = (n) => n === null || n === undefined || n === '';
  const error = (message) => ({ ok: false, message });
  const f = (n) => n.toLocaleString('en-AU', { maximumSignificantDigits: 9 });
  function parseNumber(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    if (!/^[+-]?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)) return NaN;
    const n = Number(raw.replace(/,/g, ''));
    return finite(n) ? n : NaN;
  }
  function solveOhms(values) {
    const supplied = Object.entries(values).filter(([, v]) => !absent(v));
    if (supplied.length !== 2) return error('Enter exactly two values. Clear the others before calculating.');
    if (supplied.some(([, v]) => !positive(v))) return error('Use numbers greater than zero for the two known values.');
    const k = Object.fromEntries(supplied);
    let V, I, R, P, steps;
    if (k.V && k.I) {
      V = k.V; I = k.I; R = V / I; P = V * I;
      steps = [`R = V ÷ I = ${f(V)} V ÷ ${f(I)} A = ${f(R)} Ω`, `P = V × I = ${f(V)} V × ${f(I)} A = ${f(P)} W`];
    } else if (k.V && k.R) {
      V = k.V; R = k.R; I = V / R; P = V * I;
      steps = [`I = V ÷ R = ${f(V)} V ÷ ${f(R)} Ω = ${f(I)} A`, `P = V × I = ${f(V)} V × ${f(I)} A = ${f(P)} W`];
    } else if (k.V && k.P) {
      V = k.V; P = k.P; I = P / V; R = V / I;
      steps = [`I = P ÷ V = ${f(P)} W ÷ ${f(V)} V = ${f(I)} A`, `R = V ÷ I = ${f(V)} V ÷ ${f(I)} A = ${f(R)} Ω`];
    } else if (k.I && k.R) {
      I = k.I; R = k.R; V = I * R; P = V * I;
      steps = [`V = I × R = ${f(I)} A × ${f(R)} Ω = ${f(V)} V`, `P = V × I = ${f(V)} V × ${f(I)} A = ${f(P)} W`];
    } else if (k.I && k.P) {
      I = k.I; P = k.P; V = P / I; R = V / I;
      steps = [`V = P ÷ I = ${f(P)} W ÷ ${f(I)} A = ${f(V)} V`, `R = V ÷ I = ${f(V)} V ÷ ${f(I)} A = ${f(R)} Ω`];
    } else if (k.R && k.P) {
      R = k.R; P = k.P; I = Math.sqrt(P / R); V = I * R;
      steps = [`I = √(P ÷ R) = √(${f(P)} W ÷ ${f(R)} Ω) = ${f(I)} A`, `V = I × R = ${f(I)} A × ${f(R)} Ω = ${f(V)} V`];
    }
    if (![V, I, R, P].every(positive)) return error('The result is outside the supported numerical range.');
    return { ok: true, V, I, R, P, steps, assumptions: 'DC or purely resistive load; positive magnitudes.' };
  }
  function solveVoltageDrop({ solveFor, drop, current, length, mvPerAmpPerM, nominal, limitPct }) {
    const values = { drop, current, length, mvPerAmpPerM };
    const required = { drop: ['current', 'length', 'mvPerAmpPerM'], current: ['drop', 'length', 'mvPerAmpPerM'], length: ['drop', 'current', 'mvPerAmpPerM'], mvPerAmpPerM: ['drop', 'current', 'length'] }[solveFor];
    if (!required) return error('Choose the value to calculate.');
    if (required.some((key) => !positive(values[key]))) return error('Enter positive numbers for the other three fields.');
    if (!absent(nominal) && !positive(nominal)) return error('Nominal voltage must be greater than zero.');
    if (!absent(limitPct) && (!finite(limitPct) || limitPct < 0 || limitPct > 100)) return error('Enter a comparison limit between 0 and 100%.');
    if (!absent(limitPct) && absent(nominal)) return error('Enter nominal voltage to compare a percentage.');
    let result, step;
    if (solveFor === 'drop') { result = length * current * mvPerAmpPerM / 1000; step = `Vd = L × I × k ÷ 1000 = ${f(length)} × ${f(current)} × ${f(mvPerAmpPerM)} ÷ 1000 = ${f(result)} V`; }
    if (solveFor === 'current') { result = drop * 1000 / (length * mvPerAmpPerM); step = `I = Vd × 1000 ÷ (L × k) = ${f(drop)} × 1000 ÷ (${f(length)} × ${f(mvPerAmpPerM)}) = ${f(result)} A`; }
    if (solveFor === 'length') { result = drop * 1000 / (current * mvPerAmpPerM); step = `L = Vd × 1000 ÷ (I × k) = ${f(drop)} × 1000 ÷ (${f(current)} × ${f(mvPerAmpPerM)}) = ${f(result)} m`; }
    if (solveFor === 'mvPerAmpPerM') { result = drop * 1000 / (current * length); step = `k = Vd × 1000 ÷ (I × L) = ${f(drop)} × 1000 ÷ (${f(current)} × ${f(length)}) = ${f(result)} mV/A/m`; }
    if (!positive(result)) return error('The result is outside the supported numerical range.');
    const calculatedDrop = solveFor === 'drop' ? result : drop;
    const percentage = absent(nominal) ? null : calculatedDrop / nominal * 100;
    if (percentage !== null && !finite(percentage)) return error('The percentage is outside the supported numerical range.');
    const steps = [step];
    if (percentage !== null) steps.push(`Drop % = Vd ÷ Vnom × 100 = ${f(calculatedDrop)} ÷ ${f(nominal)} × 100 = ${f(percentage)}%`);
    return { ok: true, result, percentage, comparison: percentage === null || absent(limitPct) ? null : percentage <= limitPct, steps, assumptions: 'One-way route length in metres. Supplied k (mV/A/m) must match the circuit, installation and phase; no extra phase multiplier is applied.' };
  }
  function threePhase({ lineVoltage, lineCurrent, powerFactor, connection = 'star' }) {
    if (!positive(lineVoltage) || !positive(lineCurrent)) return error('Line voltage and current must be greater than zero.');
    if (!['star', 'delta'].includes(connection)) return error('Choose star or delta connection.');
    if (!absent(powerFactor) && (!finite(powerFactor) || powerFactor < 0 || powerFactor > 1)) return error('Power factor must be between 0 and 1.');
    const apparent = Math.sqrt(3) * lineVoltage * lineCurrent;
    const phaseVoltage = connection === 'star' ? lineVoltage / Math.sqrt(3) : lineVoltage;
    const real = absent(powerFactor) ? null : apparent * powerFactor;
    const reactive = real === null ? null : apparent * Math.sqrt(Math.max(1 - powerFactor ** 2, 0));
    if (![apparent, phaseVoltage, real ?? 0, reactive ?? 0].every(finite)) return error('The result is outside the supported numerical range.');
    const steps = [`S = √3 × VL × IL = √3 × ${f(lineVoltage)} × ${f(lineCurrent)} = ${f(apparent / 1000)} kVA`, connection === 'star' ? `Vphase = VL ÷ √3 = ${f(lineVoltage)} ÷ √3 = ${f(phaseVoltage)} V` : `Vphase = VL = ${f(phaseVoltage)} V (delta)`];
    if (real !== null) steps.push(`P = S × pf = ${f(apparent / 1000)} × ${f(powerFactor)} = ${f(real / 1000)} kW`, `Q = S × √(1 − pf²) = ${f(reactive / 1000)} kVAR`);
    return { ok: true, apparent, phaseVoltage, real, reactive, steps, assumptions: 'Balanced sinusoidal three-phase load. Reactive power is a magnitude; leading/lagging sign is not inferred.' };
  }
  function conduitFill({ internalDiameter, cableDiameters }) {
    if (!positive(internalDiameter)) return error('Conduit internal diameter must be greater than zero.');
    if (!Array.isArray(cableDiameters) || !cableDiameters.length || cableDiameters.some((v) => !positive(v))) return error('Enter a positive overall diameter for each cable, or remove the unused row.');
    const conduitArea = Math.PI / 4 * internalDiameter ** 2;
    const cableArea = cableDiameters.reduce((sum, v) => sum + Math.PI / 4 * v ** 2, 0);
    const fillPercent = cableArea / conduitArea * 100;
    if (![conduitArea, cableArea, fillPercent].every(positive)) return error('The result is outside the supported numerical range.');
    return { ok: true, conduitArea, cableArea, fillPercent, steps: [`Conduit area = π × ID² ÷ 4 = π × ${f(internalDiameter)}² ÷ 4 = ${f(conduitArea)} mm²`, `Cable area = Σ(π × diameter² ÷ 4) = ${f(cableArea)} mm²`, `Fill = cable area ÷ conduit area × 100 = ${f(fillPercent)}%`], assumptions: 'Round cross-sections. All diameters in mm. Geometry only; no automatic space-factor approval.' };
  }
  function derating({ base, load, factors }) {
    if (!positive(base)) return error('Base capacity must be greater than zero.');
    if (!absent(load) && (!finite(load) || load < 0)) return error('Design load must be zero or greater.');
    if (!Array.isArray(factors) || factors.length !== 4 || factors.some((v) => !positive(v))) return error('Enter a positive value for each correction factor.');
    const capacity = factors.reduce((v, factor) => v * factor, base);
    if (!positive(capacity)) return error('The result is outside the supported numerical range.');
    return { ok: true, capacity, comparison: absent(load) ? null : capacity >= load, steps: ['Capacity = base × ambient × grouping × insulation × other', `${f(base)} × ${factors.map(f).join(' × ')} = ${f(capacity)} A`], assumptions: 'Use applicable table ratings and correction factors. Capacity comparison alone does not complete cable/protective-device selection.' };
  }
  const UNIT_GROUPS = {
    length: { label: 'Length', units: { mm: ['mm', 0.001], cm: ['cm', 0.01], m: ['m', 1], km: ['km', 1000], inch: ['in', 0.0254], foot: ['ft', 0.3048] } },
    area: { label: 'Area', units: { mm2: ['mm²', 0.000001], cm2: ['cm²', 0.0001], m2: ['m²', 1] } },
    voltage: { label: 'Voltage', units: { mV: ['mV', 0.001], V: ['V', 1], kV: ['kV', 1000] } },
    current: { label: 'Current', units: { mA: ['mA', 0.001], A: ['A', 1], kA: ['kA', 1000] } },
    resistance: { label: 'Resistance', units: { ohm: ['Ω', 1], kohm: ['kΩ', 1000], Mohm: ['MΩ', 1000000] } },
    power: { label: 'Real power', units: { W: ['W', 1], kW: ['kW', 1000], MW: ['MW', 1000000] } },
    apparent: { label: 'Apparent power', units: { VA: ['VA', 1], kVA: ['kVA', 1000], MVA: ['MVA', 1000000] } },
  };
  function convert({ group, value, from, to }) {
    const units = UNIT_GROUPS[group]?.units;
    if (!units || !Object.hasOwn(units, from) || !Object.hasOwn(units, to)) return error('Choose units from the same quantity.');
    if (!finite(value)) return error('Enter a valid number to convert.');
    const factor = units[from][1] / units[to][1];
    const result = value * factor;
    if (!finite(result)) return error('The result is outside the supported numerical range.');
    return { ok: true, result, unit: units[to][0], steps: [`${f(value)} ${units[from][0]} × ${f(factor)} = ${f(result)} ${units[to][0]}`], assumptions: 'Converts units of the same quantity. kW and kVA are different quantities.' };
  }
  return { parseNumber, solveOhms, solveVoltageDrop, threePhase, conduitFill, derating, UNIT_GROUPS, convert };
}));
