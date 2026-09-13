// file location: src/features/website/showcase/sections/HelpShowcase.js
//
// /website/dev — @family help: the Help & Advice cards and the More info popup.
// Markup mirrors the blog renderer in src/features/website/WebsitePage.js and
// src/features/website/components/HelpArticleModal.js. The popup is rendered
// static inside a Stage — the real component locks page scroll and grabs focus
// when it opens, which a showcase must not do.

import { blogPosts } from "@/features/website/data/blogPosts";
import { Frame, Row, ShowcaseSection, Stage } from "../ShowcasePrimitives";

export default function HelpShowcase({ section }) {
  const post = blogPosts[0] || { id: "demo", title: "Help article", category: "Servicing", detail: {} };
  const detail = post.detail || {};
  const firstSection = (detail.sections || [])[0];
  const checklist = detail.checklist;

  return (
    <ShowcaseSection id="help" section={section}>
      <Row label="Help cards" note=".ws-help-media · .ws-chip--accent · .ws-help-body · .ws-help-more">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-grid ws-grid--cards">
              {blogPosts.slice(0, 2).map((item) => (
                <article key={item.id} className="ws-card">
                  <div className="ws-help-media">
                    {item.image ? <img src={item.image} alt={item.title} loading="lazy" /> : null}
                    <span className="ws-chip ws-chip--accent ws-help-category">{item.category}</span>
                  </div>
                  <div className="ws-card-body ws-help-body">
                    <span className="ws-muted ws-help-meta">{[item.date, item.readTime].filter(Boolean).join(" · ")}</span>
                    <h3 className="ws-card-title">{item.title}</h3>
                    <p className="ws-muted">{item.excerpt}</p>
                    <div className="ws-help-actions">
                      <button type="button" className="ws-help-more">
                        More info
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="More info popup" note=".ws-article-* · scrim · pinned header and footer">
        <Stage>
          <div className="ws-page">
            <div className="ws-article-backdrop">
              <div className="ws-article-scrim" />
              <div className="ws-article-card" role="dialog" aria-label="Help article preview">
                <header className="ws-article-header">
                  <h3 className="ws-article-title">{post.title}</h3>
                  <div className="ws-article-header-actions">
                    <button type="button" className="ws-article-close" aria-label="Close">
                      <span aria-hidden="true">×</span>
                    </button>
                  </div>
                </header>
                <div className="ws-article-body">
                  {post.image ? (
                    <div className="ws-article-media">
                      <img src={post.image} alt={post.title} />
                    </div>
                  ) : null}
                  <div className="ws-article-meta-row">
                    <span className="ws-chip ws-chip--accent">{post.category}</span>
                    <span className="ws-article-meta">{[post.date, post.readTime].filter(Boolean).join(" · ")}</span>
                  </div>
                  <div className="ws-article-prose">
                    <p className="ws-article-lead">{detail.lead || post.excerpt}</p>
                    {firstSection ? (
                      <section className="ws-article-section">
                        <h4 className="ws-article-h3">{firstSection.heading}</h4>
                        {(firstSection.body || []).slice(0, 2).map((paragraph) => (
                          <p key={paragraph} className="ws-muted">
                            {paragraph}
                          </p>
                        ))}
                      </section>
                    ) : null}
                    {checklist ? (
                      <aside className="ws-article-checklist">
                        <h4 className="ws-article-h3">{checklist.heading}</h4>
                        <ul className="ws-ticks">
                          {(checklist.items || []).slice(0, 3).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </aside>
                    ) : null}
                  </div>
                </div>
                <footer className="ws-article-footer">
                  <p className="ws-article-note">{detail.cta?.note || "Our service team can help."}</p>
                  <a href="#contact" className="ws-btn ws-btn--primary">
                    {detail.cta?.label || "Book a service"}
                  </a>
                </footer>
              </div>
            </div>
          </div>
        </Stage>
      </Row>
    </ShowcaseSection>
  );
}
