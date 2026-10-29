<script>

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
        clearTimeout(this._toastTimer)
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
            clearTimeout(this._toastTimer)
            this._toastTimer = setTimeout(() => (this.toast = ''), 6000)
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
    <div class="budget-page" :class="{ embedded }">
        <div class="container budget-container py-3 pb-5">

            <header class="d-flex justify-content-between align-items-center mb-3">
                <h1 class="h4 mb-0">Budget Planner</h1>
                <span class="text-muted small" data-testid="trip-id">Trip: {{ budgetTripId }}</span>
            </header>

            <div v-if="toast" class="alert alert-danger py-2" role="alert" data-testid="error">{{ toast }}</div>

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
                    <div class="row g-2 mb-2" v-for="(c, i) in form.categories" :key="i">
                        <div class="col-7"><input class="form-control" v-model="c.name" :aria-label="`Category ${i + 1} name`" placeholder="Category" required>
                        </div>
                        <div class="col-12 col-sm-4"><input type="number" min="0" step="0.01" class="form-control"
                                v-model.number="c.allocated" required :aria-label="`Category ${i + 1} allocation`" :data-testid="'alloc-' + i"></div>
                        <div class="col-1 d-grid"><button type="button" class="btn btn-outline-danger"
                                @click="form.categories.splice(i, 1)" aria-label="Remove category">×</button></div>
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
                <div class="row g-2 mb-3">
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

                <div class="progress mb-1" style="height: 14px;" role="progressbar" :aria-valuenow="summary.percentUsed"
                    aria-valuemin="0" aria-valuemax="100">
                    <div class="progress-bar" :class="barClass(summary.status)"
                        :style="{ width: Math.min(summary.percentUsed, 100) + '%' }"></div>
                </div>
                <div class="d-flex justify-content-between small text-muted mb-3">
                    <span>{{ summary.percentUsed }}% used</span>
                    <span v-if="summary.upcomingTotal > 0">Projected: {{ fmt(summary.projectedTotal) }}</span>
                </div>

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
                <section>
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
    </div>
</template>

<style scoped>
/* Page background lives on this wrapper (not <body>) so other pages are unaffected */
.budget-page {
    background: var(--travel-bg);
    color: var(--travel-text);
    min-height: calc(100vh - 56px);
    /* minus navbar height */
}

.container.budget-container {
    max-width: 880px;
}

.card {
    border: 1px solid #e3e6ea;
    border-radius: 12px;
}

.stat .label {
    font-size: .75rem;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: .04em;
}

.stat .value {
    font-size: 1.05rem;
    font-weight: 600;
}

.stat-over {
    border-color: #dc3545;
}

.stat-over .value {
    color: #dc3545;
}

.progress {
    background: #e9ecef;
}

/* Phone: tighter spacing, larger tap targets */
@media (max-width: 575.98px) {
    .stat .value {
        font-size: .9rem;
    }

    .btn,
    .form-control,
    .form-select {
        min-height: 44px;
    }

    .container.budget-container {
        padding-left: 12px;
        padding-right: 12px;
    }
}
.budget-page.embedded { min-height: auto; }
.embedded .budget-container { max-width: none; padding-inline: 0; }
.card, .list-group-item { background: var(--travel-panel); color: var(--travel-text); border-color: var(--travel-border); }
.text-muted, .stat .label { color: var(--travel-muted) !important; }
.form-control, .form-select { background-color: var(--travel-bg); color: var(--travel-text); border-color: var(--travel-border); }
.form-control::placeholder { color: var(--travel-muted); opacity: 1; }
.btn-outline-secondary { color: var(--travel-muted); border-color: var(--travel-border); }
.progress { background: #35435a; }
</style>