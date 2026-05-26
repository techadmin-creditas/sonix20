export interface AnalysisJob {
  id: string;
  name: string;
  status: 'Ingested' | 'Queued' | 'Analyzing' | 'Executing' | 'Completed' | 'Paused' | 'Failed';
  systemPrompt: string;
  totalRecords: number;
  processedRecords: number;
  createdAt: string;
  completedAt?: string;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  todayTasksCount: number;
  futureTasksCount: number;
  currentRecordName?: string;
}

export interface JobEntity {
  id: string;
  jobId: string;
  referenceId: string;
  name: string;
  contactInfo: string;
  attributes: Record<string, any>;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Active' | 'Resolved' | 'Snoozed' | 'Escalated' | 'PaymentLinkSent';
  createdAt: string;
  updatedAt: string;
}

export interface InteractionLog {
  id: string;
  entityId: string;
  channel: 'VoiceCall' | 'WhatsApp' | 'SMS' | 'Email' | 'SystemTask';
  direction: 'Inbound' | 'Outbound';
  status: 'Completed' | 'Failed' | 'NoAnswer' | 'Busy' | 'Scheduled';
  metadata: {
    transcript?: string;
    durationSeconds?: number;
    sentiment?: 'Positive' | 'Neutral' | 'Negative';
    messageContent?: string;
    actionOutcome?: string;
    paymentLink?: string;
  };
  createdAt: string;
}

export interface ScheduledTask {
  id: string;
  entityId: string;
  jobId: string;
  taskType: 'CallRetry' | 'CampaignFollowup' | 'ScheduledReminder' | 'SendPaymentLink' | 'CheckPaymentStatus';
  scheduledTime: string;
  status: 'Pending' | 'Processing' | 'Executed' | 'Cancelled' | 'Failed';
  retryCount: number;
  maxRetries: number;
  contextData: {
    promptOverride?: string;
    customMessage?: string;
  };
  createdAt: string;
}

export interface RecommendedAction {
  id: string;
  entityId: string;
  jobId: string;
  suggestedAction: 'Voice_Agent_Call' | 'WhatsApp_Nudge' | 'SMS_Alert' | 'Snooze';
  confidenceScore: number;
  reasoning: string;
  status: 'Pending' | 'Approved' | 'Executed' | 'Dismissed';
  createdAt: string;
}

// -------------------------------------------------------------
// INITIAL PRESETS
// -------------------------------------------------------------

export const PRESET_JOBS: AnalysisJob[] = [
  {
    id: 'job-1',
    name: 'HDFC Two-Wheeler Auto-Call Wave',
    status: 'Completed',
    systemPrompt: 'Identify all customer records that have outstanding payments. For critical risk levels (debt > 50,000 or past due > 30 days), trigger an automated Voice Agent Call. If the user promises to pay, schedule a WhatsApp payment link. If they refuse, escalate. If busy or unanswered, schedule a CallRetry in 2 hours up to 3 times.',
    totalRecords: 620,
    processedRecords: 620,
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    criticalCount: 93,
    highCount: 155,
    mediumCount: 248,
    lowCount: 124,
    todayTasksCount: 279,
    futureTasksCount: 341
  },
  {
    id: 'job-2',
    name: 'SBI Retail Card Recovery Loop',
    status: 'Executing',
    systemPrompt: 'Filter and prioritize card drop-offs over 30 DPD. Execute AI Voice Bot sweeps with scheduled retry fallback loops.',
    totalRecords: 850,
    processedRecords: 410,
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    criticalCount: 127,
    highCount: 212,
    mediumCount: 340,
    lowCount: 171,
    todayTasksCount: 382,
    futureTasksCount: 468
  },
  {
    id: 'job-3',
    name: 'ICICI Auto-Debit Bounce Sweep',
    status: 'Completed',
    systemPrompt: 'Identify all bounced auto-debit payments. Dispatch SMS/WA alerts and trigger automated voice retries.',
    totalRecords: 740,
    processedRecords: 740,
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 15 * 3600 * 1000).toISOString(),
    criticalCount: 111,
    highCount: 185,
    mediumCount: 296,
    lowCount: 148,
    todayTasksCount: 333,
    futureTasksCount: 407
  },
  {
    id: 'job-4',
    name: 'Kotak Premium Card Recovery Wave 3',
    status: 'Ingested',
    systemPrompt: 'Filter borrowers with over 45 days past due. Initiate automated reminders via voice and WhatsApp.',
    totalRecords: 980,
    processedRecords: 0,
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    todayTasksCount: 0,
    futureTasksCount: 0
  },
  {
    id: 'job-5',
    name: 'Axis Micro-Finance Remediation Sweep',
    status: 'Executing',
    systemPrompt: 'Micro-Finance borrowers soft collections sweep. IVR and SMS reminders.',
    totalRecords: 600,
    processedRecords: 180,
    createdAt: new Date(Date.now() - 1.5 * 3600 * 1000).toISOString(),
    criticalCount: 90,
    highCount: 150,
    mediumCount: 240,
    lowCount: 120,
    todayTasksCount: 270,
    futureTasksCount: 330
  },
  {
    id: 'job-6',
    name: 'Bajaj Finserv Consumer Durable Campaign',
    status: 'Completed',
    systemPrompt: 'Consumer durable EMI overdue alerts. Voice bot scheduled retries.',
    totalRecords: 1400,
    processedRecords: 1400,
    createdAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
    criticalCount: 210,
    highCount: 350,
    mediumCount: 560,
    lowCount: 280,
    todayTasksCount: 630,
    futureTasksCount: 770
  },
  {
    id: 'job-7',
    name: 'HDFC Credit Card Late Fee Reminders',
    status: 'Ingested',
    systemPrompt: 'Credit card accounts with active late fee penalty. Soft reminders via WhatsApp and SMS.',
    totalRecords: 550,
    processedRecords: 0,
    createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    todayTasksCount: 0,
    futureTasksCount: 0
  },
  {
    id: 'job-8',
    name: 'IDFC Home Loan EMI Warning Run',
    status: 'Completed',
    systemPrompt: 'Home Loan accounts with outstanding EMIs. High touch AI Voice calls with manual escalations.',
    totalRecords: 1200,
    processedRecords: 1200,
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
    criticalCount: 180,
    highCount: 300,
    mediumCount: 480,
    lowCount: 240,
    todayTasksCount: 540,
    futureTasksCount: 660
  },
  {
    id: 'job-9',
    name: 'IndusInd Personal Loan Soft Sweep',
    status: 'Analyzing',
    systemPrompt: 'Soft collection warning run. Standard SMS and WhatsApp templates.',
    totalRecords: 800,
    processedRecords: 320,
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    criticalCount: 120,
    highCount: 200,
    mediumCount: 320,
    lowCount: 160,
    todayTasksCount: 360,
    futureTasksCount: 440
  },
  {
    id: 'job-10',
    name: 'Yes Bank Digital Loans Follow-up',
    status: 'Executing',
    systemPrompt: 'Digital personal loans outbound follow-up. AI Voice bot sweep.',
    totalRecords: 510,
    processedRecords: 240,
    createdAt: new Date(Date.now() - 1.2 * 3600 * 1000).toISOString(),
    criticalCount: 76,
    highCount: 128,
    mediumCount: 204,
    lowCount: 102,
    todayTasksCount: 229,
    futureTasksCount: 281
  }
];

