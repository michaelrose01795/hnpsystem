// ✅ Imports converted to use absolute alias "@/"
// file location: src/components/StatusTracking/StatusSidebar.js

import { useState, useEffect, useMemo } from 'react';
import { getMainStatusMetadata, getStatusConfig } from '@/lib/status/statusFlow';
import JobProgressTracker from '@/components/StatusTracking/JobProgressTracker';
// ⚠️ Mock data found — replacing with Supabase query
// ✅ Mock data replaced with Supabase integration (see seed-test-data.js for initial inserts)

// This is the main status sidebar that shows on all pages
// It displays the complete process flow with current status highlighted
export default function StatusSidebar({
  jobId,
  currentStatus,
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
  const [statusHistory, setStatusHistory] = useState([]); // Array of past statuses with timestamps
  const [clockingBaseSeconds, setClockingBaseSeconds] = useState(0); // Completed clocking seconds
  const [activeClockIns, setActiveClockIns] = useState([]); // Active clock-in timestamps
  const [liveClockingSeconds, setLiveClockingSeconds] = useState(0); // Running clocked total
  const [searchInput, setSearchInput] = useState(''); // Search input state
  const [searchError, setSearchError] = useState(''); // Error message state
  const safeViewportWidth = typeof viewportWidth === 'number' ? viewportWidth : 1440;
  const isDocked = variant === "docked";
  const compactMode = !isDocked && (isCompact || safeViewportWidth <= 1100);
  const panelWidth = compactMode
    ? Math.min(Math.max(safeViewportWidth - 32, 300), 520)
    : Math.round(Math.min(Math.max(safeViewportWidth * 0.64, 880), 1120));
  const isWideLayout = !compactMode && panelWidth >= 720;
  
  // Fetch status history when component mounts or jobId changes
  useEffect(() => {
    if (!jobId) {
      // Clear data when no job selected
      setStatusHistory([]);
      setClockingBaseSeconds(0);
      setActiveClockIns([]);
      setLiveClockingSeconds(0);
      return;
    }
    
    const loadHistory = async () => {
      const fetched = await fetchStatusHistory(jobId);
      if (!fetched) {
        setStatusHistory([]);
        setClockingBaseSeconds(0);
        setActiveClockIns([]);
        setLiveClockingSeconds(0);
        setSearchError('No status history available yet');
      }
    };

    loadHistory();
  }, [jobId, refreshKey]);

  // Fetch the complete status history for this job
  const fetchStatusHistory = async (targetJobId) => {
    try {
      const response = await fetch(`/api/status/getHistory?jobId=${targetJobId}`);
      const data = await response.json();
      
      if (data.success) {
        const history = Array.isArray(data.history) ? data.history : [];
        setStatusHistory(history); // Array of {status, timestamp, userId, duration}
        const summary = data.clockingSummary || {};
        setClockingBaseSeconds(summary.completedSeconds || 0);
        setActiveClockIns(Array.isArray(summary.activeClockIns) ? summary.activeClockIns : []);
        setSearchError(history.length ? '' : 'No status history available yet'); // Clear any errors
        return true;
      }
      setSearchError(data.error || 'Job not found');
    } catch (error) {
      console.error('Error fetching status history:', error);
      setSearchError('Failed to load job data');
    }
    return false;
  };

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
      const response = await fetch(`/api/status/getCurrentStatus?jobId=${trimmed}`);
      const data = await response.json();
      
      if (data.success) {
        onJobSearch?.(trimmed); // Update parent with searched job ID
        setSearchInput(''); // Clear search input
        setSearchError(''); // Clear errors
      } else {
        setSearchError('Job not found');
      }
    } catch (error) {
      setSearchError('Failed to search for job');
    }
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

  const currentStatusForDisplay = currentStatus;

  const timelineStatuses = useMemo(() => {
    if (!Array.isArray(statusHistory)) return [];

    return statusHistory
      .map((entry, index) => {
        const statusId = entry.status;
        const config = statusId ? getStatusConfig(statusId) : null;
        const fallbackLabel = statusId
          ? statusId.replace(/_/g, " ")
          : entry.label || "Update";
        const timestamp = entry.timestamp
          ? new Date(entry.timestamp)
          : new Date(Date.now() - index * 180000);

        return {
          ...entry,
          status: statusId || null,
          label: entry.label || config?.label || fallbackLabel,
          department: entry.department || entry.category || config?.department,
          color:
            entry.color ||
            (entry.kind === "event"
              ? "var(--accent-orange)"
              : config?.color || "var(--grey-accent-light)"),
          timestamp: timestamp.toISOString(),
          kind: entry.kind || config?.kind || (statusId ? "status" : "event"),
          description: entry.description || entry.reason || entry.notes || null,
          icon: entry.icon || null,
          eventType: entry.eventType || null,
          meta: entry.meta || {},
        };
      })
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [statusHistory]);

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
        borderRadius: '50%',
        boxShadow: 'none',
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
        borderTopLeftRadius: '8px',
        borderBottomLeftRadius: '8px',
        boxShadow: 'none',
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
        left: '16px',
        right: '16px',
        bottom: '88px',
        height: 'calc(100vh - 170px)',
        width: 'auto',
        backgroundColor: 'var(--surface)',
        boxShadow: 'none',
        borderRadius: '20px',
        transform: isOpen ? 'translateY(0)' : 'translateY(calc(100% + 32px))',
        transition: 'transform 0.3s ease-in-out',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }
    : isDocked
    ? {
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '100%',
        backgroundColor: 'var(--surface)',
        boxShadow: 'none',
        borderRadius: '16px',
        border: '1px solid var(--surface-light)',
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
        boxShadow: 'none',
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
          background: 'var(--primary)',
          color: 'var(--text-inverse)',
          padding: '20px',
          borderRadius: '0',
          position: 'relative'
        }}>
          {canClose && onToggle && (
            <button
              aria-label="Close status sidebar"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(var(--surface-rgb), 0.2)',
                border: '1px solid rgba(var(--surface-rgb), 0.35)',
                borderRadius: '999px',
                color: 'var(--text-inverse)',
                fontWeight: '700',
                fontSize: '14px',
                padding: '4px 10px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          )}
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-inverse)' }}>
            Job Progress Tracker
          </h2>
          
          {/* Show search bar if no job ID from URL */}
          {!hasUrlJobId && !jobId && (
            <form onSubmit={handleSearch} style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Enter job number..."
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '2px solid var(--search-surface-muted)',
                    fontSize: '14px',
                    color: 'var(--search-text)',
                    outline: 'none',
                    backgroundColor: 'var(--search-surface)',
                    boxShadow: 'none'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '10px 16px',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--accent-purple)',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '14px',
                    transition: 'all 0.2s',
                    boxShadow: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--background)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(var(--shadow-rgb),0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--surface)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(var(--shadow-rgb),0.1)';
                  }}
                >
                  Search
                </button>
              </div>
              {searchError && (
                <div style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  color: 'var(--text-inverse)',
                  backgroundColor: 'rgba(var(--surface-rgb), 0.15)',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(var(--surface-rgb), 0.3)'
                }}>
                  {searchError}
                </div>
              )}
            </form>
          )}

          {/* Show job info with clear button for searched jobs */}
          {jobId && (
            <div
              style={{
                fontSize: '14px',
                opacity: 0.95,
                display: 'grid',
                gridTemplateColumns: isWideLayout ? 'minmax(0, 1fr) auto' : '1fr',
                gap: '12px',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontWeight: '600' }}>Job ID: {jobId}</span>
                  <button
                    onClick={handleClearJob}
                    style={{
                      padding: '4px 10px',
                      backgroundColor: 'rgba(var(--surface-rgb), 0.15)',
                      color: 'var(--text-inverse)',
                      border: '1px solid rgba(var(--surface-rgb), 0.3)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(var(--surface-rgb), 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(var(--surface-rgb), 0.2)';
                    }}
                  >
                    Clear Job
                  </button>
                </div>
              </div>
              <div id="job-progress-total-time" style={{ fontWeight: '600', fontSize: '16px' }}>
                Total Time: {formatTime(liveClockingSeconds)}
              </div>
            </div>
          )}
        </div>

        {/* Scrollable content area */}
        <div style={{
          overflowY: 'auto',
          overflowX: 'hidden',
          flex: 1, // Fill remaining vertical space so colored section reaches footer
          minHeight: 0, // Allow flex child to shrink for proper scrolling
          padding: '20px',
          background: 'var(--surface)',
          borderRadius: '0 0 16px 16px' // Match parent border radius
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ minHeight: 0 }}>
                <JobProgressTracker
                  statuses={timelineStatuses}
                  currentStatus={currentStatusForDisplay}
                  currentStatusMeta={getMainStatusMetadata(currentStatusForDisplay) || null}
                  isWide={isWideLayout}
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
