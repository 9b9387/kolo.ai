import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPLETENESS_COLUMNS,
  FDC_ID_WHITELIST,
  NUTRIENTS,
  NUTRIENT_COLUMNS,
  kjToKcal,
  offUnitConvert,
  resolveFdcEnergy,
  saltToSodiumMg,
} from './nutrients';

test('resolveFdcEnergy prefers 1008 over every alternative', () => {
  const map = new Map<number, number>([
    [1008, 100],
    [2047, 101],
    [2048, 102],
    [1062, 500],
  ]);
  assert.equal(resolveFdcEnergy(map), 100);
});

test('resolveFdcEnergy falls back to 2047 (Atwater general)', () => {
  const map = new Map<number, number>([
    [2047, 101],
    [2048, 102],
    [1062, 500],
  ]);
  assert.equal(resolveFdcEnergy(map), 101);
});

test('resolveFdcEnergy falls back to 2048 (Atwater specific)', () => {
  const map = new Map<number, number>([
    [2048, 102],
    [1062, 500],
  ]);
  assert.equal(resolveFdcEnergy(map), 102);
});

test('resolveFdcEnergy converts 1062 kJ as the last resort', () => {
  const map = new Map<number, number>([[1062, 850]]);
  // 850 / 4.184 = 203.1548... → 203.155 (3 decimals)
  assert.equal(resolveFdcEnergy(map), 203.155);
});

test('resolveFdcEnergy returns null when no energy id is present', () => {
  assert.equal(resolveFdcEnergy(new Map()), null);
  assert.equal(resolveFdcEnergy(new Map([[1003, 12]])), null);
});

test('resolveFdcEnergy keeps a legitimate 0 kcal value', () => {
  assert.equal(resolveFdcEnergy(new Map([[1008, 0]])), 0);
});

test('kjToKcal converts and rounds to 3 decimals', () => {
  assert.equal(kjToKcal(4.184), 1);
  assert.equal(kjToKcal(0), 0);
  assert.equal(kjToKcal(100), 23.901); // 23.90057...
  assert.equal(kjToKcal(2000), 478.011); // 478.0114...
});

test('offUnitConvert handles mass unit scaling in both directions', () => {
  assert.equal(offUnitConvert(1, 'g', 'mg'), 1000);
  assert.equal(offUnitConvert(1, 'g', 'ug'), 1_000_000);
  assert.equal(offUnitConvert(2, 'mg', 'ug'), 2000);
  assert.equal(offUnitConvert(500, 'µg', 'mg'), 0.5);
  assert.equal(offUnitConvert(250, 'mg', 'g'), 0.25);
  assert.equal(offUnitConvert(1.5, 'kg', 'g'), 1500);
  assert.equal(offUnitConvert(3, 'mcg', 'ug'), 3);
  assert.equal(offUnitConvert(7, 'MG', 'mg'), 7); // case-insensitive
});

test('offUnitConvert treats a missing unit as already-target', () => {
  assert.equal(offUnitConvert(12, undefined, 'mg'), 12);
  assert.equal(offUnitConvert(12, '', 'g'), 12);
  assert.equal(offUnitConvert(12, '  ', 'kcal'), 12);
});

test('offUnitConvert rejects IU in every combination', () => {
  assert.equal(offUnitConvert(5, 'IU', 'ug'), null);
  assert.equal(offUnitConvert(5, 'iu', 'mg'), null);
  assert.equal(offUnitConvert(5, 'Iu', 'g'), null);
});

test('offUnitConvert converts energy units to kcal only', () => {
  assert.equal(offUnitConvert(2, 'kcal', 'kcal'), 2);
  assert.equal(offUnitConvert(100, 'kJ', 'kcal'), 23.901);
  assert.equal(offUnitConvert(100, 'kj', 'kcal'), 23.901);
  assert.equal(offUnitConvert(5, 'g', 'kcal'), null); // mass → energy
  assert.equal(offUnitConvert(5, 'kcal', 'g'), null); // energy → mass
  assert.equal(offUnitConvert(5, 'kj', 'mg'), null);
});

test('offUnitConvert rejects unknown units and non-finite values', () => {
  assert.equal(offUnitConvert(5, '%', 'g'), null);
  assert.equal(offUnitConvert(5, '% vol', 'g'), null);
  assert.equal(offUnitConvert(5, 'ml', 'g'), null);
  assert.equal(offUnitConvert(Number.NaN, 'g', 'mg'), null);
  assert.equal(offUnitConvert(Number.POSITIVE_INFINITY, 'g', 'mg'), null);
});

test('offUnitConvert boundary values: 0 converts, negatives pass through', () => {
  assert.equal(offUnitConvert(0, 'g', 'mg'), 0);
  // Negative amounts are physically invalid but rejecting them is the
  // caller's responsibility — the converter only scales.
  assert.equal(offUnitConvert(-5, 'g', 'mg'), -5000);
});

test('saltToSodiumMg applies the salt ÷ 2.5 fallback in mg', () => {
  assert.equal(saltToSodiumMg(2.5), 1000);
  assert.equal(saltToSodiumMg(1), 400);
  assert.equal(saltToSodiumMg(0), 0);
});

test('FDC_ID_WHITELIST covers every mapped id exactly once', () => {
  for (const id of [1008, 2047, 2048, 1062, 1003, 1004, 1005, 1079, 2000, 1103, 1057, 1051, 1018]) {
    assert.equal(FDC_ID_WHITELIST.has(id), true, `missing FDC id ${id}`);
  }
  assert.equal(FDC_ID_WHITELIST.has(9999), false);
  // 39 columns × 1 primary id, plus 2047/2048/1062 energy alternates.
  assert.equal(FDC_ID_WHITELIST.size, 42);
});

test('NUTRIENTS table shape is consistent', () => {
  assert.equal(NUTRIENT_COLUMNS.length, 39);
  for (const column of NUTRIENT_COLUMNS) {
    const spec = NUTRIENTS[column];
    assert.equal(spec.fdcIds.length > 0, true, `${column} has no FDC id`);
    // Column-name unit suffix must agree with spec.unit.
    if (column === 'energyKcal') assert.equal(spec.unit, 'kcal');
    else if (column.endsWith('G')) assert.equal(spec.unit, 'g', column);
    else if (column.endsWith('Mg')) assert.equal(spec.unit, 'mg', column);
    else if (column.endsWith('Ug') || column === 'vitAUgRae') assert.equal(spec.unit, 'ug', column);
    else assert.fail(`unrecognized column suffix: ${column}`);
  }
  assert.equal(COMPLETENESS_COLUMNS.length, 12);
  for (const column of COMPLETENESS_COLUMNS) {
    assert.equal(NUTRIENT_COLUMNS.includes(column), true, `${column} not in NUTRIENTS`);
  }
});
