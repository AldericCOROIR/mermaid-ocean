# Castle district art and projection plates

The master composition is `../castle_overview_concept.png`. The two close district references use it as the visual source while focusing on the lower market and the upper palace terraces. They are planning references for the geometry, shops, streets, bridges and fountain.

## Lower market reference

**Built-in imagegen.** Prompt: Zoom into the lower half of the supplied overhead mermaid-castle concept while preserving its topology. Show the shell portal in the foreground, the dense asymmetric market on both sides of the main avenue, individual open shops and striped awnings, coral gardens, a broad staircase to the raised central shell fountain, and the higher palace beyond. Keep the original painterly fairy-tale pearl, gold, coral and turquoise style. Wide 16:9 view, no text.

Saved at `lower_market_reference.png`.

## Upper terraces reference

**Built-in imagegen.** Prompt: Zoom into the upper half of the supplied mermaid-castle concept while preserving its topology. Show the grand raised rear shell palace and its open entrance, flanking towers, two side arched high bridges, small flanking fountains, broad steps to the central fountain terrace, and lower market beyond. Keep the same rich painterly underwater fairy-tale style. Wide 16:9 view, no text.

Saved at `upper_terraces_reference.png`.

## Exact-camera paint-over plates

**Built-in imagegen style-transfer.** The first image of each call was the raw 3D screenshot from `shots/revision` and was the geometry authority; the second was the appropriate concept reference. Each prompt required the original camera, silhouette, object placement and navigable openings to remain in place. The resulting PNGs are stored in `painted/`; reduced JPEGs in `assets/paint/` are used by the game. Exact projection cameras are in `src/paintviews.js` and `shots/revision/cams.json`.

- `castle_market_v4.png`: “Paint over the lower-market screenshot in the reference’s hand-painted underwater style: nacre stone, glazed shell roofs, gold filigree, warm shop lights, coral planters, patterned cobblestone, and teal water. Preserve all pixel positions of the gate opening, shops, fountain terrace and palace. No people, lettering or UI.”
- `castle_fountain_v4.png`: “Paint over the central-fountain screenshot in the upper-terrace reference style. Preserve the shell fountain, side fountains, rear steps, side bridges, palace doorway and towers exactly. Add pearly scalloped stone, glazed roofs, gold tracery, turquoise water and coral gardens. Keep every opening clear. No people, lettering or UI.”
- `castle_palace_v4.png`: “Paint over the palace screenshot in the upper-terrace reference style. Preserve the front towers, central dome, enterable archway, two side aisles, windows, steps, podium and bridges. Add iridescent pearl stone, scallop relief, stained glass, gold tracery and sea-blue shadows. Keep the central doorway open. No characters, lettering or UI.”
- `castle_aerial_v4.png`: “Paint over the exact oblique aerial 3D screenshot using the master castle concept as a style and material reference. Keep the oval wall, front portal, lower shops, central raised fountain, side bridges, three stair routes, side houses and rear palace in precisely the screenshot’s layout. Add detailed pearl masonry, glazed roofs, corals, decorated paths, illuminated windows and blue-gold reflections. No characters, lettering or UI.”

Reproduction: run `python tools/serve.py`, then set `SHOT_QS='&clean=1&raw=1&compare=1'` and run `node tools/shoot.mjs shots/revision overview market fountain palace`. The `compare=1` flag disables depth-of-field and post-paint blur for geometry comparisons. Generate a new paint-over only after its camera and static geometry are final, then update the corresponding entry in `src/paintviews.js`.
