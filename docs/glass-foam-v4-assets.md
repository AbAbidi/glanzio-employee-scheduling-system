# Current foaming picture-window demonstration (v4)

The v4 clean/foam photographs and runoff remain unchanged. The original full-height SVG wipe described below has been superseded by the realistic partial diagonal pull documented in [glass-squeegee-v5-assets.md](glass-squeegee-v5-assets.md).

Created with the built-in image-generation tool (not API/CLI fallback), then encoded as WebP at quality 90 without resizing or cropping. Both assets are 1672 × 941:

- `frontend/public/glass-clean-windowsill-v4.webp`
- `frontend/public/glass-foam-windowsill-v4.webp`

The clean image edits v3 to add a recessed single-pane window and deep sill with indoor plants. The soap edit uses that result as its edit target and the user's photograph only as a reference for fresh bubbles and cleaner. Older v1–v3 assets are retained but not referenced by the homepage.

The glass opening is approximately (140,82)–(1544,804) in the source. `fitGlassPane` maps that region into object-fit-cover coordinates and clips it to the visible viewport. Only the pane receives the soap overlay. A native SVG metal-and-green-grip squeegee follows the exact same scroll progress as the foam clipping edge; the plants, frame and sill remain outside the wipe. CSS rivulets and foam beads flow downward only while the section is visible. Scrolling backwards restores the product. Reduced motion displays the clear image without drips or a moving tool.

These are illustrative generated visuals, not customer-job photographs. The squeegee and dynamic runoff are code-native animation, not extra generated raster assets.

## Clean edit prompt (verbatim)

Use case: precise-object-edit.
Asset type: CLEAN architectural photograph for a website scroll-controlled window-cleaning demonstration.
Input image: edit target, the existing rainy ordinary German street seen through a house window.
Primary request: keep this ordinary rainy German street, everyday cars, pedestrians, umbrellas and bicycle, but adjust the INTERIOR WINDOW to feel like a real house picture-window with a proper deep windowsill for indoor plants, not a floor-to-ceiling door.
Composition: same wide 16:9 canvas, straight-on level eye-height camera from inside the house, pulled back slightly. Create one single large uninterrupted rectangular glass pane, with NO central mullion. The glass rectangle is approximately x=8% to 92% of the image width and y=8% to 78% of image height. Straight slim dark forest-green frame around that rectangle, recessed into warm beige plaster. A substantial pale oak or limestone windowsill spans below the entire window, clearly showing its horizontal top surface and front thickness in the bottom 20% of the image. No floor, balcony, patio or extra furniture. Two healthy modest-sized potted indoor plants rest on that sill at the extreme left and right; their pots and leaves should mostly remain below or outside the main glass rectangle so a cleaning demonstration can pass over the glass without touching plants.
Exterior: preserve the same ordinary German residential street, wet asphalt, compact cars and walking people, modest buildings, grey rainy weather and soft reflections. Reframe it naturally within the window; no luxury city, tourist street or glamorous skyline.
State: freshly cleaned clear glass, no dirt, no foam, no cleaner residue, no squeegee and no hands in this version. Natural slight reflections only.
Style: photorealistic architectural interior photograph, warm beige and muted oak indoors, cool overcast daylight outdoors. Keep central street activity visible in the middle for mobile cropping.
Constraints: one image, no text, logo, watermark or before/after split. Straight rectangular opening, no tilted camera, no floor visible.

## Soap edit prompt (verbatim)

Use case: precise-object-edit.
Asset type: SOAPED glass state for a website squeegee-cleaning animation.
Input image 1: edit target, clean picture window overlooking an ordinary rainy German street.
Input image 2: reference only for cleaning-liquid foam, bubbles and suds on glass; do not copy the person, tool, outdoor building or sunny weather.
Primary request: cover ONLY the glass pane of image 1 with freshly applied professional window-cleaning solution: lots of luminous white soap bubbles of varied sizes, small translucent circular foam clusters, wet watery cleaning-product film, irregular milky lather and long fresh clear/white drips running downward. It should look visibly soapy, like the reference, NOT dirty, muddy, dusty, brown or neglected. Keep enough translucency that the rainy street and traffic can still be faintly seen through the soap. More lather near the upper and middle glass, vertical rivulets draining down the pane.
Critical invariants: preserve the exact 1672x941 canvas, crop, window-opening rectangle, every frame edge, sill, interior wall, both indoor plants and every exterior car, pedestrian, building, tree and reflection at identical coordinates. Do not blur or soap the plants, pots, frame, sill or wall. No central mullion. No new objects.
No human hand, cleaner, cloth or squeegee in the generated image; the squeegee will be animated separately in code. No text, logo, watermark or before/after split. Change only the glass surface. Exact alignment with the clean image is essential.

