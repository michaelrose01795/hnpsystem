// file location: src/singlescroll/components/ParallaxLayer.js
// Thin wrapper that marks a node for parallax. The actual GSAP wiring is in
// useScrollAnimations — this component just sets the data attributes.

export default function ParallaxLayer({
  speed = -15,
  children,
  className = "",
  style,
  as: Component = "div",
}) {
  return (
    <Component
      className={className}
      style={style}
      data-parallax={speed}
    >
      {children}
    </Component>
  );
}
