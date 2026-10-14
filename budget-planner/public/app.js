const { createApp } = Vue;

const tripId = new URLSearchParams(location.search).get('trip') || 'demo-trip';
const API = '/api';

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.details ? ': ' + data.details.join('; ') : '';
    const err = new Error((data.error || 'Request failed') + detail);
    err.status = res.status;
    throw err;
  }
  return data;
}

createApp({
  data() {
    return {
      tripId,
      loading: true,
      busy: false,
      toast: '',
      summary: null,
      expenses: [],
      editingBudget: false,
      filter: '',
      form: {
        total: 2000,
        homeCurrency: 'SGD',
        destCurrency: 'JPY',
        categories: [],
      },
      expense: { amount: null, currency: 'JPY', category: '', note: '' },
      preview: null,
      previewTimer: null,
    };
  },

  computed: {
    allocatedSum() {
      return this.form.categories.reduce((s, c) => s + (Number(c.allocated) || 0), 0);
    },
    shownExpenses() {
      return this.filter ? this.expenses.filter((e) => e.category === this.filter) : this.expenses;
    },
  },

  watch: {
    'expense.amount': 'schedulePreview',
    'expense.currency': 'schedulePreview',
  },

  async mounted() {
    this.splitEvenly(['Accommodation', 'Transport', 'Food', 'Activities', 'Other']);
    await this.refresh();
    this.loading = false;
  },

  methods: {
    fmt(n) {
      const cur = this.summary?.homeCurrency || this.form.homeCurrency || '';
      return `${cur} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },
    barClass(status) {
      return { 'bg-success': status === 'ok', 'bg-warning': status === 'warning', 'bg-danger': status === 'over' };
    },
    flash(message) {
      this.toast = message;
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => (this.toast = ''), 6000);
    },

    splitEvenly(names) {
      const list = Array.isArray(names) ? names : this.form.categories.map((c) => c.name);
      const each = list.length ? Math.floor((this.form.total / list.length) * 100) / 100 : 0;
      this.form.categories = list.map((name) => ({ name, allocated: each }));
    },

    async refresh() {
      try {
        const [summary, expenses] = await Promise.all([
          api(`/trips/${tripId}/budget/summary`),
          api(`/trips/${tripId}/expenses`),
        ]);
        this.summary = summary;
        this.expenses = expenses;
        if (!this.expense.category) this.expense.category = summary.categories[0]?.name || '';
        if (!this.expense.currency || ![summary.destCurrency, summary.homeCurrency].includes(this.expense.currency)) {
          this.expense.currency = summary.destCurrency;
        }
      } catch (e) {
        if (e.status === 404) { this.summary = null; return; } // no budget yet -> show setup
        this.flash(e.message);
      }
    },

    startEdit() {
      const s = this.summary;
      this.form = {
        total: s.total,
        homeCurrency: s.homeCurrency,
        destCurrency: s.destCurrency,
        categories: s.categories.map((c) => ({ name: c.name, allocated: c.allocated })),
      };
      this.editingBudget = true;
    },

    async saveBudget() {
      try {
        this.busy = true;
        await api(`/trips/${tripId}/budget`, { method: 'PUT', body: this.form });
        this.editingBudget = false;
        await this.refresh();
      } catch (e) {
        this.flash(e.message);
      } finally {
        this.busy = false;
      }
    },

    // Live "≈ SGD 12.34" preview while typing (debounced; rate is cached server-side).
    schedulePreview() {
      clearTimeout(this.previewTimer);
      this.preview = null;
      const amount = Number(this.expense.amount);
      if (!this.summary || !(amount > 0)) return;
      this.previewTimer = setTimeout(async () => {
        try {
          const r = await api(`/rates?from=${this.expense.currency}&to=${this.summary.homeCurrency}`);
          this.preview = { rate: r.rate, stale: r.stale, home: amount * r.rate };
        } catch (e) {
          this.flash(e.message);
        }
      }, 300);
    },

    async addExpense() {
      try {
        this.busy = true;
        await api(`/trips/${tripId}/expenses`, { method: 'POST', body: this.expense });
        this.expense.amount = null;
        this.expense.note = '';
        this.preview = null;
        await this.refresh();
      } catch (e) {
        this.flash(e.message);
      } finally {
        this.busy = false;
      }
    },

    async removeExpense(e) {
      if (!confirm('Delete this expense?')) return;
      try {
        await api(`/expenses/${e.id}`, { method: 'DELETE' });
        await this.refresh();
      } catch (err) {
        this.flash(err.message);
      }
    },
  },
}).mount('#app');
