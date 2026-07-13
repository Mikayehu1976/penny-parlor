# Penny Parlor — developer notes

Working notes for whoever picks this up next (usually Claude in a fresh session). Read this before touching the visuals.

## Status as of 2026-07-12

All three games work end to end vs. bots, deployed to GitHub Pages. The Gold Rush canyon scene went through one screenshot-driven cleanup pass. **Jeremy has seen it and still doesn't love it** — it's structurally correct (no overlaps, readable, everything in its place) but the art doesn't yet have the charm/richness of the original. The next session on this project should expect more visual iteration, not feature work.

Likely directions for the art gap (not yet tried):

- More shape detail and shading: the original used layered rounded blobs with rim highlights everywhere; ours are still mostly single-color paths with one highlight.
- Texture and edge treatment: darker cartoon outlines on *every* object (the original outlines everything), dirt speckle, rock striations.
- Warmer, more saturated palette; original reads more red/orange, less brown.
- The mine entrance and cart deserve the most love; they're the focal point.
- Consider hand-tuning in the dev-preview loop for several rounds rather than one pass.

## The design brief (original Moola Gold Rush screenshot)

Jeremy supplied a real screenshot of the original in chat (2026-07-12; not saved to disk before the chat was cleared, so this description is the record; ask him for it again if needed — he found it via Google Images):

- Desert canyon at dusk. Sky gradient purple → red → orange. Dark maroon mesa silhouettes on the horizon. Everything flat-vector cartoon with dark outlines.
- Center: mine entrance in a big red rock mass, timbered with wooden posts and lintel, arched wooden **"Gold Rush!"** banner above, ore cart full of gold on rails at the mouth.
- One giant wooden plank scale spans the scene on a fulcrum, ends near wooden signposts reading **"You: N lbs"** and **"Them: N lbs"** (scores are pounds of gold).
- Bids shown as **"?" gold nuggets** perched on rocks flanking the mine until reveal; the round's prize nugget sits at the plank center.
- Bottom left: **leather pouch mat** with the player's nuggets 1-6 laid in depressions; spent nuggets leave empty depressions.
- Ambient props: barrel with plant, TNT crate, cow skull, orange lizard bottom-right, cacti. Top bar had player cards (avatar, name, city, join date), a Cancel button, and a sound toggle.
- Gameplay video Jeremy found (unwatched, may show animation timing): https://www.youtube.com/watch?v=NFFwG4za_eY

## The screenshot loop (do not skip this)

Never ship visual changes without looking at them. The loop:

1. `dev-preview.html` renders the Gold Rush scene in fixed states:
   - no hash → round start (full pouches, bonus with carry)
   - `#reveal` → static pose: bids 5 vs 2 sitting on the tilted plank (uses `PP.goldscene.pose()`, no animation clocks)
   - `#live` → real `playRound()` animation (combine with a virtual-time budget to catch mid-flight frames)
2. Screenshot headless:
   ```powershell
   & "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu `
     --window-size=800,540 --screenshot="out.png" --virtual-time-budget=1500 `
     "file:///e:/ClaudeCode/PennyParlor/dev-preview.html#reveal"
   ```
3. Read the PNG, critique it like a designer, fix, repeat. Several small loops beat one big rewrite.

Known gotcha: under `--virtual-time-budget`, `performance.now()` and the rAF frame clock diverge. Tweens therefore stamp their start time lazily from the frame callback's clock (see `animate()` in goldscene.js). Prefer `pose()` for stills.

## Architecture

No build step, no dependencies; plain scripts sharing the `PP` namespace, loaded in order by `index.html`:

| File | Role |
|---|---|
| `js/state.js` | bankroll (integer pennies), 30-rung doubling ladder, ranks, honors, localStorage persistence |
| `js/sound.js` | WebAudio-synthesized sfx (no audio files), mute toggle persisted |
| `js/nugget.js` | shared cartoon nugget SVG markup |
| `js/goldscene.js` | the Gold Rush canyon diorama + animation + `pose()`; all Gold Rush visuals |
| `js/bots.js` | Rusty (easy) / Ruby (medium) / Silas (sharp); bot picked by stake rung |
| `js/goldrush.js` | Gold Rush rules and round flow; delegates visuals to goldscene |
| `js/hilo.js`, `js/rsbfu.js` | the other two games (still plain-UI; want the same immersion treatment eventually) |
| `js/main.js` | lobby, stake picker, match settlement, result screen, ledger, wiring |
| `scale-lab.html` | 3-option animated design-contest page (how Jeremy picked the cartoon style); reuse the pattern for future visual decisions |
| `dev-preview.html` | screenshot harness (above) |
| `tests/smoke.js` | Node smoke test, no browser needed: `node tests/smoke.js` |

## Testing

`node tests/smoke.js` — stubs the DOM, loads every script, plays hundreds of full matches of all three games through the same entry points the UI uses, checks money math, honors, and bot-balance win rates. Run it after any change to game logic or the scene APIs. All checks passed at last commit.

Game-balance notes: bots must stay ordered easy < medium < sharp. Silas's Gold Rush strategy is deliberately a disciplined prize-matcher; a pure prize-plus-one bidder was exploitable by always-bid-ascending (70% player win rate, now ~49%).

## Rules references (recovered originals)

- Archived Wikipedia mirror: https://en-academic.com/dic.nsf/enwiki/11764421
- Stanford CS229 2010 paper on RoShamBoFu bots: https://cs229.stanford.edu/proj2010/Marple-AutomatedAgentfortheGameRoShamBoFu.pdf
- Tie handling in Gold Rush (both bids lost, bonus carries) is our design call, not documented Moola behavior.

## Deploy

Push to `main` → GitHub Pages redeploys https://mikayehu1976.github.io/penny-parlor/ in ~1 minute. Repo: https://github.com/Mikayehu1976/penny-parlor.

## Backlog

1. Make Jeremy love the Gold Rush scene (see art directions above).
2. Same immersion treatment for Hi-Lo and Ro-Sham-Bo-Fu (scene concepts TBD; run a scale-lab-style contest for each).
3. Human-vs-human multiplayer (Cloudflare Workers is the sketched path).
4. Nostalgia launch post once it's something to show off.
5. Custom domain, sounds polish, timing-feel tuning.
