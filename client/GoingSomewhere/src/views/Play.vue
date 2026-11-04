<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { COUNTRIES } from '@/data/countries.js'

const router = useRouter()

/* ------------------------------------------------------------------ */
/*  Config + data                                                      */
/* ------------------------------------------------------------------ */
const LOCATIONS = [
    { img: '/locations/france.jpg', country: 'France', code: 'fr', capital: 'Paris', region: 'Europe', flag: '🇫🇷', aliases: ['French Republic'], clue: 'Its capital has a famous iron tower.', population: 68000000, currencies: 'Euro', languages: 'French', coords: [48.86, 2.35] },
    { img: '/locations/japan.jpg', country: 'Japan', code: 'jp', capital: 'Tokyo', region: 'Asia', flag: '🇯🇵', aliases: ['Nippon'], clue: 'An island nation known for bullet trains and cherry blossoms.', population: 124000000, currencies: 'Japanese yen', languages: 'Japanese', coords: [35.68, 139.69] },
    { img: '/locations/egypt.jpg', country: 'Egypt', code: 'eg', capital: 'Cairo', region: 'Africa', flag: '🇪🇬', aliases: [], clue: 'The Nile runs through it, and so do some very old pyramids.', population: 114000000, currencies: 'Egyptian pound', languages: 'Arabic', coords: [30.04, 31.24] },
    { img: '/locations/brazil.jpg', country: 'Brazil', code: 'br', capital: 'Brasília', region: 'Americas', flag: '🇧🇷', aliases: ['Brasil'], clue: 'It hosts most of the Amazon rainforest.', population: 212000000, currencies: 'Brazilian real', languages: 'Portuguese', coords: [-15.79, -47.88] },
    { img: '/locations/italy.jpg', country: 'Italy', code: 'it', capital: 'Rome', region: 'Europe', flag: '🇮🇹', aliases: ['Italia'], clue: 'Shaped like a boot, and the birthplace of pizza.', population: 59000000, currencies: 'Euro', languages: 'Italian', coords: [41.9, 12.5] },
    { img: '/locations/canada.jpg', country: 'Canada', code: 'ca', capital: 'Ottawa', region: 'Americas', flag: '🇨🇦', aliases: [], clue: 'Its flag has a maple leaf, and it is the second-largest country in the world by area.', population: 41000000, currencies: 'Canadian dollar', languages: 'English, French', coords: [45.42, -75.7] },
    { img: '/locations/finland.jpg', country: 'Finland', code: 'fi', capital: 'Helsinki', region: 'Europe', flag: '🇫🇮', aliases: [], clue: 'A Nordic country known for saunas, thousands of lakes and the northern lights.', population: 5600000, currencies: 'Euro', languages: 'Finnish, Swedish', coords: [60.17, 24.94] },
    { img: '/locations/austria.jpg', country: 'Austria', code: 'at', capital: 'Vienna', region: 'Europe', flag: '🇦🇹', aliases: [], clue: 'The birthplace of Mozart, with the Alps and grand coffeehouses.', population: 9100000, currencies: 'Euro', languages: 'German', coords: [48.21, 16.37] },
    { img: '/locations/iceland.jpg', country: 'Iceland', code: 'is', capital: 'Reykjavik', region: 'Europe', flag: '🇮🇸', aliases: [], clue: 'An island of volcanoes, geysers and glaciers in the North Atlantic.', population: 390000, currencies: 'Icelandic króna', languages: 'Icelandic', coords: [64.15, -21.94] },
    { img: '/locations/kazakhstan.jpg', country: 'Kazakhstan', code: 'kz', capital: 'Astana', region: 'Asia', flag: '🇰🇿', aliases: [], clue: 'The largest landlocked country in the world.', population: 20000000, currencies: 'Kazakhstani tenge', languages: 'Kazakh, Russian', coords: [51.17, 71.43] },
    { img: '/locations/nepal.jpg', country: 'Nepal', code: 'np', capital: 'Kathmandu', region: 'Asia', flag: '🇳🇵', aliases: [], clue: 'Home to Mount Everest, and the only national flag that is not a rectangle.', population: 30000000, currencies: 'Nepalese rupee', languages: 'Nepali', coords: [27.72, 85.32] },
    { img: '/locations/newzealand.jpg', country: 'New Zealand', code: 'nz', capital: 'Wellington', region: 'Oceania', flag: '🇳🇿', aliases: ['Aotearoa'], clue: 'A South Pacific island nation where The Lord of the Rings was filmed.', population: 5300000, currencies: 'New Zealand dollar', languages: 'English, Māori', coords: [-41.29, 174.78] },
    { img: '/locations/russia.jpg', country: 'Russia', code: 'ru', capital: 'Moscow', region: 'Europe', flag: '🇷🇺', aliases: [], clue: 'The largest country in the world, spanning 11 time zones.', population: 144000000, currencies: 'Russian ruble', languages: 'Russian', coords: [55.76, 37.62] },
    { img: '/locations/china.jpg', country: 'China', code: 'cn', capital: 'Beijing', region: 'Asia', flag: '🇨🇳', aliases: [], clue: 'Home to the Great Wall and giant pandas.', population: 1410000000, currencies: 'Chinese yuan', languages: 'Mandarin Chinese', coords: [39.9, 116.41] },
    { img: '/locations/unitedstates.jpg', country: 'United States', code: 'us', capital: 'Washington, D.C.', region: 'Americas', flag: '🇺🇸', aliases: [], clue: 'Fifty states, and its capital is named after its first president.', population: 340000000, currencies: 'United States dollar', languages: 'English', coords: [38.91, -77.04] },
]

