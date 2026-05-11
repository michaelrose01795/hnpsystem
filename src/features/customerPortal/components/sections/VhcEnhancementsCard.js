// file location: src/features/customerPortal/components/sections/VhcEnhancementsCard.js
// VHC dashboard: authorised total, declined-work revisit prompts, inspection
// media gallery, technician video updates, and a deep link to the customer
// VHC viewer.
import React from "react";
import SectionShell from "./SectionShell";
import { Stack, Grid, Tile, SubHeader, Badge, GhostBtn, MoneyHero, Empty } from "./_websiteParts";

const MOCK_AUTHORISED = 612.4;
const MOCK_DECLINED = [
  { id: "d1", item: "Pollen filter", price: 38.5 },
  { id: "d2", item: "Wiper blades (pair)", price: 28.0 },
];
const MOCK_VIDEOS = [
  { id: "v1", title: "Tech walkaround · brakes", duration: "1:42" },
  { id: "v2", title: "Underside inspection", duration: "2:08" },
];

function MediaThumb({ item }) {
  const isVideo = String(item.type || "").startsWith("video/");
  return (
    <div
      style={{
        height: 72,
        width: 96,
        borderRadius: 10,
        overflow: "hidden",
        background: "rgba(255,255,255,0.05)",
        flexShrink: 0,
      }}
    >
      {isVideo ? (
        <video src={item.url} muted playsInline loop style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <img src={item.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      )}
    </div>
  );
}

export default function VhcEnhancementsCard({ vhcSummaries = [] }) {
  const latest = vhcSummaries[0];
  const media = latest?.mediaItems?.slice(0, 6) || [];
  return (
    <SectionShell
      id="vhc-extras"
      eyebrow="Inspection"
      title="VHC hub"
      action={
        latest ? (
          <GhostBtn
            href={`/customer/vhc?vehicle=${encodeURIComponent(latest.reg || "")}&job=${latest.jobNumber || ""}`}
          >
            Open VHC viewer
          </GhostBtn>
        ) : null
      }
      todo={latest ? null : { label: "No live VHC linked yet" }}
    >
      <Grid min={260}>
        <Tile padding={16}>
          <MoneyHero
            label="Authorised total this visit"
            value={`£${(latest?.authorisedTotal ?? MOCK_AUTHORISED).toFixed(2)}`}
          />
          <span style={{ fontSize: 12, color: "var(--txt-soft)" }}>
            {(latest?.authorisedCount ?? 3)} items approved · ready for invoicing.
          </span>
        </Tile>

        <Tile padding={16}>
          <SubHeader>Declined items to revisit</SubHeader>
          {MOCK_DECLINED.length === 0 ? (
            <Empty>Nothing outstanding.</Empty>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {MOCK_DECLINED.map((d) => (
                <li
                  key={d.id}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    borderRadius: 10,
                    padding: "8px 10px",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--txt-bright)" }}>{d.item}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--txt-bright)" }}>
                    £{d.price.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <GhostBtn href="#messages" style={{ alignSelf: "flex-start" }}>
            Ask us to re-quote
          </GhostBtn>
        </Tile>
      </Grid>

      <Tile padding={16}>
        <SubHeader>Inspection media</SubHeader>
        {media.length ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {media.map((m) => <MediaThumb key={m.id} item={m} />)}
          </div>
        ) : (
          <Empty>Media will appear once the technician uploads photos and video to the VHC.</Empty>
        )}
      </Tile>

      <Tile padding={16}>
        <SubHeader>Technician video updates</SubHeader>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
          {MOCK_VIDEOS.map((v) => (
            <li
              key={v.id}
              style={{
                background: "rgba(255,255,255,0.04)",
                borderRadius: 10,
                padding: "8px 10px",
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 13, color: "var(--txt-bright)" }}>{v.title}</span>
              <span style={{ fontSize: 11, color: "var(--txt-mute)" }}>{v.duration}</span>
            </li>
          ))}
        </ul>
      </Tile>
    </SectionShell>
  );
}
