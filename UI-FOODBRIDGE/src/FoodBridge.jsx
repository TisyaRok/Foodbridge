import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronRight,
  ClipboardList,
  Database,
  Download,
  Leaf,
  Menu,
  PackageSearch,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { demoInventory, demoMetadata, HERO_ITEM_ID } from './data/demoInventory';
import {
  calculatePlan,
  escapeCsv,
  formatMoney,
  formatNumber,
  getAlertReason,
} from './planning';

const STORAGE_KEY = 'foodbridge-demo-planning-v2';
const ROUTES = {
  Overview: '/overview',
  Inventory: '/inventory',
  'Order draft': '/order-draft',
  'Data quality': '/data-quality',
};
const NAVIGATION = [
  ['Overview', BarChart3],
  ['Inventory', PackageSearch],
  ['Order draft', ShoppingCart],
  ['Data quality', ShieldCheck],
];
const ASSUMPTION_FIELDS = [
  ['leadTimeDays', 'Supplier lead time', 'days'],
  ['reviewPeriodDays', 'Review period', 'days'],
  ['safetyStock', 'Safety stock', null],
  ['usageWindowWeeks', 'Usage window', 'weeks'],
  ['packSize', 'Supplier pack size', null],
];

function readSavedDemoState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || typeof parsed !== 'object') return { assumptions: {}, draft: {} };
    const itemIds = new Set(demoInventory.map((item) => item.id));
    const assumptions = Object.fromEntries(
      Object.entries(parsed.assumptions ?? {}).filter(([id, values]) => {
        const item = demoInventory.find((candidate) => candidate.id === id);
        if (!item || !values || typeof values !== 'object') return false;
        const finiteAndBounded = Object.values(values).every((value) => Number.isFinite(value) && value >= 0 && value <= 100000);
        return finiteAndBounded
          && Number.isInteger(values.leadTimeDays) && values.leadTimeDays >= 1
          && Number.isInteger(values.reviewPeriodDays) && values.reviewPeriodDays >= 1
          && Number.isInteger(values.usageWindowWeeks) && values.usageWindowWeeks >= 1 && values.usageWindowWeeks <= item.history.length
          && Number.isInteger(values.packSize) && values.packSize >= 1;
      }),
    );
    const draft = Object.fromEntries(
      Object.entries(parsed.draft ?? {}).filter(([id, quantity]) => (
        itemIds.has(id) && Number.isInteger(quantity) && quantity > 0
      )),
    );
    return { assumptions, draft };
  } catch {
    return { assumptions: {}, draft: {} };
  }
}

function readRoute() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const pathname = window.location.pathname.slice(base.length) || '/';
  const itemMatch = pathname.match(/^\/inventory\/([^/]+)\/?$/);
  if (itemMatch) return { page: 'Inventory', itemId: decodeURIComponent(itemMatch[1]) };
  if (pathname.startsWith('/inventory')) return { page: 'Inventory', itemId: null };
  if (pathname.startsWith('/order-draft')) return { page: 'Order draft', itemId: null };
  if (pathname.startsWith('/data-quality')) return { page: 'Data quality', itemId: null };
  return { page: 'Overview', itemId: null };
}

function useAppRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onPopState = () => setRoute(readRoute());
    window.addEventListener('popstate', onPopState);
    if (window.location.pathname === '/' || window.location.pathname === import.meta.env.BASE_URL) {
      window.history.replaceState({}, '', `${import.meta.env.BASE_URL.replace(/\/$/, '')}/overview`);
    }
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const navigate = useCallback((path) => {
    const fullPath = `${import.meta.env.BASE_URL.replace(/\/$/, '')}${path}`;
    window.history.pushState({}, '', fullPath);
    setRoute(readRoute());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  return [route, navigate];
}

function StatusBadge({ status }) {
  const kind = status === 'Healthy'
    ? 'healthy'
    : status === 'Stockout risk'
      ? 'risk'
      : status === 'Excess stock'
        ? 'excess'
        : 'review';
  return <span className={`status-badge ${kind}`}>{status}</span>;
}

function Button({ variant = 'primary', className = '', ...props }) {
  return <button className={`button ${variant} ${className}`} {...props} />;
}

function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {action}
    </div>
  );
}

