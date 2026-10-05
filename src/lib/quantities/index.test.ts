// Run: npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  boxesForArea,
  ceilToStep,
  floorQuantities,
  formatEn,
  formatFr,
  panelQuantities,
  parsePositiveDecimal,
  pluralFr,
  SQFT_TO_M2,
  type RoomInput,
} from './index';

const planRooms: RoomInput[] = [
  { id: '1', name: 'Salon', length: '18,2', width: '14' },
  { id: '2', name: 'Cuisine', length: '12', width: '10' },
  { id: '3', name: 'Chambre principale', length: '9,8', width: '14' },
  { id: '4', name: 'Corridor', length: '12', width: '4' },
  { id: '5', name: 'Chambre 2', length: '12', width: '12' },
  { id: '6', name: 'Bureau', length: '10', width: '12' },
  { id: '7', name: 'Entrée', length: '10', width: '12' },
];

test('parsePositiveDecimal accepts French and English input', () => {
  assert.equal(parsePositiveDecimal('18,2'), 18.2);
  assert.equal(parsePositiveDecimal('18.2'), 18.2);
  assert.equal(parsePositiveDecimal('1 012,5'), 1012.5);
  assert.equal(parsePositiveDecimal('1 012,5'), 1012.5);
  assert.equal(parsePositiveDecimal('12.'), 12);
  assert.equal(parsePositiveDecimal(',5'), 0.5);
});

test('parsePositiveDecimal rejects non-positive and malformed values', () => {
  for (const bad of ['', 'abc', '0', '-3', '1e3', '12,5,1', '+4', null, undefined, Number.NaN, -1]) {
    assert.equal(parsePositiveDecimal(bad as string), null, `expected null for ${String(bad)}`);
  }
});

test('ceilToStep does not drift on float noise', () => {
  assert.equal(ceilToStep(110.00000000000001, 1), 110);
  assert.equal(ceilToStep(96.47, 0.1), 96.5);
  assert.equal(ceilToStep(20, 1), 20);
});

test('floor: canvas example, 7 rooms from the plan, 10 % waste, 20 sq ft per box', () => {
  const r = floorQuantities({ rooms: planRooms, wastePct: 10, coveragePerBox: '20', units: 'imperial' });
  assert.equal(Math.round(r.netArea * 10) / 10, 944);
  assert.equal(r.orderArea, 1039);
  assert.equal(r.boxes, 52);
  assert.equal(formatFr(r.orderAreaOtherUnit, 1), '96,5');
});

test('floor: 15 % waste matches the prototype', () => {
  const r = floorQuantities({ rooms: planRooms, wastePct: 15, coveragePerBox: '20', units: 'imperial' });
  assert.equal(r.orderArea, 1086);
  assert.equal(r.boxes, 55);
});

test('floor: metric input gives the same box count', () => {
  const metricRooms = planRooms.map((room) => ({
    ...room,
    length: String(Number(room.length.replace(',', '.')) * 0.3048),
    width: String(Number(room.width.replace(',', '.')) * 0.3048),
  }));
  const r = floorQuantities({ rooms: metricRooms, wastePct: 10, coveragePerBox: String(20 * SQFT_TO_M2), units: 'metric' });
  assert.equal(Math.round(r.netArea * 10) / 10, 87.7);
  assert.equal(r.orderArea, 96.5);
  assert.equal(r.boxes, 52);
});

test('floor: invalid rooms are flagged and excluded from the total', () => {
  const rooms = [...planRooms.slice(1), { id: '8', name: 'Salon', length: 'abc', width: '14' }];
  const r = floorQuantities({ rooms, wastePct: 10, coveragePerBox: '20', units: 'imperial' });
  const bad = r.rooms.find((x) => x.id === '8');
  assert.equal(bad?.area, null);
  assert.equal(bad?.lengthError, 'invalid');
  assert.equal(bad?.widthError, null);
  assert.equal(Math.round(r.netArea * 10) / 10, 689.2);
});

test('floor: missing coverage gives area but no box count', () => {
  const r = floorQuantities({ rooms: planRooms, wastePct: 10, coveragePerBox: '', units: 'imperial' });
  assert.equal(r.orderArea, 1039);
  assert.equal(r.boxes, null);
});

test('floor: exact multiples do not add a box', () => {
  const r = floorQuantities({ rooms: [{ id: 'a', name: 'A', length: '4', width: '5' }], wastePct: 5, coveragePerBox: '21', units: 'imperial' });
  assert.equal(r.orderArea, 21);
  assert.equal(r.boxes, 1);
});

test('floor: oversized values are refused', () => {
  const r = floorQuantities({ rooms: [{ id: 'a', name: 'A', length: '5000', width: '10' }], wastePct: 10, coveragePerBox: '20', units: 'imperial' });
  assert.equal(r.rooms[0]!.lengthError, 'too-large');
  assert.equal(r.orderArea, 0);
  assert.equal(r.boxes, null);
});

test('floor: waste must be one of the offered options', () => {
  assert.throws(() => floorQuantities({ rooms: planRooms, wastePct: 12, coveragePerBox: '20', units: 'imperial' }), RangeError);
});

test('panels: 12 x 8 ft wall with 24 x 96 in panels needs 6', () => {
  const r = panelQuantities({ walls: [{ id: 'w', name: 'Mur du salon', width: '12', height: '8' }], panelWidth: '24', panelHeight: '96', units: 'imperial' });
  assert.equal(r.panels, 6);
  assert.equal(r.wallArea, 96);
});

test('panels: partial panels round up per wall', () => {
  const r = panelQuantities({
    walls: [
      { id: 'a', name: 'A', width: '12,5', height: '8' },
      { id: 'b', name: 'B', width: '10', height: '9' },
    ],
    panelWidth: '24',
    panelHeight: '96',
    units: 'imperial',
  });
  assert.equal(r.walls[0]!.panels, 7);
  assert.equal(r.walls[1]!.panels, 10);
  assert.equal(r.panels, 17);
});

test('panels: metric wall and panel sizes', () => {
  const r = panelQuantities({ walls: [{ id: 'w', name: 'Mur', width: '3,6', height: '2,4' }], panelWidth: '600', panelHeight: '2400', units: 'metric' });
  assert.equal(r.panels, 6);
});

test('formatting and plurals', () => {
  assert.equal(formatFr(1039, 0).replace(/\s/g, ' '), '1 039');
  assert.equal(formatEn(1039, 0), '1,039');
  assert.equal(pluralFr(0, 'panneau', 'panneaux'), '0 panneau');
  assert.equal(pluralFr(1, 'boîte', 'boîtes'), '1 boîte');
  assert.equal(pluralFr(52, 'boîte', 'boîtes'), '52 boîtes');
});

test('boxesForArea matches the product sheet example (374 sq ft + 10 % at 20 sq ft per box = 21 boxes)', () => {
  assert.deepEqual(boxesForArea('374', 10, 20), { orderArea: 412, boxes: 21 });
  assert.equal(boxesForArea('', 10, 20), null);
  assert.equal(boxesForArea('374', 10, null), null);
  assert.equal(boxesForArea('999999', 10, 20), null);
  assert.deepEqual(boxesForArea('18,2', 10, 20), { orderArea: 21, boxes: 2 });
});
