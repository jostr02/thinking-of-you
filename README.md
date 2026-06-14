# thinking of you 💭

A little timeline website that plots every time I thought about you.

`times.txt` is a flat list of `HH:MM` times (12-hour, no AM/PM) split by
`Next day`, starting at midnight on New Year's Day 2026. The page parses it in
the browser and draws a glowing dot per entry, one vertical bar per day,
grouped by month — plus the running "if I had a nickel" total.

## Run it locally

The page `fetch()`es `times.txt`, so it must be served over HTTP (opening the
file directly with `file://` is blocked by the browser).

```sh
python -m http.server 8000
# then open http://localhost:8000/
```

Open `http://localhost:8000/test.html` to run the parser self-checks.

## Dot types

| Color  | Meaning                                  |
| ------ | ---------------------------------------- |
| white  | a normal "thought about you" moment      |
| blue   | a moment with a note (hover/tap to read) |
| yellow | a moment with an image                   |

## Adding an image (yellow) dot

1. Drop the image file in `images/` (e.g. `images/beach.jpg`).
2. In `times.txt`, write the note for that time with an `img:` prefix:

   ```
   3:42 - img:beach.jpg that day at the beach :)
   ```

   Format is `img:<filename> <optional caption>`. The filename is looked up
   under `images/`; everything after it is the caption shown in the lightbox.

## Editing the data

- A normal time is just `HH:MM`.
- A note is `HH:MM - your note here` (a bare `HH:MM -` with nothing after is
  treated as a plain white dot).
- `Next day` marks a new waking day. It's normally followed by a morning (AM)
  time, but afternoon/evening starts are handled too (see below).

### Forcing AM/PM (the override)

Times have no AM/PM, so the parser infers it. When it guesses wrong, just write
the time with `am` or `pm` and that becomes ground truth:

```
9:27 pm
8:42am - some note
```

An explicit `am`/`pm` also turns off the auto PM-shift for that whole day, so you
stay in full control.

### How the parser disambiguates (already handled)

- **Monotonic time**: each time is resolved to the earliest AM/PM reading that is
  still later than the previous entry — real time only moves forward.
- **PM-start days**: a day that would otherwise read as deep-night → late-morning
  with no evening (e.g. `1:09 … 10:24` all AM) is recognized as an afternoon start
  and shifted to PM (`1:09pm … 10:24pm`).
- **Missing `Next day`**: self-healing — when a time would go backwards, the
  parser rolls to the next calendar day automatically.
- **Genuinely ambiguous** mid-day jumps (e.g. a normal-looking gap that's really
  AM→PM) can't be inferred — use the `am`/`pm` override above.

## Customize

- The subtext under the nickel line is a placeholder in `index.html`
  (look for the `TODO` comment).

## Deploy (GitHub Pages)

```sh
git init
git add .
git commit -m "thinking of you timeline"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

Then in the repo: **Settings → Pages → Build from branch → `main` / root**.
