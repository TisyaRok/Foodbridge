# FoodBridge inventory planning

FoodBridge is a React/Vite procurement-planning prototype for Penn State Central Procurement. It supports one focused workflow: identify inventory risk, inspect a transparent demand estimate, change assumptions, prepare an order draft, and export that draft to CSV.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. The app uses history-based routes such as `/overview`, `/inventory`, `/inventory/FB-1001`, `/order-draft`, and `/data-quality`. Vite's development and preview servers serve these routes through the app entry point.

Validation commands:

```bash
npm run test
npm run lint
npm run build
```

## Data modes

The interactive planning workspace uses 20 explicitly labeled synthetic items from `src/data/demoInventory.js`. Every item has 12 weekly periods, units, supplier, current and incoming stock, lead time, review period, pack size, unit cost, and safety stock. Chicken breast (`FB-1001`) is the hero item for the interview walkthrough. Demo assumption changes and valid order-draft quantities persist in browser `localStorage` under `foodbridge-demo-planning-v2`. Reset demo restores all seeded assumptions and clears the draft.

The original repository CSV files remain in `public/` and are downloadable from Data quality. They are bundled snapshots, not a live backend. They are deliberately excluded from the interactive recommendations because they lack dated weekly history and reliable unit prices, and the stock-count and aggregate-usage units cannot be reconciled safely. `../ml_model/Model/model.py` remains preserved; it generates a saved monthly suggestion file using average usage, trend, seasonality, a safety buffer, and a volatility cap. This UI does not present that script as a trained or currently served AI model.

## Calculation

`src/planning.js` is the pure source of truth used by tables, status metrics, detail charts, explanations, recommendation totals, and tests.

```text
average daily usage = mean of available weeks in the selected window / 7
expected demand = average daily usage × (lead-time days + review-period days)
net requirement = max(0, expected demand + safety stock − current stock − incoming stock)
recommendation = net requirement rounded up to the supplier pack size
```

Missing weeks are excluded from the average and shown as chart gaps; they are never filled with zero. All-missing history produces no recommendation. Zero usage produces “No recent usage” instead of Infinity or NaN. Incoming stock offsets the planning-horizon requirement but does not conceal an immediate on-hand stockout risk. The chart uses the same recent average and prorates the final partial week, so projected chart totals equal expected demand.

Status definitions:

- **Stockout risk:** on-hand days remaining are shorter than the supplier lead time.
- **Replenish:** stock covers lead time but the calculated planning target still requires an order.
- **Excess stock:** on-hand coverage exceeds twice the lead-time-plus-review horizon.
- **Healthy:** current and incoming stock cover the target without excess.
- **Missing usage / No recent usage:** a human review is required before acting.

## Suggested 5–8 minute demo

1. Open Overview. Explain that every KPI is calculated from the 20 displayed demo items and the current draft. Point out the data-source banner and Reset demo control.
2. Select **Chicken breast** at the top of Needs attention. Its rising weekly history and low coverage make the replenishment problem visible.
3. Explain the solid historical line, dashed baseline projection, planning horizon, and “Why this quantity” math. The default uses the last four weeks.
4. Change **Safety stock from 80 to 160 lb**. The recommendation changes immediately and remains rounded to a 20-lb supplier pack.
5. Add the recommendation. Point out the in-place confirmation, open Order draft, adjust by a valid 20-lb multiple, and export CSV. State that this creates a local draft and submits nothing to a supplier.
6. If time remains, open Data quality to show one missing week, a short-history item, and a zero-usage item with the exact handling for each.

## Current limitations

This is an offline interview prototype. It has no authentication, live stock service, supplier submission, delivery-date validation, purchase-order approvals, tax/freight pricing, or trained forecasting service. Synthetic unit costs exclude tax and freight. Incoming stock is assumed usable within the planning horizon; users must verify the actual arrival date. The baseline does not model seasonality, events, menu changes, or confidence intervals. History routes depend on the hosting server returning `index.html` for unknown paths; the included Vite servers do this for local use.