const TOTAL_ROUNDS = 5
const ROUND_SECONDS = 30
const MAX_ATTEMPTS = 2
const MAX_HINTS = 3
const HINT_COST = 150
const MAX_BLUR = 22
const BEST_KEY = 'guess-country-best'
const RING = 2 * Math.PI * 20

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */
const countries = ref(COUNTRIES)
const rounds = ref([])
const roundIndex = ref(0)
const history = ref([])
const score = ref(0)
const displayScore = ref(0)
const streak = ref(0)
const bestStreak = ref(0)
const best = ref(0)
const newBest = ref(false)

const guess = ref('')
const attemptsLeft = ref(MAX_ATTEMPTS)
const wrongGuesses = ref([])
const hintsUsed = ref(0)
const timeLeft = ref(ROUND_SECONDS)

const result = ref(null)
const details = ref(null)
const detailsLoading = ref(false)
const weatherLoading = ref(false)
const mapMode = ref('capital')
const offline = ref(false)

const open = ref(false)
const activeIndex = ref(-1)
const shake = ref(false)
const confetti = ref([])
const finished = ref(false)
const copied = ref(false)

const inputEl = ref(null)
const nextBtn = ref(null)

let timerId = null
let rafId = null
let detailToken = 0
let confettiTimer = null

/* ------------------------------------------------------------------ */
/*  Computed                                                           */
/* ------------------------------------------------------------------ */
const current = computed(() => rounds.value[roundIndex.value])
const multiplier = computed(() => 1 + Math.min(streak.value, 5) * 0.1)
const blurPx = computed(() => (result.value ? 0 : (timeLeft.value / ROUND_SECONDS) * MAX_BLUR))

const potential = computed(() => {
    const base = 100 + 900 * (timeLeft.value / ROUND_SECONDS) - hintsUsed.value * HINT_COST
    return Math.round(Math.max(50, base) * multiplier.value)
})

const hints = computed(() => {
    if (!current.value) return []
    const a = current.value
    const pattern = a.country
        .split('')
        .map((ch, i) => (ch === ' ' ? '/' : i === 0 ? ch : '_'))
        .join(' ')
    return [
        `It's in ${a.region}.`,
        a.clue,
        `Spelling: ${pattern}`
    ].slice(0, hintsUsed.value)
})

const suggestions = computed(() => {
    const q = normalize(guess.value)
    if (!q) return []
    const starts = countries.value.filter(c => normalize(c.name).startsWith(q))
    const includes = countries.value.filter(
        c => !normalize(c.name).startsWith(q) && normalize(c.name).includes(q)
    )
    return [...starts, ...includes].slice(0, 6)
})

const ringOffset = computed(() => RING * (1 - timeLeft.value / ROUND_SECONDS))

const accuracy = computed(() => {
    const total = history.value.length
    return total ? Math.round((history.value.filter(h => h.correct).length / total) * 100) : 0
})

const perfect = computed(
    () => rounds.value.length > 0 && history.value.length === rounds.value.length && history.value.every(h => h.correct)
)

const gradeText = computed(() => {
    const correct = history.value.filter(h => h.correct).length
    if (correct === rounds.value.length) return 'Perfect round. You could be a tour guide.'
    if (correct >= rounds.value.length / 2) return 'Nice work. Your passport is getting stamps.'
    return 'Time to do some exploring.'
})

const factList = computed(() => {
    const d = details.value
    if (!d) return []
    const list = []
    if (d.population) list.push({ label: 'Population', value: compact.format(d.population) })
    if (d.currencies) list.push({ label: 'Currency', value: d.currencies })
    if (d.languages) list.push({ label: 'Languages', value: d.languages })
    if (d.weather || weatherLoading.value) {
        list.push({
            label: `Right now in ${d.capital}`,
            value: d.weather ? `${d.weather.icon} ${d.weather.temp}°C, ${d.weather.label}` : null,
            loading: !d.weather
        })
    }
    return list
})

