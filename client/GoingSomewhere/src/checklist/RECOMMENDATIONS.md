# Packing recommendations

The checklist suggests items from what is known about the trip. Every suggestion shows why it
was made, suggestions are ranked by relevance, and an item is never suggested or added twice.

## How it works

```
 trip types picked ──┐
 (later) itinerary ──┼──► signals { tag, reason } ──► items' metadata ──► ranked suggestions
 (later) destination,│                                 ITEMS[key].needs     { item, score, level, reasons }
         weather ────┘                                 (catalog.js)         (recommend.js)
```

1. **Items carry metadata.** Each catalogue item lists the situations it is for, with a weight
   (3 = core, 2 = recommended, 1 = nice to have):
   `sunscreen: { needs: { beach: 3, hot: 3, ski: 2, hike: 2, snow: 1, swim: 1 } }`
2. **The trip becomes signals.** Each known fact becomes a tag plus a readable reason.
   Today the only source is the trip types the user picks (`TRIP_TYPES[].tags`, e.g. "Snow & ski"
   gives `ski` and `snow`).
3. **One scoring function.** `recommend()` scores each item as the sum of `weight × evidence` over
   the tags it shares with the trip. Evidence grows when independent sources agree, capped at 1.5×.
   Results are sorted by score, labelled Top pick / Recommended / Nice to have, and carry all their
   reasons. Items already on the list are hidden; the database refuses a second copy of an item.

**Tags:** situations `abroad`, `cold`, `snow`, `rain`, `hot`, `beach`, `swim`, `hike`, `ski`, `city`;
backups `battery`, `unwell`, `cash`, `lost-docs`.

### "What if…?" backups

Things that can go wrong on any trip are handled by the same engine, as data (`BACKUPS` in
catalog.js): each backup is a tag plus a reason, e.g. `{ tag: 'battery', reason: 'Backup: if your
phone dies' }`, optionally limited to trips that already have certain tags
(`when: ['abroad']` for losing your passport). They are added at half strength, so they rank as
*Nice to have* below what the trip itself needs, and "Generate my packing list" leaves backup-only
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

## Connecting other features (not done yet)

The checklist does not collect or fetch trip, itinerary or weather data itself; those belong to
other features. When they exist, the connection is written in `src/views/Checklist.vue`
(`itineraryActivities` and `tripSignals`), based on the data they actually provide:

- **Itinerary planner:** each activity can be passed as `{ title, date?, type?, tags? }`.
  `type`/`tags` from the tag list above are used directly; otherwise the title is scanned for
  `TAG_WORDS` (e.g. "Skiing in Niseko" gives `ski`).
- **Trips (destination) and weather/haze:** their data is turned into signals, for example a
  destination outside Singapore → `{ tag: 'abroad', reason: 'Going abroad: Japan' }`, or a cold or
  rainy forecast → `cold` / `rain` with the forecast as the reason.

`recommend.test.js` includes the "Japan in December with skiing" example with these inputs given by
hand, to show the result once the features are connected.

## Why not an AI API for this

An LLM could read free-text plans, but as the core of the feature it would need a paid key kept on
the server, give different answers on different runs, sometimes invent items, and be hard to test
or explain. A good fit later is narrow: an optional tagger that maps a free-text activity title to
the fixed tags above (the job `tagActivity()` does with keywords). The rest would stay the same.