export const PRESET_ENTITIES: JobEntity[] = [
  // Job 1 Entities (Collections)
  {
    id: 'ent-1',
    jobId: 'job-1',
    referenceId: 'TX-10023',
    name: 'Rajesh Kumar',
    contactInfo: '+91 98765 43210',
    attributes: {
      OutstandingAmount: '₹24,500',
      DueDate: '2026-05-10',
      DaysPastDue: '15',
      PromiseToPayDate: '2026-05-27',
      AssetClass: 'Personal Loan'
    },
    riskLevel: 'High',
    status: 'Active',
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString()
  },
  {
    id: 'ent-2',
    jobId: 'job-1',
    referenceId: 'TX-10492',
    name: 'Anjali Sharma',
    contactInfo: '+91 87654 32109',
    attributes: {
      OutstandingAmount: '₹62,000',
      DueDate: '2026-04-20',
      DaysPastDue: '35',
      PromiseToPayDate: '',
      AssetClass: 'Credit Card'
    },
    riskLevel: 'Critical',
    status: 'PaymentLinkSent',
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString()
  },
  {
    id: 'ent-3',
    jobId: 'job-1',
    referenceId: 'TX-10381',
    name: 'Vikram Singh',
    contactInfo: '+91 76543 21098',
    attributes: {
      OutstandingAmount: '₹8,900',
      DueDate: '2026-05-18',
      DaysPastDue: '7',
      PromiseToPayDate: '2026-05-24',
      AssetClass: 'Two-Wheeler Loan'
    },
    riskLevel: 'Low',
    status: 'Resolved',
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 22 * 3600 * 1000).toISOString()
  },
  {
    id: 'ent-4',
    jobId: 'job-1',
    referenceId: 'TX-10221',
    name: 'Amit Patel',
    contactInfo: '+91 99887 76655',
    attributes: {
      OutstandingAmount: '₹45,000',
      DueDate: '2026-05-02',
      DaysPastDue: '23',
      PromiseToPayDate: '2026-05-25',
      AssetClass: 'Personal Loan'
    },
    riskLevel: 'High',
    status: 'Active',
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ent-5',
    jobId: 'job-1',
    referenceId: 'TX-10114',
    name: 'Priya Nair',
    contactInfo: '+91 88776 65544',
    attributes: {
      OutstandingAmount: '₹12,400',
      DueDate: '2026-05-12',
      DaysPastDue: '13',
      PromiseToPayDate: '',
      AssetClass: 'Consumer Durable'
    },
    riskLevel: 'Medium',
    status: 'Snoozed',
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString()
  },

  // Job 2 Entities (Surveys)
  {
    id: 'ent-6',
    jobId: 'job-2',
    referenceId: 'USR-8820',
    name: 'Siddharth Roy',
    contactInfo: '+91 77665 54433',
    attributes: {
      PlanName: 'Premium Voice Pro',
      JoinDate: '2026-05-22',
      ActiveAgents: '3',
      CSAT: '4/10'
    },
    riskLevel: 'High',
    status: 'Active',
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1.5 * 3600 * 1000).toISOString()
  },
  {
    id: 'ent-7',
    jobId: 'job-2',
    referenceId: 'USR-8901',
    name: 'Neha Mehta',
    contactInfo: '+91 66554 43322',
    attributes: {
      PlanName: 'Enterprise Custom',
      JoinDate: '2026-05-24',
      ActiveAgents: '12',
      CSAT: '9/10'
    },
    riskLevel: 'Low',
    status: 'Resolved',
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1.8 * 3600 * 1000).toISOString()
  },
  {
    id: 'ent-8',
    jobId: 'job-2',
    referenceId: 'USR-8944',
    name: 'Rohan Joshi',
    contactInfo: '+91 99001 12233',
    attributes: {
      PlanName: 'Basic Trial',
      JoinDate: '2026-05-25',
      ActiveAgents: '1',
      CSAT: ''
    },
    riskLevel: 'Medium',
    status: 'Active',
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
  },
  {
    id: 'ent-9',
    jobId: 'job-2',
    referenceId: 'USR-8990',
    name: 'Sneha Deshmukh',
    contactInfo: '+91 91122 33445',
    attributes: {
      PlanName: 'Premium Voice Pro',
      JoinDate: '2026-05-25',
      ActiveAgents: '4',
      CSAT: ''
    },
    riskLevel: 'Medium',
    status: 'Active',
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
  }
];

