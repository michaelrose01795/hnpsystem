// file location: src/features/website/components/Stars.js
//
// Five-star rating row (custglobal.css .ws-stars). A fractional rating rounds
// to the nearest whole star; the exact figure is in the accessible label.

export default function Stars({ rating }) {
  const value = Number(rating) || 0;
  const filled = Math.round(Math.min(Math.max(value, 0), 5));
  return (
    <span className="ws-stars" role="img" aria-label={`${value} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < filled ? "ws-star ws-star--on" : "ws-star"} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}
