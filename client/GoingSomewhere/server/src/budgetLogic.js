// Pure budget logic: no I/O, no Express, no DB. Easy to unit test and to reuse
// from the Conflict Detector (call getConflicts(summary) and show the result).

const WARN_THRESHOLD = 0.8; // 80% of allocation => warning

const DEFAULT_CATEGORIES = [
  'Accommodation',
  'Transport',
  'Food',
  'Activities',
  'Other',
];

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function statusFor(spent, allocated) {
  if (allocated <= 0) return spent > 0 ? 'over' : 'ok';
  const ratio = spent / allocated;
  if (ratio >= 1) return 'over';
  if (ratio >= WARN_THRESHOLD) return 'warning';
  return 'ok';
}

/**
 * Validate a budget payload. Returns { ok, errors, value }.
 * categories: [{ name, allocated }] (amounts in home currency)
 */
function validateBudget(input) {
  const errors = [];
  const total = Number(input?.total);
  if (!Number.isFinite(total) || total <= 0) errors.push('total must be a positive number');

  const homeCurrency = String(input?.homeCurrency || '').toUpperCase();
  const destCurrency = String(input?.destCurrency || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(homeCurrency)) errors.push('homeCurrency must be a 3-letter code');
  if (!/^[A-Z]{3}$/.test(destCurrency)) errors.push('destCurrency must be a 3-letter code');

  let categories = input?.categories;
  if (categories === undefined) {
    // Default: split evenly across default categories.
    const each = round2(total / DEFAULT_CATEGORIES.length);
    categories = DEFAULT_CATEGORIES.map((name) => ({ name, allocated: each }));
  }
  if (!Array.isArray(categories) || categories.length === 0) {
    errors.push('categories must be a non-empty array');
    categories = [];
  }
  const seen = new Set();
  const cleaned = [];
  for (const c of categories) {
    const name = String(c?.name || '').trim();
    const allocated = Number(c?.allocated);
    if (!name) { errors.push('every category needs a name'); continue; }
    if (seen.has(name.toLowerCase())) { errors.push(`duplicate category: ${name}`); continue; }
    if (!Number.isFinite(allocated) || allocated < 0) {
      errors.push(`allocation for ${name} must be zero or more`);
      continue;
    }
    seen.add(name.toLowerCase());
    cleaned.push({ name, allocated: round2(allocated) });
  }
  const allocatedSum = cleaned.reduce((s, c) => s + c.allocated, 0);
  if (Number.isFinite(total) && allocatedSum > total + 0.005) {
    errors.push('category allocations add up to more than the total budget');
  }

  return {
    ok: errors.length === 0,
    errors,
    value: { total: round2(total), homeCurrency, destCurrency, categories: cleaned },
  };
}

/**
 * Validate an expense payload against a budget.
 * The caller supplies `rate` = (home units per 1 unit of expense currency).
 */
function validateExpense(input, budget) {
  const errors = [];
  const amount = Number(input?.amount);
  if (!Number.isFinite(amount) || amount <= 0) errors.push('amount must be a positive number');

  const currency = String(input?.currency || budget?.homeCurrency || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) errors.push('currency must be a 3-letter code');

  const category = String(input?.category || '').trim();
  const known = budget?.categories?.some((c) => c.name.toLowerCase() === category.toLowerCase());
  if (!known) errors.push('category must be one of the budget categories');

  const date = input?.date ? String(input.date) : new Date().toISOString().slice(0, 10);
  if (Number.isNaN(Date.parse(date))) errors.push('date is not valid');

  const canonicalCategory = budget?.categories?.find(
    (c) => c.name.toLowerCase() === category.toLowerCase(),
  )?.name;

  return {
    ok: errors.length === 0,
    errors,
    value: {
      amount: round2(amount),
      currency,
      category: canonicalCategory || category,
      date,
      note: String(input?.note || '').slice(0, 200),
      paidBy: String(input?.paidBy || '').slice(0, 60),
      itineraryItemId: input?.itineraryItemId ? String(input.itineraryItemId) : null,
    },
  };
}

/** Convert an amount into the home currency using a saved/looked-up rate. */
function toHome(amount, rate) {
  return round2(amount * rate);
}

