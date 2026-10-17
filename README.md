# Mermaid Ocean 🧜‍♀️

A gentle 3D underwater fairy-tale adventure for young children (made for a 6-year-old), playable in a phone browser or an offline Android app. Built with [three.js](https://threejs.org) r180. The browser game still runs without a build step.

## Play

**Play online:** https://aldericcoroir.github.io/mermaid-ocean/ (always the latest version on `main`, rebuilt by GitHub Pages on every push).

**Offline (plane, no signal):** open the link once with internet and wait for the title screen; the whole game is then saved on the phone. Add it to the home screen (Chrome menu ⋮ → *Add to home screen* / *Install app*; iPhone Safari Share → *Add to Home Screen*) and it opens with no network.

Or run it locally:

Open `index.html` through any static web server:

```sh
python3 -m http.server 8123   # then open http://<your-computer-ip>:8123
```

On Windows, use `python tools/serve.py` so JavaScript modules get the correct
MIME type. That helper binds to localhost; use a server bound to your LAN
address when testing from a separate phone.

Controls: left thumb = floating joystick, drag anywhere else to look around, ⬆️/⬇️ to swim up and down, ✨ to talk (💬) or do a speed dash. Swim up fast to leap out of the water. Desktop: WASD/arrows, Q/E for down/up, mouse drag to look, Space to talk/dash.

### Offline on Android

The installable Android app includes the entire game, French character clips, and the small French Vosk speech model. It does not need a separate phone download while playing. Install the APK once, then it can open in airplane mode. On starting a game, the app checks whether the phone can load the offline speech model. A microphone button appears near a character after their normal dialogue if it can; hold it, speak French, and release. The app asks for microphone permission when the button is first used. If microphone access or the model is unavailable, the mic button stays hidden and the normal tap controls and voice output continue to work. Speech is optional: quests and cosmetics progress through movement and the existing action button, with no spoken answer required. No recording or transcript is saved or uploaded.

To build a debug APK on Windows with the Android SDK and JDK installed:

```powershell
npm install
npm run build:apk
```

`build:apk` downloads the [Apache-2.0 Vosk French model](https://alphacephei.com/vosk/models) and, if needed, a Java 21 build runtime **on the development PC at build time**. It packs the speech model into the APK. It does not ask the phone to install a separate model. The APK is at `android/app/build/outputs/apk/debug/app-debug.apk`. Install it on the phone, allow app installation from the chosen file source, and launch normally. The app requests microphone permission only after holding 🎤. Declining permission leaves silent play available. Real microphone accuracy must be tested with the child's voice on the phone in airplane mode.

The GitHub Pages browser version also installs a service worker after its first full online visit. After the cache finishes installing, the installed page and its paintings and French audio can reopen offline. Browser speech recognition is deliberately disabled because Android browsers may send speech to a network service; push-to-talk requires the Android app. Browser speech output still uses the phone's existing speech voice if a bundled clip cannot play. Browser offline storage can be cleared by the system, so use the APK for reliable offline play.

## What's inside

- **World** (`src/world.js`): seabed with dancing caustics, kelp forest, coral reef (branch, brain, lace-fan, tube, table corals, anemones), rock arch, glowing crystal trench, light shafts, shimmering surface, marine snow, bubble vents.
- **Coralia, the mermaid castle** (`src/city.js`): a large oval walled city with a walk-through shell portal, thirteen outer shell towers, eighteen shell homes, sixteen striped open-front shops, lower market lanes, a raised pearl-fountain court, four stair routes, a higher palace terrace, two raised side bridges, and an enterable throne hall with library and music aisles. The fountains have moving water and ripples. The broad steps carry the player up during normal forward swimming.
- **Characters** (`src/mermaid.js`): procedural chibi mermaids & merman guards with swimming tail animation.
- **Creatures** (`src/creatures.js`): fish schools (clownfish, blue tang, sunny fish, angelfish) that scatter around you, whale, dolphins that leap, seahorses, crabs, jellyfish, sea turtle, manta rays, pufferfish that puff up, octopus.
- **Story** (`src/quests.js`): meet Queen Coralie → find 5 magic pearls (crown reward) → bring baby seahorse Lulu home → sing with the whale → light the 3 crystals in the Deep Trench → rainbow tail. More than sixty named friends across the castle, sea, bay and islands turn toward the player and tell short stories. Optional quests in every district reward wardrobe treasures. The 👗 wardrobe previews and equips earned cosmetics and saves them on the device. A sparkle trail and floating star guide the main story.
- **Look** (`src/post.js`): one full-screen pass with depth of field focused on the mermaid, a Kuwahara painterly filter, soft ink edges, canvas grain and an underwater grade. Toggle in ⚙️.
- **Voice** (`src/audio.js`, `src/voice-dialogue.js`): the original phone voice is the default. In ⚙️ Settings, **Voice: phone (original)** / **Voix : téléphone (ancienne)** switches to the browser's speech voice; the same button can switch back to the bundled character recordings. The choice is saved on each phone. Tap the ⭐ quest pill to hear the goal again. No music or sound effects.
- English & French (auto from the phone language), progress saved on the device, automatic quality drop on slow phones.

## Painted look

See [PAINTING.md](PAINTING.md) for the asset workflow and the `tools/check_paint.mjs` coverage check (also run on every push).

Two layers make the 3D world look hand-painted:

1. **Painted surfaces** (`src/brushwork.js`): seamless painted tiles in `assets/swatch/` (sand, rock, coral, kelp, shell, brush strokes, generated with Codex/GPT Image from the concept frames) are laid on every object with triplanar mapping and tinted by the object's colour. Moving creatures carry their strokes with them.
2. **Projected paintings** (`src/projection.js`): following the "paint over the blocks, project it back" process: clean camera plates of the plain 3D world were painted with the [district references and prompts](painted/districts/prompts.md), then projected back from those exact cameras (`src/paintviews.js`). Four v4 paintings cover the aerial, lower market, fountain court and palace. Three v2 paintings still cover the throne hall, library and music gallery. They show only near the camera each one was painted from; everywhere else the painted surface tiles carry the look. The repeatable no-blur comparison is `?shot=overview&compare=1`.

Rebuild helpers: `tools/make_paintviews.py` (plates/cams.json + paintings → `src/paintviews.js` and `assets/paint/`), `tools/make_swatches.py` (paintings → seamless tiles and `src/swatches.js`).

## Screenshots & painterly concept pass

`tools/shoot.mjs` renders fixed camera views with headless Chromium (`?shot=overview|market|fountain|palace|westbridge|eastbridge`). `compare=1` disables depth-of-field and post-paint blur while keeping the geometry and projected colors. `clean=1&raw=1` produces a plain block plate for imagegen paint-over.

```sh
npm i -D playwright && node tools/shoot.mjs shots
```

Run `node tools/castle_playtest.mjs` with the server on port 8123 to check routes
from the gate to the market, fountain, both bridges, garden and palace rooms.
`node tools/check_revision.mjs` checks the mobile wardrobe, cosmetic reward,
save persistence and terrace heights. On Windows, set `CHROME_PATH` to the
installed Chrome or Edge executable to use its browser without downloading
Playwright's Chromium.

Compare the [overhead concept](painted/castle_overview_concept.png) with the
[current in-game no-blur overhead capture](painted/castle_game_overview_v4.png).
The camera is repeatable with `?shot=overview&compare=1` on the local or hosted game.

## Voice assets and credits

The French character audio is generated at development time with the [Piper MLS French model](https://huggingface.co/rhasspy/piper-voices/blob/main/fr/fr_FR/mls/medium/MODEL_CARD), trained from the [Multilingual LibriSpeech dataset](http://openslr.org/94/) under CC BY 4.0. Each character is assigned a different model speaker. The Piper runtime and voice model are not installed on the phone; only the compressed clips are shipped. The Android recognizer uses [Vosk](https://github.com/alphacep/vosk-api) and its [small French 0.22 model](https://alphacephei.com/vosk/models), both under Apache 2.0. The JavaScript game uses [Capacitor](https://capacitorjs.com/docs) to package its local files. The generated dialogue is fixed in `src/voice-dialogue.js` and can be reviewed before playing.
