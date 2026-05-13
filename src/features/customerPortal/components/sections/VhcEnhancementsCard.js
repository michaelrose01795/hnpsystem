// file location: src/features/customerPortal/components/sections/VhcEnhancementsCard.js
// VHC dashboard from live VHC summary rows, declined checks and uploaded media.
import React from "react";
import SectionShell from "./SectionShell";
import { Stack, Grid, Tile, SubHeader, GhostBtn, MoneyHero, Empty, ItemList, ItemRow, Badge } from "./_websiteParts";

function MediaThumb({ item }) {
  const type = String(item.mime_type || item.media_type || "");
  const isVideo = type.startsWith("video") || type === "video";
  const url = item.public_url;
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
      {url && isVideo ? (
        <video src={url} muted playsInline loop style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : null}
    </div>
  );
}

export default function VhcEnhancementsCard({
  jobs = [],
  vhcByJob = {},
  vhcDeclinations = [],
  vhcMedia = [],
}) {
  const jobsWithVhc = jobs.filter((job) => vhcByJob[job.id]);
  const latestJob = jobsWithVhc[0];
  const latestSummary = latestJob ? vhcByJob[latestJob.id] : null;
  const latestMedia = latestJob
    ? vhcMedia.filter((item) => item.job_number === latestJob.job_number).slice(0, 6)
    : vhcMedia.slice(0, 6);
  const declined = latestJob
    ? vhcDeclinations.filter((row) => row.job_id === latestJob.id)
    : vhcDeclinations;

  return (
    <SectionShell
      id="vhc-extras"
      eyebrow="Inspection"
      title="VHC hub"
      action={
        latestJob ? (
          <GhostBtn href={`/vhc/customer-preview/${encodeURIComponent(latestJob.job_number || "")}`}>
            Open VHC viewer
          </GhostBtn>
        ) : null
      }
    >
      {!latestSummary ? (
        <Empty>No live VHC is linked to this account yet.</Empty>
      ) : (
        <Stack gap={12}>
          <Grid min={260}>
            <Tile padding={16}>
              <MoneyHero
                label="Authorised total this visit"
                value={`£${Number(latestJob.vhc_authorized_total || 0).toFixed(2)}`}
              />
              <span style={{ fontSize: 12, color: "var(--txt-soft)" }}>
                {latestSummary.green || 0} green - {latestSummary.amber || 0} amber - {latestSummary.red || 0} red.
              </span>
            </Tile>

            <Tile padding={16}>
              <SubHeader>Declined items to revisit</SubHeader>
              {declined.length === 0 ? (
                <Empty>Nothing declined on the linked VHC.</Empty>
              ) : (
                <ItemList>
                  {declined.map((item) => (
                    <ItemRow
                      key={item.vhc_id || `${item.job_id}-${item.issue_title}`}
                      title={item.issue_title || item.section || "VHC item"}
                      meta={item.issue_description}
                      right={<Badge tone="open">{item.display_status || item.approval_status || "Declined"}</Badge>}
                    />
                  ))}
                </ItemList>
              )}
              <GhostBtn href="#messages" style={{ alignSelf: "flex-start" }}>
                Ask us to re-quote
              </GhostBtn>
            </Tile>
          </Grid>

          <Tile padding={16}>
            <SubHeader>Inspection media</SubHeader>
            {latestMedia.length ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {latestMedia.map((item) => <MediaThumb key={item.id} item={item} />)}
              </div>
            ) : (
              <Empty>Media will appear once the technician uploads customer-visible VHC photos or video.</Empty>
            )}
          </Tile>
        </Stack>
      )}
    </SectionShell>
  );
}
