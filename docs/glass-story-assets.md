# Glass-cleaning story assets

The current v4 soap-and-squeegee assets, prompts and animation details are documented in [glass-foam-v4-assets.md](glass-foam-v4-assets.md). The earlier versions below are retained as history.

Created using the built-in image-generation tool (not the API/CLI fallback). These are illustrative visuals, not photographs of a customer job.

- `frontend/public/glass-clean-v1.webp`
- `frontend/public/glass-dirty-v1.webp`

These v1 files are retained as the previous version and are no longer used by the homepage. Both were optimized as WebP at quality 88; originals remain under the generator's output directory.

## Clean-image prompt

Photorealistic architectural photograph for a full-screen website glass-cleaning story: elegant floor-to-ceiling French glass door, viewed straight-on from a beige minimalist interior looking onto a calm green garden at Lake Constance. Large glass panes occupy most of a wide 16:9 frame, thin dark forest-green metal outer frames and one slim mullion, perfectly clean transparent glass, subtle realistic reflections, bright warm daylight. Pale limestone floor at the bottom. Level camera. No people, foreground furniture, sofa, tools, text, logos or watermarks.

## Dirty-state edit prompt

Edit only the glass surfaces in the clean original: add realistic outdoor dust, grey-beige water streaks, dried rain spotting and dull grime haze; keep the landscape visible but less clear and bright. Preserve every tree, lake, horizon, floor tile, metal frame, mullion, camera position, image dimensions and lighting direction. No new objects, people, tools, text or branding. Exact registration is required for the clip-path wipe.

## Previous rainy German street pair (v2)

Created with the built-in image-generation tool: the clean version edits the previous scene; the dirty version edits that clean result. Both are 1672 × 941, encoded as WebP at quality 90 without resizing or cropping.

- `frontend/public/glass-clean-rainy-street-v2.webp`
- `frontend/public/glass-dirty-rainy-street-v2.webp`

The scene is viewed from inside a house through a large picture window: a rainy German residential street, wet road, indoor potted plants and no visible interior floor or terrace. Only the glass dirt changes during the reveal; no CSS brightness filter is applied to the plants or exterior weather. These are generated illustrations, not customer-job photographs.

These v2 files are retained as a previous version. The current homepage uses v3 below.

### Clean edit prompt (verbatim)

Use case: precise-object-edit.
Asset type: full-screen photographic background for a website before-and-after window-cleaning scroll reveal.
Input image: edit target, existing glass window composition.
Primary request: replace the sunny garden/lake setting with a photorealistic view from inside a German home through a very large picture window onto a charming German residential street in rainy weather. Remove all indoor floor and outdoor patio from the composition; this should feel like looking through a house window, not through a door.
Scene: eye-level view from a cozy understated beige interior. Outside, a quiet southern German street with cream and muted pastel stucco houses, steep red clay-tiled roofs, wet pavement with soft realistic reflections, grey overcast sky and light rain in the air. No lake or lawn. Keep the street visible in the center so the view also works in a narrow mobile center crop.
Composition: wide landscape 16:9 frame. Large window glass fills almost the entire canvas, slim dark forest-green perimeter frame and only one slim mullion. Window sill at the very bottom edge, with two tasteful potted indoor green plants toward the lower left and lower right, a few leaves extending inwards; plants clearly indoors in front of the glass. No visible floor, no furniture, no terrace.
State: CLEAN version. Glass is exceptionally clear and freshly cleaned, with no grime, smears, condensation or water droplets on the pane. Rainy weather remains outside; the street is wet but the sheltered glass is clear. Subtle realistic interior reflections only.
Style: natural architectural interior photography, realistic leaf and plaster textures, calm premium atmosphere, cool soft daylight outside and warmer beige indoors, no bright sunlight.
Constraints: single full-bleed image, no split screen, no before/after labels, no text, no logos, no people, no tools, no watermark, level camera, keep window geometry straight. Leave the central street view spacious.

### Dirty edit prompt (verbatim)

Use case: precise-object-edit.
Asset type: DIRTY before-state of an exactly aligned website window-cleaning reveal.
Input image: edit target, CLEAN large home window looking out onto a rainy German residential street, with indoor plants.
Primary request: change ONLY the glass panes to a clearly dirty, unwashed state. Add realistic translucent grey-beige grime, dried hard-water rain spots, fine dust, a few broad dried streaks and a gently cloudy film ON THE GLASS, so the same street remains visible but noticeably less clear. Make the dirty state visibly different from the clean image without making the view opaque.
Invariants: Preserve EXACT camera position, 16:9 image dimensions and crop, all window frames and mullion coordinates, all houses and roofs, every street reflection, street lamp, tree, sky, the sill and BOTH indoor plants including every leaf and pot. Do not move, repaint, blur or dirty the plants, pots, wall, frame or sill. Keep the rainy weather and exterior lighting exactly unchanged. Do not add floor, furniture, people, tools, logos, text or watermarks. This is an image-registration task: all geometry must remain pixel-aligned with the source because a scrolling clip-path wipe will overlay the CLEAN original on this DIRTY version. Only add surface dirt to the glass.

