// file location: src/features/customers/hub/CustomerFilesSection.js
//
// Every document, photo and video attached to any of this customer's jobs, with
// the search / filter / sort / grouping needed once a customer has more than a
// handful. Rows come from job_files via getCustomerJobs — no new table.

import React, { useMemo, useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import InputField from "@/components/ui/InputField";
import { RecordHeading, StatusBadge, LinkButton } from "./RecordPrimitives";
import useCopyToClipboard from "./useCopyToClipboard";
import {
  FILE_SORT_OPTIONS,
  filterCustomerFiles,
  formatDate,
  groupFilesByJob,
} from "@/lib/customers/customerHubModel";

const KIND_OPTIONS = [
  { value: "all", label: "All file types" },
  { value: "document", label: "Documents" },
  { value: "photo", label: "Photos" },
  { value: "video", label: "Videos" },
];

const KIND_TONE = { document: "neutral", photo: "accent-soft", video: "accent-soft" };

// The card alternates with whatever it is nested in: straight inside the
// section (--theme) it is a surface; inside a per-job group card (--surface) it
// flips back to theme. CLAUDE.md §3.0 strict alternation.
function FileCard({ file, onCopyLink, layer = "surface" }) {
  const Layer = layer === "theme" ? LayerTheme : LayerSurface;
  return (
    <Layer
      as="div"
      sectionKey={`customer-profile-file-${file.fileId}`}
      parentKey="customer-profile-files"
    >
      <a
        className="app-record-file"
        href={file.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${file.name}`}
      >
        <span className="app-record-file__frame">
          {file.kind === "photo" ? (
            <img className="app-record-file__media" src={file.url} alt={file.name} loading="lazy" />
          ) : file.kind === "video" ? (
            <video className="app-record-file__media" src={file.url} muted preload="metadata" />
          ) : (
            "Document"
          )}
        </span>
        <span className="app-record-file__name">{file.name}</span>
      </a>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
        <StatusBadge tone={KIND_TONE[file.kind] || "neutral"}>{file.kind}</StatusBadge>
        {file.folder && <StatusBadge tone="neutral">{file.folder}</StatusBadge>}
      </div>

      <p className="app-record-note">
        {[file.jobNumber ? `Job ${file.jobNumber}` : null, file.vehicle, formatDate(file.uploadedAt)]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <div className="app-record-actions">
        <LinkButton href={file.url} variant="ghost">
          Open
        </LinkButton>
        <Button variant="ghost" size="sm" onClick={() => onCopyLink(file.url)}>
          Copy link
        </Button>
        {file.jobNumber && (
          <LinkButton href={`/job-cards/${encodeURIComponent(file.jobNumber)}`} variant="ghost">
            Job card
          </LinkButton>
        )}
      </div>
    </Layer>
  );
}

export default function CustomerFilesSection({ files = [] }) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [job, setJob] = useState("all");
  const [sort, setSort] = useState("newest");
  const [grouped, setGrouped] = useState(false);
  const { copy, copied } = useCopyToClipboard();

  const jobOptions = useMemo(() => {
    const numbers = Array.from(new Set(files.map((file) => file.jobNumber).filter(Boolean)));
    return [{ value: "all", label: "All jobs" }, ...numbers.map((n) => ({ value: n, label: `Job ${n}` }))];
  }, [files]);

  const visible = useMemo(
    () => filterCustomerFiles(files, { search, kind, job, sort }),
    [files, search, kind, job, sort]
  );

  const groups = useMemo(() => (grouped ? groupFilesByJob(visible) : null), [grouped, visible]);

  if (!files.length) {
    return (
      <LayerTheme as="section" sectionKey="customer-profile-files" parentKey="customer-profile-tab-overview">
        <RecordHeading>Documents, photos and videos</RecordHeading>
        <EmptyState
          variant="bare"
          icon="📄"
          title="Nothing uploaded yet"
          description="Files added to any of this customer's job cards appear here automatically."
        />
      </LayerTheme>
    );
  }

  return (
    <LayerTheme as="section" sectionKey="customer-profile-files" parentKey="customer-profile-tab-overview">
      <RecordHeading
        actions={
          <Button variant="ghost" size="sm" onClick={() => setGrouped((value) => !value)}>
            {grouped ? "Show flat list" : "Group by job"}
          </Button>
        }
      >
        {`Documents, photos and videos (${visible.length} of ${files.length})`}
      </RecordHeading>

      <div className="app-filter-bar">
        <div className="app-filter-bar__controls">
          <InputField
            label="Search files"
            id="customer-files-search"
            type="search"
            value={search}
            placeholder="File name, job number, registration…"
            onChange={(event) => setSearch(event.target.value)}
          />
          <DropdownField
            label="File type"
            value={kind}
            options={KIND_OPTIONS}
            onChange={(event) => setKind(event.target.value)}
          />
          <DropdownField
            label="Job"
            value={job}
            options={jobOptions}
            onChange={(event) => setJob(event.target.value)}
          />
          <DropdownField
            label="Sort"
            value={sort}
            options={FILE_SORT_OPTIONS}
            onChange={(event) => setSort(event.target.value)}
          />
        </div>
      </div>

      {copied && <p className="app-record-note">Link copied to clipboard</p>}

      {visible.length === 0 ? (
        <EmptyState
          variant="bare"
          role="status"
          icon="🔍"
          title="No files match those filters"
          description="Clear the search or widen the file type to see everything on the record."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearch("");
                setKind("all");
                setJob("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : grouped ? (
        groups.map((group) => (
          <LayerSurface
            key={group.jobNumber}
            as="div"
            sectionKey={`customer-profile-files-group-${group.jobNumber}`}
            parentKey="customer-profile-files"
          >
            <RecordHeading>
              {`Job ${group.jobNumber}${group.vehicle ? ` · ${group.vehicle}` : ""} (${group.files.length})`}
            </RecordHeading>
            <div className="app-card-grid" style={{ "--app-card-grid-min": "220px" }}>
              {group.files.map((file) => (
                <FileCard key={file.id} file={file} onCopyLink={copy} layer="theme" />
              ))}
            </div>
          </LayerSurface>
        ))
      ) : (
        <div className="app-card-grid" style={{ "--app-card-grid-min": "220px" }}>
          {visible.map((file) => (
            <FileCard key={file.id} file={file} onCopyLink={copy} />
          ))}
        </div>
      )}
    </LayerTheme>
  );
}
