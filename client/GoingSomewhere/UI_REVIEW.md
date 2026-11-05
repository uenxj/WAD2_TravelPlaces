# Planning UI review — 5 November 2026

## Scope and coverage

Reviewed Home, Discover and destination cards, Travel Preference Quiz and results, My Trips, trip creation, Itinerary and its trip/activity dialogs, Budget, Packing List, Profile, login, and sample-trip layouts. This is an implementation review of the main planning flow, not a whole-product accessibility certification. The country game retains its existing design; its planning hand-off was smoke-tested. The standalone weather tool was covered by the existing functional suite rather than a separate visual redesign.

Stack: Vue 3, Vue Router, Bootstrap, scoped CSS, shared navy/mint tokens in `src/styles/app.css`, and globe.gl. Preserved existing fonts, postcard/stamp treatments, services, data contracts, and budget calculations. Read the repository and client READMEs and itinerary hand-off notes. No AGENTS.md, CONTRIBUTING.md, CODING_STANDARDS.md, CLAUDE.md or separate design-system convention document was found.

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | Chrome accessibility trees for ten main routes; shared dialog focus, Escape and focus return; route focus; skip link; globe reduced-motion behavior; toast persistence | Fixes below; native screen-reader testing not verified |
| Layout | Rendered main planning routes at 320, 640, 768, 1024 and 1440px; narrow long-name itinerary; Budget edit form; quiz results; empty and populated checklist | Confirmed overflow fixed; no horizontal page scrolling in checked routes |
| Writing | Page/action labels, signed-in destination hint, empty-list instructions, retry and error messages | Terminology and recovery fixes below |
| Typography | Computed headings and input sizes; shared card/section roles; wrapping at 320px | Shared scale and mobile input fixes below |
| Colors | Rendered Budget input colors; shared text, muted, accent, focus and input-boundary pairs | Measured contrast passes for checked pairs |
| UI polish | Header/search alignment; cards, back links and controls; nested scroll areas; normal and reduced-motion globe states | Shared spacing and control fixes below |

## Findings and implemented fixes

| Severity | Domain | Location | Before | After | Why |
| --- | --- | --- | --- | --- | --- |
| HIGH | Layout | `src/components/AppHeader.vue:68` | At 768px, search overlapped the brand; at 320px, navigation formed a roughly 176px tall side column | Search moves to its own row below 1100px; narrow navigation gets one full-width row; consistent header padding | Keeps navigation readable and controls reachable (WCAG 1.4.10) |
| HIGH | Accessibility | `src/components/itinerary/ModalShell.vue:10` | Custom dialog had no inert background or focus containment/return | Native `dialog.showModal()`, initial form focus, Escape, return to trigger, contained scrolling and page scroll lock | Prevents keyboard focus moving into background content (WCAG 2.4.3) |
| HIGH | Layout | `src/views/Itinerary.vue:468`, `src/views/Home.vue` `.globe` | Itinerary sidebar min-content width produced a 330px document at 320px; initial globe canvas could escape its box | Shrinkable grid tracks/children, wrapping member rows, clipped canvas overflow | Removes horizontal page scrolling at 320px without reducing globe dimensions (WCAG 1.4.10) |
| HIGH | Colors | `src/styles/app.css:9` and form styles in Budget, Checklist, Itinerary, AppHeader | Input boundary `#42546b` against `#101a2e` measured 2.24:1 | Separate control-boundary token `#71849b`: 4.53:1 against page/input background and 3.91:1 against panel | Input boundaries meet the checked 3:1 non-text contrast requirement (WCAG 1.4.11) |
| HIGH | Accessibility | `src/views/Home.vue:43`, `src/views/Discover.vue:153`, `src/composables/useReducedMotion.js` | Globes rotated, pulsed and flew between views regardless of motion preference | Reduced motion disables auto-rotation, rings, animated arcs, damping, fly-to movement and sliding transitions; preference changes are observed | Honors the reader’s motion setting; static canvas frames verified |
| HIGH | Accessibility | `src/views/Checklist.vue:309`, `src/views/Budget.vue` `flash()` | Errors disappeared after six seconds; checklist Undo disappeared after seven | Errors and Undo remain until dismissed/replaced; Budget error gets a dismiss control | Readers retain time to read errors and act on Undo (WCAG 2.2.1) |
| MEDIUM | Accessibility | `src/App.vue:8`, `router/index.js:39`, `src/styles/app.css` | Shared page title, no skip link or route focus, sticky header offset not measured | Route-specific titles, heading focus on view mount, skip link and measured scroll offset | Makes route changes and keyboard navigation easier to follow (WCAG 2.4.1/2.4.2/2.4.3) |
| MEDIUM | Typography | `src/styles/app.css`, `src/views/Quiz.vue`, `src/views/Checklist.vue`, Budget and Itinerary section titles | Mobile selects/search/member input used 14–14.4px; inconsistent page/section headings and card padding | Mobile editable controls at least 16px; shared page and section type roles; shared card padding; clearer small badges | Reduces iOS input zoom and gives the planning pages a consistent hierarchy |
| MEDIUM | Layout | `src/views/Checklist.vue` list/sidebar markup | Suggestions appeared first in DOM order but second visually on mobile | Packing items precede suggestions in both source and visual order | Keyboard order matches the displayed layout |
| MEDIUM | Writing | `src/views/Checklist.vue:442`, `components/DestinationCard.vue`, `src/components/itinerary/SuggestedPlaces.vue` | “My checklist” differed from the Packing List entry; signed-in visitors still saw a login instruction; suggestions error offered no direct retry | “Packing list” heading; login hint only when signed out; retry button in suggestions error | Uses consistent terms and gives an immediate recovery action |

