// file location: src/lib/status/statusFlow.js
// This file defines all possible statuses and their transitions for the service department
export const SERVICE_STATUS_FLOW = {
  // Stage 1: Booking & Arrival
  BOOKED: {
    id: 'booked',
    label: 'Appointment Booked',
    color: '#3B82F6', // blue
    next: ['customer_arrived'],
    department: 'Service Reception',
    canClockOn: false,
    pausesTime: true
  },
  
  CUSTOMER_ARRIVED: {
    id: 'customer_arrived',
    label: 'Customer Arrived',
    color: '#8B5CF6', // purple
    next: ['job_accepted'],
    department: 'Service Reception',
    canClockOn: false,
    pausesTime: true
  },
  
  JOB_ACCEPTED: {
    id: 'job_accepted',
    label: 'Job Accepted',
    color: '#10B981', // green
    next: ['assigned_to_tech'],
    department: 'Workshop Manager',
    canClockOn: false,
    pausesTime: true
  },

  // Stage 2: Assignment & Start
  ASSIGNED_TO_TECH: {
    id: 'assigned_to_tech',
    label: 'Assigned to Technician',
    color: '#F59E0B', // amber
    next: ['in_progress'],
    department: 'Workshop',
    canClockOn: true,
    pausesTime: true,
    requiresAction: 'Tech must clock on'
  },

  IN_PROGRESS: {
    id: 'in_progress',
    label: 'Work In Progress',
    color: '#10B981', // green
    next: ['waiting_for_parts', 'tea_break', 'vhc_in_progress', 'work_complete'],
    department: 'Workshop',
    canClockOn: true,
    pausesTime: false, // Time actively running
    autoSetOnClockOn: true
  },

  // Stage 3: Paused States
  WAITING_FOR_PARTS: {
    id: 'waiting_for_parts',
    label: 'Waiting for Parts',
    color: '#EF4444', // red
    next: ['parts_arrived', 'in_progress'],
    department: 'Workshop',
    canClockOn: true,
    pausesTime: true, // Pauses job timer
    notifyDepartment: 'Parts'
  },

  TEA_BREAK: {
    id: 'tea_break',
    label: 'Tea Break',
    color: '#6B7280', // gray
    next: ['in_progress'],
    department: 'Workshop',
    canClockOn: true,
    pausesTime: true, // Pauses job timer
    maxDuration: 15 // minutes
  },

  PARTS_ARRIVED: {
    id: 'parts_arrived',
    label: 'Parts Ready',
    color: '#10B981', // green
    next: ['in_progress'],
    department: 'Parts',
    canClockOn: true,
    pausesTime: true,
    notifyDepartment: 'Workshop'
  },

  // Stage 4: VHC Process
  VHC_IN_PROGRESS: {
    id: 'vhc_in_progress',
    label: 'VHC Being Completed',
    color: '#8B5CF6', // purple
    next: ['vhc_sent_to_service'],
    department: 'Workshop',
    canClockOn: true,
    pausesTime: false
  },

  VHC_SENT_TO_SERVICE: {
    id: 'vhc_sent_to_service',
    label: 'VHC With Service Team',
    color: '#F59E0B', // amber
    next: ['vhc_priced', 'in_progress'],
    department: 'Service',
    canClockOn: true,
    pausesTime: true,
    notifyDepartment: 'Service'
  },

  VHC_PRICED: {
    id: 'vhc_priced',
    label: 'VHC Priced',
    color: '#10B981', // green
    next: ['vhc_sent_to_customer'],
    department: 'Service',
    canClockOn: true,
    pausesTime: true
  },

  VHC_SENT_TO_CUSTOMER: {
    id: 'vhc_sent_to_customer',
    label: 'Awaiting Customer Approval',
    color: '#F59E0B', // amber
    next: ['vhc_approved', 'vhc_declined', 'in_progress'],
    department: 'Service',
    canClockOn: true,
    pausesTime: true,
    notifyCustomer: true
  },

  VHC_APPROVED: {
    id: 'vhc_approved',
    label: 'VHC Work Approved',
    color: '#10B981', // green
    next: ['waiting_for_parts', 'in_progress'],
    department: 'Service',
    canClockOn: true,
    pausesTime: true,
    notifyDepartments: ['Workshop', 'Parts']
  },

  VHC_DECLINED: {
    id: 'vhc_declined',
    label: 'VHC Work Declined',
    color: '#EF4444', // red
    next: ['work_complete'],
    department: 'Service',
    canClockOn: true,
    pausesTime: true,
    notifyDepartment: 'Workshop'
  },

  // Stage 5: Completion
  WORK_COMPLETE: {
    id: 'work_complete',
    label: 'Workshop Complete',
    color: '#10B981', // green
    next: ['ready_for_valet'],
    department: 'Workshop',
    canClockOn: false,
    pausesTime: true,
    requiresAction: 'Tech must complete write-up'
  },

  READY_FOR_VALET: {
    id: 'ready_for_valet',
    label: 'Ready for Valeting',
    color: '#3B82F6', // blue
    next: ['being_valeted'],
    department: 'Valeting',
    canClockOn: true,
    pausesTime: true,
    notifyDepartment: 'Valeting'
  },

  BEING_VALETED: {
    id: 'being_valeted',
    label: 'Being Valeted',
    color: '#8B5CF6', // purple
    next: ['valet_complete'],
    department: 'Valeting',
    canClockOn: true,
    pausesTime: false
  },

  VALET_COMPLETE: {
    id: 'valet_complete',
    label: 'Valet Complete',
    color: '#10B981', // green
    next: ['ready_for_release'],
    department: 'Valeting',
    canClockOn: false,
    pausesTime: true
  },

  // Stage 6: Release
  READY_FOR_RELEASE: {
    id: 'ready_for_release',
    label: 'Ready for Customer',
    color: '#10B981', // green
    next: ['invoicing'],
    department: 'Service',
    canClockOn: false,
    pausesTime: true,
    notifyDepartments: ['Service', 'Accounts']
  },

  INVOICING: {
    id: 'invoicing',
    label: 'Creating Invoice',
    color: '#F59E0B', // amber
    next: ['completed'],
    department: 'Accounts',
    canClockOn: false,
    pausesTime: true
  },

  COMPLETED: {
    id: 'completed',
    label: 'Job Complete',
    color: '#10B981', // green
    next: null, // Final status
    department: 'Accounts',
    canClockOn: false,
    pausesTime: true,
    isFinalStatus: true
  }
};

// Helper function to get next possible statuses
export const getNextStatuses = (currentStatusId) => {
  const currentStatus = SERVICE_STATUS_FLOW[currentStatusId.toUpperCase()];
  if (!currentStatus || !currentStatus.next) return [];
  
  return currentStatus.next.map(nextId => 
    SERVICE_STATUS_FLOW[nextId.toUpperCase()]
  );
};

// Helper function to check if status transition is valid
export const isValidTransition = (fromStatusId, toStatusId) => {
  const fromStatus = SERVICE_STATUS_FLOW[fromStatusId.toUpperCase()];
  if (!fromStatus || !fromStatus.next) return false;
  
  return fromStatus.next.includes(toStatusId.toLowerCase());
};

// Helper function to check if time should be paused
export const shouldPauseTime = (statusId) => {
  const status = SERVICE_STATUS_FLOW[statusId.toUpperCase()];
  return status ? status.pausesTime : true;
};

// Get all statuses as array for timeline display
export const getStatusTimeline = () => {
  return Object.values(SERVICE_STATUS_FLOW);
};