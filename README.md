# ✦ Penny Parlor ✦

*Start with a penny. Double it thirty times and that's ten million. Nobody's ever done it. You could be first.*

**Penny Parlor** is a small parlor of quick head-to-head games played for play money — no real money in, none out, ever. It is a loving revival of the lost games of **Moola.com** (2006–2011), an ad-funded site where every player started with one free cent and tried to double their way up by beating other players at tiny, sharp games of skill and nerve.

## The games

- **⚖️ Gold Rush** — Six nuggets, six blind bids. Each round a bonus nugget sits on the scale; the higher bid hauls in both bids plus the bonus. Ties leave the gold on the scale and it carries. A pocket-sized cousin of the game-theory classic *Goofspiel*.
- **🂡 Hi-Lo** — Call each card higher or lower. Right calls ride as an unbanked streak; wrong calls cost a life and sweep the streak away. Locking banks your cards — but costs a life too. Three lives. Most cards banked wins.
- **🥋 Ro-Sham-Bo-Fu** — The ancient art, six rounds, three points a round, pots carry on ties. Each round one hand is *forbidden*; throw anything else for bonus honor, win or lose.

## How it works

You start with **p$0.01**. Pick a table, name your stake (stakes come in doubling amounts, just like the original), and play a house regular — Rusty Pete, Madame Ruby, or Silas "Snake-Eyes," depending on how much money is on the table. Win and your stake doubles. Lose it all and you can always sweep the floor for a fresh penny.

Progress lives in your browser (localStorage): your bankroll, your high-water mark on the 30-rung doubling ladder, your rank, and your honors.

## Run it

No build step, no dependencies. Open `index.html` in a browser, or serve the folder with anything:

```
python -m http.server   # or any static server
```

## The story

The original Moola.com let you watch a short video ad for a free penny, then wager it head-to-head. Its three launch games were exactly these. The site died around 2010–2011 when cashouts stalled — which is one reason this revival keeps real money out entirely. The rules here were reconstructed from archived pages, a 2010 Stanford CS229 paper on RoShamBoFu bots, and one player's twenty-year-old memories.

---

*Play money only. Nothing to buy, nothing to cash out.*
