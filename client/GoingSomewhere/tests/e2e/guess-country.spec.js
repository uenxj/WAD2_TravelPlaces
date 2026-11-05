import { test, expect } from '@playwright/test'

const PLAY_PATH = process.env.PLAY_PATH || '/play'
const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64'
)
const json = body => ({
    status: 200,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
})

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const guessInput = page => page.getByRole('combobox', { name: 'Which country is this?' })
const guessButton = page => page.getByRole('button', { name: 'Guess', exact: true })
const stamp = page => page.locator('.stamp')
const dots = page => page.locator('.dots .dot')
const digits = text => Number(text.replace(/\D/g, ''))

async function startGame(page) {
    await page.goto(PLAY_PATH)
    await expect(guessInput(page)).toBeVisible()
}

async function answerOf(page) {
    const src = await page.locator('.location-img').getAttribute('src')
    const slug = src.split('/').pop().replace(/\.\w+$/, '')
    return slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

async function submit(page, text) {
    await guessInput(page).fill(text)
    await guessButton(page).click()
}

async function playRound(page, correct) {
    const answer = await answerOf(page)
    if (correct) {
        await submit(page, answer)
    } else {
        await submit(page, 'Mongolia')
        await submit(page, 'Peru')
    }
    await expect(stamp(page)).toBeVisible()
    return answer
}

async function earned(page) {
    const el = page.locator('.earned')
    await expect(el).toBeVisible()
    return digits(await el.innerText())
}

async function advance(page) {
    await page.getByRole('button', { name: /Next round|See results/ }).click()
}

async function worth(page) {
    return digits(await page.locator('.worth b').innerText())
}

/* ------------------------------------------------------------------ */
/*  Mock every external service                                        */
/* ------------------------------------------------------------------ */
test.beforeEach(async ({ page }) => {
    await page.route('**/api/rest_v1/page/summary/**', route =>
        route.fulfill(json({ extract: 'Mock summary one. Mock summary two. Mock summary three.' }))
    )
    await page.route('https://geocoding-api.open-meteo.com/**', route =>
        route.fulfill(json({ results: [{ latitude: 10, longitude: 20 }] }))
    )
    await page.route('https://api.open-meteo.com/**', route =>
        route.fulfill(json({ current: { temperature_2m: 21.4, weather_code: 0 } }))
    )
    await page.route('https://flagcdn.com/**', route =>
        route.fulfill({ status: 200, contentType: 'image/png', body: PNG })
    )
    await page.route('https://www.openstreetmap.org/**', route =>
        route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>map</body></html>' })
    )
    await page.route('https://fonts.googleapis.com/**', route =>
        route.fulfill({ status: 200, contentType: 'text/css', body: '' })
    )
    await page.route('https://fonts.gstatic.com/**', route => route.abort())
})

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */
test.describe('Guess the country', () => {
    test('loads a fresh round with the right starting state', async ({ page }) => {
        await startGame(page)

        await expect(page.locator('.location-img')).toBeVisible()
        await expect(page.getByRole('timer')).toBeVisible()
        await expect(page.getByLabel('2 attempts left')).toBeVisible()
        await expect(page.locator('.score-pill b')).toHaveText('0')
        await expect(guessButton(page)).toBeDisabled()
        expect(await dots(page).count()).toBeGreaterThan(0)
        await expect(dots(page).first()).toHaveClass(/now/)
    })

    test('correct answer: stamp, points, score and reveal facts', async ({ page }) => {
        await startGame(page)
        const answer = await playRound(page, true)

        await expect(stamp(page)).toHaveText('Correct')
        expect(await earned(page)).toBeGreaterThan(0)
        await expect(page.getByRole('heading', { name: answer })).toBeVisible()
        await expect(dots(page).first()).toHaveClass(/\bok\b/)
        await expect.poll(async () => digits(await page.locator('.score-pill b').innerText())).toBeGreaterThan(0)

        // live data (mocked) + local facts
        await expect(page.getByText('Mock summary one. Mock summary two.')).toBeVisible()
        await expect(page.getByText(/21°C, Clear/)).toBeVisible()
        await expect(page.getByText('Population')).toBeVisible()
        await expect(page.getByRole('img', { name: `Flag of ${answer}` })).toBeVisible()
    })

    test('answers are case-insensitive and ignore extra spaces', async ({ page }) => {
        await startGame(page)
        const answer = await answerOf(page)
        await submit(page, `   ${answer.toUpperCase()}  `)
        await expect(stamp(page)).toHaveText('Correct')
    })

    test('wrong guess costs a heart, then a second miss ends the round', async ({ page }) => {
        await startGame(page)

        await submit(page, 'Mongolia')
        await expect(stamp(page)).toHaveCount(0)
        await expect(page.getByLabel('1 attempts left')).toBeVisible()
        await expect(page.locator('.chip.wrong')).toHaveText('Mongolia')
        await expect(guessInput(page)).toHaveValue('')

        await submit(page, 'Peru')
        await expect(stamp(page)).toHaveText('Missed')
        await expect(page.getByText('You guessed Mongolia, Peru.')).toBeVisible()
        await expect(dots(page).first()).toHaveClass(/\bbad\b/)
        await expect(page.locator('.earned')).toHaveCount(0)
    })

    test('hints: reveal one at a time, cost 150 points, then run out', async ({ page }) => {
        await page.clock.install()
        await startGame(page)
        await page.clock.pauseAt(new Date(Date.now() + 1000))

        const hintBtn = page.getByRole('button', { name: /Need a hint\?/ })
        const before = await worth(page)

        await hintBtn.click()
        await expect(page.locator('.chip.hint')).toHaveCount(1)
        expect(await worth(page)).toBe(before - 150)

        await hintBtn.click()
        await page.getByRole('button', { name: /Need a hint\?/ }).click()
        await expect(page.locator('.chip.hint')).toHaveCount(3)
        await expect(page.locator('.chip.hint').nth(2)).toContainText('Spelling:')
        await expect(page.getByRole('button', { name: 'No more hints' })).toBeDisabled()
    })

    test("timer: running out of time reveals the answer as \"Time's up\"", async ({ page }) => {
        await page.clock.install()
        await startGame(page)
        await page.clock.runFor(31_000)

        await expect(stamp(page)).toHaveText("Time's up")
        await expect(page.getByRole('timer')).toHaveCount(0)
        await expect(dots(page).first()).toHaveClass(/\bbad\b/)
    })

    test('autocomplete: suggestions appear and clicking one submits it', async ({ page }) => {
        await startGame(page)
        const answer = await answerOf(page)

        await guessInput(page).fill(answer.slice(0, 3))
        await expect(page.getByRole('listbox')).toBeVisible()
        await page.getByRole('option', { name: answer, exact: true }).click()
        await expect(stamp(page)).toHaveText('Correct')
    })

    test('autocomplete: keyboard (arrow down + enter) and escape work', async ({ page }) => {
        await startGame(page)
        const answer = await answerOf(page)

        await guessInput(page).fill(answer.slice(0, 2))
        await expect(page.getByRole('listbox')).toBeVisible()
        await guessInput(page).press('Escape')
        await expect(page.getByRole('listbox')).toHaveCount(0)

        await guessInput(page).fill(answer)
        await guessInput(page).press('ArrowDown')
        await guessInput(page).press('Enter')
        await expect(stamp(page)).toHaveText('Correct')
    })

    test('next round resets hearts, input, hints and timer', async ({ page }) => {
        await startGame(page)
        await submit(page, 'Mongolia') // lose a heart
        await page.getByRole('button', { name: /Need a hint\?/ }).click()
        await submit(page, 'Peru')
        await advance(page)

        await expect(guessInput(page)).toBeVisible()
        await expect(guessInput(page)).toHaveValue('')
        await expect(page.getByLabel('2 attempts left')).toBeVisible()
        await expect(page.locator('.chip')).toHaveCount(0)
        await expect(page.getByRole('timer')).toBeVisible()
        await expect(dots(page).nth(1)).toHaveClass(/now/)
    })

    test('perfect game: "Flawless", big confetti, saved best score', async ({ page }) => {
        await startGame(page)
        const total = await dots(page).count()
        let sum = 0

        for (let i = 0; i < total; i++) {
            await playRound(page, true)
            sum += await earned(page)
            await advance(page)
            if (i < total - 1) await expect(guessInput(page)).toBeVisible()
        }

        await expect(page.getByRole('heading', { name: 'Flawless' })).toBeVisible()
        await expect(page.locator('.confetti.big span').first()).toBeAttached()
        await expect(page.locator('.end-stats')).toContainText(`${total}/${total}`)
        await expect(page.locator('.end-stats')).toContainText('100%')
        await expect(page.getByText('New personal best')).toBeVisible()
        await expect(page.locator('.recap li')).toHaveCount(total)

        // the animated score counts up to the sum of all earned points
        await expect.poll(async () => digits(await page.locator('.end-score').innerText())).toBe(sum)
        expect(await page.evaluate(() => localStorage.getItem('guess-country-best'))).toBe(String(sum))
    })

    test('imperfect game: "Game over", no big confetti, correct accuracy', async ({ page }) => {
        await startGame(page)
        const total = await dots(page).count()

        for (let i = 0; i < total; i++) {
            await playRound(page, i !== 1) // miss the second round
            await advance(page)
            if (i < total - 1) await expect(guessInput(page)).toBeVisible()
        }

        await expect(page.getByRole('heading', { name: 'Game over' })).toBeVisible()
        await expect(page.locator('.end-stats')).toContainText(`${total - 1}/${total}`)
        await expect(page.locator('.end-stats')).toContainText(`${Math.round(((total - 1) / total) * 100)}%`)
        await page.waitForTimeout(800)
        await expect(page.locator('.confetti.big')).toHaveCount(0)
    })

    test('play again starts a fresh game', async ({ page }) => {
        await startGame(page)
        const total = await dots(page).count()
        for (let i = 0; i < total; i++) {
            await playRound(page, true)
            await advance(page)
            if (i < total - 1) await expect(guessInput(page)).toBeVisible()
        }

        await page.getByRole('button', { name: 'Play again' }).click()
        await expect(guessInput(page)).toBeVisible()
        await expect(page.locator('.score-pill b')).toHaveText('0')
        await expect(dots(page).first()).toHaveClass(/now/)
        await expect(page.locator('.dots .dot.ok, .dots .dot.bad')).toHaveCount(0)
    })

    test('map toggle switches between capital and country zoom', async ({ page }) => {
        await startGame(page)
        await playRound(page, true)

        const map = page.locator('iframe[title^="Map of"]')
        await expect(map).toBeVisible()
        const capitalSrc = await map.getAttribute('src')
        await page.getByRole('button', { name: 'Country', exact: true }).click()
        await expect.poll(() => map.getAttribute('src')).not.toBe(capitalSrc)
    })

    test('falls back to saved local data when live APIs fail', async ({ page }) => {
        await page.route('**/api/rest_v1/page/summary/**', route => route.abort())
        await page.route('https://geocoding-api.open-meteo.com/**', route => route.abort())
        await page.route('https://api.open-meteo.com/**', route => route.abort())

        await startGame(page)
        const answer = await playRound(page, true)

        await expect(stamp(page)).toHaveText('Correct')
        await expect(page.getByRole('heading', { name: answer })).toBeVisible()
        await expect(page.getByText('Population')).toBeVisible() // from local LOCATIONS data
        await expect(page.getByText("The live summary couldn't load")).toBeVisible()
    })


    test('mobile: no horizontal scrolling during a round or on the reveal', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 700 })
        await startGame(page)

        const overflows = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
        expect(await overflows()).toBe(false)
        await playRound(page, true)
        expect(await overflows()).toBe(false)
    })
})