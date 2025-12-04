// ✅ Imports converted to use absolute alias "@/"
// file location: src/components/StatusTracking/StatusSidebar.js

import { useState, useEffect, useMemo } from 'react';
import { SERVICE_STATUS_FLOW } from '@/lib/status/statusFlow';
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
  timelineContent = null,
  showToggleButton = true,
  variant = "overlay",
  canClose = true,
}) {
  const [statusHistory, setStatusHistory] = useState([]); // Array of past statuses with timestamps
  const [totalTimeSpent, setTotalTimeSpent] = useState(0); // Total working time in minutes
  const [currentTimer, setCurrentTimer] = useState(0); // Current session time
  const [searchInput, setSearchInput] = useState(''); // Search input state
  const [searchError, setSearchError] = useState(''); // Error message state
  const safeViewportWidth = typeof viewportWidth === 'number' ? viewportWidth : 1440;
  const isDocked = variant === "docked";
  const compactMode = !isDocked && (isCompact || safeViewportWidth <= 1100);
  const panelWidth = compactMode ? Math.min(Math.max(safeViewportWidth - 32, 280), 420) : 400;
  
  // Fetch status history when component mounts or jobId changes
  useEffect(() => {
    if (!jobId) {
      // Clear data when no job selected
      setStatusHistory([]);
      setTotalTimeSpent(0);
      setCurrentTimer(0);
      return;
    }
    
    const loadHistory = async () => {
      const fetched = await fetchStatusHistory(jobId);
      if (!fetched) {
        setStatusHistory([]);
        setTotalTimeSpent(0);
        setSearchError('No status history available yet');
      }
    };

    loadHistory();
  }, [jobId]);

  // Fetch the complete status history for this job
  const fetchStatusHistory = async (targetJobId) => {
    try {
      const response = await fetch(`/api/status/getHistory?jobId=${targetJobId}`);
      const data = await response.json();
      
      if (data.success) {
        if (Array.isArray(data.history) && data.history.length > 0) {
          setStatusHistory(data.history); // Array of {status, timestamp, userId, duration}
          setTotalTimeSpent(data.totalTime); // Total working time
          setSearchError(''); // Clear any errors
          return true;
        }
        return false;
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
    setMockCurrentStatus(null);
    setStatusHistory([]);
    setTotalTimeSpent(0);
    setCurrentTimer(0);
  };

  // Live timer update when job is in progress (not paused)
  useEffect(() => {
    if (!jobId) return; // Don't run timer if no job selected
    
    const statusId = currentStatus?.toUpperCase();
    const currentStatusObj = SERVICE_STATUS_FLOW[statusId];
    
    // Only run timer if status doesn't pause time
    if (currentStatusObj && !currentStatusObj.pausesTime) {
      const interval = setInterval(() => {
        setCurrentTimer(prev => prev + 1); // Increment every second
      }, 1000);
      
      return () => clearInterval(interval);
    } else {
      setCurrentTimer(0); // Reset timer when paused
    }
  }, [currentStatus, jobId]);

  const currentStatusForDisplay = currentStatus;

  const timelineStatuses = useMemo(() => {
    const toTimelineEntry = (entry, index = 0) => {
      const statusId = entry.status;
      const config = SERVICE_STATUS_FLOW[statusId?.toUpperCase()] || {};
      const fallbackLabel = statusId ? statusId.replace(/_/g, ' ') : 'Status';
      const timestamp = entry.timestamp
        ? new Date(entry.timestamp)
        : new Date(Date.now() - index * 180000);

      return {
        status: statusId,
        label: entry.label || config.label || fallbackLabel,
        department: entry.department || config.department,
        timestamp: timestamp.toISOString(),
      };
    };

    const normalizedHistory = (statusHistory || []).map((entry, index) =>
      toTimelineEntry(entry, index)
    );

    return normalizedHistory.sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
  }, [statusHistory]);

  // Format seconds to HH:MM:SS
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
        color: 'white',
        border: 'none',
        borderRadius: '50%',
        boxShadow: '0 12px 24px rgba(var(--shadow-rgb),0.2)',
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
        color: 'white',
        border: 'none',
        borderTopLeftRadius: '8px',
        borderBottomLeftRadius: '8px',
        boxShadow: '-4px 4px 12px rgba(var(--shadow-rgb),0.2)',
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
        boxShadow: isOpen
          ? '0 20px 40px rgba(var(--shadow-rgb),0.15)'
          : 'none',
        borderRadius: '20px',
        transform: isOpen ? 'translateY(0)' : 'translateY(calc(100% + 32px))',
        transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
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
        boxShadow: '0 20px 40px rgba(var(--primary-rgb),0.12)',
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
        backgroundColor: 'var(--surface)',
        boxShadow: isOpen
          ? '-8px 0 32px rgba(var(--shadow-rgb),0.15), 0 8px 32px rgba(var(--shadow-rgb),0.1)'
          : 'none',
        borderRadius: '0px',
        transform: isOpen ? 'translateX(0)' : `translateX(${panelWidth}px)`,
        transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
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
          background: 'var(--primary)', // Red gradient
          color: 'white',
          padding: '20px',
          borderRadius: '0', // Match full-height edge-to-edge layout
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
                border: '1px solid rgba(var(--surface-rgb), 0.4)',
                borderRadius: '999px',
                color: 'var(--surface)',
                fontWeight: '700',
                fontSize: '14px',
                padding: '4px 10px',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          )}
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '12px' }}>
            Job Progress Tracker
          </h2>
          
          {/* Show search bar if no job ID from URL */}
          {!hasUrlJobId && !jobId && (
            <form onSubmit={handleSearch} style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Enter job number..."
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '2px solid var(--surface-light)',
                    fontSize: '14px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    backgroundColor: 'var(--surface)',
                    boxShadow: '0 2px 4px rgba(var(--shadow-rgb),0.02)'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '10px 16px',
                    backgroundColor: 'white',
                    color: 'var(--primary)',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '14px',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 6px rgba(var(--shadow-rgb),0.1)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--background)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(var(--shadow-rgb),0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
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
                  color: 'var(--surface)',
                  backgroundColor: 'rgba(var(--surface-rgb), 0.2)',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(var(--surface-rgb), 0.3)'
                }}>
                  ⚠️ {searchError}
                </div>
              )}
            </form>
          )}

          {/* Show job info with clear button for searched jobs */}
          {jobId && (
            <div style={{ fontSize: '14px', opacity: 0.95 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '600' }}>Job ID: {jobId}</span>
                <button
                  onClick={handleClearJob}
                  style={{
                    marginLeft: '8px',
                    padding: '4px 10px',
                    backgroundColor: 'rgba(var(--surface-rgb), 0.2)',
                    color: 'white',
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
              <div style={{ marginTop: '10px', fontWeight: '600', fontSize: '16px' }}>
                ⏱️ Total Time: {formatTime(totalTimeSpent * 60)}
              </div>
              {currentTimer > 0 && (
                <div style={{ 
                  marginTop: '6px', 
                  color: 'var(--success)',
                  fontWeight: '600',
                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                }}>
                  ▶️ Current Session: {formatTime(currentTimer)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scrollable content area */}
        <div style={{ 
          overflowY: 'auto', 
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
              <svg style={{ width: '64px', height: '64px', marginBottom: '16px', color: 'var(--danger)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
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
            <>
              {/* Current Status Card - ALWAYS AT TOP */}
              <div style={{
                marginBottom: '20px',
                padding: '16px',
                background: 'var(--surface)',
                borderRadius: '16px',
                border: '2px solid var(--surface-light)', // Lighter border
                boxShadow: '0 8px 16px rgba(var(--shadow-rgb),0.08), 0 0 20px rgba(var(--danger-rgb), 0.05)',
                transition: 'all 0.3s ease'
              }}>
                <h3 style={{ fontWeight: 'bold', color: 'var(--primary)', marginBottom: '10px', fontSize: '16px' }}>
                  Current Status
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                    backgroundColor: SERVICE_STATUS_FLOW[currentStatusForDisplay?.toUpperCase()]?.color || 'var(--grey-accent-light)',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    boxShadow: `0 0 12px ${SERVICE_STATUS_FLOW[currentStatusForDisplay?.toUpperCase()]?.color || 'var(--grey-accent-light)'}`
                  }}
                />
                <span style={{ fontWeight: '600', fontSize: '18px', color: 'var(--text-primary)' }}>
                    {SERVICE_STATUS_FLOW[currentStatusForDisplay?.toUpperCase()]?.label || 'Unknown'}
                  </span>
                </div>
                <div style={{ marginTop: '8px', fontSize: '14px', color: 'var(--grey-accent-dark)' }}>
                  🏢 Department: {SERVICE_STATUS_FLOW[currentStatusForDisplay?.toUpperCase()]?.department}
                </div>
                {SERVICE_STATUS_FLOW[currentStatusForDisplay?.toUpperCase()]?.requiresAction && (
                  <div style={{
                    marginTop: '12px',
                    padding: '10px',
                    backgroundColor: 'var(--warning-surface)',
                    borderLeft: '4px solid var(--warning)',
                    fontSize: '14px',
                    borderRadius: '6px'
                  }}>
                    <strong>⚠️ Action Required:</strong>{' '}
                    {SERVICE_STATUS_FLOW[currentStatusForDisplay?.toUpperCase()].requiresAction}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '20px' }}>
                {timelineStatuses.length > 0 ? (
                  <JobProgressTracker
                    statuses={timelineStatuses}
                    currentStatus={currentStatusForDisplay}
                  />
                ) : (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '20px', 
                    color: 'var(--grey-accent-light)',
                    fontSize: '14px'
                  }}>
                    No status history yet
                  </div>
                )}
                {timelineContent && (
                  <div style={{ marginTop: '16px' }}>
                    {timelineContent}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* NO OVERLAY - User can interact with page normally */}
    </>
  );
}
