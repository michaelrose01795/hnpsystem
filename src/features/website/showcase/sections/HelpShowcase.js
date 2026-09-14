// file location: src/features/website/showcase/sections/HelpShowcase.js
//
// /website/dev — @family help: the Help & Advice cards and the More info popup.
// Markup mirrors the blog renderer in src/features/website/WebsitePage.js and
// src/features/website/components/HelpArticleModal.js. The popup is rendered
// static inside a Stage — the real component locks page scroll and grabs focus
// when it opens, which a showcase must not do.

import { blogPosts } from "@/features/website/data/blogPosts";
import { Frame, Row, ShowcaseSection, Stage } from "../ShowcasePrimitives";

// The help chat's stroke glyphs, as the widget draws them.
function ShowcaseGlyph({ d }) {
  return (
    <svg className="ws-chat-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}

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

      {/* @family help-chat. Static markup mirroring
          src/features/website/components/WebsiteHelpChat.js — the real widget
          fetches, polls and is fixed to the viewport, so each state is drawn
          inside a Stage instead. */}
      <Row label="Help chat — assistant" hint=".ws-chat · launcher · bubbles · links · page questions · composer" size="md">
        <Stage>
          <div className="ws-chat" data-open="true">
            <section className="ws-chat-panel" aria-label="Help chat preview">
              <header className="ws-chat-header">
                <div className="ws-chat-header__text">
                  <h2 className="ws-chat-title">Chat with us</h2>
                  <p className="ws-chat-status">
                    <span className="ws-chat-status__dot" data-tone="online" aria-hidden="true" />
                    Assistant · replies instantly
                  </p>
                </div>
                <div className="ws-chat-header__actions">
                  <button type="button" className="ws-chat-icon-btn" aria-label="Chat history">
                    <ShowcaseGlyph d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2" />
                  </button>
                  <button type="button" className="ws-chat-icon-btn" aria-label="Start a new chat">
                    <ShowcaseGlyph d="M12 5v14M5 12h14" />
                  </button>
                  <button type="button" className="ws-chat-close" aria-label="Close chat">
                    <ShowcaseGlyph d="M6 6l12 12M18 6L6 18" />
                  </button>
                </div>
              </header>
              <div className="ws-chat-body">
                <div className="ws-chat-feed">
                  <div className="ws-chat-row" data-author="assistant">
                    <span className="ws-chat-sender">Assistant</span>
                    <div className="ws-chat-bubble">Hi, I&apos;m the Humphries &amp; Parks assistant. Ask me anything, or pick a question below.</div>
                    <span className="ws-chat-meta">Assistant · 09:41</span>
                  </div>
                  <div className="ws-chat-row" data-author="customer">
                    <div className="ws-chat-bubble">What are your opening hours?</div>
                    <span className="ws-chat-meta">You · 09:42</span>
                  </div>
                  <div className="ws-chat-row" data-author="assistant">
                    <span className="ws-chat-sender">Assistant</span>
                    <div className="ws-chat-bubble">{"Sales:\n• Mon – Fri: 8:30 – 18:00\n• Saturday: 8:30 – 17:00"}</div>
                    <div className="ws-chat-links">
                      <a href="#help" className="ws-chat-link">
                        Contact details
                      </a>
                    </div>
                    <span className="ws-chat-meta">Assistant · 09:42</span>
                  </div>
                </div>
                <div className="ws-chat-suggestions">
                  <button type="button" className="ws-chat-suggestion">
                    Where are you located?
                  </button>
                  <button type="button" className="ws-chat-suggestion">
                    How do I book a service?
                  </button>
                </div>
              </div>
              <div className="ws-chat-footer">
                <button type="button" className="ws-chat-team-btn">
                  Chat with the team
                </button>
                <form className="ws-chat-composer" onSubmit={(event) => event.preventDefault()}>
                  <input type="text" className="ws-chat-input" placeholder="Ask a question…" aria-label="Ask a question" />
                  <button type="submit" className="app-btn ws-chat-send" aria-label="Send message">
                    <ShowcaseGlyph d="M4 12l16-8-6 16-2.5-6.5L4 12Z" />
                  </button>
                </form>
              </div>
            </section>
            <button type="button" className="app-btn ws-chat-launcher" aria-label="Open chat, new message">
              <ShowcaseGlyph d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12Z" />
              <span className="ws-chat-launcher__badge" aria-hidden="true" />
            </button>
          </div>
        </Stage>
      </Row>

      <Row label="Help chat — queue and the team" hint=".ws-chat-queue · staff bubble · system notice · details form" size="md">
        <Stage>
          <div className="ws-chat" data-open="true">
            <section className="ws-chat-panel" aria-label="Help chat queue preview">
              <header className="ws-chat-header">
                <div className="ws-chat-header__text">
                  <h2 className="ws-chat-title">Chat with us</h2>
                  <p className="ws-chat-status">
                    <span className="ws-chat-status__dot" data-tone="waiting" aria-hidden="true" />
                    Waiting for the team · 2nd in the queue
                  </p>
                </div>
              </header>
              <div className="ws-chat-queue">
                <p className="ws-chat-queue__text">You&apos;re 2nd in the queue. A member of our team will join this chat shortly.</p>
                <button type="button" className="ws-chat-queue__leave">
                  Leave
                </button>
              </div>
              <div className="ws-chat-body">
                <div className="ws-chat-feed">
                  <div className="ws-chat-row" data-author="system">
                    <p className="ws-chat-notice">Sam has joined the chat.</p>
                  </div>
                  <div className="ws-chat-row" data-author="staff">
                    <span className="ws-chat-sender">Sam</span>
                    <div className="ws-chat-bubble">Hi, I&apos;m Sam from the service desk. How can I help?</div>
                    <span className="ws-chat-meta">Sam · 09:46</span>
                  </div>
                </div>
                <form className="ws-chat-handoff" onSubmit={(event) => event.preventDefault()}>
                  <p className="ws-chat-handoff__title">Chat with the team</p>
                  <p className="ws-chat-handoff__text">Tell us who you are and we&apos;ll put you in the queue.</p>
                  <input type="text" className="ws-chat-input" placeholder="Your name" aria-label="Your name" />
                  <p className="ws-chat-error">Please enter a valid email address.</p>
                  <div className="ws-chat-handoff__actions">
                    <button type="button">Cancel</button>
                    <button type="submit" className="app-btn">
                      Join the queue
                    </button>
                  </div>
                </form>
              </div>
            </section>
          </div>
        </Stage>
      </Row>

      <Row label="Help chat — history" hint=".ws-chat-history · .ws-chat-badge · .ws-chat-empty" size="md">
        <Stage>
          <div className="ws-chat" data-open="true">
            <section className="ws-chat-panel" aria-label="Help chat history preview">
              <div className="ws-chat-body">
                <ul className="ws-chat-history">
                  <li>
                    <button type="button" className="ws-chat-history-item" aria-current="true">
                      <span className="ws-chat-history-item__title">How much does an MOT cost?</span>
                      <span className="ws-chat-history-item__meta">
                        <span className="ws-chat-badge" data-status="active">
                          With the team
                        </span>
                        Today, 09:46
                      </span>
                    </button>
                  </li>
                  <li>
                    <button type="button" className="ws-chat-history-item">
                      <span className="ws-chat-history-item__title">Do you offer Motability cars?</span>
                      <span className="ws-chat-history-item__meta">
                        <span className="ws-chat-badge" data-status="queued">
                          Waiting
                        </span>
                        <span className="ws-chat-badge" data-status="closed">
                          Ended
                        </span>
                        2 Sept 2026
                      </span>
                    </button>
                  </li>
                </ul>
                <p className="ws-chat-empty">No saved chats yet.</p>
              </div>
              <div className="ws-chat-footer">
                <button type="button" className="app-btn ws-chat-team-btn">
                  Start a new chat
                </button>
              </div>
            </section>
          </div>
        </Stage>
      </Row>
    </ShowcaseSection>
  );
}
