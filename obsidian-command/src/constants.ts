import { Teammate, Session, KnowledgeEntry, AgentPersona, Workflow, SessionDetail } from './types';

// ... existing constants ...

export const WORKFLOWS: Workflow[] = [
  {
    id: '1',
    name: 'Call Setup Flow',
    description: 'Standard procedure for scheduling a discovery call with potential clients.',
    status: 'Active',
    lastUpdated: 'Oct 25, 2024 · 10:30',
    steps: [
      { id: 's1', type: 'trigger', label: 'User Intent: Book Call', description: 'Triggered when user expresses interest in a call.', icon: 'Zap' },
      { id: 's2', type: 'action', label: 'Check Availability', description: 'Queries the calendar for open slots.', icon: 'Calendar' },
      { id: 's3', type: 'condition', label: 'Slots Available?', description: 'Branch based on calendar availability.', icon: 'GitBranch' },
      { id: 's4', type: 'action', label: 'Present Options', description: 'Show available time slots to the user.', icon: 'MessageSquare' },
      { id: 's5', type: 'action', label: 'Confirm Booking', description: 'Finalize the appointment in the system.', icon: 'CheckCircle' }
    ]
  },
  {
    id: '2',
    name: 'Support Escalation',
    description: 'Workflow for handing off complex technical issues to human agents.',
    status: 'Draft',
    lastUpdated: 'Oct 26, 2024 · 15:45',
    steps: [
      { id: 'e1', type: 'trigger', label: 'High Sentiment Score', description: 'Triggered on negative user sentiment.', icon: 'AlertTriangle' },
      { id: 'e2', type: 'action', label: 'Summarize Issue', description: 'Generate a summary of the conversation.', icon: 'FileText' },
      { id: 'e3', type: 'action', label: 'Notify Team', description: 'Send alert to Slack/Discord.', icon: 'Bell' }
    ]
  },
  {
    id: '3',
    name: 'Loan Recovery Flow',
    description: 'Complex workflow for handling overdue loan payments, handling objections, and sending reminders.',
    status: 'Active',
    lastUpdated: 'Mar 27, 2026 · 13:06',
    steps: [
      { id: 'l1', type: 'trigger', label: 'Due Date Passed', description: 'Triggered when a loan payment is overdue.', icon: 'AlertTriangle' },
      { id: 'l2', type: 'speech', label: 'Initial Reminder', description: 'Friendly reminder about the due payment.', icon: 'MessageSquare' },
      { id: 'l3', type: 'userInput', label: 'User Response', description: 'Listen for payment commitment or objection.', icon: 'Search' },
      { id: 'l4', type: 'logic', label: 'Agrees to Pay?', description: 'Branch based on user commitment.', icon: 'GitBranch' },
      { id: 'l5', type: 'action', label: 'Send SMS Link', description: 'Send payment link via SMS.', icon: 'Bell' }
    ]
  }
];

export const TEAMMATES: Teammate[] = [
  {
    id: '1',
    name: 'Alex Rivera',
    email: 'alex@sonicarchitect.ai',
    role: 'Admin',
    status: 'Active Now',
    avatar: 'https://picsum.photos/seed/alex/100/100'
  },
  {
    id: '2',
    name: 'Nova Chen',
    email: 'nova.c@sonicarchitect.ai',
    role: 'Editor',
    status: 'Away',
    avatar: 'https://picsum.photos/seed/nova/100/100'
  },
  {
    id: '3',
    name: 'Max Power',
    email: 'max.p@sonicarchitect.ai',
    role: 'Viewer',
    status: '2h ago',
    avatar: 'https://picsum.photos/seed/max/100/100'
  }
];

export const SESSIONS: Session[] = [
  { id: 'VX-9102', bot: 'Alex', status: 'Active', time: 'Just now', duration: '04:22', turns: 12, sentiment: 0.85, intent: 'Feature Inquiry', date: 'Oct 24, 2024' },
  { id: 'VX-9098', bot: 'Nova', status: 'Ended', time: '4m ago', duration: '08:15', turns: 24, sentiment: 0.72, intent: 'Booking', date: 'Oct 24, 2024' },
  { id: 'VX-9087', bot: 'Alex', status: 'Ended', time: '12m ago', duration: '02:40', turns: 8, sentiment: 0.65, intent: 'Support', date: 'Oct 24, 2024' },
  { id: 'VX-9082', bot: 'Max', status: 'Ended', time: '28m ago', duration: '11:04', turns: 31, sentiment: 0.91, intent: 'General', date: 'Oct 24, 2024' }
];