/**
 * Build the dashboard summary.
 * expenses: [{ category, amountHome }]
 * upcoming: optional [{ category, estimatedCost }] for itinerary items not yet done
 *           (estimatedCost in home currency). Powers the planned-vs-actual projection.
 */
function summarize(budget, expenses = [], upcoming = []) {
  const spentTotal = round2(expenses.reduce((s, e) => s + e.amountHome, 0));
  const remaining = round2(budget.total - spentTotal);

  const upcomingTotal = round2(upcoming.reduce((s, u) => s + (u.estimatedCost || 0), 0));
  const projectedTotal = round2(spentTotal + upcomingTotal);

  const categories = budget.categories.map((c) => {
    const spent = round2(
      expenses.filter((e) => e.category === c.name).reduce((s, e) => s + e.amountHome, 0),
    );
    const planned = round2(
      upcoming.filter((u) => u.category === c.name).reduce((s, u) => s + (u.estimatedCost || 0), 0),
    );
    const projected = round2(spent + planned);
    return {
      name: c.name,
      allocated: c.allocated,
      spent,
      remaining: round2(c.allocated - spent),
      percentUsed: c.allocated > 0 ? Math.round((spent / c.allocated) * 100) : spent > 0 ? 100 : 0,
      projected,
      status: statusFor(spent, c.allocated),
      projectedStatus: statusFor(projected, c.allocated),
    };
  });

  const summary = {
    total: budget.total,
    homeCurrency: budget.homeCurrency,
    destCurrency: budget.destCurrency,
    spentTotal,
    remaining,
    percentUsed: Math.round((spentTotal / budget.total) * 100),
    upcomingTotal,
    projectedTotal,
    status: statusFor(spentTotal, budget.total),
    projectedStatus: statusFor(projectedTotal, budget.total),
    categories,
  };
  summary.conflicts = getConflicts(summary);
  return summary;
}

/**
 * Turn a summary into conflict objects the Conflict Detector can display
 * in the same pop-up as schedule and haze conflicts.
 */
function getConflicts(summary) {
  const out = [];
  const cur = summary.homeCurrency;
  const fmt = (n) => `${cur} ${n.toFixed(2)}`;

  if (summary.status === 'over') {
    out.push({
      type: 'budget',
      severity: 'high',
      message: `Over budget by ${fmt(Math.abs(summary.remaining))}.`,
      suggestion: 'Remove or downgrade a planned activity, or raise the total budget.',
    });
  } else if (summary.projectedStatus === 'over') {
    out.push({
      type: 'budget',
      severity: 'medium',
      message: `Planned activities push the trip ${fmt(summary.projectedTotal - summary.total)} over budget.`,
      suggestion: 'Swap an expensive planned item for a cheaper one.',
    });
  } else if (summary.status === 'warning') {
    out.push({
      type: 'budget',
      severity: 'low',
      message: `You have used ${summary.percentUsed}% of your total budget.`,
      suggestion: 'Keep an eye on remaining spend.',
    });
  }

  for (const c of summary.categories) {
    if (c.status === 'over') {
      // Suggest moving money from the category with the most headroom.
      const donor = summary.categories
        .filter((o) => o.name !== c.name && o.remaining > 0)
        .sort((a, b) => b.remaining - a.remaining)[0];
      const shortfall = round2(c.spent - c.allocated);
      out.push({
        type: 'budget',
        severity: 'medium',
        category: c.name,
        message: `${c.name} is over its allocation by ${fmt(shortfall)} (${c.percentUsed}%).`,
        suggestion: donor && donor.remaining >= shortfall
          ? `Move ${fmt(shortfall)} from ${donor.name} (${fmt(donor.remaining)} left).`
          : 'Increase this category or cut spending here.',
      });
    } else if (c.status === 'warning') {
      out.push({
        type: 'budget',
        severity: 'low',
        category: c.name,
        message: `${c.name} is at ${c.percentUsed}% of its allocation.`,
        suggestion: `${fmt(c.remaining)} left in this category.`,
      });
    }
  }
  return out;
}

module.exports = {
  DEFAULT_CATEGORIES,
  WARN_THRESHOLD,
  round2,
  statusFor,
  validateBudget,
  validateExpense,
  toHome,
  summarize,
  getConflicts,
};
