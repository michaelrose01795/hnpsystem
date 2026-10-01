// file location: src/singlescroll/components/Blog.js
// Blog chapter — preview cards wrapped in Card3D, routed through the
// shared SceneShell so the chapter sits inside the page's master scene
// language (huge ghost backdrop, numbered head, premium dark cards).

import LayerSurface from "@/components/ui/LayerSurface";
import Card3D from "./Card3D";
import { blogPosts } from "../data/blogPosts";
import SceneShell from "./SceneShell";
import styles from "../styles/singlescroll.module.css";

export default function Blog() {
  // Blog section: heading and introduction above a grid of blog post previews.
  return (
    <SceneShell
      id="blog"
      number="07"
      eyebrow="From the Blog"
      title="Helpful guides for car buyers in Kent"
      lead="Practical, plain-English advice from the showroom floor — written by the people who deal with these questions every day."
      backdrop="Read"
      tone="surface"
      ariaLabel="From the blog"
    >
      <div className={styles.blogGrid}>
        {blogPosts.map((post) => (
          <div key={post.id} data-reveal>
            {/* One preview card per blog post: image, date, title and a short excerpt. */}
            <Card3D intensity={0.7}>
              <LayerSurface className={styles.blogCard} padding="14px" gap="10px">
                <div className={styles.blogImageWrap}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.image}
                    alt={post.title}
                    className={styles.blogImg}
                    loading="lazy"
                  />
                </div>
                <span className={styles.blogDate}>{post.date}</span>
                <h3 className={styles.blogTitle}>{post.title}</h3>
                <p className={styles.blogExcerpt}>{post.excerpt}</p>
              </LayerSurface>
            </Card3D>
          </div>
        ))}
      </div>
    </SceneShell>
  );
}
