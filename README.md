# Mermaid Ocean 🧜‍♀️

A gentle 3D underwater fairy-tale adventure for young children (made for a 6-year-old), playable in a phone browser. Built with [three.js](https://threejs.org) r180, no build step.

## Play

**Play online:** https://aldericcoroir.github.io/mermaid-ocean/ (always the latest version on `main`, rebuilt by GitHub Pages on every push).

Or run it locally:

Open `index.html` through any static web server:

```sh
python3 -m http.server 8123   # then open http://<your-computer-ip>:8123
```

On Windows, use `python tools/serve.py` so JavaScript modules get the correct
MIME type. That helper binds to localhost; use a server bound to your LAN
address when testing from a separate phone.

Controls: left thumb = floating joystick, drag anywhere else to look around, ⬆️/⬇️ to swim up and down, ✨ to talk (💬) or do a speed dash. Swim up fast to leap out of the water. Desktop: WASD/arrows, Q/E for down/up, mouse drag to look, Space to talk/dash.

## What's inside

- **World** (`src/world.js`): seabed with dancing caustics, kelp forest, coral reef (branch, brain, lace-fan, tube, table corals, anemones), rock arch, glowing crystal trench, light shafts, shimmering surface, marine snow, bubble vents.
- **Coralia, the mermaid castle** (`src/city.js`): a wide walled district with an open gate, nine outer watchtowers, a market and inner court, gardens, shell homes, a fountain, and a palace with an enterable throne hall, library aisle, and music gallery. The queen now waits inside. Mermaids tend the stalls and gardens, browse the library, and gather around the court; seahorses and fish swim through the district.
- **Characters** (`src/mermaid.js`): procedural chibi mermaids & merman guards with swimming tail animation.
- **Creatures** (`src/creatures.js`): fish schools (clownfish, blue tang, sunny fish, angelfish) that scatter around you, whale, dolphins that leap, seahorses, crabs, jellyfish, sea turtle, manta rays, pufferfish that puff up, octopus.
- **Story** (`src/quests.js`): meet Queen Coralie → find 5 magic pearls (crown reward) → bring baby seahorse Lulu home → sing with the whale → light the 3 crystals in the Deep Trench → rainbow tail. A sparkle trail and floating star always show the way. Swim near any creature to add it to the friends album 📖.
- **Look** (`src/post.js`): one full-screen pass with depth of field focused on the mermaid, a Kuwahara painterly filter, soft ink edges, canvas grain and an underwater grade. Toggle in ⚙️.
- **Voice** (`src/audio.js`): every line, new goal, pearl and new friend is read aloud by the browser's speech voice (pitch per character) so children who can't read yet can follow the quest; tap the ⭐ quest pill to hear the goal again. No music or sound effects.
- English & French (auto from the phone language), progress saved on the device, automatic quality drop on slow phones.

## Painted look

Two layers make the 3D world look hand-painted:

1. **Painted surfaces** (`src/brushwork.js`): seamless painted tiles in `assets/swatch/` (sand, rock, coral, kelp, shell, brush strokes, generated with Codex/GPT Image from the concept frames) are laid on every object with triplanar mapping and tinted by the object's colour. Moving creatures carry their strokes with them.
2. **Projected paintings** (`src/projection.js`): following the r/aigamedev "paint over the blocks, project it back" process: clean plates of the plain world (`plates/`, `?shot=NAME&clean=1&raw=1`) were painted over by Codex (`painted/plate_*.png`), aligned to the plate (`painted/aligned_*.png`) and projected back from the exact same camera (`src/paintviews.js`). The rebuilt castle has five new plates for the gate, palace, throne hall, library and music gallery; their sources, cameras and prompts are in `painted/castle_*_v2.png`, `painted/castle_cams.json` and `painted/castle_prompts.md`. They show near the spot each one was painted from.

Rebuild helpers: `tools/make_paintviews.py` (plates/cams.json + paintings → `src/paintviews.js` and `assets/paint/`), `tools/make_swatches.py` (paintings → seamless tiles and `src/swatches.js`).

## Screenshots & painterly concept pass

`tools/shoot.mjs` renders fixed camera views with headless Chromium (`?shot=city|reef|kelp|trench|palace|mermaid|face`). Those screenshots are fed to an image model (GPT Image) to produce painterly concept frames, which guide the in-game shader and palette.

```sh
npm i -D playwright && node tools/shoot.mjs shots
```

The castle views are `city`, `palace`, `court`, `hall`, `library`, and
`music`. Run `node tools/castle_playtest.mjs` with the server on port 8123 to
check that the gate, palace, side rooms, market, and garden are reachable at
swimming height. On Windows, set `CHROME_PATH` to the installed Chrome or Edge
executable to use its browser without downloading Playwright's Chromium.
