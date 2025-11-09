// file location: src/components/StatusTracking/StatusSidebar.js

import { useState, useEffect } from 'react';
import StatusTimeline from './StatusTimeline';
import { SERVICE_STATUS_FLOW } from '../../lib/status/statusFlow';

// This is the main status sidebar that shows on all pages
// It displays the complete process flow with current status highlighted
export default function StatusSidebar({
  jobId,
  currentStatus,
  isOpen,
  onToggle,
  onJobSearch,
  hasUrlJobId,
  viewportWidth = 1440,
  isCompact = false,
}) {
  const [statusHistory, setStatusHistory] = useState([]); // Array of past statuses with timestamps
  const [totalTimeSpent, setTotalTimeSpent] = useState(0); // Total working time in minutes
  const [currentTimer, setCurrentTimer] = useState(0); // Current session time
  const [searchInput, setSearchInput] = useState(''); // Search input state
  const [searchError, setSearchError] = useState(''); // Error message state
  const safeViewportWidth = typeof viewportWidth === 'number' ? viewportWidth : 1440;
  const compactMode = isCompact || safeViewportWidth <= 1100;
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
    
    fetchStatusHistory();
  }, [jobId]);

  // Fetch the complete status history for this job
  const fetchStatusHistory = async () => {
    try {
      const response = await fetch(`/api/status/getHistory?jobId=${jobId}`);
      const data = await response.json();
      
      if (data.success) {
        setStatusHistory(data.history); // Array of {status, timestamp, userId, duration}
        setTotalTimeSpent(data.totalTime); // Total working time
        setSearchError(''); // Clear any errors
      } else {
        setSearchError(data.error || 'Job not found');
      }
    } catch (error) {
      console.error('Error fetching status history:', error);
      setSearchError('Failed to load job data');
    }
  };

  // Handle job search
  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!searchInput.trim()) {
      setSearchError('Please enter a job number');
      return;
    }

    // Check if job exists first
    try {
      const response = await fetch(`/api/status/getCurrentStatus?jobId=${searchInput}`);
      const data = await response.json();
      
      if (data.success) {
        onJobSearch(searchInput); // Update parent with searched job ID
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
    onJobSearch(null);
    setSearchInput('');
    setSearchError('');
  };

  // Live timer update when job is in progress (not paused)
  useEffect(() => {
    if (!jobId) return; // Don't run timer if no job selected
    
    const currentStatusObj = SERVICE_STATUS_FLOW[currentStatus?.toUpperCase()];
    
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

  // Format seconds to HH:MM:SS
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate time spent in each status
  const getTimeInStatus = (statusId) => {
    const history = statusHistory.filter(h => h.status === statusId);
    return history.reduce((total, h) => total + (h.duration || 0), 0);
  };

  const toggleButtonStyle = compactMode
    ? {
        width: '56px',
        height: '56px',
        position: 'fixed',
        right: '16px',
        bottom: '16px',
        backgroundColor: '#d10000',
        color: 'white',
        border: 'none',
        borderRadius: '50%',
        boxShadow: '0 12px 24px rgba(0,0,0,0.2)',
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
        right: isOpen ? `${panelWidth + 10}px` : '0',
        top: '50%',
        transform: 'translateY(-50%)',
        backgroundColor: '#d10000',
        color: 'white',
        border: 'none',
        borderTopLeftRadius: '8px',
        borderBottomLeftRadius: '8px',
        boxShadow: '-4px 4px 12px rgba(0,0,0,0.2)',
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
        backgroundColor: '#fff',
        boxShadow: isOpen
          ? '0 20px 40px rgba(0,0,0,0.15)'
          : 'none',
        borderRadius: '20px',
        transform: isOpen ? 'translateY(0)' : 'translateY(calc(100% + 32px))',
        transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }
    : {
        position: 'fixed',
        right: '10px',
        top: '10px',
        height: 'calc(100vh - 20px)',
        width: `${panelWidth}px`,
        backgroundColor: '#fff',
        boxShadow: isOpen
          ? '-8px 0 32px rgba(0,0,0,0.15), 0 8px 32px rgba(0,0,0,0.1)'
          : 'none',
        borderRadius: '16px',
        transform: isOpen ? 'translateX(0)' : `translateX(${panelWidth + 20}px)`,
        transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      };

  const handleToggleMouseEnter = (e) => {
    if (compactMode) return;
    e.currentTarget.style.backgroundColor = '#a00000';
    e.currentTarget.style.transform = 'translateY(-50%) translateX(-2px)';
  };

  const handleToggleMouseLeave = (e) => {
    if (compactMode) return;
    e.currentTarget.style.backgroundColor = '#d10000';
    e.currentTarget.style.transform = 'translateY(-50%)';
  };

  return (
    <>
      {/* Toggle button - always visible */}
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
        {compactMode ? (isOpen ? '▼' : '▲') : isOpen ? '→' : '←'}
      </button>

      {/* Sidebar panel - FLOATING */}
      <div style={panelStyle}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(to right, #d10000, #a00000)', // Red gradient
          color: 'white',
          padding: '20px',
          borderRadius: '16px 16px 0 0' // Match parent border radius
        }}>
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
                    border: '2px solid #e0e0e0',
                    fontSize: '14px',
                    color: '#222',
                    outline: 'none',
                    backgroundColor: '#fafafa',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '10px 16px',
                    backgroundColor: 'white',
                    color: '#d10000',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '14px',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#fffafa';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
                  }}
                >
                  🔍 Search
                </button>
              </div>
              {searchError && (
                <div style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  color: '#fff',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.3)'
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
                {!hasUrlJobId && (
                  <button
                    onClick={handleClearJob}
                    style={{
                      marginLeft: '8px',
                      padding: '4px 10px',
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      border: '1px solid rgba(255,255,255,0.3)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
                    }}
                  >
                    ✕ Clear
                  </button>
                )}
              </div>
              <div style={{ marginTop: '10px', fontWeight: '600', fontSize: '16px' }}>
                ⏱️ Total Time: {formatTime(totalTimeSpent * 60)}
              </div>
              {currentTimer > 0 && (
                <div style={{ 
                  marginTop: '6px', 
                  color: '#86efac',
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
          background: 'linear-gradient(to bottom, #fffafa, #ffecec)',
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
              color: '#999' 
            }}>
              <svg style={{ width: '64px', height: '64px', marginBottom: '16px', color: '#ffcccc' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#555' }}>
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
                background: '#fff',
                borderRadius: '16px',
                border: '2px solid #ffe0e0', // Lighter border
                boxShadow: '0 8px 16px rgba(0,0,0,0.08), 0 0 20px rgba(255,64,64,0.05)',
                transition: 'all 0.3s ease'
              }}>
                <h3 style={{ fontWeight: 'bold', color: '#d10000', marginBottom: '10px', fontSize: '16px' }}>
                  📍 Current Status
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: SERVICE_STATUS_FLOW[currentStatus?.toUpperCase()]?.color || '#999',
                      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                      boxShadow: `0 0 12px ${SERVICE_STATUS_FLOW[currentStatus?.toUpperCase()]?.color || '#999'}`
                    }}
                  />
                  <span style={{ fontWeight: '600', fontSize: '18px', color: '#222' }}>
                    {SERVICE_STATUS_FLOW[currentStatus?.toUpperCase()]?.label || 'Unknown'}
                  </span>
                </div>
                <div style={{ marginTop: '8px', fontSize: '14px', color: '#555' }}>
                  🏢 Department: {SERVICE_STATUS_FLOW[currentStatus?.toUpperCase()]?.department}
                </div>
                {SERVICE_STATUS_FLOW[currentStatus?.toUpperCase()]?.requiresAction && (
                  <div style={{
                    marginTop: '12px',
                    padding: '10px',
                    backgroundColor: '#fff4e6',
                    borderLeft: '4px solid #ff9800',
                    fontSize: '14px',
                    borderRadius: '6px'
                  }}>
                    <strong>⚠️ Action Required:</strong>{' '}
                    {SERVICE_STATUS_FLOW[currentStatus?.toUpperCase()].requiresAction}
                  </div>
                )}
              </div>

              {/* Completed Activity Timeline - REVERSE ORDER (newest first) */}
              <div>
                <h3 style={{ fontWeight: 'bold', color: '#555', marginBottom: '12px', fontSize: '16px' }}>
                  📋 Status History
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* REVERSED: Show newest at top, oldest at bottom */}
                  {[...statusHistory].reverse().map((history, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '14px',
                        backgroundColor: '#fff',
                        borderRadius: '12px',
                        borderLeft: `4px solid ${SERVICE_STATUS_FLOW[history.status.toUpperCase()]?.color}`,
                        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', fontSize: '14px', color: '#222' }}>
                            {SERVICE_STATUS_FLOW[history.status.toUpperCase()]?.label}
                          </div>
                          <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                            🕐 {new Date(history.timestamp).toLocaleString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                        {history.duration && (
                          <div style={{ 
                            fontSize: '13px', 
                            fontWeight: '600', 
                            color: '#d10000',
                            backgroundColor: '#fff0f0',
                            padding: '4px 10px',
                            borderRadius: '6px'
                          }}>
                            ⏱️ {Math.floor(history.duration / 60)}m {history.duration % 60}s
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* Show message if no history */}
                  {statusHistory.length === 0 && (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '20px', 
                      color: '#999',
                      fontSize: '14px'
                    }}>
                      No status history yet
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* NO OVERLAY - User can interact with page normally */}
    </>
  );
}
