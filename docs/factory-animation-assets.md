# Factory production light effect

The current factory displays `assets/factory/concept-original.webp` unchanged.
Santas, conveyor, rollers, gifts and the mystery box remain still. The transient
bouncing/spinning produced-ornament overlay has also been removed; the result
dialog still opens after the existing production delay.

During production, only a warm oven light slowly brightens and dims. The glow
uses a 512:1024 source-aligned overlay restricted to the oven opening. Screen and
multiply gradients vary opacity over 1.4 seconds; no image pixels are warped and
no sprite assets or animation canvases are loaded.

`src/factory-scene.js` mounts the effect and tracks the existing producing class.
It hides immediately on skip or completion, hidden documents, reduced-motion
preferences and navigation cleanup. The daily-limit state does not suppress the
last production. Ad verification, item generation, prices and rewards are unchanged.

Historical source cutouts in `assets/factory/original/`, their coordinate manifest
and extraction script are retained as unused artwork; the current renderer does
not import or load them.

Validation: production/skip lifecycle tests, hidden/reduced-motion cleanup,
mobile browser checks for the oven-only pulse and static artwork, and web build.