export const PRESET_INTERACTIONS: InteractionLog[] = [
  // Rajesh Kumar History
  {
    id: 'log-1',
    entityId: 'ent-1',
    channel: 'SystemTask',
    direction: 'Outbound',
    status: 'Completed',
    metadata: {
      actionOutcome: 'AI Analysis completed: Customer identified as High risk due to personal loan asset class with ₹24,500 due. Scheduled softer call nudge first.'
    },
    createdAt: new Date(Date.now() - 23.5 * 3600 * 1000).toISOString()
  },
  {
    id: 'log-2',
    entityId: 'ent-1',
    channel: 'VoiceCall',
    direction: 'Outbound',
    status: 'NoAnswer',
    metadata: {
      durationSeconds: 0,
      sentiment: 'Neutral',
      actionOutcome: 'Unanswered outbound call. Triggered auto-retry rule.'
    },
    createdAt: new Date(Date.now() - 20 * 3600 * 1000).toISOString()
  },
  {
    id: 'log-3',
    entityId: 'ent-1',
    channel: 'VoiceCall',
    direction: 'Outbound',
    status: 'Completed',
    metadata: {
      durationSeconds: 45,
      sentiment: 'Positive',
      transcript: 'Agent: Good afternoon Rajesh, this is Sonix Debt Assist calling regarding your loan. Rajesh: Yes, I know. I had a cash flow issue. I can pay this Wednesday, May 27. Agent: Thank you, I have logged your promise to pay ₹24,500 on May 27.',
      actionOutcome: 'Promise to pay (PTP) established for 2026-05-27. Suspended immediate calls and queued a reminder.'
    },
    createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString()
  },

  // Anjali Sharma History
  {
    id: 'log-4',
    entityId: 'ent-2',
    channel: 'SystemTask',
    direction: 'Outbound',
    status: 'Completed',
    metadata: {
      actionOutcome: 'AI Analysis completed: Customer identified as Critical risk due to 35 days past due. Scheduled urgent debt collector call.'
    },
    createdAt: new Date(Date.now() - 23.5 * 3600 * 1000).toISOString()
  },
  {
    id: 'log-5',
    entityId: 'ent-2',
    channel: 'VoiceCall',
    direction: 'Outbound',
    status: 'Completed',
    metadata: {
      durationSeconds: 72,
      sentiment: 'Neutral',
      transcript: 'Agent: Hello Anjali, this is Nova Credit collection agent. Your balance of ₹62,000 is 35 days overdue. Anjali: I cannot pay the full amount today. Send me a link, I can clear a partial payment of ₹25,000 right now. Agent: Perfect, sending payment link to your registered contact number.',
      actionOutcome: 'Customer requested payment link. Auto-dispatched payment URL.'
    },
    createdAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString()
  },
  {
    id: 'log-6',
    entityId: 'ent-2',
    channel: 'WhatsApp',
    direction: 'Outbound',
    status: 'Completed',
    metadata: {
      messageContent: 'Hi Anjali, as requested, please find your secure payment link for Nova Credit Services: https://pay.sonix.ai/tx10492. Balance: ₹62,000.',
      actionOutcome: 'WhatsApp template delivered successfully. Queued payment status checker.'
    },
    createdAt: new Date(Date.now() - 0.98 * 3600 * 1000).toISOString()
  },

  // Vikram Singh History
  {
    id: 'log-7',
    entityId: 'ent-3',
    channel: 'VoiceCall',
    direction: 'Outbound',
    status: 'Completed',
    metadata: {
      durationSeconds: 30,
      sentiment: 'Positive',
      transcript: 'Agent: Hi Vikram, reminder for ₹8,900. Vikram: Yes, I just paid it online. Please verify. Agent: Thank you, verifying transaction.',
      actionOutcome: 'Payment confirmed. Account set to Resolved.'
    },
    createdAt: new Date(Date.now() - 22 * 3600 * 1000).toISOString()
  },

  // Amit Patel History
  {
    id: 'log-8',
    entityId: 'ent-4',
    channel: 'VoiceCall',
    direction: 'Outbound',
    status: 'NoAnswer',
    metadata: {
      durationSeconds: 0,
      actionOutcome: 'Call unanswered. Triggered automated reschedule.'
    },
    createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString()
  },

  // Siddharth Roy History
  {
    id: 'log-9',
    entityId: 'ent-6',
    channel: 'WhatsApp',
    direction: 'Outbound',
    status: 'Completed',
    metadata: {
      messageContent: 'Hi Siddharth, how would you rate your signup experience with Sonix Voice Pro from 1 to 10?',
      actionOutcome: 'Satisfaction poll sent.'
    },
    createdAt: new Date(Date.now() - 1.8 * 3600 * 1000).toISOString()
  },
  {
    id: 'log-10',
    entityId: 'ent-6',
    channel: 'WhatsApp',
    direction: 'Inbound',
    status: 'Completed',
    metadata: {
      messageContent: '4/10. The latency is quite high on voice responses.',
      sentiment: 'Negative',
      actionOutcome: 'Low score feedback received. Escalated immediately for a Voice Agent Call follow-up.'
    },
    createdAt: new Date(Date.now() - 1.5 * 3600 * 1000).toISOString()
  }
];

export const PRESET_TASKS: ScheduledTask[] = [
  // Rajesh Kumar: reminder scheduled 1 day before PTP
  {
    id: 'task-1',
    entityId: 'ent-1',
    jobId: 'job-1',
    taskType: 'ScheduledReminder',
    scheduledTime: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), // Tomorrow
    status: 'Pending',
    retryCount: 0,
    maxRetries: 1,
    contextData: {
      promptOverride: 'Remind Rajesh of his promise to pay ₹24,500 tomorrow (May 26) as arranged in our last call.'
    },
    createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString()
  },
  // Anjali Sharma: check payment link
  {
    id: 'task-2',
    entityId: 'ent-2',
    jobId: 'job-1',
    taskType: 'CheckPaymentStatus',
    scheduledTime: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
    status: 'Pending',
    retryCount: 0,
    maxRetries: 3,
    contextData: {},
    createdAt: new Date(Date.now() - 0.98 * 3600 * 1000).toISOString()
  },
  // Amit Patel: retry call (since last call was NoAnswer)
  {
    id: 'task-3',
    entityId: 'ent-4',
    jobId: 'job-1',
    taskType: 'CallRetry',
    scheduledTime: new Date(Date.now() + 1.2 * 3600 * 1000).toISOString(), // soon
    status: 'Pending',
    retryCount: 1,
    maxRetries: 3,
    contextData: {
      promptOverride: 'Outbound collections reminder. Keep tone polite and professional.'
    },
    createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString()
  },
  // Siddharth Roy: call survey (because of CSAT 4/10)
  {
    id: 'task-4',
    entityId: 'ent-6',
    jobId: 'job-2',
    taskType: 'CallRetry',
    scheduledTime: new Date(Date.now() + 30 * 60000).toISOString(), // In 30 mins
    status: 'Pending',
    retryCount: 0,
    maxRetries: 2,
    contextData: {
      promptOverride: 'Feedback gathering call. Address the high latency issue he reported on WhatsApp and offer customized optimization support.'
    },
    createdAt: new Date(Date.now() - 1.5 * 3600 * 1000).toISOString()
  },
  // Sneha Deshmukh: pending survey poll
  {
    id: 'task-5',
    entityId: 'ent-9',
    jobId: 'job-2',
    taskType: 'CampaignFollowup',
    scheduledTime: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    status: 'Pending',
    retryCount: 0,
    maxRetries: 1,
    contextData: {},
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
  }
];

export const PRESET_RECOMMENDATIONS: RecommendedAction[] = [
  {
    id: 'rec-1',
    entityId: 'ent-1',
    jobId: 'job-1',
    suggestedAction: 'Voice_Agent_Call',
    confidenceScore: 0.9421,
    reasoning: 'Customer promised to pay by May 27. Gentle voice reminder on May 26 is the most effective approach.',
    status: 'Approved',
    createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString()
  },
  {
    id: 'rec-2',
    entityId: 'ent-2',
    jobId: 'job-1',
    suggestedAction: 'WhatsApp_Nudge',
    confidenceScore: 0.8872,
    reasoning: 'Payment link sent, but transaction not verified yet. Monitor transaction status before calling again.',
    status: 'Pending',
    createdAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString()
  },
  {
    id: 'rec-3',
    entityId: 'ent-4',
    jobId: 'job-1',
    suggestedAction: 'Voice_Agent_Call',
    confidenceScore: 0.9150,
    reasoning: 'Previous call attempt was unanswered. High balance outstanding. Run retry call protocol.',
    status: 'Pending',
    createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString()
  },
  {
    id: 'rec-4',
    entityId: 'ent-6',
    jobId: 'job-2',
    suggestedAction: 'Voice_Agent_Call',
    confidenceScore: 0.9850,
    reasoning: 'CSAT rating of 4/10 is critical for premium accounts. Direct Voice Support check-in requested.',
    status: 'Approved',
    createdAt: new Date(Date.now() - 1.5 * 3600 * 1000).toISOString()
  }
];

// -------------------------------------------------------------
// SIMULATED DATABASE STATE STORE
// -------------------------------------------------------------

class MockDatabaseStore {
  jobs: AnalysisJob[] = [...PRESET_JOBS];
  entities: JobEntity[] = [];
  interactions: InteractionLog[] = [];
  tasks: ScheduledTask[] = [];
  recommendations: RecommendedAction[] = [];
  pendingFileRecords: Record<string, any[]> = {};

