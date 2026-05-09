// file location: src/singlescroll/components/Blog.js
// Blog preview cards — each wrapped in <Card3D>.

import LayerSurface from "@/components/ui/LayerSurface";
import Card3D from "./Card3D";
import { blogPosts } from "../data/blogPosts";
import SectionHeading from "./SectionHeading";
import styles from "../styles/singlescroll.module.css";

export default function Blog() {
  return (
    <section id="blog" className={styles.section}>
      <SectionHeading
        number="10"
        eyebrow="From the Blog"
        title="Helpful guides for car buyers in Kent"
        lead="Practical, plain-English advice from the showroom floor."
      />

      <div className={styles.blogGrid}>
        {blogPosts.map((post) => (
          <div key={post.id} data-reveal>
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
    </section>
  );
}
