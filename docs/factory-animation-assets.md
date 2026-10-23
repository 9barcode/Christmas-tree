# Layered factory animation

The production scene uses independent transparent sprites and CSS animations.
There is no scanline warp, image-patch displacement, or per-frame canvas copy.

## Assets

All three source illustrations were generated with the built-in image generation
tool using `assets/factory/concept-original.png` as the reference. Generated alpha
is preserved. WebP export, transparent-margin trimming, and the two belt component
crops are mechanical asset preparation; they do not redraw the illustrations.

| File under assets/factory | Purpose |
| --- | --- |
| workshop-layered.webp | Clean background without working Santas, conveyor, or conveyor gifts |
| santa-worker.webp | Complete clipboard Santa, reused at two sizes |
| conveyor-frame.webp | Independent wooden conveyor with brass rollers |
| conveyor-slat.webp | Repeatable surface tile cropped from the generated conveyor |
| conveyor-roller.webp | Roller face cropped from the generated conveyor |

The original painting remains the loading/error fallback. The clean background
and all sprites appear together only after their images decode successfully.
The existing production and overtime controls remain interactive HTML.

## Generation prompts

Background (precise-object-edit): use the original portrait workshop as the edit
target. Remove only both working clipboard Santas, diagonal conveyor and rollers,
and small conveyor gifts. Reconstruct the empty warm wooden workbench and floor.
Keep the large cream mystery present, oven, window, wreath, lighting, viewpoint,
painted style, and all UI panels and Korean lettering in their original positions.
No new props, people, crop, or reframing.

Santa (stylized-concept/background-extraction): use the original lower-right Santa
as the character and style reference. One isolated chubby clipboard Santa with
rosy cheeks, red nose, floppy red hat, cream fur cuffs, and a complete upper body
ending at a rounded coat hem. Same warm amber painted storybook style and slight
left-facing three-quarter view. Both hands and clipboard complete. Stable neutral
working pose, clean actual alpha, no background, ground, text, UI, or extra props.

Conveyor (stylized-concept): one isolated horizontal conveyor on actual alpha,
slightly viewed from above, with honey-colored wooden slats, dark brown side frame,
four round brass roller faces, and rounded end caps. Match the warm painted toy
workshop. No diagonal tilt or vanishing point; orientation is applied in CSS.
No gifts, people, floor, room, labels, or text.

## Motion and lifecycle

- Production starts after the existing ad/server completion flow. No economy or
  advertisement verification behavior changes.
- Santas rock gently around the lower torso over 1.65/1.9 seconds, out of phase.
  The intact sprite moves as one rigid layer; its face and hands never stretch.
- The belt surface repeats continuously in one direction. Roller faces turn in
  the same direction, and two existing gift thumbnails travel along the belt.
- Idle, skipped, finished, background, and reduced-motion states pause animation.
  The final daily production still animates even when the limit is reached.
- Renderer cleanup disconnects observers/listeners and prevents late image
  loading from reattaching a scene after navigation.

Validation: image availability/alpha, mobile layout and animation frames, final
production, skip, navigation, reduced motion, loading failures, and web build.
