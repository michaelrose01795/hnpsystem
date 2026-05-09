// file location: src/singlescroll/components/ReviewsSection.js
// Customer testimonials — 10 cards in a 3D parallax wall, plus the
// platform-rating strip. Acts as a "scene section" with subtle backdrop
// glow so the persistent 3D canvas can punch through.

import LayerSurface from "@/components/ui/LayerSurface";
import Card3D from "./Card3D";
import { reviews } from "../data/reviews";
import { siteContent } from "../data/siteContent";
import SectionHeading from "./SectionHeading";
import styles from "../styles/singlescroll.module.css";

const Stars = ({ count }) => (
  <span className={styles.reviewStars} aria-label={`${count} out of 5 stars`}>
    {Array.from({ length: 5 }).map((_, i) => (
      <span key={i} className={i < count ? styles.reviewStarOn : styles.reviewStarOff}>★</span>
    ))}
  </span>
);

export default function ReviewsSection() {
  return (
    <section id="reviews" className={`${styles.section} ${styles.reviewsSection}`} aria-label="Customer reviews">
      <SectionHeading
        number="09"
        eyebrow="What customers say"
        title="The reviews speak for us"
        lead="Across AutoTrader, JudgeService, Google and Trustpilot — 4.7 average. Below, in customers' own words."
      />

      <div className={styles.ratingsRow} data-reveal>
        {siteContent.ratings.map((r) => (
          <div key={r.source} className={styles.ratingChip}>
            <span className={styles.ratingScore}>{r.score}</span>
            <span className={styles.ratingSource}>{r.source}</span>
          </div>
        ))}
      </div>

      <div className={styles.reviewsGrid}>
        {reviews.map((review) => (
          <div key={review.id} data-reveal>
            <Card3D intensity={0.6}>
              <LayerSurface className={styles.reviewCard} padding="24px">
                <Stars count={review.rating} />
                <p className={styles.reviewQuote}>&ldquo;{review.quote}&rdquo;</p>
                <div className={styles.reviewMeta}>
                  <span className={styles.reviewName}>{review.name}</span>
                  <span className={styles.reviewSource}>{review.source} &middot; {review.date}</span>
                </div>
              </LayerSurface>
            </Card3D>
          </div>
        ))}
      </div>
    </section>
  );
}
