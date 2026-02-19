// ✅ Imports converted to use absolute alias "@/"
// file location: src/components/StatusTracking/StatusTimeline.js

import { getStatusTimeline } from '@/lib/status/statusFlow';

// Visual timeline showing all statuses in order with progress indication
export default function StatusTimeline({ currentStatus, currentStatusId = null, statusHistory, getTimeInStatus }) {
  const allStatuses = getStatusTimeline(); // Get ordered list of all possible statuses
  const resolvedCurrent = currentStatus || currentStatusId;
  
  // Check if a status has been completed
  const isStatusCompleted = (statusId) => {
    return statusHistory.some(h => h.status === statusId);
  };

  // Check if this is the current active status
  const isCurrentStatus = (statusId) => {
    return resolvedCurrent?.toUpperCase() === statusId.toUpperCase();
  };

  // Get the index of current status in the timeline
  const currentIndex = allStatuses.findIndex(
    s => s.id === resolvedCurrent?.toLowerCase()
  );

  return (
    <div className="relative">
      {/* Timeline container */}
      <div className="space-y-4">
        {allStatuses.map((status, index) => {
          const completed = isStatusCompleted(status.id);
          const current = isCurrentStatus(status.id);
          const timeSpent = getTimeInStatus(status.id);
          
          // Determine if this status is future (not yet reached)
          const isFuture = index > currentIndex;

          return (
            <div key={status.id} className="relative flex items-start gap-4">
              {/* Vertical line connector */}
              {index < allStatuses.length - 1 && (
                <div
                  className="absolute left-4 top-10 w-0.5 h-12"
                  style={{
                    backgroundColor: completed || current ? status.color : 'var(--accent-purple-surface)'
                  }}
                />
              )}

              {/* Status indicator circle */}
              <div
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  current ? 'animate-pulse ring-4 ring-opacity-50' : ''
                }`}
                style={{
                  backgroundColor: completed || current ? status.color : 'var(--accent-purple-surface)',
                  ringColor: current ? status.color : 'transparent'
                }}
              >
                {completed && !current && (
                  // Checkmark for completed statuses
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {current && (
                  // Pulsing dot for current status
                  <div className="w-3 h-3 bg-white rounded-full" />
                )}
              </div>

              {/* Status details */}
              <div className={`flex-1 pb-4 ${isFuture ? 'opacity-40' : ''}`}>
                <div className="font-semibold text-sm" style={{ color: completed || current ? status.color : 'var(--info)' }}>
                  {status.label}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {status.department}
                </div>
                
                {/* Time spent in this status */}
                {timeSpent > 0 && (
                  <div className="text-xs font-semibold mt-2 text-gray-700">
                    Time: {Math.floor(timeSpent / 60)}m {timeSpent % 60}s
                  </div>
                )}

                {/* Show action required message */}
                {current && status.requiresAction && (
                  <div
                    className="mt-2 text-xs rounded p-2"
                    style={{
                      backgroundColor: "var(--warning-surface)",
                      border: "1px solid var(--warning-border)",
                      color: "var(--warning-text)",
                    }}
                  >
                    {status.requiresAction}
                  </div>
                )}

                {/* Show if time is paused */}
                {current && status.pausesTime && (
                  <div
                    className="mt-2 inline-flex items-center gap-1 text-xs rounded px-2 py-1"
                    style={{
                      backgroundColor: "var(--danger-surface)",
                      border: "1px solid var(--danger-border)",
                      color: "var(--danger-text)",
                    }}
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Timer Paused
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
