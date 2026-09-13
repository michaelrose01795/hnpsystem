// file location: src/features/website/showcase/sections/ReferenceShowcase.js
//
// /website/dev — token and coverage reference. Rendered from
// src/config/websiteDesign.generated.json, which tools/scripts/check-website-design.js
// regenerates from custglobal.css on every predev / prebuild, so a new token or
// family appears here without editing this file.

import { useEffect, useMemo, useRef, useState } from "react";
import WEBSITE_DESIGN from "@/config/websiteDesign.generated.json";
import { Code, Row, ShowcaseSection } from "../ShowcasePrimitives";

const COLOUR_LIKE = /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i;

// Reads every token from inside a .ws-page probe, so page-scoped tokens resolve
// too. Re-reads whenever the theme flips.
function useLiveTokens(names, theme) {
  const probeRef = useRef(null);
  const [values, setValues] = useState({});
  useEffect(() => {
    const probe = probeRef.current;
    if (!probe || typeof window === "undefined") return undefined;
    const readValues = () => {
      const computed = window.getComputedStyle(probe);
      const next = {};
      names.forEach((name) => {
        next[name] = computed.getPropertyValue(name).trim();
      });
      setValues(next);
    };
    readValues();
    const timer = window.setTimeout(readValues, 120);
    return () => window.clearTimeout(timer);
  }, [names, theme]);
  return [probeRef, values];
}

export default function ReferenceShowcase({ section, theme }) {
  const names = useMemo(() => WEBSITE_DESIGN.tokens.map((token) => token.name), []);
  const [probeRef, live] = useLiveTokens(names, theme);
  const { totals, sections, contrast } = WEBSITE_DESIGN;

  return (
    <ShowcaseSection id="reference" section={section}>
      <div className="ws-page website-dev-probe" ref={probeRef} aria-hidden="true" />

      <Row label="Coverage" note="npm run check:website">
        <ul className="website-dev-stats">
          <li className="website-dev-stat">
            <strong>{totals.coveredClasses}</strong> / {totals.classes} classes rendered
          </li>
          <li className="website-dev-stat">
            <strong>{totals.tokens}</strong> tokens
          </li>
          <li className="website-dev-stat">
            <strong>{totals.rules}</strong> rules
          </li>
          <li className="website-dev-stat">
            <strong>{totals.families}</strong> families
          </li>
        </ul>
      </Row>

      <Row label="Tokens" note={`Live values are for the ${theme} theme.`}>
        <div className="website-dev-table-wrap">
          <table className="website-dev-table">
            <thead>
              <tr>
                <th className="website-dev-table__th" aria-label="Swatch" />
                <th className="website-dev-table__th">Token</th>
                <th className="website-dev-table__th">Group</th>
                <th className="website-dev-table__th">Dark</th>
                <th className="website-dev-table__th">Light</th>
                <th className="website-dev-table__th">Live</th>
                <th className="website-dev-table__th">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {WEBSITE_DESIGN.tokens.map((token) => {
                const value = live[token.name] || "";
                const paintable = COLOUR_LIKE.test(value);
                return (
                  <tr key={token.name}>
                    <td className="website-dev-table__td">
                      {paintable ? (
                        <span className="website-dev-token-chip" style={{ "--website-dev-swatch": `var(${token.name})` }} />
                      ) : (
                        <span className="website-dev-token-chip website-dev-token-chip--missing" />
                      )}
                    </td>
                    <td className="website-dev-table__td website-dev-table__td--nowrap">
                      <Code>{token.name}</Code>
                    </td>
                    <td className="website-dev-table__td">{token.group}</td>
                    <td className="website-dev-table__td">
                      <span className="website-dev-code-mono">{token.dark || "—"}</span>
                    </td>
                    <td className="website-dev-table__td">
                      <span className="website-dev-code-mono">{token.light || "inherits dark"}</span>
                    </td>
                    <td className="website-dev-table__td">
                      <span className="website-dev-code-mono">{value || "(unset)"}</span>
                    </td>
                    <td className="website-dev-table__td">{token.purpose}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Row>

      <Row label="Families" note="Every @family block in custglobal.css, with its recorded debt.">
        <div className="website-dev-table-wrap">
          <table className="website-dev-table">
            <thead>
              <tr>
                <th className="website-dev-table__th">Family</th>
                <th className="website-dev-table__th">Section</th>
                <th className="website-dev-table__th">Rules</th>
                <th className="website-dev-table__th">Raw colours</th>
                <th className="website-dev-table__th">!important</th>
                <th className="website-dev-table__th">Dead classes</th>
                <th className="website-dev-table__th">Classes</th>
              </tr>
            </thead>
            <tbody>
              {sections.flatMap((group) =>
                group.families.map((family) => (
                  <tr key={family.id}>
                    <td className="website-dev-table__td website-dev-table__td--nowrap">
                      <Code>@family {family.id}</Code>
                    </td>
                    <td className="website-dev-table__td website-dev-table__td--nowrap">
                      <a href={`#${group.id}`}>{group.title}</a>
                    </td>
                    <td className="website-dev-table__td">{family.rules}</td>
                    <td className="website-dev-table__td">{family.debt.rawColours}</td>
                    <td className="website-dev-table__td">{family.debt.important}</td>
                    <td className="website-dev-table__td">{family.debt.deadClasses}</td>
                    <td className="website-dev-table__td">
                      <details className="website-dev-details">
                        <summary>{family.classes.length} classes</summary>
                        <p className="website-dev-class-list">{family.classes.join(" · ") || "—"}</p>
                      </details>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </Row>

      <Row label="Contrast" note="Registry pairs, both themes. Failures are tracked debt.">
        <div className="website-dev-table-wrap">
          <table className="website-dev-table">
            <thead>
              <tr>
                <th className="website-dev-table__th">Pair</th>
                <th className="website-dev-table__th">Theme</th>
                <th className="website-dev-table__th">Ratio</th>
                <th className="website-dev-table__th">Floor</th>
                <th className="website-dev-table__th">Result</th>
              </tr>
            </thead>
            <tbody>
              {contrast.map((result) => (
                <tr key={`${result.label}-${result.theme}`}>
                  <td className="website-dev-table__td">{result.label}</td>
                  <td className="website-dev-table__td">{result.theme}</td>
                  <td className="website-dev-table__td">{result.ratio}:1</td>
                  <td className="website-dev-table__td">{result.min}:1</td>
                  <td className="website-dev-table__td">{result.pass ? "Pass" : "Below floor"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Row>
    </ShowcaseSection>
  );
}