const mapSrc = computed(() => {
    const d = details.value
    if (!d?.coords) return null
    const [lat, lon] = mapMode.value === 'capital' ? d.coords : d.countryCoords ?? d.coords
    const dx = mapMode.value === 'capital' ? 0.35 : 11
    const dy = mapMode.value === 'capital' ? 0.22 : 7
    const bbox = [lon - dx, lat - dy, lon + dx, lat + dy].join(',')
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${d.coords[0]},${d.coords[1]}`
})

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function shuffle(arr) {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

function normalize(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/^the\s+/, '')
        .replace(/\s+/g, ' ')
        .trim()
}

function isCorrect(typed, answer) {
    const known = countries.value.find(c => normalize(c.name) === normalize(answer.country))
    const names = [answer.country, ...(answer.aliases ?? []), ...(known?.alt ?? [])]
    return names.some(n => normalize(n) === normalize(typed))
}

function prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function stopTimer() {
    clearInterval(timerId)
    timerId = null
}

function startTimer() {
    stopTimer()
    timeLeft.value = ROUND_SECONDS
    timerId = setInterval(() => {
        timeLeft.value--
        if (timeLeft.value <= 0) {
            stopTimer()
            reveal(false, true)
        }
    }, 1000)
}

function animateScore(from = displayScore.value) {
    cancelAnimationFrame(rafId)
    const to = score.value
    if (prefersReducedMotion()) {
        displayScore.value = to
        return
    }
    const start = performance.now()
    const duration = 800
    const tick = now => {
        const t = Math.min((now - start) / duration, 1)
        displayScore.value = Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3)))
        if (t < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
}

function fireConfetti(count = 36, spread = 340, lift = 160) {
    if (prefersReducedMotion()) return
    const colors = ['#ffb703', '#1fa971', '#1b6ca8', '#e5484d', '#ffffff']
    confetti.value = Array.from({ length: count }, (_, i) => ({
        id: i,
        color: colors[i % colors.length],
        x: `${Math.round((Math.random() - 0.5) * spread)}px`,
        y: `${-Math.round(80 + Math.random() * lift)}px`,
        r: `${Math.round(Math.random() * 720 - 360)}deg`,
        d: `${Math.round(Math.random() * 150)}ms`
    }))
    clearTimeout(confettiTimer)
    confettiTimer = setTimeout(() => (confetti.value = []), count > 36 ? 2600 : 1800)
}

function dotClass(i) {
    const h = history.value[i]
    if (h) return h.correct ? 'ok' : 'bad'
    return i === roundIndex.value ? 'now' : ''
}

/* ------------------------------------------------------------------ */
/*  Game flow                                                          */
/* ------------------------------------------------------------------ */
function beginRound() {
    guess.value = ''
    attemptsLeft.value = MAX_ATTEMPTS
    wrongGuesses.value = []
    hintsUsed.value = 0
    result.value = null
    details.value = null
    mapMode.value = 'capital'
    activeIndex.value = -1
    startTimer()
    setTimeout(() => inputEl.value?.focus(), 380)
}

function startGame() {
    rounds.value = shuffle(LOCATIONS).slice(0, Math.min(TOTAL_ROUNDS, LOCATIONS.length))
    roundIndex.value = 0
    history.value = []
    score.value = 0
    displayScore.value = 0
    streak.value = 0
    bestStreak.value = 0
    newBest.value = false
    finished.value = false
    beginRound()
}

function useHint() {
    if (hintsUsed.value < MAX_HINTS && !result.value) hintsUsed.value++
}

function submitGuess() {
    if (result.value || !guess.value.trim()) return
    open.value = false
    if (isCorrect(guess.value, current.value)) return reveal(true)

    wrongGuesses.value.push(guess.value.trim())
    attemptsLeft.value--
    if (attemptsLeft.value <= 0) return reveal(false)

    shake.value = true
    setTimeout(() => (shake.value = false), 500)
    guess.value = ''
    inputEl.value?.focus()
}

function pick(country) {
    guess.value = country.name
    open.value = false
    submitGuess()
}

function onKey(e) {
    const n = suggestions.value.length
    if (e.key === 'ArrowDown' && n) {
        e.preventDefault()
        open.value = true
        activeIndex.value = (activeIndex.value + 1) % n
    } else if (e.key === 'ArrowUp' && n) {
        e.preventDefault()
        activeIndex.value = (activeIndex.value - 1 + n) % n
    } else if (e.key === 'Escape') {
        open.value = false
    } else if (e.key === 'Enter') {
        e.preventDefault()
        if (open.value && activeIndex.value >= 0) pick(suggestions.value[activeIndex.value])
        else submitGuess()
    }
}

function reveal(correct, timedOut = false) {
    stopTimer()
    const a = current.value
    const points = correct ? potential.value : 0

    if (correct) {
        streak.value++
        bestStreak.value = Math.max(bestStreak.value, streak.value)
        const from = displayScore.value
        score.value += points
        animateScore(from)
        fireConfetti()
    } else {
        streak.value = 0
    }

    result.value = {
        correct,
        timedOut,
        points,
        name: a.country,
        capital: a.capital,
        region: a.region,
        flagEmoji: a.flag,
        flagImg: `https://flagcdn.com/w160/${a.code}.png`
    }
    history.value.push({ country: a.country, flag: a.flag, correct, points })
    loadDetails(a)
    nextTick(() => setTimeout(() => nextBtn.value?.focus({ preventScroll: true }), 450))
}

function nextRound() {
    if (roundIndex.value + 1 >= rounds.value.length) {
        finishGame()
        return
    }
    roundIndex.value++
    beginRound()
}

function finishGame() {
    finished.value = true
    if (score.value > best.value) {
        newBest.value = score.value > 0
        best.value = score.value
        try { localStorage.setItem(BEST_KEY, String(best.value)) } catch { /* ignore */ }
    }
    displayScore.value = 0
    animateScore(0)
    if (perfect.value) setTimeout(() => fireConfetti(120, 900, 320), 350)
}

async function share() {
    const grid = history.value.map(h => (h.correct ? '🟩' : '🟥')).join('')
    const text = `I scored ${score.value} pts on Guess the Country!\n${grid}`
    try {
        await navigator.clipboard.writeText(text)
        copied.value = true
        setTimeout(() => (copied.value = false), 2000)
    } catch (err) {
        console.error('Clipboard unavailable', err)
    }
}

