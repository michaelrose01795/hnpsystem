// file location: src/components/page-ui/dev/dev-showcase-ui.js

export default function ShowcasePageUi(props) {
  const {
    FamilyBlock,
    Head,
    UI_FAMILIES,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <main style={{
  padding: 24
}}>
        <p>Loading…</p>
      </main>; // render extracted page section.

    case "section2":
      return <main style={{
  padding: 24
}}>
        <h1 style={{
    color: "var(--accentMain)"
  }}>Design system showcase</h1>
        <p>
          This page is restricted to roles that can use the dev overlay. Ask an
          admin if you need access.
        </p>
      </main>; // render extracted page section.

    case "section3":
      return <>
      <Head>
        <title>Design system showcase · HNPSystem</title>
      </Head>
      <main className="app-page-shell" style={{
    padding: "16px 20px 40px",
    minHeight: "100vh"
  }}>
        <div className="app-page-card" style={{
      padding: 24
    }}>
          <header style={{
        marginBottom: 24
      }}>
            <h1 style={{
          margin: 0,
          color: "var(--accentMain)"
        }}>
              HNPSystem · Design system showcase
            </h1>
            <p style={{
          margin: "8px 0 0",
          color: "var(--text-secondary)",
          maxWidth: 720
        }}>
              The authoritative reference for every approved UI family and variant.
              Page-by-page cleanup should use the variants listed here before
              creating anything new. If a pattern is missing, add it to{" "}
              <code>src/components/ui/variants.js</code> first.
            </p>
            <nav style={{
          marginTop: 14,
          display: "flex",
          flexWrap: "wrap",
          gap: 8
        }}>
              {UI_FAMILIES.map(family => <a key={family.id} href={`#${family.id}`} className="app-btn app-btn--secondary app-btn--xs app-btn--pill" style={{
            textDecoration: "none"
          }}>
                  {family.label}
                </a>)}
            </nav>
          </header>

          {UI_FAMILIES.map(family => <FamilyBlock key={family.id} family={family} />)}
        </div>
      </main>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
