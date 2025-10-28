// file location: src/components/StatusTracking/StatusSidebar.js

import { useState, useEffect } from 'react';
import StatusTimeline from './StatusTimeline';
import { SERVICE_STATUS_FLOW } from '../../lib/status/statusFlow';

// This is the main status sidebar that shows on all job-related pages
// It displays the complete process flow with current status highlighted
export default function StatusSidebar({ jobId, currentStatus, isOpen, onToggle }) {
  const [statusHistory, setStatusHistory] = useState([]); // Array of past statuses with timestamps
  const [totalTimeSpent, setTotalTimeSpent] = useState(0); // Total working time in minutes
  const [currentTimer, setCurrentTimer] = useState(0); // Current session time
  
  // Fetch status history when component mounts or jobId changes
  useEffect(() => {
    if (!jobId) return;
    
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
      }
    } catch (error) {
      console.error('Error fetching status history:', error);
    }
  };

  // Live timer update when job is in progress (not paused)
  useEffect(() => {
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
  }, [currentStatus]);

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

  return (
    <>
      {/* Toggle button - always visible */}
      <button
        onClick={onToggle}
        className="fixed right-0 top-1/2 -translate-y-1/2 bg-blue-600 text-white p-2 rounded-l-lg shadow-lg z-50 hover:bg-blue-700 transition-colors"
        style={{ width: '40px', height: '60px' }}
      >
        {/* Icon changes based on open/closed state */}
        {isOpen ? '→' : '←'}
      </button>

      {/* Sidebar panel */}
      <div
        className={`fixed right-0 top-0 h-full bg-white shadow-2xl border-l-2 border-gray-200 transition-transform duration-300 ease-in-out z-40 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: '400px' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 sticky top-0 z-10">
          <h2 className="text-xl font-bold mb-2">Job Progress Tracker</h2>
          <div className="text-sm opacity-90">
            <div>Job ID: {jobId}</div>
            <div className="mt-2 font-semibold">
              Total Time: {formatTime(totalTimeSpent * 60)}
            </div>
            {currentTimer > 0 && (
              <div className="mt-1 text-green-200 animate-pulse">
                Current Session: {formatTime(currentTimer)}
              </div>
            )}
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="overflow-y-auto h-[calc(100vh-140px)] p-4">
          {/* Status Timeline */}
          <StatusTimeline
            currentStatus={currentStatus}
            statusHistory={statusHistory}
            getTimeInStatus={getTimeInStatus}
          />

          {/* Current Status Card */}
          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border-2 border-blue-300">
            <h3 className="font-bold text-blue-900 mb-2">Current Status</h3>
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full animate-pulse"
                style={{
                  backgroundColor: SERVICE_STATUS_FLOW[currentStatus?.toUpperCase()]?.color || '#gray'
                }}
              />
              <span className="font-semibold text-lg">
                {SERVICE_STATUS_FLOW[currentStatus?.toUpperCase()]?.label || 'Unknown'}
              </span>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              Department: {SERVICE_STATUS_FLOW[currentStatus?.toUpperCase()]?.department}
            </div>
            {SERVICE_STATUS_FLOW[currentStatus?.toUpperCase()]?.requiresAction && (
              <div className="mt-3 p-2 bg-amber-100 border-l-4 border-amber-500 text-sm">
                <strong>Action Required:</strong>{' '}
                {SERVICE_STATUS_FLOW[currentStatus?.toUpperCase()].requiresAction}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="mt-6">
            <h3 className="font-bold text-gray-800 mb-3">Recent Activity</h3>
            <div className="space-y-2">
              {statusHistory.slice(0, 5).map((history, index) => (
                <div
                  key={index}
                  className="p-3 bg-gray-50 rounded border-l-4"
                  style={{
                    borderColor: SERVICE_STATUS_FLOW[history.status.toUpperCase()]?.color
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-sm">
                        {SERVICE_STATUS_FLOW[history.status.toUpperCase()]?.label}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(history.timestamp).toLocaleString()}
                      </div>
                    </div>
                    {history.duration && (
                      <div className="text-xs font-semibold text-gray-700">
                        {Math.floor(history.duration / 60)}m {history.duration % 60}s
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Overlay when sidebar is open (click to close) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-20 z-30"
          onClick={onToggle}
        />
      )}
    </>
  );
}