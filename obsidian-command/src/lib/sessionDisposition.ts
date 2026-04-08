export type DispositionTone = 'success' | 'warning' | 'danger' | 'neutral';

export type DispositionMeta = {
  label: string;
  description: string;
  statusTone: DispositionTone;
  nextSteps: string[];
};

export const DISPOSITION_META: Record<string, DispositionMeta> = {
  resolved_satisfied: {
    label: 'Ended successfully (satisfied)',
    description: 'The user completed their goal and appears satisfied.',
    statusTone: 'success',
    nextSteps: [
      'Mark the session as complete in CRM.',
      'Send a short confirmation message if your flow requires it.',
      'Tag this conversation as a successful resolution example.',
    ],
  },
  callback_requested: {
    label: 'Callback requested',
    description: 'The user asked for a follow-up call.',
    statusTone: 'warning',
    nextSteps: [
      'Create a callback task with preferred time window.',
      'Assign the callback owner and add session notes.',
      'Trigger reminder workflow before callback SLA expires.',
    ],
  },
  user_declined: {
    label: 'User declined to continue',
    description: 'The user refused to continue the conversation.',
    statusTone: 'danger',
    nextSteps: [
      'Do not retry immediately unless policy allows it.',
      'Mark contact preference and decline reason in notes.',
      'Route to low-frequency re-engagement cadence if applicable.',
    ],
  },
  payment_pending: {
    label: 'Ready to pay (pending bills/payment)',
    description: 'The user is willing, but payment completion is pending.',
    statusTone: 'warning',
    nextSteps: [
      'Send payment link or invoice details.',
      'Validate pending amount and due date with billing system.',
      'Schedule a short follow-up for payment completion.',
    ],
  },
  needs_assistance: {
    label: 'Customer needs more assistance',
    description: 'The issue remains unresolved or partially resolved.',
    statusTone: 'warning',
    nextSteps: [
      'Escalate to specialist or human support queue.',
      'Capture missing details and blockers from transcript.',
      'Set priority and follow-up timeline for resolution.',
    ],
  },
  needs_more_time: {
    label: 'Requested more time',
    description: 'The user asked for more time before proceeding.',
    statusTone: 'neutral',
    nextSteps: [
      'Set a reminder for the user-requested timeline.',
      'Share concise recap and pending decision items.',
      'Re-open the same case on the follow-up date.',
    ],
  },
  unknown: {
    label: 'Outcome unclear',
    description: 'The conversation did not clearly indicate a final outcome.',
    statusTone: 'neutral',
    nextSteps: [
      'Review transcript quickly for missing context.',
      'Add manual outcome tag if known.',
      'Queue for lightweight supervisor review if needed.',
    ],
  },
};

export function getDispositionMeta(code: string | undefined): DispositionMeta {
  if (!code) return DISPOSITION_META.unknown;
  return DISPOSITION_META[code] ?? DISPOSITION_META.unknown;
}