## Verification

Passed:

- Production build: `npm run build` in `client/GoingSomewhere`. Existing globe bundle size advisory remains.
- `git diff --check`.
- Desktop/mobile Playwright suite using an isolated Vite port and temporary test services: 66 checks passed on the broad rerun. The two new dialog tests initially assumed Chromium skips browser chrome when tabbing from the final native-dialog control. Corrected that platform expectation; the focused rerun passed all four dialog/narrow-layout checks. All 68 current browser checks have passed across these runs.
- Exact browser commands: `PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:e2e -- --config /tmp/travel-ui-playwright.config.mjs` and the focused rerun with `--grep 'dialogs contain|reflow at 320px'`.
- Existing flows cover authentication, preview, quiz-to-destination, destination-to-trip, trip/item create/edit/delete, group membership, schedule clashes, Budget expense/currency/persistence behavior, weather failure/retry, seasonal context, sample trips, and haze/air-quality conditions. Updated stale test expectations for the renamed back link and the game’s existing two-attempt rule; game rules were not changed.
- Additional browser checks: planning routes fit at 320/640/768/1024/1440px; Budget editor and quiz results fit at 320/1440px; quiz results receive focus; one trip-type selector remains in Packing List; adding the 14 basics and generating a list still work.
- Chrome accessibility tree: interactive controls had names on Home, Discover, quiz, trips, creation, Itinerary, Budget, Packing List, Profile and login.
- Reduced-motion Home/Discover canvas screenshots were identical 700ms apart after loading. No animation pause button was added, following the earlier product request.
- Mocked Budget error remained visible beyond 6.5 seconds and could be dismissed.
- Computed Budget input colors: text `#f5f5f3`, background `#101a2e`, border `#71849b`. Shared panel text contrast: primary 13.75:1, muted 8.88:1, accent 10.25:1; focus `#8ecae6` against the panel 8.39:1.

Not verified: VoiceOver/NVDA output, physical iOS Safari behavior, Firefox, actual browser text zoom at 200%, translation/RTL layouts, live external API reliability, or all game-specific states. Responsive checks and synthetic failures used isolated/mocked data; no user trip data was edited.

## Verdict

Approve for the inspected planning flow: the confirmed findings above are fixed. This verdict does not certify the unverified platforms, assistive technologies, or excluded game-specific states.