function explore() {
    router.push(`/explore/${encodeURIComponent(result.value.name)}`)
}

/* ------------------------------------------------------------------ */
/*  APIs: REST Countries, Wikipedia, Open-Meteo                        */
/* ------------------------------------------------------------------ */

async function fetchJson(url, { retries = 1, timeout = 6000 } = {}) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), timeout)
        try {
            const res = await fetch(url, { signal: ctrl.signal })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            return await res.json()
        } catch (err) {
            if (attempt === retries) throw err
        } finally {
            clearTimeout(timer)
        }
    }
}

async function fetchWiki(name) {
    const data = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`)
    return (data.extract ?? '').split(/(?<=\.)\s/).slice(0, 2).join(' ')
}

// Open-Meteo geocoding: find the capital's coordinates
async function fetchCapitalCoords(answer) {
    const data = await fetchJson(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(answer.capital)}&count=1&language=en&countryCode=${answer.code.toUpperCase()}`
    )
    const hit = data.results?.[0]
    if (!hit) throw new Error('no match')
    return [hit.latitude, hit.longitude]
}

const WEATHER_CODES = [
    [[0], '☀️', 'Clear'],
    [[1, 2, 3], '⛅', 'Partly cloudy'],
    [[45, 48], '🌫️', 'Foggy'],
    [[51, 53, 55, 56, 57], '🌦️', 'Drizzle'],
    [[61, 63, 65, 66, 67, 80, 81, 82], '🌧️', 'Rain'],
    [[71, 73, 75, 77, 85, 86], '❄️', 'Snow'],
    [[95, 96, 99], '⛈️', 'Thunderstorm']
]

