// file location: src/features/customerPortal/components/sections/MotHistoryCard.js
// DVLA MOT history viewer — the reg-lookup DVLA endpoint exists; the MOT
// history API isn't wired, so mock tests are shown per VRM.
import React from "react";
import SectionShell from "./SectionShell";
import { Stack, Tile, ItemList, ItemRow, Badge } from "./_websiteParts";

const MOCK_TESTS = [
  { id: "m1", date: "12 Aug 2025", result: "Pass", mileage: "39,402", advisories: ["Rear tyres approaching legal limit"], failures: [] },
  { id: "m2", date: "10 Aug 2024", result: "Pass", mileage: "34,118", advisories: [], failures: [] },
  { id: "m3", date: "06 Aug 2023", result: "Fail then Pass", mileage: "28,602", advisories: ["Front pads low"], failures: ["Offside headlamp aim"] },
];

export default function MotHistoryCard({ vehicles = [] }) {
  const list = vehicles.length ? vehicles : [{ reg: "DEMO123", makeModel: "Example Vehicle" }];
  return (
    <SectionShell
      id="mot"
      eyebrow="MOT record"
      title="MOT history"
      todo={{
        label: "DVLA MOT History API not linked yet",
        detail: "Once the DVLA MOT History endpoint key is configured, this card will fetch real tests per VRM.",
      }}
    >
      <Stack gap={12}>
        {list.map((v) => (
          <Tile key={v.reg} padding={14}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "var(--txt-bright)" }}>
                {v.makeModel || "Vehicle"}
              </span>
              <Badge>{v.reg}</Badge>
            </div>
            <ItemList>
              {MOCK_TESTS.map((t) => {
                const isFail = String(t.result).toLowerCase().includes("fail");
                return (
                  <ItemRow
                    key={t.id}
                    title={t.date}
                    meta={`Mileage ${t.mileage}`}
                    right={<Badge tone={isFail ? "open" : "ok"}>{t.result}</Badge>}
                  >
                    {t.failures.length ? (
                      <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ffb3b3" }}>
                        Failures: {t.failures.join("; ")}
                      </p>
                    ) : null}
                    {t.advisories.length ? (
                      <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ffd699" }}>
                        Advisories: {t.advisories.join("; ")}
                      </p>
                    ) : null}
                  </ItemRow>
                );
              })}
            </ItemList>
          </Tile>
        ))}
      </Stack>
    </SectionShell>
  );
}
