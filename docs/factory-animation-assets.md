# Original artwork factory animation

The approved reference is `assets/factory/concept-original.png`, 512 x 1024.
Its artwork, character poses, conveyor perspective, UI and framing are retained.
The redesigned Santa and straight conveyor assets from the previous revision are
no longer consumed by the scene renderer.

## Source cutouts

`src/factory-scene-layers.js` records source-pixel coordinates and silhouette
mattes. Run `node scripts/extract-factory-layers.mjs` with ImageMagick installed
to reproduce the lossless cutouts. Their color pixels come from the approved
painting, not newly generated characters. The silhouette mattes are traced paths.

All current runtime assets are under `assets/factory/original/`:

| Asset | Source and use |
| --- | --- |
| santa-back.webp | Original small, front-facing clipboard Santa |
| santa-front.webp | Original large, right-hand clipboard Santa |
| parcel-left.webp | Original cropped gift at the left conveyor edge |
| parcel-center.webp | Original small red/yellow gift |
| mystery-box.webp | Original cream mystery gift |
| floor-gift.webp | Original green gift standing in front of the machine |
| conveyor.webp | Original machine, at its original perspective |
| roller-0.webp through roller-3.webp | Original painted wheel faces |
| belt-tile.webp | Original wooden slat texture, without glowing bulbs |
| repair.webp | Generated occluded background; only visible under moving silhouettes |

## Geometry and motion

The overlay uses the same 512:1024 coordinate system as the original image.
There is no extra conveyor rotation, responsive coordinate guess, or replacement
background. Santa and gift sprites use the original crop coordinates and sizes.

Idle, reduced-motion, skipped, and completed states display the original painting
directly. Once production starts, decoded cutouts nod gently around the base;
gifts glide a few pixels along the original belt; painted roller faces turn and
exposed belt segments scroll. Characters are rigid image layers, not warped pixels.

The generated repair plate is masked to the two moving Santa silhouettes and
two conveyor gift silhouettes, with a narrow edge margin. Its newly generated UI,
background details, and any other modifications are never displayed. All motion
is clipped to source y=256..512, above the original production panel. Cleanup
prevents abandoned image loads or observers from restoring a previous scene.

## Background repair prompt

Built-in image generation tool; edit target: the approved original painting.
Remove only the two working clipboard Santas and the two conveyor gifts.
Reconstruct the occluded workbench, floor, and original wooden belt surface.
Preserve the exact original conveyor perspective, angle, wheels, dimensions,
mystery box, floor gift, lighting, UI, lettering, viewpoint, and 1:2 composition.
No replacement people, new straight conveyor, rotated objects, or reframing.

The generated repair image is reduced to 512 x 1024 for alignment and exported
as WebP. It is used only inside the restricted silhouette mask described above.

## Validation

Check original idle appearance, rigid source-sized sprites, absence of UI overlap,
CSS motion during all ten productions including the last, skip/finish restoration,
navigation cleanup, reduced motion, missing-layer fallback, and the web build.
