// file location: src/components/page-ui/job-cards/service-history/MileageTrendChart.js
// Final section of the Service History tab: a line chart of recorded mileage
// (y-axis) against each appointment date (x-axis). Built on chart.js /
// react-chartjs-2 (already in package.json). Chart colours resolve from the CSS
// design tokens at render time so the chart follows the active theme.
//
// Layer alternation (CLAUDE.md §3.0): <LayerSurface> section; the <canvas> is not
// a surface, so no nested layer is required.

import { useEffect, useMemo, useState } from "react";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import LayerSurface from "@/components/ui/LayerSurface";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const eyebrowStyle = {
  margin: 0,
  fontSize: "0.7rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--accentText)",
  fontWeight: 700,
};

// Read a CSS custom property off the document root, with a hard fallback so the
// chart still renders before styles resolve / during SSR hydration.
const cssVar = (name, fallback) => {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

export default function MileageTrendChart({ points = [] }) {
  // chart.js needs the canvas/DOM, so only render after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const hasData = Array.isArray(points) && points.length >= 2;

  const { data, options } = useMemo(() => {
    // Canvas can't parse color-mix() reliably, so resolve the RGB tokens the app
    // already exposes and build concrete rgb()/rgba() strings.
    const accentRgb = cssVar("--accentMainRgb", "185, 28, 28");
    const textRgb = cssVar("--text-1-rgb", "15, 15, 15");
    const accent = `rgb(${accentRgb})`;
    const grid = `rgba(${accentRgb}, 0.12)`;
    const muted = `rgba(${textRgb}, 0.6)`;

    return {
      data: {
        labels: points.map((p) => p.dateFormatted),
        datasets: [
          {
            label: "Mileage",
            data: points.map((p) => p.mileage),
            borderColor: accent,
            backgroundColor: `rgba(${accentRgb}, 0.14)`,
            pointBackgroundColor: accent,
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2,
            tension: 0.25,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.parsed.y.toLocaleString("en-GB")} mi`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: muted, maxRotation: 0, autoSkip: true },
            grid: { color: grid, drawBorder: false },
          },
          y: {
            ticks: {
              color: muted,
              callback: (value) => Number(value).toLocaleString("en-GB"),
            },
            grid: { color: grid, drawBorder: false },
          },
        },
      },
    };
  }, [points]);

  return (
    <LayerSurface
      sectionKey="jobcard-service-history-trend"
      parentKey="jobcard-tab-service-history"
      gap="var(--space-4)"
    >
      <p style={eyebrowStyle}>Mileage trend</p>
      {hasData && mounted ? (
        <div style={{ height: "260px", width: "100%" }}>
          <Line data={data} options={options} />
        </div>
      ) : (
        <p style={{ color: "color-mix(in srgb, var(--text-1) 60%, transparent)", margin: 0 }}>
          Not enough recorded mileage to plot a trend yet.
        </p>
      )}
    </LayerSurface>
  );
}
