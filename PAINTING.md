# Painterly asset workflow

Mermaid Ocean must look hand-painted from **every** angle, not only from the
spots a painting was made from. Two layers do that, and they have different jobs:

| Layer | File | Job | Where it shows |
|---|---|---|---|
| Painted surfaces | `src/brushwork.js` | Base look of every surface: a painted tile (sand, rock, coral, kelp, shell) plus the shared brush-stroke tile, laid on with triplanar mapping | Everywhere, always |
| Projected paintings | `src/projection.js` | Bonus detail near a painted viewpoint (the r/aigamedev "paint over the blocks, project it back" process) | Only within ~30-90 units of the camera the painting was made from |

**Projected paintings never carry coverage.** Seen from the side, a projection
smears, stretches and leaves holes the shape of whatever blocked the painter's
camera. Do not widen the projection fades in `src/projection.js` (camera
distance 30-90, depth 90-160, occlusion `ls * 1.02 + 0.4`) to "fill" an area:
make or assign a painted tile instead.

## Adding a new building, prop or district

1. Build meshes with `paintMat()` from `src/geom.js` (or any Lambert/Standard/Phong/Basic material). They are painted automatically, including meshes added later (the game re-sweeps the scene every second).
2. Pick the tile: use a `withCaustics(mat, s, 'city')`-style key listed in `KINDS` in `src/brushwork.js`, or set `material.userData.paintTile = 'shell'`. With neither, the surface gets the neutral brush tile, which is painted but plain.
3. Need a new surface look (marble, gold, glass...)? Make a tile:
   - generate a flat, straight-on, seamless square texture in the game's style (Codex/GPT Image, using `painted/aligned_*.png` or `painted/castle_*_v4.png` as style references; no perspective, objects or text);
   - run `python3 tools/make_swatches.py assets/swatch NAME=path/to/tile.png` (makes it seamless, records its average colour and stroke contrast in `src/swatches.js`);
   - add it to `KINDS` or use `userData.paintTile = 'NAME'`.
4. Only things that must not be painted (glows, light shafts, particles, UI) may opt out, with a reason: `material.userData.noPaint = 'glow sprite'`.
5. Optional: a projected painting for a hero view: `?shot=NAME&clean=1&raw=1` plate, paint it over, align it (see `tools/make_paintviews.py`), add it to `src/paintviews.js`.
6. **Run the check before committing:**

   ```sh
   python3 tools/serve.py &        # or: python3 -m http.server 8123
   node tools/check_paint.mjs      # fails if any visible surface is unpainted
   ```

   Add a shot preset for any new area in `SHOTS` (`src/main.js`) and to `SPOTS` in `tools/check_paint.mjs`, then look at `node tools/shoot.mjs shots NAME` from an angle that is **not** one of the painted viewpoints.

The same check runs on GitHub for every push (`.github/workflows/paint-check.yml`); a red check means something shipped unpainted.