export const SESSION_DETAILS: Record<string, SessionDetail> = {
  'VX-9102': {
    ...SESSIONS[0],
    transcript: [
      { role: 'bot', content: 'Hello! How can I help you today?', timestamp: '00:01' },
      { role: 'user', content: 'I want to know more about your enterprise features.', timestamp: '00:05' },
      { role: 'bot', content: 'Our enterprise plan includes advanced analytics, custom bot personas, and 24/7 support. Would you like a demo?', timestamp: '00:10' },
      { role: 'user', content: 'Yes, that sounds great. How do I sign up?', timestamp: '00:15' },
      { role: 'bot', content: 'I can help you with that. I just need a few details from you.', timestamp: '00:20' },
    ],
    summary: 'User inquired about enterprise features and expressed interest in a demo. The bot provided a summary of key features and offered to initiate the signup process.',
    insights: [
      'User is highly engaged and interested in high-tier features.',
      'Positive sentiment throughout the conversation.',
      'Intent clearly identified as "Feature Inquiry".'
    ],
    metrics: {
      sttLatency: 120,
      llmLatency: 450,
      ttsLatency: 180,
      totalRtt: 750
    },
    recordingUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
  },
  'VX-9098': {
    ...SESSIONS[1],
    transcript: [
      { role: 'bot', content: 'Hi there! Ready to book your appointment?', timestamp: '00:01' },
      { role: 'user', content: 'Yes, for tomorrow at 2 PM.', timestamp: '00:04' },
      { role: 'bot', content: 'Checking availability... Yes, we have a slot at 2 PM tomorrow. Shall I confirm it?', timestamp: '00:08' },
      { role: 'user', content: 'Perfect, go ahead.', timestamp: '00:12' },
      { role: 'bot', content: 'Done! Your appointment is booked for tomorrow at 2 PM. You will receive a confirmation email shortly.', timestamp: '00:16' },
    ],
    summary: 'Successful appointment booking for tomorrow at 2 PM. User was quick and decisive.',
    insights: [
      'Efficient transaction completed in under 2 minutes.',
      'Extremely high sentiment score (0.92).',
      'User preferred direct, concise communication.'
    ],
    metrics: {
      sttLatency: 110,
      llmLatency: 400,
      ttsLatency: 150,
      totalRtt: 660
    },
    recordingUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'
  }
};

export const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    id: '1',
    category: 'Office Hours',
    priority: 1,
    question: 'What are your standard business hours?',
    answer: 'Our main corporate offices are open Monday through Friday from 9:00 AM to 6:00 PM EST. However, technical support is available 24/7 for Enterprise clients.',
    tags: ['hours', 'schedule', 'holidays'],
    hits: '1.2k',
    confidence: '98%',
    lastUpdated: 'Oct 24, 2023 · 14:22',
    author: 'AI Trainer (Admin)',
    path: '/support/sla/priority'
  },
  {
    id: '2',
    category: 'Pricing Policy',
    priority: 2,
    question: 'How much does the Enterprise plan cost?',
    answer: 'The Enterprise tier starts at $2,500/month and includes unlimited seats, custom voice training, and 24/7 dedicated support with a guaranteed SLA.',
    tags: ['billing', 'enterprise'],
    hits: '850',
    confidence: '95%',
    lastUpdated: 'Oct 22, 2023 · 09:15',
    author: 'Finance Lead',
    path: '/billing/enterprise/pricing'
  }
];

export const PERSONAS: AgentPersona[] = [
  {
    id: 'alex',
    name: 'Alex',
    role: 'AI Concierge',
    description: 'Expert in seamless knowledge retrieval and initial customer onboarding. Optimized for hospitality tone.',
    status: 'Active',
    sessions: '842',
    rating: 4.8,
    completion: '98%',
    tools: ['search_knowledge', 'book_appointment'],
    icon: 'concierge',
    color: 'primary'
  },
  {
    id: 'nova',
    name: 'Nova',
    role: 'Technical Lead',
    description: 'Specialized in complex technical troubleshooting, API documentation navigation, and deep code analysis.',
    status: 'Active',
    sessions: '1.2k',
    rating: 4.9,
    completion: '94%',
    tools: ['search_knowledge', 'handle_support'],
    icon: 'memory',
    color: 'secondary'
  },
  {
    id: 'max',
    name: 'Max',
    role: 'Schedule Asst',
    description: 'Currently under maintenance. Optimized for calendar synchronization and booking flows.',
    status: 'Inactive',
    sessions: '321',
    rating: 4.6,
    completion: '99%',
    tools: ['book_appointment'],
    icon: 'event_busy',
    color: 'outline'
  },
  {
    id: 'loan-bot',
    name: 'Finley',
    role: 'Loan Specialist',
    description: 'Empathetic yet firm agent specialized in debt recovery, payment plans, and financial counseling.',
    status: 'Active',
    sessions: '2.4k',
    rating: 4.7,
    completion: '92%',
    tools: ['search_knowledge', 'send_sms', 'process_payment'],
    icon: 'account_balance',
    color: 'primary'
  }
];