  constructor() {
    this.jobs.forEach(job => {
      const records = this.generateLargeBatch(job.totalRecords);
      if (job.status === 'Ingested') {
        this.pendingFileRecords[job.id] = records;
      }

      // Always populate entities for all preset campaigns so they can be inspected in the UI
      records.forEach((r, idx) => {
        const scored = scoreRiskByAI(r);
        const entityId = `ent-${job.id}-${idx}`;
        
        this.entities.push({
          id: entityId,
          jobId: job.id,
          referenceId: r.id,
          name: r.name,
          contactInfo: r.phone,
          attributes: r,
          riskLevel: scored.tier,
          status: job.status === 'Ingested' ? 'Active' : (idx % 10 === 0 ? 'Resolved' : idx % 15 === 0 ? 'Escalated' : 'Active'),
          createdAt: job.createdAt,
          updatedAt: job.createdAt
        });

        // Initialize ingested counts
        if (job.status === 'Ingested') {
          if (scored.tier === 'Critical') job.criticalCount++;
          else if (scored.tier === 'High') job.highCount++;
          else if (scored.tier === 'Medium') job.mediumCount++;
          else if (scored.tier === 'Low') job.lowCount++;
        }
      });

      if (job.status !== 'Ingested') {
        records.forEach((r, idx) => {
          const scored = scoreRiskByAI(r);
          const entityId = `ent-${job.id}-${idx}`;

          // Add some mock interaction logs for step 5 funnel
          if (idx < Math.min(250, job.processedRecords)) {
            const outcome = idx % 9 === 0 ? 'Failed' : idx % 12 === 0 ? 'NoAnswer' : 'Completed';
            const channel = scored.tier === 'Critical' || scored.tier === 'High' ? 'VoiceCall' : 'WhatsApp';
            
            this.interactions.push({
              id: `log-${job.id}-${idx}`,
              entityId: entityId,
              channel: channel,
              direction: 'Outbound',
              status: outcome,
              metadata: {
                durationSeconds: channel === 'VoiceCall' ? 45 : undefined,
                sentiment: 'Neutral',
                actionOutcome: 'Initial automated campaign outreach sweep.'
              },
              createdAt: job.createdAt
            });
          }

          // Add task entries
          if (idx < 200) {
            this.tasks.push({
              id: `task-${job.id}-${idx}`,
              entityId: entityId,
              jobId: job.id,
              taskType: scored.tier === 'Critical' || scored.tier === 'High' ? 'CallRetry' : 'CampaignFollowup',
              scheduledTime: new Date(Date.now() + idx * 30000).toISOString(),
              status: idx < job.processedRecords ? 'Executed' : 'Pending',
              retryCount: 0,
              maxRetries: 3,
              contextData: {},
              createdAt: job.createdAt
            });
          }
        });
      }
    });

    // Start background process loop for Executing / Analyzing campaigns
    if (typeof window !== 'undefined') {
      setInterval(() => {
        this.jobs.forEach(job => {
          if (job.status === 'Executing') {
            const step = Math.floor(1 + Math.random() * 4);
            job.processedRecords = Math.min(job.totalRecords, job.processedRecords + step);
            if (job.processedRecords >= job.totalRecords) {
              job.status = 'Completed';
              job.completedAt = new Date().toISOString();
              job.currentRecordName = undefined;
            } else {
              // Simulate current record processed
              const jobEntities = this.entities.filter(e => e.jobId === job.id);
              if (jobEntities.length > 0) {
                job.currentRecordName = jobEntities[job.processedRecords % jobEntities.length]?.name;
              }
            }
          } else if (job.status === 'Analyzing') {
            // If startJob has not initiated a timer, we can advance it slowly
            if (!this.pendingFileRecords[job.id]) {
              const step = Math.floor(2 + Math.random() * 5);
              job.processedRecords = Math.min(job.totalRecords, job.processedRecords + step);
              if (job.processedRecords >= job.totalRecords) {
                job.status = 'Executing';
                job.processedRecords = 0; // reset to 0 for execution progress
                job.currentRecordName = undefined;
              } else {
                job.currentRecordName = `Analyzing record #${job.processedRecords}...`;
              }
            }
          }
        });
      }, 3000);
    }
  }

  generateLargeBatch(count: number): any[] {
    const firstNames = ['Rajesh', 'Amit', 'Anjali', 'Vikram', 'Priya', 'Siddharth', 'Neha', 'Rohan', 'Karan', 'Deepa', 'Suresh', 'Meera', 'Vijay', 'Jyoti', 'Rahul', 'Sunita', 'Arjun', 'Aditi', 'Sanjay', 'Kavita'];
    const lastNames = ['Kumar', 'Sharma', 'Singh', 'Patel', 'Nair', 'Roy', 'Mehta', 'Joshi', 'Gupta', 'Verma', 'Rao', 'Iyer', 'Reddy', 'Choudhury', 'Sen', 'Das', 'Mishra', 'Pandey', 'Deshmukh', 'Kulkarni'];
    const regions = ['Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Hyderabad', 'Chennai', 'Kolkata', 'Ahmedabad'];
    
    const records = [];
    for (let i = 0; i < count; i++) {
      const name = `${firstNames[i % firstNames.length]} ${lastNames[(i + 3) % lastNames.length]}`;
      const outstanding = Math.floor(1000 + Math.random() * 85000);
      const dpd = Math.floor(Math.random() * 60);
      const id = `TX-${10000 + i}`;
      
      // Seed validation errors for testing scrubber
      const isBalanceMismatch = (i % 13 === 0);
      const isExtremeDpd = (i % 17 === 0);
      
      const finalOutstanding = isBalanceMismatch ? 0 : outstanding;
      const finalDpd = isBalanceMismatch ? 25 : isExtremeDpd ? 410 : dpd;
      const email = i % 7 === 0 ? '' : i % 11 === 0 ? 'invalid-email-format' : `${firstNames[i % firstNames.length].toLowerCase()}@example.com`;

      records.push({
        id,
        reference_id: id,
        name,
        phone: `+91 ${90000 + Math.floor(Math.random() * 9999)} ${10000 + Math.floor(Math.random() * 89999)}`,
        OutstandingAmount: `₹${finalOutstanding.toLocaleString('en-IN')}`,
        DueDate: new Date(Date.now() - finalDpd * 24 * 3600 * 1000).toISOString().split('T')[0],
        DaysPastDue: String(finalDpd),
        PromiseToPayDate: Math.random() > 0.6 ? new Date(Date.now() + Math.floor(Math.random() * 5 + 1) * 24 * 3600 * 1000).toISOString().split('T')[0] : '',
        AssetClass: i % 3 === 0 ? 'Personal Loan' : i % 3 === 1 ? 'Credit Card' : 'Two-Wheeler Loan',
        Region: regions[i % regions.length],
        email
      });
    }
    return records;
  }

