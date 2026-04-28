// ✅ Imports converted to use absolute alias "@/"
// file location: src/components/StatusTracking/StatusSidebar.js

import { useState, useEffect, useMemo, useRef } from 'react';
import JobProgressTracker from '@/components/StatusTracking/JobProgressTracker';
import SmartSummaryBlock from '@/components/StatusTracking/SmartSummaryBlock'; // Smart Summary panel
import { SearchBar } from '@/components/ui/searchBarAPI';
import { buildSmartSummary } from '@/lib/status/smartSummaryBuilder'; // Summary generation from snapshot
import { enhanceTimeline } from '@/lib/status/timelineEnhancer'; // Timeline enhancement pipeline
import { getAllTrackerFlags } from '@/config/trackerFlags'; // Feature flags for tracker enhancements
import { supabase } from '@/lib/database/supabaseClient'; // Supabase client for real-time subscriptions
// ⚠️ Mock data found — replacing with Supabase query
// ✅ Mock data replaced with Supabase integration (see seed-test-data.js for initial inserts)

// This is the main status sidebar that shows on all pages
// It displays the complete process flow with current status highlighted
export default function StatusSidebar({
  jobId,
  isOpen,
  onToggle,
  onJobSearch,
  onJobClear,
  hasUrlJobId,
  viewportWidth = 1440,
  isCompact = false,
  showToggleButton = true,
  variant = "overlay",
  canClose = true,
  refreshKey = 0,
}) {
  const [snapshot, setSnapshot] = useState(null); // Latest job status snapshot payload
  const [statusHistory, setStatusHistory] = useState([]); // Timeline entries for the tracker
  const [clockingBaseSeconds, setClockingBaseSeconds] = useState(0); // Completed clocking seconds
  const [activeClockIns, setActiveClockIns] = useState([]); // Active clock-in timestamps
  const [liveClockingSeconds, setLiveClockingSeconds] = useState(0); // Running clocked total
  const [searchInput, setSearchInput] = useState(''); // Search input state
  const [searchError, setSearchError] = useState(''); // Error message state
  const [searchResults, setSearchResults] = useState([]); // Live job search matches
  const [isSearchLoading, setIsSearchLoading] = useState(false); // Live search loading state
  const safeViewportWidth = typeof viewportWidth === 'number' ? viewportWidth : 1440;
  const isDocked = variant === "docked";
  const compactMode = !isDocked && (isCompact || safeViewportWidth <= 1100);
  const panelWidth = compactMode
    ? Math.min(Math.max(safeViewportWidth - 32, 300), 520)
    : Math.round(Math.min(Math.max(safeViewportWidth * 0.64, 880), 1120));
  const isWideLayout = !compactMode && panelWidth >= 720;
  
  // Fetch snapshot when component mounts or jobId changes
  useEffect(() => {
    if (!jobId) {
      // Clear data when no job selected
      setSnapshot(null);
      setStatusHistory([]);
      setClockingBaseSeconds(0);
      setActiveClockIns([]);
      setLiveClockingSeconds(0);
      return;
    }
    
    const loadSnapshot = async () => {
      const fetched = await fetchStatusSnapshot(jobId);
      if (!fetched) {
        setSnapshot(null);
        setStatusHistory([]);
        setClockingBaseSeconds(0);
        setActiveClockIns([]);
        setLiveClockingSeconds(0);
        setSearchError('No status history available yet');
      }
    };

    loadSnapshot();
  }, [jobId, refreshKey]);

  useEffect(() => {
    const trimmed = searchInput.trim();

    if (jobId || hasUrlJobId || !trimmed) {
      setSearchResults([]);
      setIsSearchLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    const debounce = setTimeout(async () => {
      setIsSearchLoading(true);

      try {
        const response = await fetch(`/api/status/search?q=${encodeURIComponent(trimmed)}&limit=8`, {
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data?.error || 'Search failed');
        }

        setSearchResults(Array.isArray(data.jobs) ? data.jobs : []);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Tracker search failed:', error);
          setSearchResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchLoading(false);
        }
      }
    }, 220);

    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
  }, [searchInput, jobId, hasUrlJobId]);

  // Stable reference to the snapshot loader so subscriptions can call it without stale closures.
  const snapshotLoaderRef = useRef(null);

  // Subscribe to real-time changes on tables that affect the tracker.
  // When any relevant row changes, re-fetch the full snapshot so the tracker
  // updates instantly without manual page refresh.
  useEffect(() => {
    if (!jobId) return undefined;

    // Resolve numeric job ID for Supabase filters (snapshot may not be loaded yet).
    const numericId = snapshot?.job?.id || (Number.isFinite(Number(jobId)) ? Number(jobId) : null);
    if (!numericId) return undefined;

    const channelName = `tracker-live-${numericId}`;
    const channel = supabase.channel(channelName);

    const handleChange = () => {
      if (snapshotLoaderRef.current) {
        snapshotLoaderRef.current(jobId);
      }
    };

    const tables = [
      { table: "jobs", filter: `id=eq.${numericId}` },
      { table: "job_status_history", filter: `job_id=eq.${numericId}` },
      { table: "job_requests", filter: `job_id=eq.${numericId}` },
      { table: "vhc_checks", filter: `job_id=eq.${numericId}` },
      { table: "parts_job_items", filter: `job_id=eq.${numericId}` },
      { table: "job_clocking", filter: `job_id=eq.${numericId}` },
      { table: "job_writeups", filter: `job_id=eq.${numericId}` },
      { table: "invoices", filter: `job_id=eq.${numericId}` },
      { table: "vhc_declinations", filter: `job_id=eq.${numericId}` },
    ];

    tables.forEach(({ table, filter }) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        handleChange
      );
    });

    void channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, snapshot?.job?.id]);

  // Fetch the complete status snapshot for this job
  const fetchStatusSnapshot = async (targetJobId) => {
    try {
      const response = await fetch(`/api/status/snapshot?jobId=${targetJobId}`);
      const data = await response.json();
      
      if (data.success && data.snapshot) {
        const history = Array.isArray(data.snapshot.timeline)
          ? data.snapshot.timeline
          : [];
        setSnapshot(data.snapshot);
        setStatusHistory(history);
        const summary = data.snapshot.clockingSummary || {};
        setClockingBaseSeconds(summary.completedSeconds || 0);
        setActiveClockIns(Array.isArray(summary.activeClockIns) ? summary.activeClockIns : []);
        setSearchError(history.length ? '' : 'No status history available yet');
        return true;
      }
      setSearchError(data.error || 'Job not found');
    } catch (error) {
      console.error('Error fetching status history:', error);
      setSearchError('Failed to load job data');
    }
    return false;
  };

  // Keep the ref in sync so real-time callbacks always call the latest loader.
  snapshotLoaderRef.current = fetchStatusSnapshot;

  // Handle job search
  const handleSearch = async (e) => {
    e.preventDefault();
    
    const trimmed = searchInput.trim();

    if (!trimmed) {
      setSearchError('Please enter a job number');
      return;
    }

    // Check if job exists first
    try {
      const response = await fetch(`/api/status/snapshot?jobId=${trimmed}`);
      const data = await response.json();
      
      if (data.success && data.snapshot?.job?.id) {
        onJobSearch?.(trimmed); // Update parent with searched job ID
        setSearchInput(''); // Clear search input
        setSearchError(''); // Clear errors
      } else {
        setSearchError('Job not found');
      }
    } catch {
      setSearchError('Failed to search for job');
    }
  };

  const handleSelectSearchResult = (result) => {
    const nextJobId = result?.job_number || result?.id;
    if (!nextJobId) return;

    onJobSearch?.(String(nextJobId));
    setSearchInput('');
    setSearchResults([]);
    setSearchError('');
  };

  // Clear current job
  const handleClearJob = () => {
    if (onJobClear) {
      onJobClear();
    } else {
      onJobSearch?.(null);
    }
    setSearchInput('');
    setSearchError('');
    setSnapshot(null);
    setStatusHistory([]);
    setClockingBaseSeconds(0);
    setActiveClockIns([]);
    setLiveClockingSeconds(0);
  };

  const calculateLiveClockingSeconds = (baseSeconds, activeStarts) => {
    if (!Array.isArray(activeStarts) || activeStarts.length === 0) {
      return baseSeconds;
    }
    const nowMs = Date.now();
    const activeSeconds = activeStarts.reduce((sum, start) => {
      const startMs = new Date(start).getTime();
      if (Number.isNaN(startMs)) return sum;
      return sum + Math.max(0, Math.floor((nowMs - startMs) / 1000));
    }, 0);
    return baseSeconds + activeSeconds;
  };

  useEffect(() => {
    setLiveClockingSeconds(calculateLiveClockingSeconds(clockingBaseSeconds, activeClockIns));
    if (!activeClockIns.length) return;

    const interval = setInterval(() => {
      setLiveClockingSeconds(calculateLiveClockingSeconds(clockingBaseSeconds, activeClockIns));
    }, 1000);

    return () => clearInterval(interval);
  }, [clockingBaseSeconds, activeClockIns]);

  const currentStatusForDisplay = snapshot?.job?.status || null;
  const currentStatusId = snapshot?.job?.overallStatus || null;
  const currentStatusMeta = snapshot?.job?.statusMeta || null;
  const displayJobId = useMemo(() => {
    const rawId = snapshot?.job?.id || jobId;
    if (rawId === null || rawId === undefined || rawId === '') return '';
    const text = String(rawId).trim();
    return /^\d+$/.test(text) ? `#${text.padStart(5, '0')}` : text;
  }, [snapshot?.job?.id, jobId]);

  const timelineStatuses = useMemo(() => {
    if (!Array.isArray(statusHistory)) return [];
    const suppressWashComplete =
      snapshot?.workflows?.wash?.state === "no_wash" ||
      snapshot?.workflows?.wash?.notRequired;
    const suppressNoWash = snapshot?.workflows?.wash?.complete;

    return statusHistory
      .map((entry, index) => {
        const timestamp = entry.at || entry.timestamp;
        const resolvedTimestamp = timestamp
          ? new Date(timestamp)
          : new Date(Date.now() - index * 180000);
        const metadata = entry.metadata || {};

        return {
          ...entry,
          status: entry.status || metadata.status || null,
          label: entry.label || entry.to || metadata.label || "Update",
          department: entry.department || metadata.department || null,
          color: entry.color || metadata.color || null,
          timestamp: resolvedTimestamp.toISOString(),
          kind: entry.kind || metadata.kind || (entry.type === "status_change" ? "status" : "event"),
          description: entry.description || metadata.description || null,
          icon: entry.icon || metadata.icon || null,
          eventType: entry.eventType || metadata.eventType || null,
          meta: metadata.meta || metadata || {},
          userId: entry.actorId || entry.userId || null,
          userName: entry.actorName || entry.userName || metadata.meta?.userName || null,
        };
      })
      .filter((entry) => {
        if (suppressWashComplete && (entry.status === "wash_complete" || entry.label === "Wash Complete")) {
          return false;
        }
        if (suppressNoWash && (entry.status === "no_wash" || entry.label === "No Wash")) {
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [statusHistory, snapshot]);

  // Resolve feature flags for tracker enhancements.
  const trackerFlags = useMemo(() => getAllTrackerFlags(), []); // Stable reference for flags

  // Run the enhancement pipeline on raw timeline statuses first (needed by smart summary).
  const enhancedTimeline = useMemo(() => {
    return enhanceTimeline(timelineStatuses, trackerFlags); // Apply display titles, dedup, grouping, highlights
  }, [timelineStatuses, trackerFlags]);

  // Build Smart Summary from the full snapshot data + enhanced timeline.
  const smartSummary = useMemo(() => {
    if (!snapshot) return null; // No snapshot yet
    return buildSmartSummary(snapshot, enhancedTimeline); // Generate summary with anomaly detection and story
  }, [snapshot, enhancedTimeline]);

  // Format seconds to hours + minutes (e.g., 1h 50min(s))
  const formatTime = (seconds) => {
    const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}min(s)`;
  };


  const showFloatingToggle = showToggleButton && !compactMode && !isDocked;
  const toggleButtonStyle = compactMode
    ? {
        width: '56px',
        height: '56px',
        position: 'fixed',
        right: '16px',
        bottom: '16px',
        backgroundColor: 'var(--primary)',
        color: 'var(--text-inverse)',
        border: 'none',
        borderRadius: 'var(--radius-full)',

        cursor: 'pointer',
        zIndex: 51,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        fontWeight: 'bold',
        transition: 'background-color 0.2s ease-in-out, transform 0.3s ease-in-out'
      }
    : {
        width: '40px',
        height: '60px',
        position: 'fixed',
        right: isOpen ? `${panelWidth}px` : '0',
        top: '50%',
        transform: 'translateY(-50%)',
        backgroundColor: 'var(--primary)',
        color: 'var(--text-inverse)',
        border: 'none',
        borderTopLeftRadius: 'var(--radius-xs)',
        borderBottomLeftRadius: 'var(--radius-xs)',

        cursor: 'pointer',
        zIndex: 51,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        fontWeight: 'bold',
        transition: 'all 0.3s ease-in-out'
      };

  const panelStyle = compactMode
    ? {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        top: 0,
        height: '100%',
        width: '100%',
        backgroundColor: 'var(--surface)',

        borderRadius: 0,
        transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s ease-in-out',
        zIndex: 150,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }
    : isDocked
    ? {
        position: 'relative',
        width: '100%',
        height: 'auto',
        minHeight: '100%',
        backgroundColor: 'var(--surface)',

        borderRadius: 'var(--radius-md)',
        border: 'none',
        boxShadow: '0 18px 42px rgba(var(--accentMainRgb), 0.24), 0 8px 22px rgba(0, 0, 0, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }
    : {
        position: 'fixed',
        right: '0',
        top: '0',
        bottom: '0',
        height: '100%',
        minHeight: '100vh',
        width: `${panelWidth}px`,
        maxWidth: '100vw',
        backgroundColor: 'var(--surface)',

        borderRadius: '0px',
        transform: isOpen ? 'translateX(0)' : `translateX(${panelWidth}px)`,
        transition: 'transform 0.3s ease-in-out',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      };

  const handleToggleMouseEnter = (e) => {
    if (compactMode || isDocked) return;
    e.currentTarget.style.backgroundColor = 'var(--primary-dark)';
    e.currentTarget.style.transform = 'translateY(-50%) translateX(-2px)';
  };

  const handleToggleMouseLeave = (e) => {
    if (compactMode || isDocked) return;
    e.currentTarget.style.backgroundColor = 'var(--primary)';
    e.currentTarget.style.transform = 'translateY(-50%)';
  };

  return (
    <>
      {/* Toggle button - desktop only; compact/mobile view uses external controls */}
      {showFloatingToggle && (
        <button
          aria-label={isOpen ? 'Hide job progress' : 'Show job progress'}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          style={toggleButtonStyle}
          onMouseEnter={handleToggleMouseEnter}
          onMouseLeave={handleToggleMouseLeave}
        >
          {compactMode ? (isOpen ? '▼' : '▲') : isOpen ? '‹' : '›'}
        </button>
      )}

      {/* Sidebar panel - FLOATING */}
      <div style={panelStyle}>
        {/* Header */}
        <div style={{
          background: 'rgba(var(--surface-rgb), 0.92)',
          color: 'var(--text-primary)',
          padding: compactMode ? '10px 12px' : '0 16px',
          borderRadius: isDocked ? 'var(--radius-md) var(--radius-md) 0 0' : '0',
          borderBottom: '1px solid var(--surface-light)',
          minHeight: compactMode ? '64px' : '75px',
          display: 'flex',
          alignItems: 'center',
          position: 'relative'
        }}>
          {canClose && onToggle && (
            <button
              aria-label="Close status sidebar"
              onClick={(e) => {
                e.stopPropagation();
              onToggle();
            }}
              className="app-btn app-btn--xs app-btn--secondary"
              style={{ position: 'absolute', top: compactMode ? '10px' : '14px', right: jobId ? '104px' : '16px', zIndex: 2 }}
            >
              Close
            </button>
          )}
          {jobId && (
            <button
              onClick={handleClearJob}
              className="app-btn app-btn--xs app-btn--secondary"
              style={{ position: 'absolute', top: compactMode ? '10px' : '14px', right: '16px', zIndex: 2 }}
            >
              Clear Job
            </button>
          )}
          <div
            style={{
              width: '100%',
              display: 'grid',
              gridTemplateColumns: compactMode ? '1fr' : 'auto minmax(260px, 1fr)',
              alignItems: 'center',
              gap: compactMode ? '10px' : '16px',
              paddingRight: jobId
                ? (canClose && onToggle ? (compactMode ? '168px' : '178px') : '96px')
                : canClose && onToggle ? (compactMode ? '76px' : '86px') : 0,
            }}
          >
            <h2
              style={{
                fontSize: compactMode ? '18px' : '20px',
                fontWeight: 800,
                margin: 0,
                color: 'var(--text-primary)',
                lineHeight: 1.15,
                whiteSpace: 'nowrap',
              }}
            >
              Job Tracker
            </h2>

            {/* Show search bar if no job ID from URL */}
            {!hasUrlJobId && !jobId && (
              <form
                onSubmit={handleSearch}
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: compactMode ? '100%' : '460px',
                  justifySelf: compactMode ? 'stretch' : 'end',
                }}
              >
                <SearchBar
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setSearchError('');
                  }}
                  onClear={() => {
                    setSearchInput('');
                    setSearchResults([]);
                    setSearchError('');
                  }}
                  placeholder="Enter job number..."
                  className="status-sidebar__searchbar"
                  inputClassName="status-sidebar__searchbar-input"
                  style={{ width: '100%' }}
                />
                <button
                  type="submit"
                  className="status-sidebar__search-submit"
                  aria-label="Search jobs"
                  title="Search jobs"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                    <path d="M10.5 4a6.5 6.5 0 0 1 5.12 10.5l4.44 4.44-1.42 1.42-4.44-4.44A6.5 6.5 0 1 1 10.5 4Zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z" />
                  </svg>
                </button>
              </form>
            )}

            {/* Show job info with clear button for searched jobs */}
            {jobId && (
              <div
                style={{
                  fontSize: '14px',
                  display: 'grid',
                  gridTemplateColumns: compactMode ? '1fr' : isWideLayout ? 'minmax(0, 1fr) auto' : '1fr',
                  gap: '12px',
                  alignItems: 'center',
                  justifySelf: compactMode ? 'stretch' : 'end',
                  width: '100%',
                  maxWidth: compactMode ? '100%' : '560px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <span style={{ fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {displayJobId}
                  </span>
                </div>
                <div id="job-progress-total-time" style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  Total Time: {formatTime(liveClockingSeconds)}
                </div>
              </div>
            )}
          </div>

          {!hasUrlJobId && !jobId && (
            <>
              {searchInput.trim() && !searchError && (
                <div
                  style={{
                    position: 'absolute',
                    top: compactMode ? 'calc(100% - 8px)' : 'calc(50% + 24px)',
                    right: canClose && onToggle ? (compactMode ? '88px' : '102px') : '16px',
                    left: compactMode ? '12px' : 'auto',
                    width: compactMode ? 'auto' : '460px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--surface-light)',
                    boxShadow: 'var(--dropdown-menu-shadow)',
                    overflow: 'hidden',
                    zIndex: 6,
                  }}
                >
                  {isSearchLoading ? (
                    <div
                      style={{
                        padding: '10px 12px',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Searching jobs...
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {searchResults.map((result) => (
                        <button
                          key={result.id || result.job_number}
                          type="button"
                          onClick={() => handleSelectSearchResult(result)}
                          className="status-sidebar__search-result"
                        >
                          <span style={{ fontWeight: '700', fontSize: '13px' }}>
                            Job {result.job_number}
                            {result.vehicle_reg ? ` · ${String(result.vehicle_reg).toUpperCase()}` : ''}
                          </span>
                          <span style={{ fontSize: '12px', opacity: 0.9 }}>
                            {result.customer || result.vehicle_make_model || 'Open job'}
                          </span>
                          {result.description && (
                            <span style={{ fontSize: '11px', opacity: 0.75 }}>
                              {result.description}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '10px 12px',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      No jobs match that search yet.
                    </div>
                  )}
                </div>
              )}
              {searchError && (
                <div style={{
                  position: 'absolute',
                  top: compactMode ? 'calc(100% + 8px)' : 'calc(50% + 34px)',
                  right: canClose && onToggle ? (compactMode ? '88px' : '102px') : '16px',
                  left: compactMode ? '12px' : 'auto',
                  width: compactMode ? 'auto' : '460px',
                  fontSize: '12px',
                  color: 'var(--danger)',
                  backgroundColor: 'var(--danger-surface)',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-xs)',
                  zIndex: 7,
                }}>
                  {searchError}
                </div>
              )}
            </>
          )}
        </div>

        {/* Content area: the overlay panel owns scrolling so page scroll does not move the tracker. */}
        <div style={{
          overflowY: 'auto',
          overflowX: 'hidden',
          flex: 1,
          minHeight: 0,
          padding: compactMode ? 'var(--page-gutter-y-mobile, 14px) var(--page-gutter-x-mobile, 12px)' : '20px',
          background: 'var(--surface)',
          borderRadius: '0 0 var(--radius-md) var(--radius-md)' // Match parent border radius
        }}>
          {/* Show message when no job selected */}
          {!jobId ? (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '100%', 
              textAlign: 'center', 
              color: 'var(--grey-accent-light)' 
            }}>
              <p style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: 'var(--grey-accent-dark)' }}>
                No Job Selected
              </p>
              <p style={{ fontSize: '14px' }}>
                {hasUrlJobId 
                  ? 'Navigate to a job card page to see status'
                  : 'Search for a job number above to view its progress'
                }
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: compactMode ? 'var(--page-stack-gap-mobile, 16px)' : '20px', minHeight: 0 }}>
              {/* Smart Summary panel — rendered above the timeline when enabled */}
              {trackerFlags.smart_summary_enabled && smartSummary && (
                <SmartSummaryBlock
                  summary={smartSummary}
                  isCompact={compactMode}
                  isWide={isWideLayout}
                  flags={trackerFlags}
                />
              )}
              <div style={{ minHeight: 0 }}>
                <JobProgressTracker
                  statuses={enhancedTimeline}
                  currentStatus={currentStatusForDisplay}
                  currentStatusId={currentStatusId}
                  currentStatusMeta={currentStatusMeta}
                  isWide={isWideLayout}
                  isCompact={compactMode}
                  flags={trackerFlags}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* NO OVERLAY - User can interact with page normally */}
    </>
  );
}