async function fetchWeather([lat, lon]) {
    const { current } = await fetchJson(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`
    )
    const [, icon, label] = WEATHER_CODES.find(([codes]) => codes.includes(current.weather_code)) ?? [[], '🌡️', 'Unknown']
    return { icon, label, temp: Math.round(current.temperature_2m) }
}

async function loadDetails(answer) {
    const token = ++detailToken
    detailsLoading.value = true
    details.value = null
    offline.value = false

    const [wikiRes, geoRes] = await Promise.allSettled([fetchWiki(answer.country), fetchCapitalCoords(answer)])
    if (token !== detailToken) return

    if (wikiRes.status === 'rejected') { console.error('Wikipedia unavailable', wikiRes.reason); offline.value = true }
    if (geoRes.status === 'rejected') console.error('Geocoding unavailable, using saved coordinates', geoRes.reason)

    const coords = geoRes.status === 'fulfilled' ? geoRes.value : answer.coords
    details.value = {
        capital: answer.capital,
        population: answer.population,
        currencies: answer.currencies,
        languages: answer.languages,
        coords,
        countryCoords: coords,
        blurb: wikiRes.status === 'fulfilled' ? wikiRes.value : ''
    }
    detailsLoading.value = false

    if (coords) {
        weatherLoading.value = true
        try {
            const weather = await fetchWeather(coords)
            if (token === detailToken) details.value = { ...details.value, weather }
        } catch (err) {
            console.error('Weather unavailable', err)
        } finally {
            if (token === detailToken) weatherLoading.value = false
        }
    }
}

/* ------------------------------------------------------------------ */
/*  Lifecycle                                                          */
/* ------------------------------------------------------------------ */
onMounted(() => {
    try { best.value = Number(localStorage.getItem(BEST_KEY)) || 0 } catch { /* ignore */ }
    startGame()
})

onBeforeUnmount(() => {
    stopTimer()
    cancelAnimationFrame(rafId)
})
</script>

<template>
    <div class="play-page">
        <div class="shell">
            <header class="topbar">
                <RouterLink to="/discover" class="back">← Back to Discover</RouterLink>
                <div v-if="!finished" class="hud">
                    <Transition name="pop">
                        <span v-if="streak > 0" :key="streak" class="streak" :class="{ hot: streak >= 3 }"
                            :title="`Streak bonus: x${multiplier.toFixed(1)}`">
                            🔥 {{ streak }}
                        </span>
                    </Transition>
                    <span class="score-pill"><b>{{ displayScore.toLocaleString() }}</b> pts</span>
                </div>
            </header>

            <ol v-if="!finished" class="dots" aria-label="Round progress">
                <li v-for="(r, i) in rounds" :key="i" class="dot" :class="dotClass(i)"></li>
            </ol>

            <Transition name="round" mode="out-in">
                <!-- ============ FINAL SCREEN ============ -->
                <section v-if="finished" key="end" class="panel end">
                    <div v-if="confetti.length" class="confetti big" aria-hidden="true">
                        <span v-for="c in confetti" :key="c.id"
                            :style="{ background: c.color, '--x': c.x, '--y': c.y, '--r': c.r, animationDelay: c.d }"></span>
                    </div>
                    <h1 class="end-title">{{ perfect ? 'Flawless' : 'Game over' }}</h1>
                    <p class="end-score">{{ displayScore.toLocaleString() }}</p>
                    <p class="end-sub">points</p>
                    <p v-if="newBest" class="best-badge">New personal best</p>
                    <p v-else-if="best" class="muted">Personal best: {{ best.toLocaleString() }}</p>
                    <p class="muted grade">{{ gradeText }}</p>

                    <div class="end-stats">
                        <div><b>{{ history.filter(h => h.correct).length }}/{{ rounds.length }}</b><span>correct</span></div>
                        <div><b>{{ accuracy }}%</b><span>accuracy</span></div>
                        <div><b>{{ bestStreak }}</b><span>best streak</span></div>
                    </div>

                    <TransitionGroup name="stagger" tag="ul" class="recap" appear>
                        <li v-for="(h, i) in history" :key="h.country" :style="{ '--i': i }">
                            <span class="recap-flag">{{ h.flag }}</span>
                            <span class="recap-name">{{ h.country }}</span>
                            <span class="recap-pts" :class="h.correct ? 'ok' : 'bad'">
                                {{ h.correct ? '+' + h.points : 'Missed' }}
                            </span>
                        </li>
                    </TransitionGroup>

                    <div class="actions">
                        <button class="btn-go" @click="startGame">Play again</button>
                        <button class="btn-ghost" @click="share">{{ copied ? 'Copied!' : 'Copy my score' }}</button>
                        <RouterLink to="/" class="btn-ghost">Back home</RouterLink>
                    </div>
                </section>

                <!-- ============ ROUND ============ -->
                <section v-else-if="current" :key="roundIndex" class="panel">
                    <div class="photo" :class="{ revealed: !!result }">
                        <img :src="current.img" class="location-img" :style="{ '--blur': blurPx + 'px' }"
                            :alt="result ? 'Photo of ' + result.name : 'Mystery location, blurry until time runs out'" />

                        <div v-if="!result" class="timer" :class="{ urgent: timeLeft <= 10 }"
                            role="timer" :aria-label="timeLeft + ' seconds left'">
                            <svg viewBox="0 0 48 48" aria-hidden="true">
                                <circle class="ring-bg" cx="24" cy="24" r="20" />
                                <circle class="ring" cx="24" cy="24" r="20" :stroke-dasharray="RING"
                                    :stroke-dashoffset="ringOffset" />
                            </svg>
                            <span>{{ timeLeft }}</span>
                        </div>

                        <div v-if="!result" class="worth">
                            <span>Worth</span> <b>{{ potential }}</b>
                            <small v-if="multiplier > 1">x{{ multiplier.toFixed(1) }}</small>
                        </div>

                        <div v-if="confetti.length" class="confetti" aria-hidden="true">
                            <span v-for="c in confetti" :key="c.id"
                                :style="{ background: c.color, '--x': c.x, '--y': c.y, '--r': c.r, animationDelay: c.d }"></span>
                        </div>
                    </div>

                    <div class="body">
                        <!-- guessing -->
                        <div v-if="!result" class="guess">
                            <div class="guess-head">
                                <label for="guess">Which country is this?</label>
                                <span class="hearts" :aria-label="attemptsLeft + ' attempts left'">
                                    <span v-for="n in MAX_ATTEMPTS" :key="n" class="heart"
                                        :class="{ lost: n > attemptsLeft }">♥</span>
                                </span>
                            </div>

                            <div class="combo">
                                <div class="guess-row" :class="{ shake }">
                                    <input id="guess" ref="inputEl" v-model="guess" type="text" autocomplete="off"
                                        placeholder="Start typing a country…" role="combobox" aria-autocomplete="list"
                                        aria-controls="suggest-list" :aria-expanded="open && suggestions.length > 0"
                                        :aria-activedescendant="activeIndex >= 0 ? 'opt-' + activeIndex : undefined"
                                        @input="open = true; activeIndex = -1" @focus="open = true"
                                        @blur="open = false" @keydown="onKey" />
                                    <button class="btn-go" :disabled="!guess.trim()" @click="submitGuess">Guess</button>
                                </div>
                                <Transition name="drop">
                                    <ul v-if="open && suggestions.length" id="suggest-list" class="suggest" role="listbox">
                                        <li v-for="(s, i) in suggestions" :id="'opt-' + i" :key="s.name" role="option"
                                            :aria-selected="i === activeIndex" :class="{ active: i === activeIndex }"
                                            @mousedown.prevent="pick(s)" @mousemove="activeIndex = i">
                                            <img v-if="s.flag" :src="s.flag" alt="" class="sg-flag" />
                                            <span>{{ s.name }}</span>
                                        </li>
                                    </ul>
                                </Transition>
                            </div>

                            <TransitionGroup name="chip" tag="div" class="chips">
                                <span v-for="w in wrongGuesses" :key="'w' + w" class="chip wrong">{{ w }}</span>
                                <span v-for="(h, i) in hints" :key="'h' + i" class="chip hint">{{ h }}</span>
                            </TransitionGroup>

                            <button class="hint-btn" :disabled="hintsUsed >= MAX_HINTS" @click="useHint">
                                {{ hintsUsed >= MAX_HINTS ? 'No more hints' : `Need a hint? (−${HINT_COST} pts)` }}
                            </button>
                        </div>

                        <!-- reveal -->
                        <div v-else class="reveal">
                            <div class="stamp-row">
                                <div class="stamp" :class="result.correct ? 'ok' : 'bad'">
                                    {{ result.correct ? 'Correct' : result.timedOut ? "Time's up" : 'Missed' }}
                                </div>
                                <div v-if="result.correct" class="earned">+{{ result.points }}</div>
                                <p v-else-if="wrongGuesses.length" class="muted">You guessed {{ wrongGuesses.join(', ') }}.</p>
                            </div>

                            <div class="identity">
                                <img v-if="result.flagImg" :src="result.flagImg" :alt="'Flag of ' + result.name"
                                    class="flag-img" @error="result.flagImg = null" />
                                <span v-else class="flag-emoji">{{ result.flagEmoji }}</span>
                                <div>
                                    <h2>{{ result.name }}</h2>
                                    <div class="muted">Capital: {{ result.capital }} &nbsp;|&nbsp; {{ result.region }}</div>
                                </div>
                            </div>

                            <div class="facts">
                                <template v-if="detailsLoading">
                                    <div v-for="n in 3" :key="n" class="fact"><span class="shimmer w40"></span><span class="shimmer w80"></span></div>
                                </template>
                                <div v-for="f in factList" :key="f.label" class="fact">
                                    <span class="fact-label">{{ f.label }}</span>
                                    <span v-if="f.loading" class="shimmer w80"></span>
                                    <span v-else class="fact-value">{{ f.value }}</span>
                                </div>
                            </div>

                            <p v-if="details?.blurb" class="blurb">{{ details.blurb }}</p>

                            <div v-if="mapSrc" class="map">
                                <div class="map-toggle" role="group" aria-label="Map zoom">
                                    <button :class="{ on: mapMode === 'capital' }" @click="mapMode = 'capital'">Capital</button>
                                    <button :class="{ on: mapMode === 'country' }" @click="mapMode = 'country'">Country</button>
                                </div>
                                <iframe :src="mapSrc" :title="'Map of ' + result.name" loading="lazy"></iframe>
                            </div>

                            <p v-if="offline" class="muted small">The live summary couldn't load, but everything else is saved locally.</p>

                            <div class="actions">
                                <button class="btn-accent" @click="explore">Explore {{ result.name }}</button>
                                <button ref="nextBtn" class="btn-go" @click="nextRound">
                                    {{ roundIndex + 1 >= rounds.length ? 'See results' : 'Next round' }}
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            </Transition>
        </div>
    </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=DM+Sans:wght@400;500;700&display=swap');

.play-page {
    --ink: #0b2545;
    --sea: #1b6ca8;
    --sky: #e6f0f8;
    --gold: #ffb703;
    --ok: #1fa971;
    --bad: #e5484d;
    --muted: #5b6b7c;
    --radius: 18px;
    min-height: calc(100vh - 56px);
    overflow: hidden;
    overflow: clip;
    padding: 2rem 1rem 4rem;
    background: #101a2e;
    font-family: 'DM Sans', system-ui, sans-serif;
    color: var(--ink);
}

.shell { max-width: 740px; margin: 0 auto; }
h1, h2, .end-score, .stamp { font-family: 'Bricolage Grotesque', 'DM Sans', sans-serif; }
.muted { color: var(--muted); margin: 0; }
.small { font-size: .85rem; margin-top: .75rem; }

/* ---------- top bar ---------- */
.topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; gap: 1rem; }
.back { color: var(--sea); text-decoration: none; font-weight: 500; }
.back:hover { text-decoration: underline; }
.hud { display: flex; align-items: center; gap: .6rem; }
.score-pill { background: var(--ink); color: #fff; padding: .4rem .9rem; border-radius: 999px; font-variant-numeric: tabular-nums; }
.score-pill b { color: var(--gold); font-size: 1.05rem; }
.streak { background: #fff; padding: .35rem .7rem; border-radius: 999px; font-weight: 700; box-shadow: 0 1px 0 rgba(11, 37, 69, .12); }
.streak.hot { background: var(--gold); }

/* ---------- progress dots ---------- */
.dots { display: flex; gap: .5rem; list-style: none; padding: 0; margin: 0 0 1.25rem; }
.dot { flex: 1; height: 8px; border-radius: 99px; background: #cddbe8; transition: background .4s, transform .4s; }
.dot.ok { background: var(--ok); }
.dot.bad { background: var(--bad); }
.dot.now { background: var(--sea); animation: pulse 1.4s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .45; } }

/* ---------- panel ---------- */
.panel { background: #fff; border-radius: var(--radius); box-shadow: 0 18px 40px -22px rgba(11, 37, 69, .45); }
.body { padding: 1.5rem; }

/* ---------- photo ---------- */
.photo { position: relative; height: 360px; overflow: hidden; background: #b9cad8; border-radius: var(--radius) var(--radius) 0 0; }
.location-img {
    width: 100%; height: 100%; object-fit: cover; display: block;
    filter: blur(var(--blur, 0px)); transform: scale(1.1);
    transition: filter 1s linear, transform .8s ease;
}
.photo.revealed .location-img { transition: filter .7s ease, transform .8s ease; transform: scale(1); }

.timer { position: absolute; top: 14px; right: 14px; width: 56px; height: 56px; display: grid; place-items: center; background: rgba(11, 37, 69, .75); border-radius: 50%; color: #fff; font-weight: 700; backdrop-filter: blur(6px); }
.timer svg { position: absolute; inset: 4px; width: 48px; height: 48px; transform: rotate(-90deg); }
.ring-bg { fill: none; stroke: rgba(255, 255, 255, .2); stroke-width: 4; }
.ring { fill: none; stroke: var(--gold); stroke-width: 4; stroke-linecap: round; transition: stroke-dashoffset 1s linear, stroke .3s; }
.timer.urgent .ring { stroke: var(--bad); }
.timer.urgent { animation: tick 1s ease-in-out infinite; }
@keyframes tick { 50% { transform: scale(1.08); } }

.worth { position: absolute; left: 14px; bottom: 14px; background: rgba(11, 37, 69, .8); color: #fff; padding: .35rem .8rem; border-radius: 999px; font-size: .9rem; backdrop-filter: blur(6px); }
.worth b { color: var(--gold); font-size: 1.1rem; font-variant-numeric: tabular-nums; }
.worth small { color: #9fd8bc; margin-left: .25rem; }

/* ---------- confetti ---------- */
.confetti { position: absolute; left: 50%; bottom: 20%; pointer-events: none; }
.confetti span { position: absolute; width: 9px; height: 14px; border-radius: 2px; opacity: 0; animation: burst 1.3s cubic-bezier(.15, .7, .3, 1) forwards; }
@keyframes burst {
    0% { opacity: 1; transform: translate(0, 0) rotate(0); }
    60% { opacity: 1; }
    100% { opacity: 0; transform: translate(var(--x), calc(var(--y) + 220px)) rotate(var(--r)); }
}

/* ---------- guessing ---------- */
.guess-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: .6rem; }
.guess-head label { font-weight: 700; }
.heart { color: var(--bad); font-size: 1.2rem; display: inline-block; transition: transform .3s, color .3s; }
.heart.lost { color: #cbd5df; transform: scale(.8); }

.combo { position: relative; }
.guess-row { display: flex; gap: .5rem; }
.guess-row input { flex: 1; min-width: 0; font: inherit; font-size: 1.1rem; padding: .8rem 1rem; border: 2px solid #cddbe8; border-radius: 12px; background: #f7fafc; transition: border-color .2s, box-shadow .2s; }
.guess-row input:focus { outline: none; border-color: var(--sea); box-shadow: 0 0 0 4px rgba(27, 108, 168, .18); background: #fff; }
.guess-row.shake { animation: shake .45s; }
.guess-row.shake input { border-color: var(--bad); }
@keyframes shake { 20%, 60% { transform: translateX(-8px); } 40%, 80% { transform: translateX(8px); } }

.suggest { max-height: 260px; overflow-y: auto; position: absolute; z-index: 5; left: 0; right: 0; top: calc(100% + 6px); margin: 0; padding: .35rem; list-style: none; background: #fff; border-radius: 12px; box-shadow: 0 14px 30px -10px rgba(11, 37, 69, .4); border: 1px solid #e0e9f1; }
.suggest li { display: flex; align-items: center; gap: .7rem; padding: .55rem .7rem; border-radius: 8px; cursor: pointer; }
.suggest li.active { background: var(--sky); }
.sg-flag { width: 28px; height: 20px; object-fit: cover; border-radius: 3px; box-shadow: 0 0 0 1px rgba(0, 0, 0, .1); }

.chips { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: 1rem; }
.chip { padding: .4rem .8rem; border-radius: 999px; font-size: .9rem; }
.chip.wrong { background: #fdeaea; color: var(--bad); text-decoration: line-through; }
.chip.hint { background: #fff4d6; color: #7a5200; }
.hint-btn { margin-top: 1rem; background: none; border: 0; padding: 0; color: var(--sea); font: inherit; font-weight: 500; cursor: pointer; }
.hint-btn:hover:not(:disabled) { text-decoration: underline; }
.hint-btn:disabled { color: var(--muted); cursor: default; }

/* ---------- buttons ---------- */
.btn-go, .btn-ghost, .btn-accent { font: inherit; font-weight: 700; padding: .8rem 1.4rem; border-radius: 12px; border: 2px solid transparent; cursor: pointer; text-decoration: none; text-align: center; transition: transform .15s, box-shadow .15s, background .2s; }
.btn-go { background: var(--ink); color: #fff; }
.btn-go:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 16px -8px rgba(11, 37, 69, .6); }
.btn-go:active:not(:disabled) { transform: translateY(0); }
.btn-go:disabled { opacity: .4; cursor: not-allowed; }
.btn-accent { background: var(--gold); color: var(--ink); }
.btn-accent:hover { transform: translateY(-2px); box-shadow: 0 8px 16px -8px rgba(255, 183, 3, .9); }
.btn-ghost { background: transparent; color: var(--ink); border-color: #cddbe8; }
.btn-ghost:hover { background: var(--sky); }
.actions { display: flex; flex-wrap: wrap; gap: .6rem; justify-content: center; margin-top: 1.5rem; }
button:focus-visible, a:focus-visible, .map-toggle button:focus-visible { outline: 3px solid var(--sea); outline-offset: 2px; }

/* ---------- reveal ---------- */
.reveal > * { animation: rise .5s ease both; }
.reveal > *:nth-child(2) { animation-delay: .1s; }
.reveal > *:nth-child(3) { animation-delay: .2s; }
.reveal > *:nth-child(n+4) { animation-delay: .3s; }
@keyframes rise { from { opacity: 0; transform: translateY(14px); } }

.stamp-row { display: flex; align-items: center; justify-content: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
.stamp { font-size: 1.8rem; font-weight: 800; padding: .2rem 1.1rem; border: 4px double currentColor; border-radius: 10px; transform: rotate(-6deg); animation: slam .55s cubic-bezier(.2, 1.4, .4, 1) both; }
.stamp.ok { color: var(--ok); }
.stamp.bad { color: var(--bad); }
@keyframes slam { 0% { opacity: 0; transform: scale(2.6) rotate(-18deg); } 100% { opacity: 1; transform: scale(1) rotate(-6deg); } }
.earned { font-size: 1.6rem; font-weight: 800; color: var(--gold); text-shadow: 0 1px 0 rgba(11, 37, 69, .25); animation: float-up .8s ease .3s both; }
@keyframes float-up { from { opacity: 0; transform: translateY(16px); } }

.identity { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-bottom: 1.25rem; }
.identity h2 { margin: 0; font-weight: 800; font-size: 2rem; }
.flag-img { height: 56px; width: auto; border-radius: 6px; box-shadow: 0 0 0 1px rgba(0, 0, 0, .12); }
.flag-emoji { font-size: 3rem; line-height: 1; }

.facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: .6rem; }
.fact { background: var(--sky); border-radius: 12px; padding: .7rem .9rem; display: flex; flex-direction: column; gap: .25rem; }
.fact-label { font-size: .8rem; color: var(--muted); }
.fact-value { font-weight: 500; }
.shimmer { display: block; height: 14px; border-radius: 6px; background: linear-gradient(90deg, #d5e3ef 25%, #eaf2f9 50%, #d5e3ef 75%); background-size: 200% 100%; animation: shimmer 1.2s linear infinite; }
.w40 { width: 40%; } .w80 { width: 80%; }
@keyframes shimmer { to { background-position: -200% 0; } }

.blurb { margin: 1rem 0 0; line-height: 1.6; max-width: 62ch; }

.map { margin-top: 1rem; position: relative; border-radius: 14px; overflow: hidden; border: 1px solid #d5e3ef; }
.map iframe { width: 100%; height: 220px; border: 0; display: block; }
.map-toggle { position: absolute; z-index: 2; top: 8px; right: 8px; display: flex; background: #fff; border-radius: 999px; padding: 3px; box-shadow: 0 2px 8px rgba(0, 0, 0, .2); }
.map-toggle button { border: 0; background: none; font: inherit; font-size: .8rem; padding: .25rem .7rem; border-radius: 999px; cursor: pointer; }
.map-toggle button.on { background: var(--ink); color: #fff; }

/* ---------- final screen ---------- */
.end { position: relative; padding: 2.5rem 1.5rem; text-align: center; }
.confetti.big { top: 28%; bottom: auto; z-index: 3; }
.end-title { font-weight: 800; font-size: 2.4rem; margin: 0; }
.end-score { font-size: 5.5rem; font-weight: 800; line-height: 1; margin: .5rem 0 0; color: var(--sea); font-variant-numeric: tabular-nums; }
.end-sub { color: var(--muted); margin: 0 0 .5rem; }
.best-badge { display: inline-block; background: var(--gold); padding: .25rem .9rem; border-radius: 999px; font-weight: 700; animation: slam .55s cubic-bezier(.2, 1.4, .4, 1) .8s both; }
.grade { margin-top: .5rem; }
.end-stats { display: flex; justify-content: center; gap: 1rem; margin: 1.5rem 0; flex-wrap: wrap; }
.end-stats div { background: var(--sky); border-radius: 14px; padding: .8rem 1.3rem; min-width: 110px; display: flex; flex-direction: column; }
.end-stats b { font-size: 1.5rem; font-family: 'Bricolage Grotesque', sans-serif; }
.end-stats span { font-size: .8rem; color: var(--muted); }
.recap { list-style: none; padding: 0; margin: 0 auto; max-width: 420px; text-align: left; }
.recap li { display: flex; align-items: center; gap: .8rem; padding: .6rem 0; border-bottom: 1px solid #e3ecf4; transition-delay: calc(var(--i) * 90ms); }
.recap-flag { font-size: 1.5rem; }
.recap-name { flex: 1; font-weight: 500; }
.recap-pts { font-weight: 700; }
.recap-pts.ok { color: var(--ok); }
.recap-pts.bad { color: var(--bad); }

/* ---------- transitions ---------- */
.round-enter-active, .round-leave-active { transition: opacity .3s ease, transform .3s ease; }
.round-enter-from { opacity: 0; transform: translateX(40px); }
.round-leave-to { opacity: 0; transform: translateX(-40px); }
.pop-enter-active { animation: slam .4s cubic-bezier(.2, 1.4, .4, 1); }
.drop-enter-active, .drop-leave-active { transition: opacity .15s, transform .15s; }
.drop-enter-from, .drop-leave-to { opacity: 0; transform: translateY(-6px); }
.chip-enter-active { transition: all .35s cubic-bezier(.2, 1.4, .4, 1); }
.chip-enter-from { opacity: 0; transform: scale(.6) translateY(8px); }
.stagger-enter-active { transition: opacity .4s ease, transform .4s ease; }
.stagger-enter-from { opacity: 0; transform: translateX(-16px); }

@media (max-width: 576px) {
    .photo { height: 230px; }
    .identity { flex-direction: column; text-align: center; }
    .end-score { font-size: 4rem; }
    .guess-row { flex-direction: column; }
}

@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
}
</style>