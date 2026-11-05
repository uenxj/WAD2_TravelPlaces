# Packing recommendations

The checklist suggests items from what is known about the trip. Every suggestion shows why it
was made, suggestions are ranked by relevance, and an item is never suggested or added twice.

## How it works

```
 trip types picked ──┐
 itinerary ──────────┼──► signals { tag, reason } ──► items' metadata ──► ranked suggestions
 destination,        │                                 ITEMS[key].needs     { item, score, level, reasons }
         weather ────┘                                 (catalog.js)         (recommend.js)
```

1. **Items carry metadata.** Each catalogue item lists the situations it is for, with a weight
   (3 = core, 2 = recommended, 1 = nice to have):
   `sunscreen: { needs: { beach: 3, hot: 3, ski: 2, hike: 2, snow: 1, swim: 1 } }`
2. **The trip becomes signals.** Each known fact becomes a tag plus a readable reason.
   Today the sources are the trip types the user picks (`TRIP_TYPES[].tags`, e.g. "Snow & ski"
   gives `ski` and `snow`) and, for a real trip, its itinerary activities, destination and weather
   (see below).
3. **One scoring function.** `recommend()` scores each item as the sum of `weight × evidence` over
   the tags it shares with the trip. Evidence grows when independent sources agree, capped at 1.5×.
   Results are sorted by score, labelled Top pick / Recommended / Nice to have, and carry all their
   reasons. Items already on the list are hidden; the database refuses a second copy of an item.
4. **Straight into the suitcase.** "Generate" and "+ Add" / "Add all" put catalogue items on the
   list already packed (`toNewItem` sends `done: true`); the user reviews them in "Review your
   list" and removes what they don't need. Items typed by hand start unpacked.

**Tags:** situations `abroad`, `cold`, `snow`, `rain`, `hot`, `beach`, `swim`, `hike`, `ski`, `city`;
backups `battery`, `unwell`, `cash`, `lost-docs`.

### "What if…?" backups

Things that can go wrong on any trip are handled by the same engine, as data (`BACKUPS` in
catalog.js): each backup is a tag plus a reason, e.g. `{ tag: 'battery', reason: 'Backup: if your
phone dies' }`, optionally limited to trips that already have certain tags
(`when: ['abroad']` for losing your passport). They are added at half strength, so they rank as
*Nice to have* below what the trip itself needs, and "Generate" leaves backup-only
items out. Which items cover a backup is set in the items' `needs` (Power bank: `battery: 3`).

Items can also list other names in `also` (Power bank: "portable charger"), so an item the user
typed themselves ("Anker power bank") counts as already on the list.

### Extending it (data only, no new logic)

| To support… | Add… |
|---|---|
| a new item | an entry in `ITEMS` with `needs`, and a picture in `itemArt.js` |
| a new activity word | the word in `TAG_WORDS` (recommend.js) |
| a new situation | a tag in `TAGS`, its words in `TAG_WORDS`, and that tag in some items' `needs` |
| a new "what if" backup | a row in `BACKUPS`, its tag in `TAGS`, and that tag in some items' `needs` |

## Connecting other features

The checklist does not collect trip, itinerary or weather data itself; those belong to other
features. The connection is written in `src/views/Checklist.vue` (`itineraryActivities` and
`tripSignals`), based on the data they actually provide:

- **Itinerary planner (connected):** a real trip's page (`/trips/:tripId`) links to
  `/checklist?trip=<trip _id>`. The checklist reads that trip and its activities through the
  itinerary's own API (`src/itinerary/api.js`) and passes each one as `{ title, date }`. The title is
  scanned for `TAG_WORDS` (e.g. "Skiing in Niseko" gives `ski`); `type`/`tags` from the tag list above
  would be used directly if the itinerary ever provides them. Sample trips (`preview-…`) use their
  sample itinerary from `src/data/sampleTrips.js`; `demo-trip` has none, and if the trip can't be
  opened the checklist works on its own.
- **Destination and weather (connected), in `tripSignals.js`:**
  - A destination outside Singapore (Charlene's `isSingapore()` on the trip's centre point and
    timezone) → `{ tag: 'abroad', reason: 'Going abroad: Tokyo, Japan' }`.
  - Each upcoming trip day (first 14 days at most) is looked up with the weather module's
    `getActivityConditions()`, as a whole day at the destination like the itinerary's own day
    summary. Within about two weeks that is a forecast; further ahead, the 10-year average for the
    month. `WEATHER_RULES` turns it into one signal per tag, e.g. "Forecast: rainy on 2 of
    3 days" or "Usually hot (30°C or more) in July (10-year average)":

    | Tag | Forecast | Monthly average |
    |---|---|---|
    | `rain` | precipitation chance ≥ 60% (the weather module's own threshold) | rain on ≥ 30% of days |
    | `hot` | high ≥ 30°C | average high ≥ 30°C |
    | `cold` | low ≤ 10°C | average low ≤ 10°C |
    | `snow` | snow codes with precipitation chance ≥ 60% | (no data) |

    `cold` starts at 10°C rather than the weather module's freezing warning, because the app's
    travellers come from Singapore: a 10°C evening already needs a jacket.
  - If the destination was not found on the map, or the weather service is down, those signals are
    simply missing; the rest of the checklist works the same.

`recommend.test.js` includes the "Japan in December with skiing" example with these inputs given by
hand; `tripSignals.test.js` covers turning real trip and weather data into those signals.

## Why not an AI API for this

An LLM could read free-text plans, but as the core of the feature it would need a paid key kept on
the server, give different answers on different runs, sometimes invent items, and be hard to test
or explain. A good fit later is narrow: an optional tagger that maps a free-text activity title to
the fixed tags above (the job `tagActivity()` does with keywords). The rest would stay the same.