function SortButton({ field, children, onSort, sortKey, sortDirection }) {
  if (!onSort) return children;
  return (
    <button className="sort-button" onClick={() => onSort(field)}>
      {children}
      <ArrowUpDown size={12} aria-hidden="true" />
      {sortKey === field && <span className="sr-only">Sorted {sortDirection === 'asc' ? 'ascending' : 'descending'}</span>}
    </button>
  );
}

function InventoryTable({ rows, onOpen, attention = false, sortKey, sortDirection, onSort }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th><SortButton field="name" onSort={onSort} sortKey={sortKey} sortDirection={sortDirection}>Item and category</SortButton></th>
            <th><SortButton field="currentStock" onSort={onSort} sortKey={sortKey} sortDirection={sortDirection}>Current stock</SortButton></th>
            {!attention && <th><SortButton field="averageWeeklyUsage" onSort={onSort} sortKey={sortKey} sortDirection={sortDirection}>Recent average</SortButton></th>}
            <th><SortButton field="daysRemaining" onSort={onSort} sortKey={sortKey} sortDirection={sortDirection}>Days remaining</SortButton></th>
            <th><SortButton field="leadTimeDays" onSort={onSort} sortKey={sortKey} sortDirection={sortDirection}>Lead time</SortButton></th>
            <th><SortButton field="status" onSort={onSort} sortKey={sortKey} sortDirection={sortDirection}>Status</SortButton></th>
            {attention && <th>Why it needs attention</th>}
            <th><span className="sr-only">Open item</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <button className="item-link" onClick={() => onOpen(row.id)}>{row.name}</button>
                <span className="cell-subtitle">{row.category} · {row.id}</span>
              </td>
              <td>{formatNumber(row.currentStock)} <span className="muted">{row.unit}</span></td>
              {!attention && (
                <td>
                  {row.plan.averageWeeklyUsage === null
                    ? 'Unavailable'
                    : `${formatNumber(row.plan.averageWeeklyUsage)} ${row.unit}/week`}
                </td>
              )}
              <td>
                {row.plan.averageWeeklyUsage === 0
                  ? 'No recent usage'
                  : row.plan.daysRemaining === null
                    ? 'Unavailable'
                    : `${formatNumber(row.plan.daysRemaining)} days`}
              </td>
              <td>{row.plan.assumptions.leadTimeDays} days</td>
              <td><StatusBadge status={row.plan.status} /></td>
              {attention && <td className="reason-cell">{getAlertReason(row, row.plan)}</td>}
              <td>
                <button className="icon-button" aria-label={`Open ${row.name}`} onClick={() => onOpen(row.id)}>
                  <ChevronRight size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GuidedDemo({ open, onClose, onOpen, currentStep, onHero }) {
  const steps = [
    'Frame the inventory problem on Overview',
    'Open Chicken breast, the hero item',
    'Change safety stock from 80 to 160 lb',
    'Add the recommendation to the draft',
    'Review the total and export CSV',
  ];
  if (!open) {
    return (
      <button className="guide-launcher" onClick={onOpen}>
        <ClipboardList size={16} /> Guided demo
      </button>
    );
  }
  return (
    <aside className="guide-panel" aria-label="Guided demo">
      <div className="guide-header">
        <div><p className="eyebrow">5–8 MINUTE WALKTHROUGH</p><h2>Guided demo</h2></div>
        <button className="icon-button" aria-label="Dismiss guided demo" onClick={onClose}><X size={17} /></button>
      </div>
      <ol>
        {steps.map((step, index) => (
          <li className={currentStep === index + 1 ? 'current' : currentStep > index + 1 ? 'complete' : ''} key={step}>
            <span>{currentStep > index + 1 ? <Check size={12} /> : index + 1}</span>{step}
          </li>
        ))}
      </ol>
      <Button variant="secondary" className="full-width" onClick={onHero}>Go to hero item <ArrowUpRight size={15} /></Button>
    </aside>
  );
}

export default function FoodBridge() {
  const [saved] = useState(readSavedDemoState);
  const [route, navigate] = useAppRoute();
  const [assumptions, setAssumptions] = useState(saved.assumptions);
  const [draft, setDraft] = useState(saved.draft);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All categories');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [sortKey, setSortKey] = useState('priority');
  const [sortDirection, setSortDirection] = useState('asc');
  const [notice, setNotice] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(true);
  const [invalidInputs, setInvalidInputs] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [draftInputs, setDraftInputs] = useState({});
  const [draftErrors, setDraftErrors] = useState({});

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ assumptions, draft }));
    } catch {
      // The current session remains functional when browser storage is unavailable.
    }
  }, [assumptions, draft]);

  const rows = useMemo(() => demoInventory.map((item) => ({
    ...item,
    plan: calculatePlan(item, assumptions[item.id]),
  })), [assumptions]);
  const selectedItem = route.itemId ? rows.find((item) => item.id === route.itemId) : null;
  const heroItem = rows.find((item) => item.id === HERO_ITEM_ID);
  const draftRows = rows.filter((item) => draft[item.id]);
  const draftTotal = draftRows.reduce((total, item) => total + draft[item.id] * item.unitCost, 0);
  const attention = [...rows]
    .filter((item) => item.plan.status !== 'Healthy')
    .sort((a, b) => {
      if (a.id === HERO_ITEM_ID) return -1;
      if (b.id === HERO_ITEM_ID) return 1;
      const priority = { 'Stockout risk': 0, Replenish: 1, 'Missing usage': 2, 'No recent usage': 3, 'Excess stock': 4 };
      return (priority[a.plan.status] ?? 5) - (priority[b.plan.status] ?? 5)
        || (a.plan.daysRemaining ?? Infinity) - (b.plan.daysRemaining ?? Infinity);
    });
  const assumptionChanged = Boolean(assumptions[HERO_ITEM_ID]);
  const guideStep = draft[HERO_ITEM_ID]
    ? route.page === 'Order draft' ? 5 : 4
    : route.itemId === HERO_ITEM_ID
      ? assumptionChanged ? 3 : 2
      : 1;

  function goToPage(page) {
    setInvalidInputs({});
    setFieldErrors({});
    setNotice('');
    navigate(ROUTES[page]);
    setMobileNavOpen(false);
  }

  function openItem(id) {
    setInvalidInputs({});
    setFieldErrors({});
    setNotice('');
    navigate(`/inventory/${encodeURIComponent(id)}`);
    setMobileNavOpen(false);
  }

  function closeItem() {
    setInvalidInputs({});
    setFieldErrors({});
    setNotice('');
    navigate('/inventory');
  }

  function changeSort(field) {
    if (sortKey === field) setSortDirection((value) => value === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(field);
      setSortDirection('asc');
    }
  }

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = rows.filter((item) => (
      (!query || item.name.toLowerCase().includes(query) || item.id.toLowerCase().includes(query))
      && (category === 'All categories' || item.category === category)
      && (statusFilter === 'All statuses' || item.plan.status === statusFilter)
    ));
    const direction = sortDirection === 'asc' ? 1 : -1;
    return filtered.sort((a, b) => {
      if (sortKey === 'priority') return ((a.plan.daysRemaining ?? Infinity) - (b.plan.daysRemaining ?? Infinity)) * direction;
      if (sortKey === 'averageWeeklyUsage') return ((a.plan.averageWeeklyUsage ?? -1) - (b.plan.averageWeeklyUsage ?? -1)) * direction;
      if (sortKey === 'daysRemaining') return ((a.plan.daysRemaining ?? Infinity) - (b.plan.daysRemaining ?? Infinity)) * direction;
      if (sortKey === 'leadTimeDays') return (a.plan.assumptions.leadTimeDays - b.plan.assumptions.leadTimeDays) * direction;
      if (sortKey === 'status') return a.plan.status.localeCompare(b.plan.status) * direction;
      if (sortKey === 'currentStock') return (a.currentStock - b.currentStock) * direction;
      return a.name.localeCompare(b.name) * direction;
    });
  }, [category, rows, search, sortDirection, sortKey, statusFilter]);

  function clearFilters() {
    setSearch('');
    setCategory('All categories');
    setStatusFilter('All statuses');
    setSortKey('priority');
    setSortDirection('asc');
  }

  function resetDemo() {
    if (!window.confirm('Reset every planning assumption and empty the order draft?')) return;
    setAssumptions({});
    setDraft({});
    setDraftInputs({});
    setDraftErrors({});
    clearFilters();
    setNotice('Demo reset. The seeded data and empty draft are ready for a fresh walkthrough.');
    navigate('/overview');
  }

  function updateAssumption(item, field, rawValue) {
    setInvalidInputs((current) => ({ ...current, [field]: rawValue }));
    const value = Number(rawValue);
    const mustBeInteger = field !== 'safetyStock';
    let error = '';
    if (rawValue === '' || !Number.isFinite(value)) error = 'Enter a number.';
    else if (field === 'safetyStock' && value < 0) error = 'Must be zero or greater.';
    else if (mustBeInteger && (!Number.isInteger(value) || value < 1)) error = 'Enter a whole number of at least 1.';
    else if (field === 'usageWindowWeeks' && value > item.history.length) error = `Maximum ${item.history.length} weeks.`;
    else if (value > 100000) error = 'Enter a value below 100,000.';
    setFieldErrors((current) => ({ ...current, [field]: error }));
    if (error) return;
    setAssumptions((current) => ({
      ...current,
      [item.id]: { ...item.plan.assumptions, [field]: value },
    }));
    setInvalidInputs((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function resetItemAssumptions(id) {
    setAssumptions((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setInvalidInputs({});
    setFieldErrors({});
    setNotice('Planning assumptions reset to the demo defaults.');
  }

  function addToDraft(item) {
    if (!item.plan.recommendation) return;
    setDraft((current) => ({ ...current, [item.id]: item.plan.recommendation }));
    setDraftInputs((current) => ({ ...current, [item.id]: String(item.plan.recommendation) }));
    setNotice(`${item.name}: ${formatNumber(item.plan.recommendation, 0)} ${item.unit} added to the draft. You are still on this item.`);
  }

  function updateDraftQuantity(item, rawValue) {
    setDraftInputs((current) => ({ ...current, [item.id]: rawValue }));
    const quantity = Number(rawValue);
    let error = '';
    if (rawValue === '' || !Number.isInteger(quantity) || quantity < 1) error = 'Enter a positive whole quantity.';
    else if (quantity % item.plan.assumptions.packSize !== 0) error = `Use a multiple of ${item.plan.assumptions.packSize}.`;
    setDraftErrors((current) => ({ ...current, [item.id]: error }));
    if (!error) setDraft((current) => ({ ...current, [item.id]: quantity }));
  }

  function removeDraftLine(id) {
    setDraft((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setDraftInputs((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setDraftErrors((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function exportDraft() {
    const headers = ['Item', 'Quantity', 'Unit', 'Pack Size', 'Unit Cost', 'Line Cost', 'Supplier'];
    const lines = draftRows.map((item) => [
      item.name,
      draft[item.id],
      item.unit,
      item.plan.assumptions.packSize,
      item.unitCost.toFixed(2),
      (draft[item.id] * item.unitCost).toFixed(2),
      item.supplier,
    ]);
    const csv = [headers, ...lines].map((line) => line.map(escapeCsv).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'foodbridge-order-draft.csv';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Draft CSV exported. No order was submitted to a supplier.');
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}>
        <div className="brand"><span className="brand-mark"><Leaf size={21} /></span><span>FoodBridge<small>INVENTORY PLANNING</small></span></div>
        <div className="workspace-name">Penn State<small>Central Procurement · Demo</small></div>
        <nav aria-label="Main navigation">
          {NAVIGATION.map(([label, Icon]) => (
            <button className={route.page === label && !route.itemId ? 'active' : ''} onClick={() => goToPage(label)} key={label}>
              {createElement(Icon, { size: 18 })}{label}
              {label === 'Order draft' && <span className="nav-count">{draftRows.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div><span className="live-dot" />Demo ready</div>
          <p>All changes stay in this browser.</p>
          <button onClick={resetDemo}><RotateCcw size={14} /> Reset demo</button>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Toggle navigation" onClick={() => setMobileNavOpen((open) => !open)}><Menu size={20} /></button>
          <div className="breadcrumb">Procurement workspace <span>/</span> {selectedItem?.name ?? route.page}</div>
          <div className="topbar-actions">
            <button className="guide-toggle" onClick={() => setGuideOpen((open) => !open)}><ClipboardList size={15} /> Guided demo</button>
            <span className="source-pill"><span className="live-dot" /> {demoMetadata.label}</span>
          </div>
        </header>

        <main>
          {notice && <div className="notice" role="status"><Check size={17} />{notice}<button aria-label="Dismiss message" onClick={() => setNotice('')}><X size={15} /></button></div>}

          {selectedItem ? (
            <ItemDetail
              item={selectedItem}
              invalidInputs={invalidInputs}
              fieldErrors={fieldErrors}
              onBack={closeItem}
              onChangeAssumption={updateAssumption}
              onReset={() => resetItemAssumptions(selectedItem.id)}
              onAdd={() => addToDraft(selectedItem)}
              onDraft={() => goToPage('Order draft')}
              isInDraft={Boolean(draft[selectedItem.id])}
            />
          ) : route.page === 'Overview' ? (
            <Overview
              rows={rows}
              attention={attention}
              draftTotal={draftTotal}
              draftCount={draftRows.length}
              onOpen={openItem}
              onReset={resetDemo}
              hero={heroItem}
            />
          ) : route.page === 'Inventory' ? (
            <Inventory
              rows={filteredRows}
              allRows={rows}
              search={search}
              category={category}
              statusFilter={statusFilter}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSearch={setSearch}
              onCategory={setCategory}
              onStatus={setStatusFilter}
              onSort={changeSort}
              onOpen={openItem}
              onClear={clearFilters}
            />
          ) : route.page === 'Order draft' ? (
            <OrderDraft
              rows={draftRows}
              draft={draft}
              draftInputs={draftInputs}
              errors={draftErrors}
              total={draftTotal}
              onQuantity={updateDraftQuantity}
              onRemove={removeDraftLine}
              onOpen={openItem}
              onBrowse={() => goToPage('Inventory')}
              onExport={exportDraft}
            />
          ) : (
            <DataQuality rows={rows} onOpen={openItem} />
          )}

          <footer>FoodBridge inventory planning prototype <span>Baseline estimates support human review.</span></footer>
        </main>
      </div>

      <GuidedDemo
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        onOpen={() => setGuideOpen(true)}
        currentStep={guideStep}
        onHero={() => openItem(HERO_ITEM_ID)}
      />
    </div>
  );
}

function Overview({ rows, attention, draftTotal, draftCount, onOpen, onReset, hero }) {
  const atRisk = rows.filter((item) => item.plan.status === 'Stockout risk').length;
  const needsReview = rows.filter((item) => item.plan.status !== 'Healthy').length;
  return (
    <>

      {/* <section className="data-banner">
        <div className="data-banner-icon"><Database size={20} /></div>
        <div><strong>{demoMetadata.label}</strong><p>{demoMetadata.description}. No network connection required.</p></div>
        <Button variant="secondary" onClick={onReset}><RefreshCcw size={15} /> Reset demo</Button>
      </section> */}
      <div className="metrics-grid">
        {[
          ['Items tracked', rows.length, 'Across six procurement categories'],
          ['Stockout risk', atRisk, 'Coverage is shorter than supplier lead time'],
          ['Needs review', needsReview, 'Risk, replenishment, excess, or usage gaps'],
          ['Draft estimated cost', formatMoney(draftTotal), `${draftCount} ${draftCount === 1 ? 'line' : 'lines'} · not submitted`],
        ].map(([label, value, help]) => (
          <section className="metric-card" key={label}><p>{label}</p><strong>{value}</strong><span>{help}</span></section>
        ))}
      </div>
      <section className="hero-callout">
        <div>
          <p className="eyebrow">START THE WALKTHROUGH</p>
          <h2>{hero.name} may run out before replenishment</h2>
          <p>{getAlertReason(hero, hero.plan)} Review its rising usage and test the safety-stock assumption.</p>
        </div>
        <Button onClick={() => onOpen(hero.id)}>Review item <ArrowUpRight size={16} /></Button>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><h2>Needs attention <span className="count-badge">{attention.length}</span></h2><p>Hero item first, then prioritized by status and remaining coverage.</p></div></div>
        <InventoryTable rows={attention} onOpen={onOpen} attention />
        <p className="panel-note">Stockout risk means current stock may be depleted before the supplier lead time. Replenish means stock covers lead time but falls short of the full planning target.</p>
      </section>
    </>
  );
}

function Inventory({ rows, allRows, search, category, statusFilter, sortKey, sortDirection, onSearch, onCategory, onStatus, onSort, onOpen, onClear }) {
  const categories = ['All categories', ...new Set(allRows.map((item) => item.category))];
  const statuses = ['All statuses', ...new Set(allRows.map((item) => item.plan.status))];
  const filtersActive = search || category !== 'All categories' || statusFilter !== 'All statuses';
  return (
    <>
      <PageHeading eyebrow="20 DEMO ITEMS" title="Inventory" description="Search stock, compare coverage, and open any item to inspect its recommendation." />
      <section className="panel">
        <div className="filters-row">
          <label className="search-field"><Search size={17} /><span className="sr-only">Search inventory</span><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search item name or ID" /></label>
          <label><span className="sr-only">Category</span><select value={category} onChange={(event) => onCategory(event.target.value)}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span className="sr-only">Stock status</span><select value={statusFilter} onChange={(event) => onStatus(event.target.value)}>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label>
          {filtersActive && <Button variant="quiet" onClick={onClear}><X size={14} /> Clear filters</Button>}
        </div>
        <div className="results-summary"><span>{rows.length} of {allRows.length} items</span><span>Usage averages use each item’s selected window.</span></div>
        {rows.length ? (
          <InventoryTable rows={rows} onOpen={onOpen} sortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
        ) : (
          <div className="empty-state"><PackageSearch size={30} /><h2>No items match these filters</h2><p>Clear the current search and filters to see the full inventory.</p><Button onClick={onClear}>Clear filters</Button></div>
        )}
      </section>
    </>
  );
}

function ItemDetail({ item, invalidInputs, fieldErrors, onBack, onChangeAssumption, onReset, onAdd, onDraft, isInDraft }) {
  const { plan } = item;
  const formulaResult = plan.recommendation === 0
    ? 'Current and incoming stock already cover expected demand plus safety stock, so the recommendation is 0.'
    : `The net requirement is ${formatNumber(plan.netRequirement)} ${item.unit}, rounded up to packs of ${plan.assumptions.packSize}.`;
  return (
    <>
      <button className="back-button" onClick={onBack}><ArrowLeft size={16} /> Back to inventory</button>
      <PageHeading
        eyebrow={`ITEM PLANNING · ${item.id}`}
        title={item.name}
        description={`${item.category} · ${item.supplier} · all quantities in ${item.unit}`}
        action={<StatusBadge status={plan.status} />}
      />
      <div className="detail-grid">
        <section className="panel chart-panel">
          <div className="panel-heading"><div><h2>Historical usage and projected demand</h2><p>Baseline estimate · {plan.assumptions.usageWindowWeeks}-week usage window · {plan.horizonDays}-day forecast</p></div></div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={plan.chartData} margin={{ top: 10, right: 22, left: 0, bottom: 4 }}>
                <CartesianGrid stroke="#e4e6dd" strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#69756d' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#69756d' }} axisLine={false} tickLine={false} width={42} />
                <Tooltip formatter={(value, name) => [`${formatNumber(value)} ${item.unit}`, name]} />
                <Legend />
                <Line name="Historical usage" type="linear" dataKey="historical" stroke="#21583f" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
                <Line name="Baseline projection" type="linear" dataKey="baseline" stroke="#a16d22" strokeWidth={2.5} strokeDasharray="7 5" dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="panel-note">W1–W12 are synthetic weekly history; P1 onward is projected demand. A partial final week is prorated. Missing observations appear as gaps and are excluded, not filled.</p>
          <div className="facts-grid">
            <div><span>Current stock</span><strong>{formatNumber(item.currentStock)} {item.unit}</strong></div>
            <div><span>Incoming stock</span><strong>{formatNumber(plan.assumptions.incomingStock)} {item.unit}</strong></div>
            <div><span>Recent average</span><strong>{formatNumber(plan.averageWeeklyUsage)} {item.unit}/week</strong></div>
            <div><span>Estimated coverage</span><strong>{plan.averageWeeklyUsage === 0 ? 'No recent usage' : plan.daysRemaining === null ? 'Unavailable' : `${formatNumber(plan.daysRemaining)} days`}</strong></div>
          </div>
        </section>

        <section className="panel recommendation-panel">
          <div className="recommendation-header"><div><p className="eyebrow">BASELINE ESTIMATE</p><h2>Replenishment recommendation</h2></div><SlidersHorizontal size={20} /></div>
          <div className="recommended-quantity">{formatNumber(plan.recommendation, 0)} <span>{item.unit}</span></div>
          <p className="estimated-cost">Estimated cost <strong>{formatMoney(plan.estimatedCost)}</strong> at {formatMoney(item.unitCost)} per {item.unit}</p>
          <div className="assumptions-grid">
            {ASSUMPTION_FIELDS.map(([field, label, suffix]) => (
              <label className={fieldErrors[field] ? 'field-error' : ''} key={field}>
                <span>{label}{field === 'safetyStock' || field === 'packSize' ? ` (${item.unit})` : suffix ? ` (${suffix})` : ''}</span>
                <input
                  type="number"
                  min={field === 'safetyStock' ? 0 : 1}
                  max={field === 'usageWindowWeeks' ? item.history.length : 100000}
                  step="1"
                  value={Object.hasOwn(invalidInputs, field) ? invalidInputs[field] : plan.assumptions[field]}
                  onChange={(event) => onChangeAssumption(item, field, event.target.value)}
                  aria-invalid={Boolean(fieldErrors[field])}
                  aria-describedby={fieldErrors[field] ? `${field}-error` : undefined}
                />
                {fieldErrors[field] && <small id={`${field}-error`}>{fieldErrors[field]}</small>}
              </label>
            ))}
          </div>
          <button className="reset-link" onClick={onReset}><RotateCcw size={13} /> Reset to defaults</button>
          <div className="why-box">
            <h3>Why this quantity</h3>
            <p>{formatNumber(plan.expectedDemand)} {item.unit} expected over {plan.assumptions.leadTimeDays} lead-time days + {plan.assumptions.reviewPeriodDays} review days, plus {formatNumber(plan.assumptions.safetyStock)} safety stock, minus {formatNumber(item.currentStock)} on hand and {formatNumber(plan.assumptions.incomingStock)} incoming.</p>
            <code>max(0, {formatNumber(plan.expectedDemand)} + {formatNumber(plan.assumptions.safetyStock)} − {formatNumber(item.currentStock)} − {formatNumber(plan.assumptions.incomingStock)})</code>
            <p>{formulaResult}</p>
          </div>
          <Button className="full-width" disabled={!plan.recommendation || Object.values(fieldErrors).some(Boolean)} onClick={onAdd}><ShoppingCart size={16} /> {isInDraft ? 'Replace draft line with recommendation' : 'Add recommendation to draft'}</Button>
          {isInDraft && <Button variant="secondary" className="full-width" onClick={onDraft}>View order draft</Button>}
        </section>
      </div>
    </>
  );
}

function OrderDraft({ rows, draft, draftInputs, errors, total, onQuantity, onRemove, onOpen, onBrowse, onExport }) {
  return (
    <>
      <PageHeading
        eyebrow="DRAFT · NOT SUBMITTED"
        title="Order draft"
        description="Review pack-aligned quantities and costs before exporting a working CSV."
        action={<Button disabled={!rows.length || Object.values(errors).some(Boolean)} onClick={onExport}><Download size={16} /> Export CSV</Button>}
      />
       {/* <div className="draft-warning"><AlertTriangle size={17} /><strong>Draft, not submitted to any supplier.</strong><span>Exporting creates a local CSV file only.</span></div> */}
      <section className="panel">
        {!rows.length ? (
          <div className="empty-state"><ShoppingCart size={31} /><h2>Your order draft is empty</h2><p>Open an inventory item and add its recommendation here.</p><Button onClick={onBrowse}>Browse inventory</Button></div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Item and supplier</th><th>Quantity</th><th>Pack size</th><th>Unit cost</th><th>Line cost</th><th>Action</th></tr></thead>
                <tbody>
                  {rows.map((item) => (
                    <tr key={item.id}>
                      <td><button className="item-link" onClick={() => onOpen(item.id)}>{item.name}</button><span className="cell-subtitle">{item.supplier} · {item.unit}</span></td>
                      <td>
                        <input
                          className="quantity-input"
                          aria-label={`${item.name} quantity`}
                          aria-invalid={Boolean(errors[item.id])}
                          type="number"
                          min={item.plan.assumptions.packSize}
                          step={item.plan.assumptions.packSize}
                          value={draftInputs[item.id] ?? draft[item.id]}
                          onChange={(event) => onQuantity(item, event.target.value)}
                        />
                        {errors[item.id] && <span className="input-error">{errors[item.id]}</span>}
                      </td>
                      <td>{item.plan.assumptions.packSize} {item.unit}</td>
                      <td>{formatMoney(item.unitCost)}</td>
                      <td><strong>{formatMoney(draft[item.id] * item.unitCost)}</strong></td>
                      <td><Button variant="quiet-danger" onClick={() => onRemove(item.id)}>Remove</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="draft-total"><div><span>Estimated draft total</span><small>Synthetic costs · excludes tax and freight</small></div><strong>{formatMoney(total)}</strong></div>
          </>
        )}
      </section>
    </>
  );
}

function DataQuality({ rows, onOpen }) {
  const issues = rows.flatMap((item) => {
    const missing = item.history.filter((point) => point.usage === null).length;
    const available = item.history.length - missing;
    const itemIssues = [];
    if (missing) itemIssues.push({ item, issue: `${missing} missing ${missing === 1 ? 'week' : 'weeks'}`, handling: `Excluded from the average; ${available} observed weeks remain.` });
    if (available > 0 && available < 4) itemIssues.push({ item, issue: `Short history: ${available} observed weeks`, handling: 'Baseline uses the available observations and should be reviewed.' });
    if (item.history.every((point) => point.usage === 0)) itemIssues.push({ item, issue: 'Zero usage across 12 weeks', handling: 'Days remaining shows “No recent usage”; demand is not inferred.' });
    return itemIssues;
  });
  return (
    <>
      <PageHeading eyebrow="INPUT REVIEW" title="Data quality" description="See the specific gaps behind the baseline estimates before making an order decision." />
      <section className="quality-summary">
        <div><strong>{issues.length}</strong><span>Observed issues</span></div>
        <p><strong>No imputation is performed.</strong> Missing weeks remain gaps and are excluded from usage averages. Zero usage remains zero.</p>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><h2>Issues in the demo dataset</h2><p>Every row below comes directly from the seeded history.</p></div></div>
        <div className="table-wrap">
          <table><thead><tr><th>Item</th><th>Observed issue</th><th>How the estimate handles it</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>
            {issues.map(({ item, issue, handling }) => <tr key={`${item.id}-${issue}`}><td><button className="item-link" onClick={() => onOpen(item.id)}>{item.name}</button><span className="cell-subtitle">{item.id}</span></td><td>{issue}</td><td className="reason-cell">{handling}</td><td><button className="icon-button" aria-label={`Open ${item.name}`} onClick={() => onOpen(item.id)}><ChevronRight size={18} /></button></td></tr>)}
          </tbody></table>
        </div>
      </section>
      <section className="source-audit panel">
        <div className="data-banner-icon"><Database size={20} /></div>
        <div><h2>Preserved repository source snapshot</h2><p>The original CSV files are still available, but they are not mixed into demo calculations. They have aggregate usage rather than dated weekly history, no reliable unit prices, and no live backend connection.</p><div className="source-links"><a href={`${import.meta.env.BASE_URL}Inventory_Master_Analysis_final.csv`} download>Download inventory snapshot</a><a href={`${import.meta.env.BASE_URL}Monthly_Buy_Suggestions.csv`} download>Download existing monthly suggestions</a></div></div>
      </section>
    </>
  );
}
