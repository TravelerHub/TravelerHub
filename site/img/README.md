# Marketing-site photography

The brief is explicit: **no photo appears twice on the page**. The original
design recycled 8 photos across 15 slots; `site/index.html` references 15
unique filenames. This folder ships 5 of them — the rest need to be
sourced or optimized before launch.

## What ships in this folder

5 of the 8 photos from the React app
(`frontend/src/assets/images/`) are mirrored here:

| File | Slot |
|------|------|
| `travelPic5.jpg` (213 KB) | Hero background (full-bleed Ken Burns) |
| `travelPic7.jpg` (108 KB) | Bento `b-1` — "Coastal escapes" |
| `travelPic1.jpg` (213 KB) | Bento `b-4` — "City nights" |
| `travelPic6.jpg` (364 KB) | Bento `b-5` — "Urban escapes" |
| `homepage_img.jpg` (532 KB) | Travel split — "Travel like one" |

## What's missing — 3 photos to optimize, 7 photos to source

The original React app has the next 3 photos but they're 2.5 MB / 14 MB /
4.5 MB respectively — too heavy for a landing page. Optimize them
(target ≤ 500 KB each, ~1600 px wide, JPG q=82) before dropping in:

| File | Slot | Source |
|------|------|--------|
| `travelPic2.jpg` | Bento `b-2` — "Mountain mornings" | `frontend/src/assets/images/travelPic2.jpg` (2.5 MB) |
| `travelPic3.jpg` | Bento `b-3` — "Hidden gems" | `frontend/src/assets/images/travelPic3.jpg` (14 MB) |
| `travelPic4.jpg` | Step 02 — "Plan together" | `frontend/src/assets/images/travelPic4.jpg` (4.5 MB) |

The remaining 7 slots reference filenames that **don't exist anywhere in
the repo yet**. The page will render with broken `<img>` tags until you
drop these in:

| File | Slot | What it should show |
|------|------|---------------------|
| `travelPic8.jpg` | Bento `b-6` — "Weekend resets" | Quick-getaway moment — golden-hour street, train window, lakeside |
| `travelPic9.jpg` | Plan split #1 — "Vote on where to go" | Decision-making vibe — friends with a map, ranked-choice mood; mountain or coastal landscape works |
| `travelPic10.jpg` | Plan split #2 — "Split without the math" | Group dinner, table-of-receipts, market scene — anything that reads "shared cost" |
| `travelPic11.jpg` | Immersive pull-quote band | Wide horizontal — golden-hour landscape with negative space on the right for the quote text |
| `travelPic12.jpg` | Step 01 — "Create a trip" | Starting-out beat — open suitcase, planning at a kitchen table, city departure board |
| `travelPic13.jpg` | Step 03 — "Travel, relax" | On-the-ground travel — group walking together, arriving at a hotel, sunset rooftop |
| `travelPic14.jpg` | CTA band background | Aspirational closer — full-bleed warm landscape with lots of room for centered headline |

## What counts as on-brand

From the design brief:

- **Golden-hour light** preferred — early morning or late afternoon.
- **Saturated naturals**, not desaturated stock.
- **Environmental human moments** beat solo studio portraits.
- Would this photo look at home next to `travelPic5.jpg` (mountain
  morning)? If yes, it fits.

## What to avoid

- Stock-looking studio shots, flat-lit desks, pure white backdrops.
- Cool/blue light — fights the warm palette.
- Duotones, color filters, heavy post-processing.
- **Reusing any of the photos already listed in the table above.** The
  brief is firm on this.

## Sources

Free, palette-friendly options:

- [Unsplash](https://unsplash.com) — search "golden hour travel," "warm sunset city," "group walking street."
- [Pexels](https://pexels.com) — same searches; check license per file.
- Your own photos are best. Use them.
