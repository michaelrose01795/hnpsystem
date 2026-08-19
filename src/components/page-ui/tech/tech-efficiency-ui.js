// file location: src/components/page-ui/tech/tech-efficiency-ui.js
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";

export function TechEfficiencyRouteSkeleton() {
  return (
    <div className="tech-efficiency-route-skeleton" role="status" aria-live="polite" aria-label="Loading" aria-busy="true">
      <SkeletonKeyframes />
      <LayerTheme padding="16px 18px" gap="var(--space-sm)">
        <div className="tech-efficiency-route-skeleton__toolbar" aria-hidden="true">
          <div className="tech-efficiency-route-skeleton__tabs">
            {Array.from({ length: 4 }).map((_, index) => <SkeletonBlock key={index} width={index === 0 ? "76px" : "92px"} height="var(--control-height-sm)" />)}
          </div>
          <SkeletonBlock width="220px" height="var(--control-height-sm)" />
        </div>
      </LayerTheme>

      <LayerTheme padding="16px 18px" gap="var(--space-sm)">
        <div className="tech-efficiency-route-skeleton__filters" aria-hidden="true">
          <SkeletonBlock width="220px" height="var(--control-height-sm)" />
          <SkeletonBlock width="190px" height="var(--control-height-sm)" />
          <SkeletonBlock width="190px" height="var(--control-height-sm)" />
          <SkeletonBlock width="min(100%, 340px)" height="var(--control-height-sm)" />
        </div>
      </LayerTheme>

      <LayerTheme padding="var(--section-card-padding)" gap="var(--space-md)">
        <SkeletonBlock width="260px" height="19px" />
        <div className="tech-efficiency-route-skeleton__metrics" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, index) => (
            <LayerSurface key={index} padding="var(--space-sm)" gap="8px">
              <SkeletonBlock width={index % 2 ? "72%" : "60%"} height="11px" />
              <SkeletonBlock width={index % 3 ? "52%" : "42%"} height="24px" />
            </LayerSurface>
          ))}
        </div>
      </LayerTheme>

      <div className="tech-efficiency-route-skeleton__analysis">
        {Array.from({ length: 4 }).map((_, index) => (
          <LayerTheme key={index} padding="var(--section-card-padding)" gap="var(--space-sm)">
            <SkeletonBlock width={index % 2 ? "150px" : "190px"} height="16px" />
            <SkeletonBlock width="100%" height={index === 1 ? "160px" : "92px"} />
            <SkeletonBlock width="68%" height="11px" />
          </LayerTheme>
        ))}
      </div>

      <style jsx>{`
        .tech-efficiency-route-skeleton { display: flex; flex-direction: column; gap: var(--page-stack-gap); width: 100%; min-width: 0; }
        .tech-efficiency-route-skeleton__toolbar, .tech-efficiency-route-skeleton__tabs, .tech-efficiency-route-skeleton__filters { display: flex; align-items: center; gap: var(--space-sm); }
        .tech-efficiency-route-skeleton__toolbar { justify-content: space-between; }
        .tech-efficiency-route-skeleton__tabs, .tech-efficiency-route-skeleton__filters { flex-wrap: wrap; }
        .tech-efficiency-route-skeleton__metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--space-sm); }
        .tech-efficiency-route-skeleton__analysis { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: var(--page-stack-gap); }
        @media (max-width: 620px) {
          .tech-efficiency-route-skeleton__toolbar { align-items: stretch; flex-direction: column; }
          .tech-efficiency-route-skeleton__toolbar > :global(.skeleton-block) { width: 100% !important; }
          .tech-efficiency-route-skeleton__filters > :global(.skeleton-block) { width: 100% !important; }
          .tech-efficiency-route-skeleton__metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>
    </div>
  );
}

export default function TechEfficiencyPageUi(props) {
  const {
    EfficiencyTab,
    ready,
    techUserId,
    canViewWorkshop,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
      <div className="tech-efficiency-page-shell">
        {!ready ? <TechEfficiencyRouteSkeleton /> : <EfficiencyTab
            editable
            filterUserId={canViewWorkshop ? null : techUserId}
            editableUserId={canViewWorkshop ? null : techUserId}
          />}
      </div>
      <style jsx>{`
        .tech-efficiency-page-shell {
          width: 100%;
          min-width: 0;
        }

        @media (max-width: 430px) {
          .tech-efficiency-page-shell {
            margin-top: -4px;
          }
        }
      `}</style>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
