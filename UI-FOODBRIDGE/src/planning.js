/**
 * FoodBridge's single source of truth for inventory planning.
 *
 * Expected demand = recent average weekly usage / 7 * (lead time + review period)
 * Recommended quantity = max(0, expected demand + safety stock - current stock
 *   - incoming stock), rounded up to the supplier pack size.
 *
 * Missing weeks are excluded from the average; they are never filled with zero.
 */
export function calculatePlan(item, overrides = {}) {
  const assumptions = {
    leadTimeDays: item.leadTimeDays,
    reviewPeriodDays: item.reviewPeriodDays,
    safetyStock: item.safetyStock,
    usageWindowWeeks: item.usageWindowWeeks ?? 4,
    packSize: item.packSize,
    incomingStock: item.incomingStock ?? 0,
    ...overrides,
  };

  const errors = validateAssumptions(assumptions, item.history.length);
  if (Object.keys(errors).length) {
    return { assumptions, errors, status: 'Needs review', recommendation: null };
  }

  const window = item.history.slice(-assumptions.usageWindowWeeks);
  const availableUsage = window
    .map((point) => point.usage)
    .filter((usage) => Number.isFinite(usage) && usage >= 0);
  const missingWeeks = window.length - availableUsage.length;
  const averageWeeklyUsage = availableUsage.length
    ? availableUsage.reduce((total, usage) => total + usage, 0) / availableUsage.length
    : null;
  const averageDailyUsage = averageWeeklyUsage === null ? null : averageWeeklyUsage / 7;
  const horizonDays = assumptions.leadTimeDays + assumptions.reviewPeriodDays;
  const expectedDemand = averageDailyUsage === null ? null : averageDailyUsage * horizonDays;
  const netRequirement = expectedDemand === null
    ? null
    : Math.max(
      0,
      expectedDemand
        + assumptions.safetyStock
        - item.currentStock
        - assumptions.incomingStock,
    );
  const recommendation = netRequirement === null
    ? null
    : Math.ceil(netRequirement / assumptions.packSize) * assumptions.packSize;
  const daysRemaining = averageDailyUsage > 0 ? item.currentStock / averageDailyUsage : null;

  let status = 'Healthy';
  if (averageWeeklyUsage === null) status = 'Missing usage';
  else if (averageWeeklyUsage === 0) status = 'No recent usage';
  else if (daysRemaining < assumptions.leadTimeDays) status = 'Stockout risk';
  else if (recommendation > 0) status = 'Replenish';
  else if (daysRemaining > horizonDays * 2) status = 'Excess stock';

  const projectedWeeks = Math.ceil(horizonDays / 7);
  const chartData = [
    ...item.history.map((point) => ({
      label: point.label,
      historical: point.usage,
      baseline: null,
    })),
    ...Array.from({ length: projectedWeeks }, (_, index) => ({
      label: `P${index + 1}`,
      historical: null,
      baseline: averageWeeklyUsage === null
        ? null
        : averageDailyUsage * Math.min(7, horizonDays - index * 7),
    })),
  ];

  return {
    assumptions,
    errors,
    averageWeeklyUsage,
    averageDailyUsage,
    availableWeeks: availableUsage.length,
    missingWeeks,
    horizonDays,
    expectedDemand,
    netRequirement,
    recommendation,
    daysRemaining,
    status,
    estimatedCost: recommendation === null ? null : recommendation * item.unitCost,
    chartData,
  };
}

export function validateAssumptions(assumptions, historyLength = 12) {
  const errors = {};
  const wholePositive = [
    ['leadTimeDays', 'Lead time must be a whole number of at least 1 day.'],
    ['reviewPeriodDays', 'Review period must be a whole number of at least 1 day.'],
    ['usageWindowWeeks', `Usage window must be a whole number from 1 to ${historyLength}.`],
    ['packSize', 'Pack size must be a whole number of at least 1.'],
  ];
  for (const [field, message] of wholePositive) {
    const value = assumptions[field];
    if (!Number.isInteger(value) || value < 1) errors[field] = message;
  }
  if (assumptions.usageWindowWeeks > historyLength) {
    errors.usageWindowWeeks = `Usage window cannot exceed the ${historyLength} recorded weeks.`;
  }
  if (!Number.isFinite(assumptions.safetyStock) || assumptions.safetyStock < 0) {
    errors.safetyStock = 'Safety stock must be zero or greater.';
  }
  if (!Number.isFinite(assumptions.incomingStock) || assumptions.incomingStock < 0) {
    errors.incomingStock = 'Incoming stock must be zero or greater.';
  }
  return errors;
}

export function getAlertReason(item, planning) {
  if (planning.status === 'Stockout risk') {
    return `${formatNumber(planning.daysRemaining)} days on hand versus a ${planning.assumptions.leadTimeDays}-day lead time.`;
  }
  if (planning.status === 'Replenish') {
    return `Order ${formatNumber(planning.recommendation)} ${item.unit} to cover the planning horizon.`;
  }
  if (planning.status === 'Excess stock') {
    return `${formatNumber(planning.daysRemaining)} days of coverage; review before ordering more.`;
  }
  if (planning.status === 'No recent usage') {
    return 'No usage in the selected window; confirm whether the item is still active.';
  }
  if (planning.status === 'Missing usage') {
    return 'No usable history is available for a baseline estimate.';
  }
  return 'Stock covers the current lead time and review period.';
}

export function formatMoney(value) {
  if (!Number.isFinite(value)) return 'Unavailable';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export function formatNumber(value, maximumFractionDigits = 1) {
  if (!Number.isFinite(value)) return 'Unavailable';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);
}

export function escapeCsv(value) {
  const safeValue = String(value ?? '').replace(/^[=+@-]/, "'$&");
  return `"${safeValue.replaceAll('"', '""')}"`;
}
