# Layered exterior glass and collected liquid (v7)

**Historical experiment, not active.** At the user's request, the homepage now restores only the original v4 foamy-window photograph and the simple black v6 tool with its small photographic foam edge. The dense alpha overlay and all glass-fluid/WebGL canvas effects have been removed from the page. Source/assets below are retained for provenance, not imported or loaded by the homepage.

## Video finding

Reviewed the user's 26-second recording `Glanzio Reinigung _ Gebäudereinigung am Bodensee - Google Chrome 2026-10-25 00-41-52.mp4`. The v6 tool was composited in front of an opaque street/foam photograph, exposing its handle and black rubber regardless of soap. Repeating stretched white CSS streams looked decorative rather than like runoff collected during wiping.

## Implementation

- The existing rainy-street/windowsill photograph is unchanged. The original full-window foamy photograph `glass-foam-windowsill-v4.webp` is restored as the backing, registered to the street with the same cover geometry. A dense, visible alpha lather overlay covers the entire pane at 95% opacity, so the window shows white foam, not just clear water droplets. Both share the exact same wipe mask: only the region actually swept by the blade is removed. Water droplets are an additional effect, not a replacement for the full pane of lather.
- New material: `frontend/public/glass-soap-alpha-v7.webp`, 1672 × 941 RGBA, WebP quality 94. Generated using built-in imagegen, not CLI fallback, then encoded without cropping/resizing and with alpha preserved.
- Original: `C:/Users/lenovo/.codex/generated_images/019f9692-a076-7db3-bffb-b973956c139d/exec-e8eb214d-6f71-4d12-b1a7-65d4bb29ed37.png`.
- The photographic v6 tool sits **behind** the full-window soap layers. A 73° X-axis perspective tilt foreshortens its handle away from the observer. The foam bank sits in front of the rubber; the window reflection remains in front of both. The visible alpha lather image is also used as the GPU liquid material; it supplements rather than replaces the original foamy photograph.
- The new `glass-fluid.ts` WebGL renderer shades a liquid height field with surface normals, directional highlights, microtexture and refraction sampled from the correctly registered street photograph. This is a depth-shaded compositing effect, not a full 3D tool mesh or a Navier–Stokes fluid solver.
- Forward blade travel adds gathered liquid and emits at most eight small drops. Drops fall with gravity, drain after a bounded lifetime, and do not endlessly repeat while idle. Reverse scrubbing clears old runoff. The physics state has no random inputs.
- The tool, wipe mask and liquid bank commit the same smoothed scroll progress in the same animation frame. Smoothing uses elapsed time, not a fixed number of frames.
- GPU work is scissored to the small blade/drop bounding rectangle; idle physics updates run at about 30fps. Pixel density is capped. All loops pause when offscreen/hidden. Resources are released on unmount.
- Reduced motion keeps the static clear-window fallback. Unsupported/lost WebGL uses the functional layered scroll wipe without the fluid canvas. No errors are suppressed.
- The existing nine subtle stationary glass runoff streaks remain; the six v6 looping blade streams are removed.

## Verification

`npm run test:glass` covers geometry, idle/no-loop behavior, accumulation, gravity/drainage, reverse scrub, bounded drop count and determinism. Browser checks cover desktop/mobile layering, perspective, registered blade/foam position, WebGL rendering, no-WebGL fallback, reduced motion, hydration and normal homepage scrolling. Build/rendered-HTML checks remain in place.

## Final imagegen prompt

Use case: photorealistic-natural.
Asset type: isolated soap/foam material alpha overlay for a physically layered window-cleaning web animation, NOT a complete scene.
Subject: freshly applied real white window-cleaning lather on a flat pane viewed straight-on. Dense irregular swathes of tiny wet microbubbles, many clustered small bubbles, some delicate translucent soap membranes, irregular thinning patches and short vertical gravity runs. Soft cloudy white foam covers most of the area, with smaller uneven thin transparent channels; no large central clear hole or pre-wiped stroke. Photographic fine texture, slightly cool neutral white, natural diffuse rainy-day light, subtle silver wet specular highlights.
Composition: landscape 16:9 rectangular sheet of soap texture filling the full canvas to all edges. Foam surface is optically flat and perpendicular to camera, not a pile of shaving cream. The clear spaces and translucent liquid between the foam clusters must be genuinely transparent alpha, so a different street photograph and a squeegee can later be seen BEHIND it. Opaque white bubble clusters alternate with semi-transparent thin soap and fully transparent pinholes. Texture only.
Constraints: real transparent background. No street, sky, room, scenery, glass frame, plants, person, tool, hand, typography, watermarks, baked black/white/checkerboard background or lighting vignette. No large spherical decorative bubbles. No illustration, no flat dots.
