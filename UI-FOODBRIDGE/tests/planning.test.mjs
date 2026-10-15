import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePlan, escapeCsv } from '../src/planning.js';
import { demoInventory, HERO_ITEM_ID } from '../src/data/demoInventory.js';

function fixture(overrides = {}) {
  return {
    id: 'test',
    name: 'Test item',
    unit: 'cases',
    currentStock: 20,
    incomingStock: 0,
    leadTimeDays: 7,
    reviewPeriodDays: 7,
    safetyStock: 10,
    usageWindowWeeks: 4,
    packSize: 12,
    unitCost: 2,
    history: [70, 70, 70, 70].map((usage, index) => ({ label: `W${index + 1}`, usage })),
    ...overrides,
  };
}

test('calculates demand over lead time plus review period and rounds to a pack', () => {
  const result = calculatePlan(fixture());
  assert.equal(result.averageDailyUsage, 10);
  assert.equal(result.expectedDemand, 140);
  assert.equal(result.netRequirement, 130);
  assert.equal(result.recommendation, 132);
  assert.equal(result.estimatedCost, 264);
});

test('zero usage displays no recent usage and avoids Infinity', () => {
  const result = calculatePlan(fixture({ currentStock: 20, safetyStock: 0, history: [0, 0, 0, 0].map((usage, index) => ({ label: `W${index + 1}`, usage })) }));
  assert.equal(result.daysRemaining, null);
  assert.equal(result.status, 'No recent usage');
  assert.equal(result.recommendation, 0);
});

test('sufficient stock produces a zero recommendation', () => {
  const result = calculatePlan(fixture({ currentStock: 1000 }));
  assert.equal(result.recommendation, 0);
  assert.equal(result.netRequirement, 0);
});

test('incoming stock offsets the recommendation without hiding immediate stockout risk', () => {
  const result = calculatePlan(fixture({ incomingStock: 100 }));
  assert.equal(result.recommendation, 36);
  assert.equal(result.status, 'Stockout risk');
});

test('missing weeks are excluded and never imputed as zero', () => {
  const result = calculatePlan(fixture({ history: [70, null, 70, null].map((usage, index) => ({ label: `W${index + 1}`, usage })) }));
  assert.equal(result.averageWeeklyUsage, 70);
  assert.equal(result.availableWeeks, 2);
  assert.equal(result.missingWeeks, 2);
});

test('all missing history prevents a recommendation', () => {
  const result = calculatePlan(fixture({ history: [null, null, null, null].map((usage, index) => ({ label: `W${index + 1}`, usage })) }));
  assert.equal(result.averageWeeklyUsage, null);
  assert.equal(result.recommendation, null);
  assert.equal(result.status, 'Missing usage');
});

test('changed assumptions update demand and pack-size rounding', () => {
  const original = calculatePlan(fixture());
  const changed = calculatePlan(fixture(), { safetyStock: 50, packSize: 25, leadTimeDays: 14 });
  assert.ok(changed.expectedDemand > original.expectedDemand);
  assert.equal(changed.recommendation % 25, 0);
  assert.ok(changed.recommendation > original.recommendation);
});

test('projected chart totals agree with expected demand', () => {
  const result = calculatePlan(fixture(), { reviewPeriodDays: 10 });
  const chartTotal = result.chartData.reduce((total, point) => total + (point.baseline ?? 0), 0);
  assert.equal(chartTotal, result.expectedDemand);
});

test('hero item is deterministic and changes visibly when safety stock changes', () => {
  const hero = demoInventory.find((item) => item.id === HERO_ITEM_ID);
  const original = calculatePlan(hero);
  const changed = calculatePlan(hero, { safetyStock: 160 });
  assert.equal(original.status, 'Stockout risk');
  assert.equal(hero.history.length, 12);
  assert.ok(changed.recommendation - original.recommendation >= 60);
});

test('CSV cells are quoted and spreadsheet formulas are neutralized', () => {
  assert.equal(escapeCsv('=SUM(A1:A2)'), '"\'=SUM(A1:A2)"');
  assert.equal(escapeCsv('Keystone, Inc.'), '"Keystone, Inc."');
});
