<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const LOCATIONS = [
    { img: '/locations/france.jpg', country: 'France', capital: 'Paris', region: 'Europe', flag: '🇫🇷' },
    { img: '/locations/japan.jpg', country: 'Japan', capital: 'Tokyo', region: 'Asia', flag: '🇯🇵' },
    { img: '/locations/egypt.jpg', country: 'Egypt', capital: 'Cairo', region: 'Africa', flag: '🇪🇬' },
    { img: '/locations/brazil.jpg', country: 'Brazil', capital: 'Brasília', region: 'Americas', flag: '🇧🇷' },
    { img: '/locations/italy.jpg', country: 'Italy', capital: 'Rome', region: 'Europe', flag: '🇮🇹' }
]

const TOTAL_ROUNDS = 5

const countries = ref([])
const rounds = ref([])
const roundIndex = ref(0)
const score = ref(0)
const guess = ref('')
const result = ref(null)
const loading = ref(false)
const finished = ref(false)
const usingFallback = ref(false)

const current = computed(() => rounds.value[roundIndex.value])


function shuffle(arr) {
    return [...arr].sort(() => Math.random() - 0.5)
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
    const names = [answer.country, ...(answer.aliases ?? [])]
    return names.some(n => normalize(n) === normalize(typed))
}

function startGame() {
    rounds.value = shuffle(LOCATIONS).slice(0, Math.min(TOTAL_ROUNDS, LOCATIONS.length))
    roundIndex.value = 0
    score.value = 0
    guess.value = ''
    result.value = null
    finished.value = false
}

async function loadCountries() {
    try {
        const res = await fetch('https://restcountries.com/v3.1/all?fields=name')
        if (!res.ok) throw new Error('bad response')
        const data = await res.json()
        countries.value = data.map(c => c.name.common).sort()
    } catch (err) {
        console.error('Could not load country list', err)
        countries.value = LOCATIONS.map(l => l.country).sort()
        usingFallback.value = true
    }
}

async function submitGuess() {
    if (!guess.value.trim()) return
    loading.value = true
    const answer = current.value

    let info = {
        name: answer.country,
        capital: answer.capital,
        region: answer.region,
        flagEmoji: answer.flag,
        flagImg: null,
    }

    try {
        const res = await fetch(
            `https://restcountries.com/v3.1/name/${encodeURIComponent(answer.country)}?fullText=true`
        )
        if (!res.ok) throw new Error('bad response')
        const [data] = await res.json()
        info = {
            name: data.name.common,
            capital: data.capital?.[0] ?? answer.capital,
            region: data.region,
            flagEmoji: data.flag ?? answer.flag,
            flagImg: data.flags?.png ?? null,
        }
    } catch (err) {
        console.error('API failed, using fallback data', err)
        usingFallback.value = true
    }

    const correct = isCorrect(guess.value, answer)
    if (correct) score.value++
    result.value = { ...info, correct }
    loading.value = false
}

function nextRound() {
    if (roundIndex.value + 1 >= rounds.value.length) {
        finished.value = true
        return
    }
    roundIndex.value++
    guess.value = ''
    result.value = null
}

function explore() {
    router.push(`/explore/${encodeURIComponent(result.value.name)}`)
}

onMounted(() => {
    startGame()
    loadCountries()
})
</script>

<template>
    <div class="play-page py-5">
        <div class="container" style="max-width: 720px">
            <RouterLink to="/discover" class="d-inline-block mb-4">← Back to Discover</RouterLink>
            <div v-if="finished" class="card shadow border-0 text-center p-5">
                <h1 class="display-5 fw-bold">Game over</h1>
                <p class="lead mb-1">You got</p>
                <p class="display-1 fw-bold text-primary mb-1">{{ score }} / {{ rounds.length }}</p>
                <p class="text-muted mb-4">
                    {{ score === rounds.length ? 'Perfect round. You could be a tour guide.' :
                        score >= rounds.length / 2 ? 'Nice work. Your passport is getting stamps.' :
                    'Time to do some exploring.' }}
                </p>
                <div class="d-flex gap-2 justify-content-center">
                    <button class="btn btn-primary btn-lg" @click="startGame">Play again</button>
                    <RouterLink to="/" class="btn btn-outline-secondary btn-lg">Back home</RouterLink>
                </div>
            </div>

            <div v-else-if="current">
                <div class="d-flex justify-content-between align-items-end mb-2">
                    <h1 class="h3 fw-bold mb-0">Guess the country</h1>
                    <span class="text-muted">
                        Round {{ roundIndex + 1 }} of {{ rounds.length }} &nbsp;|&nbsp; Score: <b>{{ score }}</b>
                    </span>
                </div>
                <div class="progress mb-4" style="height: 6px">
                    <div class="progress-bar"
                        :style="{ width: ((roundIndex + (result ? 1 : 0)) / rounds.length) * 100 + '%' }"></div>
                </div>

                <div class="card shadow border-0 overflow-hidden">
                    <img :src="current.img" class="location-img" alt="Mystery location" />

                    <div class="card-body p-4">
                        <div v-if="!result">
                            <label for="guess" class="form-label fw-semibold">Which country is this?</label>
                            <div class="input-group input-group-lg">
                                <input id="guess" v-model="guess" type="text" class="form-control"
                                    placeholder="Type a country, e.g. Japan" list="country-suggestions"
                                    autocomplete="off" @keyup.enter="submitGuess" />
                                <button class="btn btn-primary px-4" :disabled="!guess.trim() || loading"
                                    @click="submitGuess">
                                    <span v-if="loading" class="spinner-border spinner-border-sm"></span>
                                    <span v-else>Guess</span>
                                </button>
                            </div>
                        </div>

                        <div v-else>
                            <div class="alert fs-4 fw-bold text-center mb-4"
                                :class="result.correct ? 'alert-success' : 'alert-danger'" role="alert">
                                {{ result.correct ? 'Correct!' : 'Wrong!' }}
                                <div v-if="!result.correct" class="fs-6 fw-normal mt-1">
                                    You guessed {{ guess }}.
                                </div>
                            </div>

                            <p class="text-muted mb-2 text-center">The right answer is</p>
                            <div class="d-flex align-items-center justify-content-center gap-3 mb-4">
                                <img v-if="result.flagImg" :src="result.flagImg" :alt="'Flag of ' + result.name"
                                    class="flag-img rounded border" />
                                <span v-else class="display-4">{{ result.flagEmoji }}</span>
                                <div>
                                    <h2 class="mb-0 fw-bold">{{ result.name }}</h2>
                                    <div class="text-muted">Capital: {{ result.capital }} &nbsp;|&nbsp; {{ result.region
                                        }}</div>
                                </div>
                            </div>

                            <div class="d-grid gap-2 d-sm-flex justify-content-sm-center">
                                <button class="btn btn-warning btn-lg px-4" @click="explore">
                                    Explore {{ result.name }}
                                </button>
                                <button class="btn btn-outline-primary btn-lg px-4" @click="nextRound">
                                    {{ roundIndex + 1 >= rounds.length ? 'See results' : 'Next round' }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>
</template>

<style scoped>
.play-page {
    min-height: calc(100vh - 56px);
    background: #eef3f7;
}

.location-img {
    width: 100%;
    height: 340px;
    object-fit: cover;
    background: #cfd8dc;
}

.flag-img {
    height: 56px;
    width: auto;
}

@media (max-width: 576px) {
    .location-img {
        height: 220px;
    }
}
</style>