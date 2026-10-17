# Notes for coding agents

- Plain three.js r180, no build step. Serve the folder with `python3 tools/serve.py` (port 8123) and open `index.html`.
- **Painted look is mandatory everywhere.** Read [PAINTING.md](PAINTING.md) before adding or changing any 3D geometry, materials, paintings or `src/projection.js`. Coverage comes from painted tiles (`src/brushwork.js`); projected paintings are only a close-up bonus and must not be widened to fill areas.
- Before every commit that touches the world, run `node tools/check_paint.mjs` (and `node tools/playtest.mjs`). Both must pass.
- The game is for a 6-year-old who can't read: every line is spoken (`src/audio.js` `say()`); no music or sound effects.
- `main` is published to https://aldericcoroir.github.io/mermaid-ocean/ on every push.