## Previous everyday German street with traffic (v3)

Generated with the built-in image-generation tool, then encoded as WebP at quality 90 without resizing or cropping (1672 × 941). The clean image edits v2; the dirty image edits that clean image. Everyday cars, umbrella-carrying pedestrians, a bicycle, street markings and wet-road reflections become clearer through the glass wipe. The street is an ordinary German residential neighborhood, not a luxury city scene. Both indoor plants, the frame and sill remain fixed; no interior floor is visible. V1 and v2 are retained but not referenced by the homepage.

- `frontend/public/glass-clean-rainy-traffic-v3.webp`
- `frontend/public/glass-dirty-rainy-traffic-v3.webp`

### Clean edit prompt (verbatim)

Use case: precise-object-edit.
Asset type: CLEAN state of a full-screen website window-cleaning reveal.
Input image: edit target, the large home window with indoor plants and rainy German street.
Primary request: make the outside view an ordinary, lived-in German town street with everyday traffic and people walking by. NOT a fancy city, tourist destination or luxury neighborhood. Keep the large picture-window viewpoint from inside a house, both indoor potted plants and the slim dark-green window frame and center mullion. No visible indoor floor, patio or furniture.
Outside changes: replace the overly picturesque flower-filled setting with modest everyday German stucco houses and low-rise apartment buildings, simple pavements and a few street trees, practical ordinary architecture, red-brown tiled roofs. Rainy overcast weather and wet asphalt with subdued reflections. Show three everyday compact cars: one parked near the curb, one hatchback passing on the road and another farther down the street; realistic scale, wheels and perspective, no luxury cars, no legible license plates. Add four naturally proportioned adults at different distances walking along the pavement near the window; two carrying umbrellas, one wearing a raincoat and one with an ordinary shopping bag. Nobody looking at the viewer. Include a simple pedestrian-crossing sign and small ordinary street details like road markings and a bicycle locked near a railing. The street should feel gently busy and believable, not a dense city traffic jam.
Composition: same wide 16:9 canvas, level eye-height camera from indoors, window glass fills nearly the full frame, street activity in the central part of the view so it survives mobile cropping. Keep the indoor plants and their pots clearly inside at the lower edges. Window sill at bottom edge only. CLEAN clear transparent glass, no dirt, condensation or droplets on the pane. The glass reveals small crisp outdoor details: car headlights reflected on wet road, umbrella fabric, clothing and wet pavement texture.
Style: photorealistic natural architectural/lifestyle photography, soft grey rainy daylight outside, restrained warm beige indoors. No cinematic glamorous skyline or postcard street, no shop advertisements, no added text, logos, tools, watermarks or before/after split screen.
Invariants: preserve the indoor plants, pots, wall, sill and frame geometry from the input; change the exterior scene only.

### Dirty edit prompt (verbatim)

Use case: precise-object-edit.
Asset type: DIRTY starting image for an exactly registered dirty-to-clean scrolling window reveal.
Input image: edit target, the clean big house window overlooking an ordinary rainy German street with people and cars.
Primary request: add a dense, realistically neglected, cloudy grey-beige dirt film to ONLY the glass panes. Make the street scene much harder to see through the dirty glass: broad cloudy mineral deposits, old rain streaks, fine muddy dust, translucent smeared grime and water marks. The cars and pedestrians remain in EXACTLY the same places behind the glass but their fine details and the bicycle, markings and reflections should be almost lost in the haze, with only vague muted shapes visible. The clean image will reveal these details dramatically. It must read as dirty glass, not mist outdoors, and not simple overall darkness.
CRITICAL REGISTRATION: Keep the exact source 16:9 canvas dimensions and crop. Preserve every underlying building, street lamp, tree, car, wheel, pedestrian, umbrella, bicycle and road marking at identical coordinates. Do NOT replace, remove or move any object; the layer of opaque-ish glass dirt simply obscures them.
INDOOR INVARIANTS: Both foreground indoor plants, every leaf and pot, all window frames, the central mullion, interior wall and sill must remain completely sharp, clean and UNCHANGED. Dirt must stop at the glass edges and behind the foreground plants; do not haze the plants or room. No visible indoor floor. Keep the same overcast rainy exterior lighting beneath the dirt. No new people, vehicles, furniture, tools, text, logos, labels or watermark. No split screen.
