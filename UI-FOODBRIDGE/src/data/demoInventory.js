const pattern = [0.84, 0.9, 0.88, 0.96, 0.94, 1, 0.98, 1.04, 1.02, 1.08, 1.06, 1.12];

function history(base, customPattern = pattern) {
  return customPattern.map((multiplier, index) => ({
    label: `W${index + 1}`,
    usage: multiplier === null ? null : Math.round(base * multiplier),
  }));
}

function item(
  id,
  name,
  category,
  unit,
  supplier,
  currentStock,
  weeklyUsage,
  leadTimeDays,
  reviewPeriodDays,
  packSize,
  unitCost,
  safetyStock,
  incomingStock = 0,
  customHistory,
) {
  return {
    id,
    name,
    category,
    unit,
    supplier,
    currentStock,
    leadTimeDays,
    reviewPeriodDays,
    packSize,
    unitCost,
    safetyStock,
    incomingStock,
    usageWindowWeeks: 4,
    history: history(weeklyUsage, customHistory),
  };
}

export const HERO_ITEM_ID = 'FB-1001';

export const demoInventory = [
  item('FB-1001', 'Chicken breast', 'Proteins', 'lb', 'Keystone Food Supply', 120, 350, 7, 14, 20, 3.8, 80, 40,
    [0.72, 0.76, 0.8, 0.84, 0.89, 0.94, 1, 1.05, 1.11, 1.17, 1.24, 1.32]),
  item('FB-1002', 'Ground beef', 'Proteins', 'lb', 'Keystone Food Supply', 460, 210, 5, 14, 25, 4.6, 60),
  item('FB-1003', 'Atlantic salmon', 'Proteins', 'lb', 'Atlantic Provisions', 52, 145, 4, 10, 10, 8.9, 25),
  item('FB-1004', 'Whole milk', 'Dairy & eggs', 'gallons', 'Nittany Dairy Cooperative', 108, 84, 2, 7, 6, 3.2, 18, 24),
  item('FB-1005', 'Cheddar cheese', 'Dairy & eggs', 'lb', 'Nittany Dairy Cooperative', 245, 72, 5, 14, 10, 4.1, 30),
  item('FB-1006', 'Large eggs', 'Dairy & eggs', 'dozen', 'Nittany Dairy Cooperative', 82, 178, 3, 10, 15, 2.7, 30),
  item('FB-1007', 'Greek yogurt', 'Dairy & eggs', 'cups', 'Nittany Dairy Cooperative', 820, 280, 3, 7, 96, 0.85, 96),
  item('FB-1008', 'Romaine lettuce', 'Produce', 'heads', 'Happy Valley Produce', 42, 212, 2, 7, 24, 1.6, 24),
  item('FB-1009', 'Roma tomatoes', 'Produce', 'lb', 'Happy Valley Produce', 175, 74, 3, 10, 20, 1.9, 20),
  item('FB-1010', 'Russet potatoes', 'Produce', 'lb', 'Happy Valley Produce', 980, 285, 4, 14, 50, 0.65, 100),
  item('FB-1011', 'Gala apples', 'Produce', 'each', 'Happy Valley Produce', 470, 425, 4, 10, 80, 0.55, 80),
  item('FB-1012', 'Bananas', 'Produce', 'lb', 'Happy Valley Produce', 92, 215, 2, 7, 40, 0.6, 40),
  item('FB-1013', 'All-purpose flour', 'Dry goods', 'lb', 'Commonwealth Grocers', 1560, 142, 7, 21, 50, 0.72, 100),
  item('FB-1014', 'Brown rice', 'Dry goods', 'lb', 'Commonwealth Grocers', 730, 138, 7, 21, 50, 1.1, 75),
  item('FB-1015', 'Penne pasta', 'Dry goods', 'lb', 'Commonwealth Grocers', 305, 176, 7, 14, 40, 1.35, 40),
  item('FB-1016', 'Bread rolls', 'Bakery', 'each', 'Centre County Bakery', 205, 705, 2, 7, 96, 0.3, 96, 96),
  item('FB-1017', 'Olive oil', 'Dry goods', 'liters', 'Commonwealth Grocers', 102, 22, 10, 21, 12, 6.2, 12),
  item('FB-1018', 'Coffee beans', 'Beverages', 'lb', 'Allegheny Roasters', 66, 58, 7, 14, 5, 7.4, 15, 0,
    [0.9, 0.94, 0.92, 0.97, 1, 1.02, null, 1.05, 1.08, 1.06, 1.1, 1.12]),
  item('FB-1019', 'Seasonal herbal tea', 'Beverages', 'boxes', 'Allegheny Roasters', 62, 18, 7, 14, 6, 5.5, 6, 0,
    [null, null, null, null, null, null, null, null, null, 0.9, 1, 1.1]),
  item('FB-1020', 'Compostable plates', 'Paper goods', 'each', 'Lion Hospitality Supply', 8100, 0, 10, 21, 1000, 0.12, 1000, 0,
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
];

export const demoMetadata = {
  label: 'Demo data',
  description: '20 synthetic items · 12 weekly periods · works offline',
};
