// file location: src/singlescroll/state/timelineProgress.js
// Tiny module-level signal that lets TimelineHistory tell the persistent
// background <Website3DScene/> how far the visitor has scrolled through
// the Our Story timeline. Kept as a plain ref-like getter rather than
// React state so the canvas can read it inside useFrame without
// triggering re-renders.

let progress = 0;

export function setTimelineProgress(p) {
  progress = p;
}

export function getTimelineProgress() {
  return progress;
}
