# Realistic diagonal squeegee (v5)

Superseded by the contact-side foamy tool and blade runoff in `glass-squeegee-v6-assets.md`. This file preserves the original v5 asset provenance.

Generated using the built-in image-generation tool, with a genuinely transparent background. Encoded as WebP at quality 94 with the source alpha preserved, without cropping or resizing.

- Final asset: `frontend/public/window-squeegee-real-v5.webp`
- Dimensions: 1254 × 1254, RGBA.
- Rubber contact edge: source x=27…1226, y=383; anchor (626.5,383).

The v4 foam and clean window images are unchanged. Their existing downward runoff is unchanged. The flat full-height SVG tool and animated edge dots have been removed.

The photographic metal/rubber tool is rotated -24° with its transform origin on the rubber contact edge. Its image is reflected vertically around that exact contact edge so the handle extends upward, suggesting a cleaner working on the exterior side. The pane clips the raised handle behind the photographed frame, with a subtle stationary glass reflection in front and only a small contact shadow (no large indoor cast shadow). The tool is visible at zero progress and moves immediately with scrolling, fading out only near the end.

A direct scroll-controlled pull runs perpendicular to the blade, from near the upper glass edge toward the lower-right. The same geometry produces an even-odd polygon hole in the foam layer, so the clear track stays exactly behind the rubber lip. Blade width is bounded by 52% of visible pane width and 62% of its height. The completed track leaves foam around a broad central strip, not a fully cleared window. The remaining foam keeps dripping while the section is visible, without decorative moving beads.

Desktop/mobile cover geometry uses `fitGlassPane`; `diagonalGlassStroke` keeps the blade ends and trail within the pane. Reverse scrolling scrubs the same geometry without random changes. Reduced motion retains the static clear-window fallback, with no moving tool or runoff.

## Generation prompt (verbatim)

Use case: product-mockup.
Asset type: photorealistic transparent-background cutout of a professional window-cleaning squeegee, for a website 3D-looking scroll animation.
Subject: one clearly recognizable high-quality real window squeegee. Wide straight horizontal brushed stainless-steel T-bar head, crisp continuous black rubber wiping lip along its LOWER edge, visible metal thickness, clips and screws. Central metal yoke attaches to a short substantial dark forest-green and black textured ergonomic handle extending straight DOWN toward the bottom of the image.
Composition: square canvas, full tool completely visible, no cropped ends. Head spans about 84% of canvas width from x=8% to x=92%; the lower straight rubber CONTACT EDGE sits around y=28% of canvas height. Handle is centered, ending around y=90%. Blade is horizontal, not diagonal, so code can rotate the entire asset. Camera nearly perpendicular to the tool face, with subtle three-dimensional depth so the metal channel, rubber lip and handle grip visibly have real volume. Do not foreshorten or bend the straight blade.
Style: convincing close-up studio product photograph, NOT an icon, vector drawing or flat illustration. Real brushed metal, tiny reflections, soft directional upper-left light, realistic rubber texture and gentle specular highlights.
Background: genuinely transparent alpha. No scenery, window, foam, bubbles, droplets, tabletop, floor, person, hand or arm. No floating decorative dots, branding, text, watermark or cast shadow on an opaque backdrop. The only object is the real squeegee.

