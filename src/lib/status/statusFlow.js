// file location: src/lib/status/statusFlow.js
// This file defines all possible statuses and their transitions for the service department
export const SERVICE_STATUS_FLOW = {
  // Stage 1: Booking & Arrival
  BOOKED: {
    id: 'booked',
    label: 'Appointment Booked',
    color: 'var(--info)', // blue
    next: ['customer_checkin_pending', 'customer_arrived'],
    department: 'Service Reception',
    canClockOn: false,
    pausesTime: true
  },

  CUSTOMER_CHECKIN_PENDING: {
    id: 'customer_checkin_pending',
    label: 'Customer Check-in Pending',
    color: 'var(--accent-orange)',
    next: ['customer_arrived'],
    department: 'Service Reception',
    canClockOn: false,
    pausesTime: true,
    requiresAction: 'Collect keys and check in customer'
  },
  
  CUSTOMER_ARRIVED: {
    id: 'customer_arrived',
    label: 'Customer Arrived',
    color: 'var(--accent-purple)', // purple
    next: ['job_accepted'],
    department: 'Service Reception',
    canClockOn: false,
    pausesTime: true
  },
  
  JOB_ACCEPTED: {
    id: 'job_accepted',
    label: 'Job Accepted',
    color: 'var(--info)', // green
    next: ['assigned_to_tech'],
    department: 'Workshop Manager',
    canClockOn: false,
    pausesTime: true
  },

  // Stage 2: Assignment & Start
  ASSIGNED_TO_TECH: {
    id: 'assigned_to_tech',
    label: 'Waiting to be Started',
    color: 'var(--warning)', // amber
    next: ['in_progress'],
    department: 'Workshop',
    canClockOn: true,
    pausesTime: true,
    requiresAction: 'Tech must clock on'
  },

  IN_PROGRESS: {
    id: 'in_progress',
    label: 'In Workshop',
    color: 'var(--info)', // green
    next: [
      'waiting_for_parts',
      'tea_break',
      'vhc_waiting',
      'vhc_in_progress',
      'in_mot',
      'work_complete'
    ],
    department: 'Workshop',
    canClockOn: true,
    pausesTime: false, // Time actively running
    autoSetOnClockOn: true
  },

  IN_MOT: {
    id: 'in_mot',
    label: 'In MOT Bay',
    color: 'var(--warning)',
    next: ['work_complete', 'waiting_for_parts', 'in_progress'],
    department: 'MOT',
    canClockOn: true,
    pausesTime: false,
    autoSetOnClockOn: true,
    requiresAction: 'MOT tester must finish inspection'
  },

  // Stage 3: Paused States
  WAITING_FOR_PARTS: {
    id: 'waiting_for_parts',
    label: 'Waiting for Parts',
    color: 'var(--danger)', // red
    next: ['parts_arrived', 'in_progress'],
    department: 'Workshop',
    canClockOn: true,
    pausesTime: true, // Pauses job timer
    notifyDepartment: 'Parts'
  },

  TEA_BREAK: {
    id: 'tea_break',
    label: 'Tea Break',
    color: 'var(--info)', // gray
    next: ['in_progress'],
    department: 'Workshop',
    canClockOn: true,
    pausesTime: true, // Pauses job timer
    maxDuration: 15 // minutes
  },

  PARTS_ARRIVED: {
    id: 'parts_arrived',
    label: 'Parts Ready',
    color: 'var(--info)', // green
    next: ['in_progress'],
    department: 'Parts',
    canClockOn: true,
    pausesTime: true,
    notifyDepartment: 'Workshop'
  },

  // Stage 4: VHC Process
  VHC_WAITING: {
    id: 'vhc_waiting',
    label: 'VHC Waiting',
    color: 'var(--warning)',
    next: ['vhc_in_progress'],
    department: 'Workshop',
    canClockOn: true,
    pausesTime: true,
    requiresAction: 'Technician must open the VHC tab'
  },

  VHC_IN_PROGRESS: {
    id: 'vhc_in_progress',
    label: 'VHC Being Completed',
    color: 'var(--accent-purple)', // purple
    next: ['vhc_complete'],
    department: 'Workshop',
    canClockOn: true,
    pausesTime: false
  },

  VHC_COMPLETE: {
    id: 'vhc_complete',
    label: 'VHC Complete',
    color: 'var(--success)',
    next: ['vhc_sent_to_service'],
    department: 'Workshop',
    canClockOn: false,
    pausesTime: true,
    requiresAction: 'Send to service for pricing'
  },

  VHC_SENT_TO_SERVICE: {
    id: 'vhc_sent_to_service',
    label: 'VHC With Service Team',
    color: 'var(--warning)', // amber
    next: ['waiting_for_pricing', 'vhc_priced', 'in_progress'],
    department: 'Service',
    canClockOn: true,
    pausesTime: true,
    notifyDepartment: 'Service'
  },

  WAITING_FOR_PRICING: {
    id: 'waiting_for_pricing',
    label: 'Waiting for Parts/Labour Pricing',
    color: 'var(--danger)',
    next: ['vhc_priced'],
    department: 'Service',
    canClockOn: false,
    pausesTime: true,
    requiresAction: 'Add labour time and parts values'
  },

  VHC_PRICED: {
    id: 'vhc_priced',
    label: 'VHC Priced',
    color: 'var(--info)', // green
    next: ['vhc_sent_to_customer'],
    department: 'Service',
    canClockOn: true,
    pausesTime: true
  },

  VHC_SENT_TO_CUSTOMER: {
    id: 'vhc_sent_to_customer',
    label: 'Waiting Authorisation',
    color: 'var(--warning)', // amber
    next: ['vhc_approved', 'vhc_declined', 'in_progress'],
    department: 'Service',
    canClockOn: true,
    pausesTime: true,
    notifyCustomer: true
  },

  VHC_APPROVED: {
    id: 'vhc_approved',
    label: 'VHC Work Approved',
    color: 'var(--info)', // green
    next: ['waiting_for_parts', 'in_progress'],
    department: 'Service',
    canClockOn: true,
    pausesTime: true,
    notifyDepartments: ['Workshop', 'Parts']
  },

  VHC_DECLINED: {
    id: 'vhc_declined',
    label: 'VHC Work Declined',
    color: 'var(--danger)', // red
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
    color: 'var(--info)', // green
    next: ['ready_for_valet'],
    department: 'Workshop',
    canClockOn: false,
    pausesTime: true,
    requiresAction: 'Tech must complete write-up'
  },

  READY_FOR_VALET: {
    id: 'ready_for_valet',
    label: 'Ready for Valeting',
    color: 'var(--info)', // blue
    next: ['being_valeted'],
    department: 'Valeting',
    canClockOn: true,
    pausesTime: true,
    notifyDepartment: 'Valeting'
  },

  BEING_VALETED: {
    id: 'being_valeted',
    label: 'In Valet',
    color: 'var(--accent-purple)', // purple
    next: ['valet_complete'],
    department: 'Valeting',
    canClockOn: true,
    pausesTime: false,
    autoSetOnClockOn: true
  },

  VALET_COMPLETE: {
    id: 'valet_complete',
    label: 'Valet Complete',
    color: 'var(--info)', // green
    next: ['ready_for_release'],
    department: 'Valeting',
    canClockOn: false,
    pausesTime: true
  },

  // Stage 6: Release
  READY_FOR_RELEASE: {
    id: 'ready_for_release',
    label: 'Ready for Customer',
    color: 'var(--info)', // green
    next: ['released', 'delivered_to_customer', 'invoicing'],
    department: 'Service',
    canClockOn: false,
    pausesTime: true,
    notifyDepartments: ['Service', 'Accounts']
  },

  DELIVERED_TO_CUSTOMER: {
    id: 'delivered_to_customer',
    label: 'Delivered to Customer',
    color: 'var(--info-dark)', // teal
    next: ['released', 'invoicing'],
    department: 'Service',
    canClockOn: false,
    pausesTime: true,
    notifyDepartments: ['Service', 'Parts']
  },

  INVOICING: {
    id: 'invoicing',
    label: 'Creating Invoice',
    color: 'var(--warning)', // amber
    next: ['invoiced'],
    department: 'Accounts',
    canClockOn: false,
    pausesTime: true
  },

  INVOICED: {
    id: 'invoiced',
    label: 'Invoice Complete',
    color: 'var(--info)',
    next: ['ready_for_release', 'released'],
    department: 'Accounts',
    canClockOn: false,
    pausesTime: true
  },

  RELEASED: {
    id: 'released',
    label: 'Released',
    color: 'var(--success)',
    next: ['completed'],
    department: 'Service',
    canClockOn: false,
    pausesTime: true,
    requiresAction: 'Archive job card'
  },

  COMPLETED: {
    id: 'completed',
    label: 'Job Complete',
    color: 'var(--info)', // green
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