  createJob(name: string, prompt: string, fileRecords: any[]): AnalysisJob {
    const jobId = `job-${Date.now()}`;
    const newJob: AnalysisJob = {
      id: jobId,
      name,
      status: 'Ingested',
      systemPrompt: prompt,
      totalRecords: fileRecords.length,
      processedRecords: 0,
      createdAt: new Date().toISOString(),
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      todayTasksCount: 0,
      futureTasksCount: 0,
      currentRecordName: undefined
    };
    this.jobs.unshift(newJob);
    this.pendingFileRecords[jobId] = fileRecords;
    return newJob;
  }

  startJob(jobId: string): void {
    const job = this.jobs.find(j => j.id === jobId);
    if (!job || job.status !== 'Ingested') return;

    job.status = 'Analyzing';
    job.currentRecordName = 'Initializing parser...';
    job.criticalCount = 0;
    job.highCount = 0;
    job.mediumCount = 0;
    job.lowCount = 0;
    const fileRecords = this.pendingFileRecords[jobId] || [];

    let currentIndex = 0;
    const totalSteps = 20;
    const chunkSize = Math.max(1, Math.ceil(fileRecords.length / totalSteps));
    
    const timer = setInterval(() => {
      const limit = Math.min(currentIndex + chunkSize, fileRecords.length);
      for (let i = currentIndex; i < limit; i++) {
        const record = fileRecords[i];
        const refId = record.reference_id || record.id || `REF-${Math.floor(1000 + Math.random() * 9000)}`;
        const contact = record.contact || record.phone || record.email || '+91 99999 88888';
        const nameVal = record.name || 'Unknown Customer';

        const scored = scoreRiskByAI(record);
        const risk = scored.tier;
        record.aiReason = scored.reason;

        if (risk === 'Critical') job.criticalCount++;
        else if (risk === 'High') job.highCount++;
        else if (risk === 'Medium') job.mediumCount++;
        else if (risk === 'Low') job.lowCount++;
        // Deduplication and Overwrite check
        const cleanContact = contact.replace(/[^0-9]/g, '');
        const existingEntity = this.entities.find(e => 
          e.referenceId === refId || 
          e.contactInfo.replace(/[^0-9]/g, '') === cleanContact
        );

        let entId: string;
        let isMerged = false;

        if (existingEntity) {
          entId = existingEntity.id;
          isMerged = true;

          // Track previous campaign history
          const campaignHistory = existingEntity.attributes.campaignHistory || [];
          if (!campaignHistory.includes(existingEntity.jobId)) {
            campaignHistory.push(existingEntity.jobId);
          }
          
          // Overwrite with latest attributes
          existingEntity.attributes = { 
            ...existingEntity.attributes, 
            ...record,
            campaignHistory 
          };
          existingEntity.jobId = jobId; // Switch to the new campaign job ID
          existingEntity.riskLevel = risk;
          existingEntity.status = 'Active'; // Reset status to active
          existingEntity.updatedAt = new Date().toISOString();

          // Cancel prior pending tasks for this entity to prevent double dialing
          this.tasks.forEach(t => {
            if (t.entityId === entId && t.status === 'Pending') {
              t.status = 'Cancelled';
            }
          });
        } else {
          entId = `ent-${jobId}-${i}`;
          const entity: JobEntity = {
            id: entId,
            jobId,
            referenceId: refId,
            name: nameVal,
            contactInfo: contact,
            attributes: record,
            riskLevel: risk,
            status: 'Active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          this.entities.push(entity);
        }

        const taskType = risk === 'Critical' || risk === 'High' ? 'CallRetry' : 'CampaignFollowup';
        const isToday = taskType === 'CallRetry';
        
        if (isToday) job.todayTasksCount++;
        else job.futureTasksCount++;

        const task: ScheduledTask = {
          id: `task-${Date.now()}-${i}`,
          entityId: entId,
          jobId,
          taskType,
          scheduledTime: new Date(Date.now() + (i * 2 + 1) * 60000).toISOString(),
          status: 'Pending',
          retryCount: 0,
          maxRetries: 3,
          contextData: {
            promptOverride: `Initial outreach action. Custom instructions: ${job.systemPrompt}`
          },
          createdAt: new Date().toISOString()
        };
        this.tasks.push(task);

        const rec: RecommendedAction = {
          id: `rec-${Date.now()}-${i}`,
          entityId: entId,
          jobId,
          suggestedAction: taskType === 'CallRetry' ? 'Voice_Agent_Call' : 'WhatsApp_Nudge',
          confidenceScore: 0.85 + Math.random() * 0.14,
          reasoning: `Suggested based on risk classification '${risk}' and user instructions: '${job.systemPrompt.substring(0, 40)}...'`,
          status: 'Pending',
          createdAt: new Date().toISOString()
        };
        this.recommendations.push(rec);

        this.interactions.push({
          id: `log-init-${Date.now()}-${i}`,
          entityId: entId,
          channel: 'SystemTask',
          direction: 'Outbound',
          status: 'Completed',
          metadata: {
            actionOutcome: isMerged
              ? `Record merged from new campaign. Updated DPD to ${record.DaysPastDue || 'unknown'}, balance to ${record.OutstandingAmount || 'unknown'}. Re-targeted action tasks using the latest agent prompt instructions.`
              : `AI Record Parser completed. Identified columns, calculated risk index: ${risk}. Queued initial task.`
          },
          createdAt: new Date().toISOString()
        });
      }

      currentIndex = limit;
      job.processedRecords = currentIndex;
      if (currentIndex > 0 && currentIndex <= fileRecords.length) {
        job.currentRecordName = fileRecords[currentIndex - 1]?.name || 'Unknown Customer';
      }

      if (currentIndex >= fileRecords.length) {
        clearInterval(timer);
        job.status = 'Executing';
        job.completedAt = new Date().toISOString();
        job.currentRecordName = undefined;
        delete this.pendingFileRecords[jobId];
      }
    }, 120);
  }

  // Executes a task in our simulated background queue
  executeTask(taskId: string, mockOutcome?: string): ScheduledTask | null {
    const taskIndex = this.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return null;

    const task = this.tasks[taskIndex];
    task.status = 'Processing';

    const entity = this.entities.find(e => e.id === task.entityId);
    if (!entity) return null;

    // Simulate outcome based on type and inputs
    let outcome = mockOutcome || 'Completed';
    let nextTaskType: typeof task.taskType | null = null;
    let nextDelayMinutes = 60;
    let transcript = '';
    let messageBody = '';
    let logStatus: 'Completed' | 'Failed' | 'NoAnswer' | 'Busy' = 'Completed';
    let logChannel: 'VoiceCall' | 'WhatsApp' | 'SMS' | 'Email' | 'SystemTask' = 'SystemTask';
    let logOutcomeDetails = '';
    let newStatus = entity.status;

    if (task.taskType === 'CallRetry') {
      logChannel = 'VoiceCall';
      if (outcome === 'Busy' || outcome === 'NoAnswer') {
        logStatus = outcome as any;
        logOutcomeDetails = `Call was ${outcome}. Scheduling automatic retry retry_count=${task.retryCount + 1}`;
        if (task.retryCount < task.maxRetries) {
          nextTaskType = 'CallRetry';
          nextDelayMinutes = 120; // retry in 2 hours
        } else {
          logOutcomeDetails = `Call was ${outcome}. Max retries exceeded. Escalating to supervisor.`;
          newStatus = 'Escalated';
        }
      } else if (outcome === 'wants_to_pay') {
        transcript = `Agent: Hello ${entity.name}, calling to settle your account. ${entity.name}: Yes, I want to clear it now. Please send me the link. Agent: Sending the transaction link to you right now.`;
        logOutcomeDetails = 'Customer agreed to settle. Queued payment link dispatch.';
        nextTaskType = 'SendPaymentLink';
        nextDelayMinutes = 1; // trigger instantly
      } else if (outcome === 'ptp_promised') {
        const ptpDate = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().split('T')[0];
        transcript = `Agent: Hello ${entity.name}, collections department. ${entity.name}: I cannot pay today, but I will pay on ${ptpDate}. Agent: OK, logging a promise to pay by ${ptpDate}.`;
        logOutcomeDetails = `PTP logged for ${ptpDate}. Queued reminder.`;
        entity.attributes.PromiseToPayDate = ptpDate;
        nextTaskType = 'ScheduledReminder';
        nextDelayMinutes = 24 * 60; // 1 day delay before PTP
      } else {
        transcript = `Agent: Hi ${entity.name}, checking in. ${entity.name}: Okay, I understand the details. Thanks.`;
        logOutcomeDetails = 'Call successfully completed. Scheduled general email follow-up.';
        nextTaskType = 'CampaignFollowup';
        nextDelayMinutes = 24 * 60;
      }
    } else if (task.taskType === 'SendPaymentLink') {
      logChannel = 'WhatsApp';
      messageBody = `Hi ${entity.name}, please clear your outstanding invoice balance using this secure link: https://pay.sonix.ai/ref-${entity.referenceId}`;
      logOutcomeDetails = 'Payment link auto-dispatched successfully.';
      newStatus = 'PaymentLinkSent';
      nextTaskType = 'CheckPaymentStatus';
      nextDelayMinutes = 10; // check status in 10 simulated minutes
    } else if (task.taskType === 'CheckPaymentStatus') {
      logChannel = 'SystemTask';
      if (outcome === 'paid') {
        logOutcomeDetails = 'Payment gateway verified transaction successful. Closing record.';
        newStatus = 'Resolved';
      } else {
        logOutcomeDetails = 'Payment link still unpaid. Rescheduling AI analysis nudges.';
        nextTaskType = 'CallRetry';
        nextDelayMinutes = 180;
      }
    } else if (task.taskType === 'ScheduledReminder') {
      logChannel = 'WhatsApp';
      messageBody = `Reminder: Your promised payment date of ${entity.attributes.PromiseToPayDate || 'tomorrow'} is coming up. Please pay here: https://pay.sonix.ai/ref-${entity.referenceId}`;
      logOutcomeDetails = 'PTP warning reminder successfully sent.';
      nextTaskType = 'CheckPaymentStatus';
      nextDelayMinutes = 24 * 60;
    } else {
      logChannel = 'Email';
      messageBody = `Dear ${entity.name}, thank you for speaking with our voice representative today. We look forward to your resolution.`;
      logOutcomeDetails = 'Followup document emailed successfully.';
    }

    // Update entity
    entity.status = newStatus;
    entity.updatedAt = new Date().toISOString();

    // Log interaction
    const job = this.jobs.find(j => j.id === task.jobId);
    const campaignName = job ? job.name : undefined;

    this.interactions.push({
      id: `log-exec-${Date.now()}`,
      entityId: task.entityId,
      channel: logChannel,
      direction: 'Outbound',
      status: logStatus,
      metadata: {
        campaignName,
        transcript: transcript || undefined,
        messageContent: messageBody || undefined,
        actionOutcome: logOutcomeDetails,
        paymentLink: task.taskType === 'SendPaymentLink' ? `https://pay.sonix.ai/ref-${entity.referenceId}` : undefined,
        sentiment: transcript ? (outcome === 'wants_to_pay' || outcome === 'ptp_promised' ? 'Positive' : 'Neutral') : undefined
      },
      createdAt: new Date().toISOString()
    });

    // Mark task executed
    task.status = 'Executed';

    // Queue next task if applicable
    if (nextTaskType) {
      const scheduledTime = new Date(Date.now() + nextDelayMinutes * 60000).toISOString();
      const newTask: ScheduledTask = {
        id: `task-${Date.now()}-next`,
        entityId: task.entityId,
        jobId: task.jobId,
        taskType: nextTaskType,
        scheduledTime,
        status: 'Pending',
        retryCount: task.taskType === nextTaskType ? task.retryCount + 1 : 0,
        maxRetries: task.maxRetries,
        contextData: {
          promptOverride: task.contextData.promptOverride
        },
        createdAt: new Date().toISOString()
      };
      this.tasks.push(newTask);
    }

    return task;
  }
}

export interface SimulationLog {
  timestamp: string;
  type: 'INFO' | 'WARN' | 'LLM' | 'SUCCESS' | 'ERROR';
  phase: 'parsing' | 'deduplication' | 'risk_scoring' | 'strategy_formulation';
  message: string;
}

export interface FieldCheck {
  field: string;           // 'Name', 'Phone', 'Balance', 'DPD', 'AssetClass', 'Region', 'Email'
  originalValue: string;
  fixedValue?: string;
  status: 'OK' | 'FIXED' | 'WARNING' | 'ERROR';
  note: string;
}

export interface RecordCleaningEvent {
  rowIndex: number;
  name: string;
  phone: string;
  fieldChecks: FieldCheck[];
  status: 'CLEAN' | 'FIXED' | 'WARNING' | 'ERROR';
}

export interface CleaningSummary {
  total: number;
  clean: number;
  fixed: number;
  warnings: number;
  errors: number;
}
function cleanRecord(record: any, rowIndex: number): RecordCleaningEvent {
  const checks: FieldCheck[] = [];
  let hasError = false;
  let hasFixed = false;
  let hasWarning = false;

  // ── Name check ──────────────────────────────────────────────────
  const name = String(record.name || '').trim();
  if (!name) {
    checks.push({ field: 'Name', originalValue: '(empty)', status: 'ERROR', note: 'Customer name is missing — record flagged for manual review.' });
    hasError = true;
  } else {
    checks.push({ field: 'Name', originalValue: name, status: 'OK', note: 'Name field validated.' });
  }

  // ── Phone check ─────────────────────────────────────────────────
  const rawPhone = String(record.phone || '').replace(/\s+/g, '');
  const digits = rawPhone.replace(/[^0-9]/g, '');
  if (!rawPhone) {
    checks.push({ field: 'Phone', originalValue: '(empty)', status: 'ERROR', note: 'Phone number is missing — cannot initiate outbound contact.' });
    hasError = true;
  } else if (digits.length < 10) {
    checks.push({ field: 'Phone', originalValue: rawPhone, fixedValue: `+91${digits.padEnd(10, '0')}`, status: 'ERROR', note: `Only ${digits.length} digits found — minimum 10 required. Could not auto-correct.` });
    hasError = true;
  } else if (!rawPhone.startsWith('+91') && !rawPhone.startsWith('91')) {
    const fixed = `+91${digits.slice(-10)}`;
    checks.push({ field: 'Phone', originalValue: rawPhone, fixedValue: fixed, status: 'FIXED', note: 'Missing +91 country prefix — auto-prefixed to E.164 format.' });
    hasFixed = true;
  } else {
    checks.push({ field: 'Phone', originalValue: rawPhone, status: 'OK', note: 'Phone number is valid E.164 format.' });
  }

  // ── Balance check ───────────────────────────────────────────────
  const rawBalance = String(record.OutstandingAmount || record.balance || '').trim();
  const balanceNum = parseFloat(rawBalance.replace(/[^0-9.\-]/g, ''));
  if (!rawBalance) {
    checks.push({ field: 'Balance', originalValue: '(empty)', status: 'ERROR', note: 'Outstanding amount is missing — cannot compute risk score.' });
    hasError = true;
  } else if (isNaN(balanceNum)) {
    checks.push({ field: 'Balance', originalValue: rawBalance, status: 'ERROR', note: `Non-numeric value "${rawBalance}" — cannot parse as currency.` });
    hasError = true;
  } else if (balanceNum < 0) {
    const fixed = String(Math.abs(balanceNum));
    checks.push({ field: 'Balance', originalValue: rawBalance, fixedValue: fixed, status: 'FIXED', note: 'Negative balance detected — converted to unsigned absolute value.' });
    hasFixed = true;
  } else {
    checks.push({ field: 'Balance', originalValue: `₹${balanceNum.toLocaleString('en-IN')}`, status: 'OK', note: 'Balance field valid.' });
  }

  // ── DPD check ───────────────────────────────────────────────────
  const rawDpd = String(record.DaysPastDue || record.dpd || '').trim();
  const dpdNum = parseInt(rawDpd);
  let finalDpd = 0;
  if (!rawDpd) {
    checks.push({ field: 'DPD', originalValue: '(empty)', fixedValue: '0', status: 'FIXED', note: 'DPD missing — defaulted to 0 (current, no overdue).' });
    hasFixed = true;
  } else if (isNaN(dpdNum) || dpdNum < 0) {
    checks.push({ field: 'DPD', originalValue: rawDpd, fixedValue: '0', status: 'FIXED', note: 'Invalid DPD value — defaulted to 0.' });
    hasFixed = true;
  } else if (dpdNum > 365) {
    finalDpd = dpdNum;
    checks.push({ field: 'DPD', originalValue: `${dpdNum} days`, status: 'WARNING', note: `Extreme overdue DPD (> 365 days) — flagged for legal/recovery team review.` });
    hasWarning = true;
  } else {
    finalDpd = dpdNum;
    checks.push({ field: 'DPD', originalValue: `${dpdNum} days`, status: 'OK', note: 'DPD value valid.' });
  }

  // ── Financial Ledger Mismatch Check ─────────────────────────────
  if (!isNaN(balanceNum) && balanceNum === 0 && finalDpd > 0) {
    checks.push({ field: 'Balance', originalValue: '₹0', status: 'ERROR', note: `DPD is active (${finalDpd} days) but outstanding balance is ₹0 — financial mismatch, account suspended.` });
    hasError = true;
  }

  // ── Email check ──────────────────────────────────────────────────
  const email = String(record.email || record.Email || '').trim();
  if (!email) {
    checks.push({ field: 'Email', originalValue: '(empty)', status: 'WARNING', note: 'Email address is missing — email outreach channel disabled.' });
    hasWarning = true;
  } else if (!email.includes('@')) {
    checks.push({ field: 'Email', originalValue: email, status: 'WARNING', note: 'Invalid email address structure — email outreach channel disabled.' });
    hasWarning = true;
  } else {
    checks.push({ field: 'Email', originalValue: email, status: 'OK', note: 'Email validated.' });
  }

  // ── AssetClass check ─────────────────────────────────────────────
  const knownAssets = ['Home Loan', 'Vehicle Loan', 'Gold Loan', 'Business Loan', 'Personal Loan', 'Credit Card', 'Education Loan'];
  const rawAsset = String(record.AssetClass || record.asset_class || '').trim();
  if (!rawAsset) {
    checks.push({ field: 'AssetClass', originalValue: '(empty)', fixedValue: 'Personal Loan', status: 'FIXED', note: 'Asset class missing — defaulted to Personal Loan for risk scoring.' });
    hasFixed = true;
  } else if (!knownAssets.includes(rawAsset)) {
    let fixedVal = 'Personal Loan';
    let assetNote = `Unrecognized asset class "${rawAsset}" — mapped to Personal Loan.`;
    if (rawAsset.toLowerCase().includes('two-wheeler') || rawAsset.toLowerCase().includes('motorcycle') || rawAsset.toLowerCase().includes('bike') || rawAsset.toLowerCase().includes('vehicle')) {
      fixedVal = 'Vehicle Loan';
      assetNote = `Unrecognized asset class "${rawAsset}" — mapped to Vehicle Loan.`;
    }
    checks.push({ field: 'AssetClass', originalValue: rawAsset, fixedValue: fixedVal, status: 'FIXED', note: assetNote });
    hasFixed = true;
  } else {
    checks.push({ field: 'AssetClass', originalValue: rawAsset, status: 'OK', note: 'Asset class recognized.' });
  }

  const status: RecordCleaningEvent['status'] = hasError ? 'ERROR' : hasFixed ? 'FIXED' : 'CLEAN';
  return { rowIndex, name: name || 'Unknown', phone: rawPhone || '—', fieldChecks: checks, status };
}

export function simulateFileCleaningStream(fileRecords: any[]): RecordCleaningEvent[] {
  return fileRecords.map((r, i) => cleanRecord(r, i + 1));
}

export interface AiRiskInsight {
  name: string;
  phone: string;
  tier: 'Critical' | 'High' | 'Medium' | 'Low';
  reason: string;
  outstanding: string;
  dpd: number;
  assetClass: string;
  channel: string;
}

// AI per-record risk scoring engine
// Analyzes each record holistically: balance band, DPD window, asset class risk weight, region
function scoreRiskByAI(record: any): AiRiskInsight {
  const outstanding = parseFloat(String(record.OutstandingAmount || record.balance || '0').replace(/[^0-9.]/g, '')) || 0;
  const dpd = parseInt(String(record.DaysPastDue || record.dpd || '0')) || 0;
  const assetClass = String(record.AssetClass || record.asset_class || 'Personal Loan');
  const region = String(record.Region || record.region || 'General');
  const name = String(record.name || 'Customer');
  const phone = String(record.phone || '');

  // Asset class risk weight (AI-informed)
  const assetWeightMap: Record<string, number> = {
    'Home Loan': 2.5,
    'Vehicle Loan': 2.0,
    'Gold Loan': 1.8,
    'Business Loan': 2.2,
    'Personal Loan': 1.5,
    'Credit Card': 1.2,
    'Education Loan': 1.0,
  };
  const assetWeight = assetWeightMap[assetClass] || 1.5;

  // Composite AI score (balance magnitude × DPD severity × asset class risk)
  const normalizedBalance = Math.min(outstanding / 100000, 1); // normalize up to ₹1L
  const normalizedDpd = Math.min(dpd / 90, 1); // normalize up to 90 days
  const compositeScore = (normalizedBalance * 0.45) + (normalizedDpd * 0.40) + ((assetWeight / 2.5) * 0.15);

  let tier: 'Critical' | 'High' | 'Medium' | 'Low';
  let reason: string;
  let channel: string;

  if (compositeScore >= 0.65) {
    tier = 'Critical';
    reason = `High outstanding (₹${outstanding.toLocaleString('en-IN')}) with ${dpd} days overdue. ${assetClass} flagged as high-exposure by LLM. Immediate escalation required.`;
    channel = 'AI Voice Bot (Immediate)';
  } else if (compositeScore >= 0.40) {
    tier = 'High';
    reason = `Elevated outstanding (₹${outstanding.toLocaleString('en-IN')}) with ${dpd} DPD. ${assetClass} risk profile warrants proactive engagement.`;
    channel = 'AI Voice Bot (Scheduled)';
  } else if (compositeScore >= 0.20) {
    tier = 'Medium';
    reason = `Moderate balance (₹${outstanding.toLocaleString('en-IN')}) with ${dpd} DPD. IVR & WhatsApp are cost-effective at this stage.`;
    channel = 'IVR + WhatsApp';
  } else {
    tier = 'Low';
    reason = `Low outstanding (₹${outstanding.toLocaleString('en-IN')}) with minimal DPD (${dpd} days). Automated SMS reminder is sufficient.`;
    channel = 'SMS Reminder';
  }

  return { name, phone, tier, reason, outstanding: `₹${outstanding.toLocaleString('en-IN')}`, dpd, assetClass, channel };
}

export function simulateInboundFileProcess(fileRecords: any[]): Promise<{ logs: SimulationLog[]; insights: AiRiskInsight[] }> {
  const count = fileRecords.length;
  const insights: AiRiskInsight[] = fileRecords.map(r => scoreRiskByAI(r));

  const criticalRecords = insights.filter(i => i.tier === 'Critical');
  const highRecords = insights.filter(i => i.tier === 'High');
  const mediumRecords = insights.filter(i => i.tier === 'Medium');
  const lowRecords = insights.filter(i => i.tier === 'Low');

  const critical = criticalRecords.length;
  const high = highRecords.length;
  const medium = mediumRecords.length;
  const low = lowRecords.length;

  const now = Date.now();
  const logs: SimulationLog[] = [
    // Phase 1: Parsing
    { timestamp: new Date(now - 9000).toISOString(), type: 'INFO', phase: 'parsing', message: `Reading & Parsing CSV boundaries; identified ${count} rows with mapped headers.` },
    { timestamp: new Date(now - 8200).toISOString(), type: 'INFO', phase: 'parsing', message: `Schema alignment: name, phone, OutstandingAmount, DueDate, DaysPastDue, AssetClass, Region.` },
    { timestamp: new Date(now - 7500).toISOString(), type: 'WARN', phase: 'parsing', message: `Cleaned phone formats on ${Math.max(1, Math.floor(count * 0.08))} rows (applied +91 country prefix standard).` },
    { timestamp: new Date(now - 6800).toISOString(), type: 'WARN', phase: 'parsing', message: `Detected ${Math.max(0, Math.floor(count * 0.04))} negative/missing balance entries. Auto-corrected to unsigned values.` },
    { timestamp: new Date(now - 6000).toISOString(), type: 'INFO', phase: 'parsing', message: `Syntactic parsing finished: 0 hard errors. ${count} records queued for analysis.` },

    // Phase 2: Deduplication
    { timestamp: new Date(now - 5200).toISOString(), type: 'INFO', phase: 'deduplication', message: 'Executing cross-campaign database matching check by Reference ID and phone number...' },
    { timestamp: new Date(now - 4500).toISOString(), type: 'WARN', phase: 'deduplication', message: `Found 2 cross-file duplicate contacts. Merging balances, redirecting active campaign tasks.` },
    { timestamp: new Date(now - 3800).toISOString(), type: 'INFO', phase: 'deduplication', message: 'Cancelled conflicting pending tasks from older batches to prevent double-outreach.' },
    { timestamp: new Date(now - 3200).toISOString(), type: 'SUCCESS', phase: 'deduplication', message: `Deduplication complete. ${count - 2} unique customer profiles ready for AI risk analysis.` },

    // Phase 3: AI Risk Scoring — per record reasoning (show up to 4 sample logs)
    { timestamp: new Date(now - 2800).toISOString(), type: 'INFO', phase: 'risk_scoring', message: `Dispatching ${count} records to LLM cognitive risk scoring engine...` },
    { timestamp: new Date(now - 2400).toISOString(), type: 'LLM', phase: 'risk_scoring', message: `Analyzing signals: OutstandingAmount × DPD window × AssetClass risk weight × Region exposure.` },
    ...(criticalRecords.slice(0, 2).map((r, i) => ({
      timestamp: new Date(now - 2100 + i * 200).toISOString(),
      type: 'LLM' as const,
      phase: 'risk_scoring' as const,
      message: `[CRITICAL] "${r.name}" (${r.outstanding} | DPD ${r.dpd} | ${r.assetClass}) → Composite risk score HIGH. ${r.reason}`
    }))),
    ...(highRecords.slice(0, 1).map((r, i) => ({
      timestamp: new Date(now - 1700 + i * 200).toISOString(),
      type: 'LLM' as const,
      phase: 'risk_scoring' as const,
      message: `[HIGH] "${r.name}" (${r.outstanding} | DPD ${r.dpd} | ${r.assetClass}) → ${r.reason}`
    }))),
    ...(mediumRecords.slice(0, 1).map((r, i) => ({
      timestamp: new Date(now - 1400 + i * 200).toISOString(),
      type: 'LLM' as const,
      phase: 'risk_scoring' as const,
      message: `[MEDIUM] "${r.name}" (${r.outstanding} | DPD ${r.dpd} | ${r.assetClass}) → ${r.reason}`
    }))),
    { timestamp: new Date(now - 1000).toISOString(), type: 'SUCCESS', phase: 'risk_scoring', message: `AI Risk assessment complete → Critical: ${critical} | High: ${high} | Medium: ${medium} | Low: ${low}` },

    // Phase 4: Strategy
    { timestamp: new Date(now - 600).toISOString(), type: 'INFO', phase: 'strategy_formulation', message: `Building optimal outreach route matrix for ${count} records...` },
    { timestamp: new Date(now - 300).toISOString(), type: 'LLM', phase: 'strategy_formulation', message: `Critical + High (${critical + high} accounts) → AI Voice Bot. Medium (${medium}) → IVR & WhatsApp. Low (${low}) → SMS Reminder.` },
    { timestamp: new Date(now).toISOString(), type: 'SUCCESS', phase: 'strategy_formulation', message: `Campaign strategy ready. ${count} accounts distributed across 4 communication channels. Ready to broadcast.` },
  ];

  return Promise.resolve({ logs, insights });
}

export const mockDB = new MockDatabaseStore();

