<script>
import TripBackLink from '../components/TripBackLink.vue'

const API = '/api'

async function api(path, options = {}) {
    const res = await fetch(API + path, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
        body: options.body ? JSON.stringify(options.body) : undefined,
    })
    if (res.status === 204) return null
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        const detail = data.details ? ': ' + data.details.join('; ') : ''
        const err = new Error((data.error || 'Request failed') + detail)
        err.status = res.status
        throw err
    }
    return data
}

export default {
    name: 'BudgetPlanner',
    components: { TripBackLink },
    props: {
        tripId: { type: String, default: '' },
        destinationCurrency: { type: String, default: 'JPY' },
        embedded: { type: Boolean, default: false },
    },

    data() {
        return {
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
                destCurrency: this.destinationCurrency,
                categories: [],
            },
            expense: { amount: null, currency: this.destinationCurrency, category: '', note: '' },
            preview: null,
            previewTimer: null,
        }
    },

    computed: {
        budgetTripId() {
            return this.tripId || (typeof this.$route.query.trip === 'string' ? this.$route.query.trip : 'demo-trip')
        },
        allocatedSum() {
            return this.form.categories.reduce((s, c) => s + (Number(c.allocated) || 0), 0)
        },
        shownExpenses() {
            return this.filter ? this.expenses.filter((e) => e.category === this.filter) : this.expenses
        },
    },

    watch: {
        async budgetTripId() {
            this.summary = null
            this.expenses = []
            this.expense.amount = null
            this.preview = null
            this.filter = ''
            this.editingBudget = false
            this.form.destCurrency = this.destinationCurrency
            this.expense.currency = this.destinationCurrency
            clearTimeout(this.previewTimer)
            this.loading = true
            await this.refresh()
            this.loading = false
        },
        'expense.amount': 'schedulePreview',
        'expense.currency': 'schedulePreview',
    },

    async mounted() {
        this.splitEvenly(['Accommodation', 'Transport', 'Food', 'Activities', 'Other'])
        await this.refresh()
        this.loading = false
    },

    beforeUnmount() {
        clearTimeout(this.previewTimer)
    },

    methods: {
        fmt(n) {
            const cur = this.summary?.homeCurrency || this.form.homeCurrency || ''
            return `${cur} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        },
        barClass(status) {
            return { 'bg-success': status === 'ok', 'bg-warning': status === 'warning', 'bg-danger': status === 'over' }
        },
        flash(message) {
            this.toast = message
        },

        splitEvenly(names) {
            const list = Array.isArray(names) ? names : this.form.categories.map((c) => c.name)
            const each = list.length ? Math.floor((this.form.total / list.length) * 100) / 100 : 0
            this.form.categories = list.map((name) => ({ name, allocated: each }))
        },

        async refresh() {
            const requestedTrip = this.budgetTripId
            try {
                const [summary, expenses] = await Promise.all([
                    api(`/trips/${encodeURIComponent(this.budgetTripId)}/budget/summary`),
                    api(`/trips/${encodeURIComponent(this.budgetTripId)}/expenses`),
                ])
                if (requestedTrip !== this.budgetTripId) return
                this.summary = summary
                this.expenses = expenses
                if (!this.expense.category) this.expense.category = summary.categories[0]?.name || ''
                if (!this.expense.currency || ![summary.destCurrency, summary.homeCurrency].includes(this.expense.currency)) {
                    this.expense.currency = summary.destCurrency
                }
            } catch (e) {
                if (requestedTrip !== this.budgetTripId) return
                if (e.status === 404) { this.summary = null; return } // no budget yet -> show setup
                this.flash(e.message)
            }
        },

        startEdit() {
            const s = this.summary
            this.form = {
                total: s.total,
                homeCurrency: s.homeCurrency,
                destCurrency: s.destCurrency,
                categories: s.categories.map((c) => ({ name: c.name, allocated: c.allocated })),
            }
            this.editingBudget = true
        },

        async saveBudget() {
            try {
                this.busy = true
                await api(`/trips/${encodeURIComponent(this.budgetTripId)}/budget`, { method: 'PUT', body: this.form })
                this.editingBudget = false
                await this.refresh()
            } catch (e) {
                this.flash(e.message)
            } finally {
                this.busy = false
            }
        },

        // Live "≈ SGD 12.34" preview while typing (debounced; rate is cached server-side).
        schedulePreview() {
            clearTimeout(this.previewTimer)
            this.preview = null
            const amount = Number(this.expense.amount)
            if (!this.summary || !(amount > 0)) return
            this.previewTimer = setTimeout(async () => {
                try {
                    const r = await api(`/rates?from=${this.expense.currency}&to=${this.summary.homeCurrency}`)
                    this.preview = { rate: r.rate, stale: r.stale, home: amount * r.rate }
                } catch (e) {
                    this.flash(e.message)
                }
            }, 300)
        },

        async addExpense() {
            try {
                this.busy = true
                await api(`/trips/${encodeURIComponent(this.budgetTripId)}/expenses`, { method: 'POST', body: this.expense })
                this.expense.amount = null
                this.expense.note = ''
                this.preview = null
                await this.refresh()
            } catch (e) {
                this.flash(e.message)
            } finally {
                this.busy = false
            }
        },

        async removeExpense(e) {
            if (!confirm('Delete this expense?')) return
            try {
                await api(`/expenses/${e.id}`, { method: 'DELETE' })
                await this.refresh()
            } catch (err) {
                this.flash(err.message)
            }
        },
    },
}
</script>

<template>
    <component :is="embedded ? 'section' : 'main'" class="budget-page" :class="{ embedded }">
        <div :class="embedded ? 'budget-container' : 'content-page budget-container'">
            <TripBackLink v-if="!embedded" :trip-id="budgetTripId" />

            <header class="budget-header">
                <div>
                    <p class="eyebrow">Your trip spending</p>
                    <component :is="embedded ? 'h2' : 'h1'" :class="embedded ? 'h4' : 'page-heading'">Budget Planner</component>
                    <p class="muted-copy budget-intro">Plan your spending, track expenses, and keep your trip on budget.</p>
                </div>
                <span class="currency-badge">{{ summary ? `${summary.homeCurrency} → ${summary.destCurrency}` : `${form.homeCurrency} → ${form.destCurrency}` }}</span>
                <span class="visually-hidden" data-testid="trip-id">Trip: {{ budgetTripId }}</span>
            </header>

            <div v-if="toast" class="alert alert-danger budget-error" role="alert" data-testid="error"><span>{{ toast }}</span><button type="button" class="btn remove-category" aria-label="Dismiss error" @click="toast = ''">×</button></div>

            <div v-if="loading" class="text-muted">Loading…</div>

            <!-- ============ SETUP ============ -->
            <section v-else-if="!summary || editingBudget" class="card card-body" data-testid="setup">
                <h2 class="h5">{{ summary ? 'Edit budget' : 'Set your trip budget' }}</h2>
                <form @submit.prevent="saveBudget">
                    <div class="row g-2 mb-3">
                        <div class="col-12 col-md-4">
                            <label class="form-label">Total budget</label>
                            <input type="number" min="1" step="0.01" class="form-control" v-model.number="form.total"
                                required aria-label="Total budget" data-testid="total-input">
                        </div>
                        <div class="col-6 col-md-4">
                            <label class="form-label">Home currency</label>
                            <input class="form-control text-uppercase" maxlength="3" v-model="form.homeCurrency"
                                required aria-label="Home currency" data-testid="home-input">
                        </div>
                        <div class="col-6 col-md-4">
                            <label class="form-label">Destination currency</label>
                            <input class="form-control text-uppercase" maxlength="3" v-model="form.destCurrency"
                                required aria-label="Destination currency" data-testid="dest-input">
                        </div>
                    </div>

                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <label class="form-label mb-0">Split across categories ({{ form.homeCurrency || '…' }})</label>
                        <button type="button" class="btn btn-sm btn-outline-secondary" @click="splitEvenly()">Split
                            evenly</button>
                    </div>
                    <div class="budget-category-row" v-for="(c, i) in form.categories" :key="i">
                        <div><input class="form-control" v-model="c.name" :aria-label="`Category ${i + 1} name`" placeholder="Category" required>
                        </div>
                        <div><input type="number" min="0" step="0.01" class="form-control"
                                v-model.number="c.allocated" required :aria-label="`Category ${i + 1} allocation`" :data-testid="'alloc-' + i"></div>
                        <div class="d-grid"><button type="button" class="btn remove-category"
                                @click="form.categories.splice(i, 1)" aria-label="Remove category" :title="`Remove ${c.name || 'category'}`">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" /></svg>
                            </button></div>
                    </div>
                    <button type="button" class="btn btn-sm btn-link px-0 mb-3"
                        @click="form.categories.push({ name: '', allocated: 0 })">+ Add category</button>

                    <div class="small mb-3" :class="allocatedSum > form.total ? 'text-danger' : 'text-muted'">
                        Allocated {{ fmt(allocatedSum) }} of {{ fmt(form.total || 0) }}
                    </div>

                    <button class="btn btn-primary" :disabled="busy" data-testid="save-budget">Save budget</button>
                    <button type="button" class="btn btn-link" v-if="summary"
                        @click="editingBudget = false">Cancel</button>
                </form>
            </section>

            <!-- ============ DASHBOARD ============ -->
            <template v-else>

                <!-- conflicts -->
                <div v-if="summary.conflicts.length" class="mb-3" data-testid="conflicts">
                    <div v-for="(c, i) in summary.conflicts" :key="i" class="alert py-2 mb-2"
                        :class="{ 'alert-danger': c.severity === 'high', 'alert-warning': c.severity !== 'high' }">
                        <strong>{{ c.message }}</strong>
                        <div class="small">{{ c.suggestion }}</div>
                    </div>
                </div>

                <!-- summary cards -->
                <div class="row g-3 mb-4 budget-stats">
                    <div class="col-12 col-sm-4">
                        <div class="card card-body stat">
                            <div class="label">Budget</div>
                            <div class="value" data-testid="total">{{ fmt(summary.total) }}</div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-4">
                        <div class="card card-body stat">
                            <div class="label">Spent</div>
                            <div class="value" data-testid="spent">{{ fmt(summary.spentTotal) }}</div>
                        </div>
                    </div>
                    <div class="col-12 col-sm-4">
                        <div class="card card-body stat" :class="{ 'stat-over': summary.remaining < 0 }">
                            <div class="label">Remaining</div>
                            <div class="value" data-testid="remaining">{{ fmt(summary.remaining) }}</div>
                        </div>
                    </div>
                </div>

                <section class="card card-body budget-usage mb-4" aria-label="Budget usage">
                <div class="progress mb-2" style="height: 10px;" role="progressbar" aria-label="Budget used" :aria-valuenow="summary.percentUsed"
                    aria-valuemin="0" aria-valuemax="100">
                    <div class="progress-bar" :class="barClass(summary.status)"
                        :style="{ width: Math.min(summary.percentUsed, 100) + '%' }"></div>
                </div>
                <div class="d-flex justify-content-between small text-muted mb-3">
                    <span>{{ summary.percentUsed }}% used</span>
                    <span v-if="summary.upcomingTotal > 0">Projected: {{ fmt(summary.projectedTotal) }}</span>
                </div>

                </section>

                <!-- add expense -->
                <section class="card card-body mb-3">
                    <h2 class="h6">Log an expense</h2>
                    <form @submit.prevent="addExpense" class="row g-2">
                        <div class="col-6 col-md-3">
                            <input type="number" min="0.01" step="0.01" class="form-control" placeholder="Amount"
                                v-model.number="expense.amount" required aria-label="Expense amount" data-testid="expense-amount">
                        </div>
                        <div class="col-6 col-md-2">
                            <select class="form-select" v-model="expense.currency" aria-label="Expense currency" data-testid="expense-currency">
                                <option :value="summary.destCurrency">{{ summary.destCurrency }}</option>
                                <option v-if="summary.homeCurrency !== summary.destCurrency"
                                    :value="summary.homeCurrency">{{ summary.homeCurrency }}</option>
                            </select>
                        </div>
                        <div class="col-12 col-md-3">
                            <select class="form-select" v-model="expense.category" required
                                aria-label="Expense category" data-testid="expense-category">
                                <option v-for="c in summary.categories" :key="c.name" :value="c.name">{{ c.name }}
                                </option>
                            </select>
                        </div>
                        <div class="col-12 col-md-4">
                            <input class="form-control" aria-label="Expense note" placeholder="Note (optional)" v-model="expense.note"
                                maxlength="200">
                        </div>
                        <div class="col-12 small text-muted" v-if="preview" data-testid="conversion-preview">
                            ≈ {{ fmt(preview.home) }} <span v-if="preview.stale">(rate may be out of date)</span>
                            <span class="ms-1">· 1 {{ expense.currency }} = {{ preview.rate.toFixed(4) }} {{
                                summary.homeCurrency }}</span>
                        </div>
                        <div class="col-12 d-grid d-md-block">
                            <button class="btn btn-primary" :disabled="busy" data-testid="add-expense">+ Add
                                expense</button>
                        </div>
                    </form>
                </section>

                <!-- categories -->
                <section class="mb-3">
                    <div class="d-flex justify-content-between align-items-center">
                        <h2 class="h6 mb-2">Categories</h2>
                        <button class="btn btn-sm btn-outline-secondary" @click="startEdit"
                            data-testid="edit-budget">Edit budget</button>
                    </div>
                    <div class="card card-body mb-2 py-2" v-for="c in summary.categories" :key="c.name"
                        :data-testid="'cat-' + c.name">
                        <div class="d-flex justify-content-between">
                            <strong>{{ c.name }}</strong>
                            <span class="small" :class="{ 'text-danger': c.status === 'over' }">{{ fmt(c.spent) }} / {{
                                fmt(c.allocated) }}</span>
                        </div>
                        <div class="progress my-1" style="height: 8px;">
                            <div class="progress-bar" :class="barClass(c.status)"
                                :style="{ width: Math.min(c.percentUsed, 100) + '%' }"></div>
                        </div>
                        <div class="small text-muted">{{ c.percentUsed }}% used · {{ fmt(c.remaining) }} left</div>
                    </div>
                </section>

                <!-- expense list -->
                <section class="card card-body expense-history">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h2 class="h6 mb-0">Expenses</h2>
                        <select class="form-select form-select-sm w-auto" v-model="filter" aria-label="Filter expenses by category">
                            <option value="">All categories</option>
                            <option v-for="c in summary.categories" :key="c.name" :value="c.name">{{ c.name }}</option>
                        </select>
                    </div>
                    <div v-if="!shownExpenses.length" class="text-muted small" data-testid="empty">No expenses yet.
                    </div>
                    <ul class="list-group" data-testid="expense-list">
                        <li class="list-group-item d-flex justify-content-between align-items-start"
                            v-for="e in shownExpenses" :key="e.id">
                            <div>
                                <div><strong>{{ e.category }}</strong> <span class="text-muted small">{{ e.date
                                        }}</span></div>
                                <div class="small text-muted" v-if="e.note">{{ e.note }}</div>
                                <div class="small text-muted" v-if="e.currency !== summary.homeCurrency">
                                    {{ e.amount.toFixed(2) }} {{ e.currency }} @ {{ e.rateUsed.toFixed(4) }}
                                </div>
                            </div>
                            <div class="text-end">
                                <div>{{ fmt(e.amountHome) }}</div>
                                <button class="btn btn-sm btn-link text-danger p-0" @click="removeExpense(e)"
                                    :data-testid="'delete-' + e.id">Delete</button>
                            </div>
                        </li>
                    </ul>
                </section>
            </template>

        </div>
    </component>

</template>

<style scoped>
.budget-error { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.budget-error .remove-category { flex-shrink: 0; color: inherit; }
.budget-page { background: var(--travel-bg); color: var(--travel-text); min-height: calc(100svh - 80px); }
.budget-container { max-width: 1200px; }
.budget-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem; }
.budget-header .eyebrow { margin-bottom: .5rem; }
.budget-header .page-heading, .budget-header .h4 { margin: 0; }
.budget-intro { margin: .75rem 0 0; max-width: 38rem; }
.currency-badge { flex-shrink: 0; margin-top: .4rem; padding: .45rem .9rem; border: 1px solid #6c8a87; border-radius: 999px; background: #29473f; color: #cce9df; font-size: .85rem; font-weight: 600; }
.card, .list-group-item { background: var(--travel-panel); color: var(--travel-text); border: 1px solid var(--travel-border); }
.card { border-radius: 1.25rem; }
.card-body { padding: 1.5rem; }
.card .h5, .budget-container h2.h6 { font-size: var(--travel-section-size); margin-bottom: 1.25rem; font-weight: 650; }
.stat { height: 100%; background: linear-gradient(145deg, var(--travel-panel), #20343f); }
.stat .label { color: var(--travel-muted); font-size: .75rem; font-weight: 650; text-transform: uppercase; letter-spacing: .08em; margin-bottom: .65rem; }
.stat .value { font-size: clamp(1.25rem, 2.5vw, 1.9rem); font-weight: 650; letter-spacing: -.03em; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.budget-stats > div:last-child .stat .value { color: var(--travel-accent); }
.stat-over { border-color: #bc7c86; }
.budget-stats > div:last-child .stat-over .value { color: #ffd8dc; }
.text-muted { color: var(--travel-muted) !important; }
.form-label { color: var(--travel-text); font-size: .9rem; }
.form-control, .form-select { min-width: 0; min-height: 44px; padding: .65rem .8rem; background-color: var(--travel-bg); color: var(--travel-text); border: 1px solid var(--travel-control-border); border-radius: .65rem; color-scheme: dark; --bs-form-select-bg-img: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23bdc8d8' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m2 5 6 6 6-6'/%3e%3c/svg%3e"); }
.form-control::placeholder { color: var(--travel-muted); opacity: 1; }
.form-control:focus, .form-select:focus { color: var(--travel-text); background-color: var(--travel-bg); border-color: var(--travel-accent); box-shadow: none; }
.budget-category-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, .65fr) 44px; max-width: 650px; gap: .65rem; align-items: center; margin-bottom: .65rem; }
.btn { min-height: 40px; padding: .55rem 1rem; border-radius: 999px; font-weight: 600; }
.btn-sm { min-height: 36px; font-size: .8rem; }
.btn-primary { --bs-btn-bg: #274840; --bs-btn-border-color: #6c8a87; --bs-btn-hover-bg: #354f4b; --bs-btn-hover-border-color: #b9ddd2; --bs-btn-active-bg: #354f4b; --bs-btn-active-border-color: #b9ddd2; --bs-btn-disabled-bg: #274840; --bs-btn-disabled-border-color: #6c8a87; color: #fff; background: linear-gradient(110deg, #10312f, #425e5c); }
.btn-outline-secondary { color: var(--travel-text); border-color: var(--travel-border); background: transparent; }
.btn-link { color: var(--travel-accent); }
.btn.remove-category { display: inline-grid; place-items: center; min-height: 44px; width: 44px; padding: 0; color: var(--travel-muted); border-color: transparent; background: transparent; }
.text-danger { color: #ffd8dc !important; }
.alert { padding: 1rem; border-radius: .85rem; line-height: 1.6; }
.alert-danger { background: #3c252c; color: #ffd8dc; border-color: #bc7c86; }
.alert-warning { background: #332d22; color: #ffedbf; border-color: #9c854b; }
.progress { border-radius: 999px; background: #35435a; overflow: hidden; }
.progress-bar.bg-success { background: #80bba5 !important; }
.progress-bar.bg-warning { background: #d4b56f !important; }
.progress-bar.bg-danger { background: #ce8993 !important; }
.budget-usage > .text-muted { margin-bottom: 0 !important; }
.list-group { gap: .65rem; }
.list-group-item { padding: 1rem; gap: 1rem; flex-wrap: wrap; border-radius: .85rem; }
.list-group-item + .list-group-item { border-top-width: 1px; }
.list-group-item:first-child, .list-group-item:last-child { border-radius: .85rem; }
.expense-history > .d-flex, section > .d-flex { flex-wrap: wrap; gap: .75rem; }
.budget-page.embedded { min-height: auto; }
.embedded .budget-container { max-width: none; padding: 0; }
.embedded .budget-header { margin-bottom: 1.5rem; }
@media (hover: hover) { .btn-outline-secondary:hover { color: var(--travel-text); background: #29473f; border-color: var(--travel-accent); } .btn-link:hover { color: #e1f1eb; } .btn.remove-category:hover { color: var(--travel-accent); background: #29473f; } }
@media (prefers-reduced-motion: no-preference) { .btn:not(:disabled) { transition: transform 150ms ease-out; } .btn:not(:disabled):active { transform: scale(.96); } }
@media (prefers-reduced-motion: reduce) { .progress-bar { transition: none; } }
@media (max-width: 575.98px) { .card-body { padding: 1.1rem; } .stat .value { font-size: 1.45rem; } .budget-header { margin-bottom: 1.5rem; } .budget-category-row { gap: .45rem; } }
</style>
