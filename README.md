# Mermaid Ocean 🧜‍♀️

A gentle 3D underwater fairy-tale adventure for young children (made for a 6-year-old), playable in a phone browser. Built with [three.js](https://threejs.org) r180, no build step.

## Play

Open `index.html` through any static web server (phones: turn sideways):

```sh
python3 -m http.server 8123   # then open http://<your-computer-ip>:8123
```

Controls: left thumb = floating joystick, drag anywhere else to look around, ⬆️/⬇️ to swim up and down, ✨ to talk (💬) or do a speed dash. Swim up fast to leap out of the water. Desktop: WASD/arrows, Q/E for down/up, mouse drag to look, Space to talk/dash.

## What's inside

- **World** (`src/world.js`): seabed with dancing caustics, kelp forest, coral reef (branch, brain, lace-fan, tube, table corals, anemones), rock arch, glowing crystal trench, light shafts, shimmering surface, marine snow, bubble vents.
- **Coralia, the mermaid city** (`src/city.js`): pearl palace with spiral shell towers, shell houses with glowing windows, coral gate, pearl lanterns, flower gardens.
- **Characters** (`src/mermaid.js`): procedural chibi mermaids & merman guards with swimming tail animation.
- **Creatures** (`src/creatures.js`): fish schools (clownfish, blue tang, sunny fish, angelfish) that scatter around you, whale, dolphins that leap, seahorses, crabs, jellyfish, sea turtle, manta rays, pufferfish that puff up, octopus.
- **Story** (`src/quests.js`): meet Queen Coralie → find 5 magic pearls (crown reward) → bring baby seahorse Lulu home → sing with the whale → light the 3 crystals in the Deep Trench → rainbow tail. A sparkle trail and floating star always show the way. Swim near any creature to add it to the friends album 📖.
- **Look** (`src/post.js`): one full-screen pass with depth of field focused on the mermaid, a Kuwahara painterly filter, soft ink edges, canvas grain and an underwater grade. Toggle in ⚙️.
- English & French (auto from the phone language), procedural sound, progress saved on the device, automatic quality drop on slow phones.

## Screenshots & painterly concept pass

`tools/shoot.mjs` renders fixed camera views with headless Chromium (`?shot=city|reef|kelp|trench|palace|mermaid|face`). Those screenshots are fed to an image model (GPT Image) to produce painterly concept frames, which guide the in-game shader and palette.

```sh
npm i -D playwright && node tools/shoot.mjs shots
```
