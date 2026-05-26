import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Upload, Play, Pause, RefreshCw, FileText, CheckCircle, AlertTriangle,
  TrendingUp, User, Users, Phone, MessageSquare, Clock, ArrowRight, Shield,
  Activity, Sparkles, Plus, Search, Filter, X, ChevronDown, ChevronUp, Database, History, Lock,
  Layers, Cpu, ShieldAlert, Send
} from 'lucide-react';
import { Header } from '../components/Header';
import {
  mockDB, AnalysisJob, JobEntity, InteractionLog, ScheduledTask, RecommendedAction,
  simulateInboundFileProcess, SimulationLog, AiRiskInsight,
  simulateFileCleaningStream, RecordCleaningEvent, CleaningSummary
} from '../data/mockCustomerActions';
import { PERSONAS } from '../constants';
import { api, Bot } from '../lib/api';

interface CampaignCasePreset {
  id: string;
  name: string;
  botId: string;
  botName: string;
  role: string;
  voice: string;
  voiceGender: 'Female' | 'Male';
  description: string;
  systemPrompt: string;
}

const CAMPAIGN_PRESET_CASES: CampaignCasePreset[] = [
  {
    id: 'case-1',
    name: 'Auto-Collections Warm Nudge',
    botId: 'loan-bot',
    botName: 'Finley',
    role: 'Collections Specialist',
    voice: 'Aditi (Indian Female)',
    voiceGender: 'Female',
    description: 'Empathetic, polite voice outreach prioritizing soft reminders and transaction link dispatch.',
    systemPrompt: `[RULE 1: SEGMENTATION & SCRUBBING]
Filter all incoming files for active retail loan borrowers with outstanding amounts > ₹0. Validate phone formats and remove DND registered entries.

[RULE 2: ROUTING ENGINE]
- Risk Tier [Critical/High]: Trigger immediate AI Voice Bot dialing via SIP Trunk Channels.
- Risk Tier [Medium/Low]: Dispatch interactive WhatsApp message templates with embedded payment buttons and quick replies.

[RULE 3: REAL-TIME RESPONSE PROTOCOLS]
- If borrower registers Promise-To-Pay (PTP): Enqueue a WhatsApp confirmation alert and schedule a payment reminder 24 hours prior to promise date.
- If borrower rejects or hangs up: Escalate account to the manual recovery queue immediately.

[RULE 4: FAILOVER RETRY MATRIX]
- If Call status is Busy, NoAnswer, or Network Drop: Auto-schedule CallRetry sweep in 2 hours. Cap maximum automated retries at 3 attempts per record.`
  },
  {
    id: 'case-2',
    name: 'Credit Card Hard Recovery Loop',
    botId: 'nova',
    botName: 'Nova',
    role: 'Hard Collections Lead',
    voice: 'Rohan (Indian Male)',
    voiceGender: 'Male',
    description: 'Firm and urgent tone targeting retail credit card overdue balances greater than 30 DPD.',
    systemPrompt: `[RULE 1: SEGMENTATION & RISK LEVEL]
Identify all credit card records with Days Past Due (DPD) > 30 and outstanding balance > ₹25,000. Prioritize High and Critical risk tiers.

[RULE 2: CHANNEL ORCHESTRATION]
- Voice Call Priority: Place outbound AI calls on voice trunk line 1 to 12. Speak in a firm and urgent tone, using Indian English/Hindi dialects.
- Fallback Trigger: If voice call fails or customer rejects, dispatch SMS with a secure UPI payment link within 5 minutes.

[RULE 3: CONCURRENCY & TRAFFIC TUNING]
Voice SIP channels dial concurrent trunks. Set call pacing to 1.5x active trunk capacity. High-priority voice queues execute in parallel with digital channels.

[RULE 4: ESCALATION & HANDOVER]
- If no contact is established after 4 voice attempts and 2 SMS follow-ups, trigger the Hard Escalation Protocol.
- Handover profile immediately to Field Recovery Desk for manual address validation and physical visit scheduler.`
  },
  {
    id: 'case-3',
    name: 'Auto-Debit Bounce Sweep',
    botId: 'alex',
    botName: 'Alex',
    role: 'EMI Bounce Manager',
    voice: 'Serena (US Female)',
    voiceGender: 'Female',
    description: 'Standard informational notice regarding failed auto-debit sweeps and repayment schedules.',
    systemPrompt: `[RULE 1: IMMEDIATE EVENT TRIGGER]
Detect auto-debit bounce events from bank sweep reports. Match customer account references against the active customer ledger.

[RULE 2: REAL-TIME ROUTING FLOW]
- Within 15 Minutes: Dispatch WhatsApp alert template notifying customer of the failed sweep and the applicable late-fee penalty waiver period.
- Dialing Protocol: For accounts with outstanding dues > ₹15,000, trigger automated IVR dialing loop to verify account funding status.

[RULE 3: CONFLICT MERGING]
If customer has multiple active loans, consolidate outstanding dues under a single primary ref ID and merge historical interaction logs.

[RULE 4: RESOLUTION SCHEDULER]
- If customer clicks "Confirm Alternate Payment": Deliver instant UPI payment link via WhatsApp.
- If payment confirmation is not received within 24 hours, schedule auto-debit re-sweep attempt for tomorrow morning.`
  },
  {
    id: 'case-4',
    name: 'Two-Wheeler Late Fee Wave',
    botId: 'loan-bot',
    botName: 'Finley',
    role: 'Asset Recovery Bot',
    voice: 'Rohan (Indian Male)',
    voiceGender: 'Male',
    description: 'Localized Hindi/English dialect outreach specifically for two-wheeler asset late reminders.',
    systemPrompt: `[RULE 1: TARGETING & GEOGRAPHIC RULES]
Filter two-wheeler loan accounts with DPD range 15 to 60. Segment accounts by geographic region to load local language voice presets (Hindi, Tamil, Marathi).

[RULE 2: CAMPAIGN EXECUTION ENGINE]
- WhatsApp First Strategy: Deliver rich media message showing image of two-wheeler vehicle and payment breakdown including interest and penalties.
- Interactive UPI Link: Pre-populate dynamic payment links with the exact outstanding amount.

[RULE 3: DIALER QUEUE RULES]
- Dialing hours: Restrict outbound AI calls to 9:30 AM to 7:30 PM.
- Voice Bot rules: State penalty fee accumulations clearly and request instant confirmation of digital payment.

[RULE 4: REPOSSESSION WARNING TRIGGER]
- If DPD exceeds 45 days, append a Repossession Warning notice to the communication template.
- If still unresolved by 60 DPD, flag account state as "Critical Asset Risk" and escalate to regional repossession field desk.`
  },
  {
    id: 'case-5',
    name: 'CSAT Satisfaction Feedback Survey',
    botId: 'nova',
    botName: 'Nova',
    role: 'Satisfaction Analyst',
    voice: 'Aditi (Indian Female)',
    voiceGender: 'Female',
    description: 'Warm and conversational greeting survey to assess customer onboarding experience.',
    systemPrompt: `[RULE 1: COHORT DEFINITION]
Extract all newly resolved accounts where payment status transitioned to 'Resolved' or 'Settled' within the past 48 hours.

[RULE 2: AUTOMATED SURVEY DISPATCH]
- Initial Touchpoint: Send automated WhatsApp survey template asking customer to rate their collections experience on a scale of 1-10.
- Response Tracking: Listen for interactive button responses or text-reply classifications.

[RULE 3: ADAPTIVE FOLLOW-UP RULES]
- Rating >= 7/10: Auto-deliver standard thank you note and archive.
- Rating 5-6/10: Send text request for specific improvement suggestions.
- Rating < 5/10 (Negative Feedback): Trigger immediate escalation and enqueue automated Voice Agent call to gather feedback.

[RULE 4: QUALITY DESK HANDOVER]
Compile low-rating logs and dispatch daily CSAT audit reports to customer service supervisors.`
  },
  {
    id: 'case-6',
    name: 'Premium Account Retention Outreach',
    botId: 'alex',
    botName: 'Alex',
    role: 'Wealth Advisor Bot',
    voice: 'Marcus (US Male)',
    voiceGender: 'Male',
    description: 'Polished, premium advisory voice to assist high-value customers with upcoming EMI dues.',
    systemPrompt: `[RULE 1: PRESET SEGMENT DEFINITION]
Identify premium credit card and high-net-worth wealth account portfolios with upcoming payment due dates within 7 days.

[RULE 2: EMBELLISHED PERSONAL BANKER TONE]
- Custom Audio Voice: Deploy premium advisory voice bot (Marcus - US Male) with calm, professional, and helpful persona characteristics.
- Zero Pressure Rules: Never use debt collection terminology. Frame conversation around "Premium Account Assistance" and "Payment Convenience".

[RULE 3: PERSONALIZED REMEDIAL OPTIONS]
- If customer responds: Offer custom payment date scheduling or setup assistance for auto-debit sweeps.
- If interest rate query is raised: Route call seamlessly to a human Relationship Manager.

[RULE 4: EXECUTION PROTOCOLS]
- Contact attempts: Maximum 1 voice check-in and 1 WhatsApp reminder.
- Schedule: Deliver messages only during business hours (10:00 AM - 5:00 PM).`
  }
];

export default function ActionAnalyzer() {
  const [activeTab, setActiveTab] = useState<'upload' | 'monitor' | 'explorer'>('upload');
  
  // Database state hooks (synced from mockDB)
  const [jobs, setJobs] = useState<AnalysisJob[]>([]);
  const [entities, setEntities] = useState<JobEntity[]>([]);
  const [interactions, setInteractions] = useState<InteractionLog[]>([]);
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendedAction[]>([]);

  // Page level selectors
  const [selectedJobId, setSelectedJobId] = useState<string>('job-1');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [riskFilter, setRiskFilter] = useState('All');
  const [timelineFilter, setTimelineFilter] = useState<'All' | 'Today' | 'Future'>('All');
  const [expandedEntityId, setExpandedEntityId] = useState<string | null>(null);

  // Table pagination, sorting, and customer details drawer states
  const [selectedEntityDetailId, setSelectedEntityDetailId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'name' | 'OutstandingAmount' | 'DaysPastDue' | 'riskLevel' | 'status'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Job insights drawer state
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const selectedJobDetailId = id || null;
  const setSelectedJobDetailId = (newId: string | null) => {
    if (newId) {
      navigate(`/campaign-ai/${newId}`);
    } else {
      navigate('/campaign-ai');
    }
  };
  const [drawerSearchQuery, setDrawerSearchQuery] = useState('');
  const [detailActiveStep, setDetailActiveStep] = useState<number>(0);
  const lastActiveJobRef = useRef<{ id: string; status: string } | null>(null);

  // Auto-select the last running or active step of the campaign on open/status transition
  useEffect(() => {
    if (!selectedJobDetailId) {
      lastActiveJobRef.current = null;
      return;
    }
    const job = jobs.find(j => j.id === selectedJobDetailId);
    if (!job) return;

    const ref = lastActiveJobRef.current;
    if (!ref || ref.id !== selectedJobDetailId || ref.status !== job.status) {
      let calculatedStep = 0;
      if (job.status === 'Analyzing') {
        const progress = job.processedRecords / (job.totalRecords || 1);
        if (progress < 0.25) calculatedStep = 0;
        else if (progress < 0.5) calculatedStep = 1;
        else if (progress < 0.75) calculatedStep = 2;
        else calculatedStep = 3;
      } else if (job.status === 'Executing' || job.status === 'Completed') {
        calculatedStep = 4;
      } else {
        calculatedStep = 0;
      }
      setDetailActiveStep(calculatedStep);
      lastActiveJobRef.current = { id: selectedJobDetailId, status: job.status };
    }
  }, [selectedJobDetailId, jobs]);

  // Full-page ingestion & broadcast simulation states
  const [simulationStage, setSimulationStage] = useState<'idle' | 'parsing' | 'strategy' | 'broadcasting'>('idle');
  const [visibleSimLogs, setVisibleSimLogs] = useState<SimulationLog[]>([]);
  const [activeParsingPhase, setActiveParsingPhase] = useState<'cleaning' | 'dedup' | 'scoring' | 'done'>('cleaning');
  
  // Strategy configurations: Selected channels for each risk tier
  const [channelRules, setChannelRules] = useState<Record<string, string[]>>({
    Critical: ['ai_voice', 'whatsapp'],
    High: ['ai_voice'],
    Medium: ['ivr', 'whatsapp'],
    Low: ['sms']
  });

  // Broadcasting progression state
  const [broadcastProgress, setBroadcastProgress] = useState(0);
  const [broadcastLogs, setBroadcastLogs] = useState<string[]>([]);
  const [broadcastStates, setBroadcastStates] = useState<Record<string, { customer: string; step: number }>>({
    sms: { customer: '', step: 0 },
    whatsapp: { customer: '', step: 0 },
    ivr: { customer: '', step: 0 },
    ai_voice: { customer: '', step: 0 }
  });

  // AI-analyzed per-record risk insights state
  const [aiInsights, setAiInsights] = useState<AiRiskInsight[]>([]);

  // File Reading & Cleaning phase animated state
  const [cleaningEvents, setCleaningEvents] = useState<RecordCleaningEvent[]>([]);
  const [cleaningProgress, setCleaningProgress] = useState(0);   // 0-100
  const [cleaningCounter, setCleaningCounter] = useState(0);     // records processed so far (ticking)
  const [cleaningSummary, setCleaningSummary] = useState<CleaningSummary>({ total: 0, clean: 0, fixed: 0, warnings: 0, errors: 0 });
  const [cleaningDone, setCleaningDone] = useState(false);
  const [showReviewIngestion, setShowReviewIngestion] = useState(false);
  const [reviewActiveStep, setReviewActiveStep] = useState(0);

  // Audit Report Generator State
  const [showReportGeneratorModal, setShowReportGeneratorModal] = useState<boolean>(false);
  const [reportGenerationPhase, setReportGenerationPhase] = useState<'idle' | 'aggregating' | 'compiling' | 'scoring' | 'done'>('idle');

  // Step 5 interactive drilldowns and detail journey state
  const [outreachFilterType, setOutreachFilterType] = useState<'all' | 'commitments' | 'failed' | 'sms_fail' | 'whatsapp_fail' | 'ivr_fail' | 'voice_fail'>('all');
  const [selectedOutreachEntityId, setSelectedOutreachEntityId] = useState<string | null>(null);
  const [outreachPage, setOutreachPage] = useState(1);

  useEffect(() => {
    setOutreachPage(1);
  }, [outreachFilterType]);

  const handleGenerateAuditReport = (job: any) => {
    setShowReportGeneratorModal(true);
    setReportGenerationPhase('aggregating');
    setTimeout(() => {
      setReportGenerationPhase('compiling');
      setTimeout(() => {
        setReportGenerationPhase('scoring');
        setTimeout(() => {
          setReportGenerationPhase('done');
        }, 1200);
      }, 1200);
    }, 1200);
  };

  // Auto-advance step in review dialog as simulation moves
  const maxUnlockedStep = activeParsingPhase === 'done' ? 3 :
                          activeParsingPhase === 'scoring' ? 2 :
                          activeParsingPhase === 'dedup' ? 1 : 0;

  useEffect(() => {
    if (showReviewIngestion) {
      setReviewActiveStep(maxUnlockedStep);
    }
  }, [maxUnlockedStep, showReviewIngestion]);

  // Live Remediation Groups State & Simulated Updates
  const [remediationGroups, setRemediationGroups] = useState([
    { id: 'sms_wa', label: 'SMS ➔ WhatsApp Fallback', count: 42, status: 'Active', activity: 'Pre-warming dispatchers...' },
    { id: 'ivr_sweep', label: 'IVR ➔ Dialer Sweep', count: 28, status: 'Enqueued', activity: 'Pending dialer window...' },
    { id: 'voice_desk', label: 'AI Voice ➔ Human Desk', count: 15, status: 'Escalated', activity: 'Profiles synced with CRM...' },
    { id: 'wa_offer', label: 'WA Drop ➔ Offer Boost', count: 35, status: 'Enqueued', activity: 'Generating offer links...' }
  ]);

  useEffect(() => {
    if (!selectedJobDetailId || detailActiveStep !== 4) return;

    const interval = setInterval(() => {
      setRemediationGroups(prev => {
        return prev.map(g => {
          const change = Math.random() > 0.6 ? (Math.random() > 0.5 ? 1 : -1) : 0;
          const newCount = Math.max(5, g.count + change);
          
          let newActivity = g.activity;
          if (change !== 0) {
            const randomId = Math.floor(10000 + Math.random() * 90000);
            if (g.id === 'sms_wa') {
              newActivity = `Routed bounce TX-${randomId} to WhatsApp fallback template.`;
            } else if (g.id === 'ivr_sweep') {
              newActivity = `Re-queued busy customer TX-${randomId} for retry dialing sweep.`;
            } else if (g.id === 'voice_desk') {
              newActivity = `Escalated drop-out user TX-${randomId} directly to Human Agent desk.`;
            } else if (g.id === 'wa_offer') {
              newActivity = `Dispatched discount coupon payment link to customer TX-${randomId}.`;
            }
          }
          return { ...g, count: newCount, activity: newActivity };
        });
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [selectedJobDetailId, detailActiveStep]);

  const personaDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (personaDropdownRef.current && !personaDropdownRef.current.contains(event.target as Node)) {
        setIsPersonaDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, riskFilter, timelineFilter, selectedJobId]);

  // Upload Tab Form states
  const [jobName, setJobName] = useState('Collections Batch June');
  const [selectedCasePresetId, setSelectedCasePresetId] = useState('case-1');
  const [systemPrompt, setSystemPrompt] = useState(
    CAMPAIGN_PRESET_CASES[0].systemPrompt
  );
  const [csvContent, setCsvContent] = useState<string>('');
  const [parsedRecords, setParsedRecords] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState(CAMPAIGN_PRESET_CASES[0].botId);
  const [apiBots, setApiBots] = useState<Bot[]>([]);
  const [isPersonaDropdownOpen, setIsPersonaDropdownOpen] = useState(false);

  useEffect(() => {
    async function loadApiBots() {
      try {
        const bots = await api.getBots();
        setApiBots(bots);
      } catch (err) {
        console.error('Failed to load personas from API:', err);
      }
    }
    loadApiBots();
  }, []);

  // Active Call Simulator overlay
  const [callSession, setCallSession] = useState<{
    entity: JobEntity;
    task: ScheduledTask;
    state: 'connecting' | 'connected' | 'ended';
    transcript: { speaker: 'Agent' | 'Customer'; text: string }[];
  } | null>(null);

  // Real-time Event Logger logs
  const [runLogs, setRunLogs] = useState<string[]>([
    '[10:15:32] System initialization completed.',
    '[10:15:33] Active queues checked. 0 tasks due.'
  ]);

  // Sync state with mockDB
  const syncDB = () => {
    setJobs([...mockDB.jobs]);
    setEntities([...mockDB.entities]);
    setInteractions([...mockDB.interactions]);
    setTasks([...mockDB.tasks]);
    setRecommendations([...mockDB.recommendations]);
  };

  // Poll state very fast for smooth progress metrics updates
  useEffect(() => {
    syncDB();
    const timer = setInterval(() => {
      syncDB();

      // Find pending tasks that should execute "now"
      const dueTasks = mockDB.tasks.filter(t => t.status === 'Pending' && new Date(t.scheduledTime) <= new Date());
      
      if (dueTasks.length > 0) {
        dueTasks.forEach(task => {
          if (task.taskType === 'CheckPaymentStatus') {
            const outcome = Math.random() > 0.5 ? 'paid' : 'unpaid';
            mockDB.executeTask(task.id, outcome);
            logEvent(`Auto-processed payment status check for Entity ${task.entityId}: outcome = ${outcome.toUpperCase()}`);
          } else if (task.taskType === 'SendPaymentLink') {
            mockDB.executeTask(task.id);
            logEvent(`Auto-dispatched WhatsApp secure payment link for Entity ${task.entityId}`);
          } else if (task.taskType === 'ScheduledReminder') {
            mockDB.executeTask(task.id);
            logEvent(`Auto-dispatched scheduled PTP WhatsApp warning for Entity ${task.entityId}`);
          }
        });
        syncDB();
      }
    }, 400);

    return () => clearInterval(timer);
  }, []);

  const logEvent = (msg: string) => {
    const time = new Date().toTimeString().split(' ')[0];
    setRunLogs(prev => [`[${time}] ${msg}`, ...prev.slice(0, 49)]);
  };

  const handleGenerateSampleCSV = () => {
    const headers = 'name,phone,OutstandingAmount,DueDate,DaysPastDue,AssetClass,email\n';
    const row1 = 'Sunita Deshmukh,+91 91234 56789,₹48,200,2026-05-02,23,Personal Loan,sunita@deshmukh.com\n';
    const row2 = 'Karan Malhotra,+91 82345 67890,₹11,000,2026-05-18,7,Two-Wheeler Loan,\n';
    const row3 = 'Deepak Sen,+91 73456 78901,₹0,2026-04-12,43,Credit Card,deepak.sen@yahoo.com\n';
    const row4 = 'Gaurav Joshi,+91 84567 89012,₹120,000,2025-01-10,480,Home Loan,gaurav@joshi.org\n';
    const content = headers + row1 + row2 + row3 + row4;
    setCsvContent(content);

    // Simple parser
    const rows = content.trim().split('\n');
    const cols = rows[0].split(',');
    const records = rows.slice(1).map(row => {
      const vals = row.split(',');
      const obj: any = {};
      cols.forEach((col, idx) => {
        obj[col.trim()] = vals[idx]?.trim();
      });
      return obj;
    });
    setParsedRecords(records);
    logEvent('Generated sample customer database template (4 records parsed with audit fields).');
  };

  const handleGenerateLargeBatch = (count: number) => {
    const batch = mockDB.generateLargeBatch(count);
    setParsedRecords(batch);
    setJobName(`Large Batch Outbound (${count} records)`);
    
    // Create preview string
    const headers = 'name,phone,OutstandingAmount,DueDate,DaysPastDue,AssetClass,Region\n';
    const previewRows = batch.slice(0, 5).map(r => 
      `${r.name},${r.phone},${r.OutstandingAmount},${r.DueDate},${r.DaysPastDue},${r.AssetClass},${r.Region}`
    ).join('\n');
    setCsvContent(headers + previewRows + `\n... [${count - 5} records truncated for preview]`);
    logEvent(`Generated large-scale collections simulation batch (${count} records).`);
  };

  const handleStartAnalysisRun = () => {
    if (parsedRecords.length === 0) {
      alert('Please upload or generate a customer record CSV first.');
      return;
    }

    // Reset all cleaning state
    setSimulationStage('parsing');
    setVisibleSimLogs([]);
    setActiveParsingPhase('cleaning');
    setCleaningEvents([]);
    setCleaningProgress(0);
    setCleaningCounter(0);
    setCleaningDone(false);
    setCleaningSummary({ total: 0, clean: 0, fixed: 0, warnings: 0, errors: 0 });
    logEvent(`Starting full-page ingestion simulator for file "${jobName}"...`);

    // ── Phase 1: Animate cleaning stream record-by-record ──────────
    const allCleaningEvents = simulateFileCleaningStream(parsedRecords);
    const total = allCleaningEvents.length;
    let cleanIdx = 0;

    // Stream in cleaning events at a steady pace
    const msPerRecord = Math.max(120, Math.floor(2500 / Math.min(total, 20)));
    const cleaningInterval = setInterval(() => {
      if (cleanIdx < allCleaningEvents.length) {
        const evt = allCleaningEvents[cleanIdx];
        setCleaningEvents(prev => [...prev, evt]);
        setCleaningCounter(cleanIdx + 1);
        setCleaningProgress(Math.round(((cleanIdx + 1) / total) * 100));
        setCleaningSummary(prev => ({
          total,
          clean: prev.clean + (evt.status === 'CLEAN' ? 1 : 0),
          fixed: prev.fixed + (evt.status === 'FIXED' ? 1 : 0),
          warnings: prev.warnings + (evt.status === 'WARNING' ? 1 : 0),
          errors: prev.errors + (evt.status === 'ERROR' ? 1 : 0),
        }));
        cleanIdx++;
      } else {
        clearInterval(cleaningInterval);
        setCleaningCounter(total);
        setCleaningDone(true);

        // ── Phase 2-4: Run the main LLM log stream after a 1.5s pause ──
        setTimeout(() => {
          simulateInboundFileProcess(parsedRecords).then(({ logs, insights }) => {
            setAiInsights(insights);

            let logIdx = 0;
            const logInterval = setInterval(() => {
              if (logIdx < logs.length) {
                const nextLog = logs[logIdx];
                setVisibleSimLogs(prev => [...prev, nextLog]);

                // Only advance phase AFTER cleaning is done
                if (nextLog.phase === 'deduplication') setActiveParsingPhase('dedup');
                else if (nextLog.phase === 'risk_scoring') setActiveParsingPhase('scoring');
                else if (nextLog.phase === 'strategy_formulation') setActiveParsingPhase('done');

                logIdx++;
              } else {
                clearInterval(logInterval);
                setTimeout(() => {
                  setSimulationStage('strategy');
                }, 1200);
              }
            }, 800);
          });
        }, 1500);
      }
    }, msPerRecord);

  };

  const handleInitiateBroadcast = () => {
    setSimulationStage('broadcasting');
    setBroadcastProgress(0);
    setBroadcastLogs([]);
    
    const customers = parsedRecords.length > 0 ? parsedRecords : [
      { name: 'Aditi Kumar', phone: '+91 92457 10106' },
      { name: 'Amit Nair', phone: '+91 90690 99502' },
      { name: 'Anjali Roy', phone: '+91 95488 38123' },
      { name: 'Arjun Kulkarni', phone: '+91 92143 33166' }
    ];
    
    const smsCust = customers[0]?.name || 'Aditi Kumar';
    const waCust = customers[1 % customers.length]?.name || 'Anjali Roy';
    const ivrCust = customers[2 % customers.length]?.name || 'Amit Nair';
    const voiceCust = customers[3 % customers.length]?.name || 'Arjun Kulkarni';

    setBroadcastStates({
      sms: { customer: smsCust, step: 0 },
      whatsapp: { customer: waCust, step: 0 },
      ivr: { customer: ivrCust, step: 0 },
      ai_voice: { customer: voiceCust, step: 0 }
    });

    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      setBroadcastProgress(progress);

      if (progress === 10) {
        setBroadcastStates(prev => ({
          ...prev,
          sms: { ...prev.sms, step: 1 },
          whatsapp: { ...prev.whatsapp, step: 1 }
        }));
        setBroadcastLogs(l => [...l, `[INFO] [SMS] [${smsCust}] Compiling outbound message reminder template.`]);
        setBroadcastLogs(l => [...l, `[INFO] [WhatsApp] [${waCust}] Verifying target phone subscription opt-in.`]);
      }
      if (progress === 25) {
        setBroadcastStates(prev => ({
          ...prev,
          ivr: { ...prev.ivr, step: 1 },
          ai_voice: { ...prev.ai_voice, step: 1 }
        }));
        setBroadcastLogs(l => [...l, `[INFO] [IVR] [${ivrCust}] Establishing SIP connection trunk with provider.`]);
        setBroadcastLogs(l => [...l, `[INFO] [AI Voice] [${voiceCust}] Spawning WebRTC outbound channel.`]);
      }
      if (progress === 45) {
        setBroadcastStates(prev => ({
          ...prev,
          sms: { ...prev.sms, step: 2 },
          whatsapp: { ...prev.whatsapp, step: 2 }
        }));
        setBroadcastLogs(l => [...l, `[INFO] [SMS] [${smsCust}] Twilio API connection authorized.`]);
        setBroadcastLogs(l => [...l, `[INFO] [WhatsApp] [${waCust}] Interactive Pay link payload appended.`]);
      }
      if (progress === 65) {
        setBroadcastStates(prev => ({
          ...prev,
          ivr: { ...prev.ivr, step: 2 },
          ai_voice: { ...prev.ai_voice, step: 2 }
        }));
        setBroadcastLogs(l => [...l, `[INFO] [IVR] [${ivrCust}] Outbound call answered. Playing pre-recorded menu.`]);
        setBroadcastLogs(l => [...l, `[INFO] [AI Voice] [${voiceCust}] Call pick-up verified. Initiating dialogue.`]);
      }
      if (progress === 80) {
        setBroadcastStates(prev => ({
          ...prev,
          sms: { ...prev.sms, step: 3 },
          whatsapp: { ...prev.whatsapp, step: 3 }
        }));
        setBroadcastLogs(l => [...l, `[SUCCESS] [SMS] [${smsCust}] SMS delivered to carrier successfully.`]);
        setBroadcastLogs(l => [...l, `[SUCCESS] [WhatsApp] [${waCust}] Payload delivered (marked as Read).`]);
      }
      if (progress === 95) {
        setBroadcastStates(prev => ({
          ...prev,
          ivr: { ...prev.ivr, step: 3 },
          ai_voice: { ...prev.ai_voice, step: 3 }
        }));
        setBroadcastLogs(l => [...l, `[SUCCESS] [IVR] [${ivrCust}] DTMF button press 1 collected. Dispatched pay link.`]);
        setBroadcastLogs(l => [...l, `[SUCCESS] [AI Voice] [${voiceCust}] Promise-To-Pay (PTP) secured. Call hung up.`]);
      }

      if (progress >= 100) {
        clearInterval(interval);
      }
    }, 250);
  };

  const handleCompleteBroadcast = () => {
    const newJob = mockDB.createJob(jobName, systemPrompt, parsedRecords);
    mockDB.startJob(newJob.id);
    syncDB();
    setSelectedJobId(newJob.id);
    
    setSimulationStage('idle');
    setActiveTab('monitor');
    logEvent(`Omni-channel broadcast for "${jobName}" running inside monitor.`);
  };

  const handleApproveAndStartJob = (jobId: string) => {
    mockDB.startJob(jobId);
    syncDB();
    logEvent(`Job Run ${jobId} approved. Triggering progressive classifier...`);
  };

  const triggerLiveDialerSim = (entity: JobEntity, task: ScheduledTask) => {
    setCallSession({
      entity,
      task,
      state: 'connecting',
      transcript: [{ speaker: 'Agent', text: 'Initializing outbound voice channel...' }]
    });

    setTimeout(() => {
      setCallSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          state: 'connected',
          transcript: [
            ...prev.transcript,
            { speaker: 'Agent', text: `Hello ${entity.name}, this is the Sonix Automated Assist call regarding your account ref ${entity.referenceId}. How are you today?` }
          ]
        };
      });
    }, 2000);
  };

  const handleCallBranchSelect = (branch: 'Busy' | 'NoAnswer' | 'wants_to_pay' | 'ptp_promised') => {
    if (!callSession) return;

    let customerReply = '';
    let agentFinal = '';

    if (branch === 'Busy') {
      customerReply = '[Line busy / Call rejected]';
      agentFinal = 'Outbound call failed (Busy). Rescheduling task...';
    } else if (branch === 'NoAnswer') {
      customerReply = '[Ringing timeout / Unanswered]';
      agentFinal = 'Outbound call failed (No Answer). Rescheduling task...';
    } else if (branch === 'wants_to_pay') {
      customerReply = 'Yes, I want to clear it now. Send me the link via WhatsApp.';
      agentFinal = 'Sending the transaction link to you right now. Thank you!';
    } else if (branch === 'ptp_promised') {
      customerReply = 'I have some budget issues. I will clear this amount in 3 days.';
      agentFinal = 'Understood, logging a promise to pay by that date. Have a good day.';
    }

    // Append to transcript
    setCallSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        transcript: [
          ...prev.transcript,
          { speaker: 'Customer', text: customerReply },
          { speaker: 'Agent', text: agentFinal }
        ]
      };
    });

    setTimeout(() => {
      mockDB.executeTask(callSession.task.id, branch);
      syncDB();
      setCallSession(null);
      logEvent(`Executed simulated voice call task for ${callSession.entity.name}. Branch chosen: ${branch.toUpperCase()}.`);
    }, 2500);
  };

  // Primary list filters
  const filteredEntities = entities.filter(ent => {
    if (ent.jobId !== selectedJobId) return false;
    if (searchQuery && !ent.name.toLowerCase().includes(searchQuery.toLowerCase()) && !ent.referenceId.includes(searchQuery)) return false;
    if (statusFilter !== 'All' && ent.status !== statusFilter) return false;
    if (riskFilter !== 'All' && ent.riskLevel !== riskFilter) return false;
    
    // Today vs Future timeline filter
    if (timelineFilter !== 'All') {
      const entTasks = tasks.filter(t => t.entityId === ent.id && t.status === 'Pending');
      if (timelineFilter === 'Today') {
        return entTasks.some(t => t.taskType === 'CallRetry' || new Date(t.scheduledTime).toDateString() === new Date().toDateString());
      } else {
        return entTasks.some(t => t.taskType !== 'CallRetry' && new Date(t.scheduledTime).toDateString() !== new Date().toDateString());
      }
    }
    return true;
  });

  // Sort logic for explorer table
  const sortedEntities = [...filteredEntities].sort((a, b) => {
    let aVal: any = a[sortField as keyof JobEntity] || '';
    let bVal: any = b[sortField as keyof JobEntity] || '';

    if (sortField === 'OutstandingAmount') {
      const aNum = parseFloat(String(a.attributes.OutstandingAmount || a.attributes.balance || '').replace(/[^0-9.-]/g, '')) || 0;
      const bNum = parseFloat(String(b.attributes.OutstandingAmount || b.attributes.balance || '').replace(/[^0-9.-]/g, '')) || 0;
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    }

    if (sortField === 'DaysPastDue') {
      const aNum = parseInt(String(a.attributes.DaysPastDue || a.attributes.dpd || 0)) || 0;
      const bNum = parseInt(String(b.attributes.DaysPastDue || b.attributes.dpd || 0)) || 0;
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    }

    if (sortField === 'riskLevel') {
      const riskOrder = { 'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4 };
      const aRisk = riskOrder[a.riskLevel as keyof typeof riskOrder] || 0;
      const bRisk = riskOrder[b.riskLevel as keyof typeof riskOrder] || 0;
      return sortDirection === 'asc' ? aRisk - bRisk : bRisk - aRisk;
    }

    if (typeof aVal === 'string') {
      return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    return 0;
  });

  const paginatedEntities = sortedEntities.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(sortedEntities.length / pageSize) || 1;

  const activeAnalyzingJob = jobs.find(j => j.status === 'Analyzing');

  
  if (selectedJobDetailId) {
    const detailJob = jobs.find(j => j.id === selectedJobDetailId);
    if (detailJob) {

          const detailJob = jobs.find(j => j.id === selectedJobDetailId);
          if (!detailJob) return null;
          
          const jobEntities = entities.filter(e => e.jobId === selectedJobDetailId);
          const filteredDrawerEntities = jobEntities.filter(e =>
            e.name.toLowerCase().includes(drawerSearchQuery.toLowerCase()) ||
            e.referenceId.toLowerCase().includes(drawerSearchQuery.toLowerCase())
          );

          // Dynamic scrubber events mapping for Step 1
          const cleaningEventsForJob = jobEntities.map((ent, idx) => {
            const assetClassVal = ent.attributes.AssetClass || ent.attributes.asset_class || '';
            const isTwoWheeler = assetClassVal === 'Two-Wheeler Loan';
            
            const checks = [
              { field: 'Name', status: 'OK', note: 'Valid string format' },
              { field: 'Phone', status: 'OK', note: 'Standard country code matched' },
              { field: 'Balance', status: 'OK', note: 'Valid decimal currency format' },
              { field: 'DPD', status: 'OK', note: 'Integer value verified' },
              {
                field: 'AssetClass',
                status: isTwoWheeler ? 'FIXED' : 'OK',
                note: isTwoWheeler
                  ? 'Unrecognized asset class "Two-Wheeler Loan" — mapped to Personal Loan.'
                  : 'Recognized asset class configuration',
                originalValue: isTwoWheeler ? 'Two-Wheeler Loan' : assetClassVal,
                fixedValue: isTwoWheeler ? 'Personal Loan' : undefined
              }
            ];

            const hasFix = checks.some(c => c.status === 'FIXED');

            return {
              rowIndex: idx + 1,
              name: ent.name,
              status: hasFix ? 'FIXED' : 'CLEAN',
              fieldChecks: checks
            };
          });

          const totalScrubbed = cleaningEventsForJob.length;
          const fixedScrubbed = cleaningEventsForJob.filter(e => e.status === 'FIXED').length;
          const cleanScrubbed = totalScrubbed - fixedScrubbed;

          // Merge logs mapping for Step 2
          const mergedLogs = [];
          if (detailJob.id === 'job-1') {
            mergedLogs.push(
              "Matched 'Anjali Sharma' (TX-10492) via phone number +91 87654 32109. Consolidated with active outreach record and updated outstanding balance.",
              "Matched 'Vikram Singh' (TX-10381) via Reference ID. Merged attributes and retained historical contact logs."
            );
          } else {
            mergedLogs.push(
              `Scanned and cross-referenced ${totalScrubbed} records. Resolved all ID conflicts automatically against historical databases.`
            );
          }

          // Risk levels lists for Step 3
          const criticalEntities = jobEntities.filter(e => e.riskLevel === 'Critical');
          const highEntities = jobEntities.filter(e => e.riskLevel === 'High');
          const mediumEntities = jobEntities.filter(e => e.riskLevel === 'Medium');
          const lowEntities = jobEntities.filter(e => e.riskLevel === 'Low');

          
      return (
        <div className="flex-1 bg-surface-lowest min-h-screen text-on-surface overflow-y-auto pb-12">
          <Header
            title="Campaign AI & Action Analyzer"
            subtitle="AUTONOMOUS OUTREACH SYSTEM"
          />
          <main className="w-full px-4 sm:px-6 lg:px-8 mt-6 flex flex-col space-y-6">
            <div className="flex items-center">
              <button
                onClick={() => setSelectedJobDetailId(null)}
                className="px-4 py-2 bg-surface-high border border-outline-variant/10 text-outline hover:text-on-surface rounded-xl transition-all font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow-md"
              >
                ← Back to Campaigns Monitor
              </button>
            </div>
            <div className="w-full bg-surface-lowest flex flex-col space-y-6 border border-outline-variant/10 rounded-3xl p-6 md:p-8 shadow-xl">

                {/* Header */}
                <div className="flex justify-between items-start border-b border-outline-variant/10 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                        detailJob.status === 'Ingested' ? 'bg-indigo-400/10 text-indigo-400 border-indigo-400/20' :
                        detailJob.status === 'Analyzing' ? 'bg-amber-400/10 text-amber-400 border-amber-400/20 animate-pulse' :
                        detailJob.status === 'Executing' ? 'bg-primary/10 text-primary border-primary/20 animate-pulse' :
                        detailJob.status === 'Completed' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' :
                        'bg-surface-high text-outline border-outline-variant/10'
                      }`}>
                        Campaign Job Run Status: {detailJob.status}
                      </span>
                      {detailJob.status === 'Executing' && (
                        <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                      )}
                    </div>
                    <h2 className="text-2xl font-bold text-on-surface flex items-center gap-2 mt-1">
                      <Database className="text-primary size-6" />
                      Campaign File Details: {detailJob.name}
                    </h2>
                    <p className="text-sm text-outline">
                      Created: {new Date(detailJob.createdAt).toLocaleString()} | Campaign ID: {detailJob.id}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedJobDetailId(null)}
                    className="p-2 bg-surface-high border border-outline-variant/10 text-outline hover:text-on-surface hover:bg-surface-high/80 rounded-full transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                {/* Stepper Header Navigation Component */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-surface-high/15 border border-outline-variant/10 p-3 rounded-2xl">
                  {[
                    { step: 0, label: 'Data Scrubbing', desc: 'Schema & verify', icon: ShieldAlert },
                    { step: 1, label: 'Consolidation', desc: 'Identity merge', icon: Layers },
                    { step: 2, label: 'AI Risk Profile', desc: 'Funnel allocations', icon: Sparkles },
                    { step: 3, label: 'Smart Strategy', desc: 'Route graphs', icon: Cpu },
                    { step: 4, label: 'Outreach Performance', desc: 'Results & conversion', icon: TrendingUp }
                  ].map((s) => {
                    const Icon = s.icon;
                    const isActive = s.step === detailActiveStep;
                    const stepStatus = (() => {
                      if (detailJob.status === 'Completed') {
                        return 'Completed';
                      }
                      if (detailJob.status === 'Executing') {
                        if (s.step < 4) return 'Completed';
                        return 'Running';
                      }
                      if (detailJob.status === 'Analyzing') {
                        const progress = detailJob.processedRecords / (detailJob.totalRecords || 1);
                        if (s.step === 0) {
                          return progress >= 0.25 ? 'Completed' : 'Running';
                        }
                        if (s.step === 1) {
                          if (progress >= 0.5) return 'Completed';
                          if (progress >= 0.25) return 'Running';
                          return 'Pending';
                        }
                        if (s.step === 2) {
                          if (progress >= 0.75) return 'Completed';
                          if (progress >= 0.5) return 'Running';
                          return 'Pending';
                        }
                        if (s.step === 3) {
                          if (progress >= 1.0) return 'Completed';
                          if (progress >= 0.75) return 'Running';
                          return 'Pending';
                        }
                        return 'Pending';
                      }
                      if (detailJob.status === 'Ingested') {
                        if (s.step === 0) return 'Running';
                        return 'Pending';
                      }
                      return 'Pending';
                    })();

                    const isCompleted = stepStatus === 'Completed';
                    const isRunning = stepStatus === 'Running';
                    const isPending = stepStatus === 'Pending';

                    return (
                      <button
                        key={s.step}
                        onClick={() => setDetailActiveStep(s.step)}
                        className={`flex items-center gap-3 text-left p-3 rounded-xl transition-all select-none w-full border ${
                          isActive
                            ? 'bg-primary/10 border-primary/30 text-primary shadow-sm'
                            : isCompleted
                              ? 'bg-emerald-400/5 hover:bg-emerald-400/10 text-outline border-emerald-400/15 cursor-pointer'
                              : isRunning
                                ? 'bg-amber-400/5 hover:bg-amber-400/10 text-outline border-amber-400/15 cursor-pointer animate-pulse'
                                : 'bg-surface-high/30 hover:bg-surface-high/50 text-outline border-transparent cursor-pointer'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${
                          isActive
                            ? 'bg-primary text-on-primary'
                            : isCompleted
                              ? 'bg-emerald-400/15 text-emerald-400'
                              : isRunning
                                ? 'bg-amber-400/15 text-amber-400'
                                : 'bg-surface-high text-outline'
                        }`}>
                          {isCompleted ? (
                            <CheckCircle className="size-4" />
                          ) : isRunning ? (
                            <RefreshCw className="size-4 animate-spin" />
                          ) : (
                            <Lock className="size-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-black uppercase tracking-wider block">
                              Step {s.step + 1}
                            </span>
                            {isCompleted && (
                              <span className="text-[9px] bg-emerald-400/10 text-emerald-400 px-1 py-0.5 rounded-full font-bold uppercase">
                                Done
                              </span>
                            )}
                            {isRunning && (
                              <span className="text-[9px] bg-amber-400/10 text-amber-400 px-1 py-0.5 rounded-full font-bold uppercase animate-pulse">
                                Active
                              </span>
                            )}
                            {isPending && (
                              <span className="text-[9px] bg-surface-high text-outline px-1 py-0.5 rounded-full font-bold uppercase">
                                Queued
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-on-surface truncate leading-tight mt-0.5">{s.label}</p>
                          <p className="text-xs text-outline truncate leading-none mt-0.5">{s.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Step Content Switcher Area */}
                <div className="flex-1 overflow-y-auto min-h-[420px] py-2">
                  {detailActiveStep === 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
                      {/* Left 2 Columns: Cleaning Stats & Record Stream */}
                      <div className="lg:col-span-2 space-y-6">
                        {/* Stats row */}
                        <div className="grid grid-cols-4 gap-4">
                          {[
                            { label: 'Total Records', val: totalScrubbed, color: 'text-on-surface border-outline-variant/10', svg: <FileText className="size-4 text-outline" /> },
                            { label: 'Clean Fields', val: cleanScrubbed, color: 'text-emerald-400 border-emerald-400/20 bg-emerald-400/5', svg: <CheckCircle className="size-4 text-emerald-400" /> },
                            { label: 'Auto-Corrected', val: fixedScrubbed, color: 'text-amber-400 border-amber-400/20 bg-amber-400/5', svg: <AlertTriangle className="size-4 text-amber-400" /> },
                            { label: 'Flagged Errors', val: 0, color: 'text-red-400 border-red-400/20 bg-red-400/5', svg: <X className="size-4 text-red-400" /> }
                          ].map((s, idx) => (
                            <div key={idx} className={`p-4 rounded-2xl border ${s.color} flex flex-col items-center justify-center text-center gap-1.5`}>
                              {s.svg}
                              <span className="text-3xl font-black tabular-nums">{s.val}</span>
                              <span className="text-xs font-bold uppercase opacity-85">{s.label}</span>
                            </div>
                          ))}
                        </div>

                        {/* Processing Stream */}
                        <div className="glass-panel p-5 rounded-2xl border border-outline-variant/10 space-y-3">
                          <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                            <Database className="size-4 text-primary" />
                            File Processing Stream Audit
                          </h4>
                          <p className="text-xs text-outline">
                            Verify individual records loaded from campaign batch. Verification matrix: Name [N], Phone [P], Balance [B], DPD [D], Asset Class [A].
                          </p>
                          <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
                            {cleaningEventsForJob.map((evt) => (
                              <div
                                key={evt.rowIndex}
                                className="flex items-center gap-3 bg-surface-high/10 border border-outline-variant/5 rounded-xl px-3 py-2.5 text-xs"
                              >
                                <span className="text-outline font-mono flex-shrink-0 w-8">#{evt.rowIndex}</span>
                                <span className="font-bold text-on-surface truncate w-36 flex-shrink-0">{evt.name}</span>
                                
                                <div className="flex items-center gap-1.5 flex-1">
                                  {evt.fieldChecks.map((fc, fi) => (
                                    <div key={fi} title={`${fc.field}: ${fc.note}`} className="flex items-center">
                                      {fc.status === 'OK' && (
                                        <span className="text-emerald-400 text-xs bg-emerald-400/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                          {fc.field[0]}✓
                                        </span>
                                      )}
                                      {fc.status === 'FIXED' && (
                                        <span className="text-amber-400 text-xs bg-amber-400/10 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold">
                                          {fc.field[0]}⚠
                                        </span>
                                      )}
                                      {fc.status === 'ERROR' && (
                                        <span className="text-red-400 text-xs bg-red-400/10 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold">
                                          {fc.field[0]}✕
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>

                                <span className={`flex-shrink-0 text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  evt.status === 'CLEAN' ? 'bg-emerald-400/15 text-emerald-400' :
                                  evt.status === 'FIXED' ? 'bg-amber-400/15 text-amber-400' :
                                  'bg-primary/15 text-primary'
                                }`}>{evt.status}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Schema anomalies */}
                      <div className="space-y-6">
                        {/* Field anomalies */}
                        <div className="glass-panel p-5 rounded-2xl border border-outline-variant/10 space-y-3">
                          <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                            <AlertTriangle className="size-4 text-amber-400" />
                            Field Errors & Auto-Corrections
                          </h4>
                          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                            {cleaningEventsForJob.filter(e => e.status === 'FIXED').map((evt) => (
                              evt.fieldChecks.filter(fc => fc.status !== 'OK').map((fc, fi) => (
                                <div key={`${evt.rowIndex}-${fi}`} className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs space-y-1">
                                  <div className="flex justify-between items-center font-bold">
                                    <span className="text-on-surface">Row #{evt.rowIndex} · {fc.field}</span>
                                    <span className="text-amber-400 bg-amber-400/15 text-[10px] font-black uppercase px-1.5 py-0.5 rounded">FIXED</span>
                                  </div>
                                  <p className="text-outline-high mt-1">{fc.note}</p>
                                  <div className="flex gap-2 text-[10px] font-mono mt-1 opacity-80">
                                    <span className="text-red-400 line-through">Was: {fc.originalValue}</span>
                                    {fc.fixedValue && <span className="text-emerald-400">Fixed: {fc.fixedValue}</span>}
                                  </div>
                                </div>
                              ))
                            ))}
                            {cleaningEventsForJob.filter(e => e.status === 'FIXED').length === 0 && (
                              <div className="text-center py-6 text-outline italic text-xs">No anomalies or fixes detected in this campaign file.</div>
                            )}
                          </div>
                        </div>

                        {/* Technical developer logs Accordion */}
                        <details className="group border border-outline-variant/10 rounded-xl overflow-hidden bg-surface-lowest">
                          <summary className="flex justify-between items-center px-4 py-2.5 cursor-pointer text-xs font-bold text-outline select-none hover:bg-surface-high/20">
                            <span className="flex items-center gap-2"><Database className="size-3.5" />View Raw Scrubber Log Feed</span>
                            <ChevronDown className="size-3.5 group-open:rotate-180 transition-transform" />
                          </summary>
                          <div className="px-4 pb-3 border-t border-outline-variant/10 bg-surface-lowest font-mono text-[11px] text-outline h-36 overflow-y-auto space-y-1 pt-2">
                            <div>[11:40:02] [SYSTEM] Campaign CSV read buffer success. (Size: {(totalScrubbed * 0.4).toFixed(1)}KB)</div>
                            <div>[11:40:03] [PARSER] Map configuration matches active bot parser schema.</div>
                            <div>[11:40:04] [SCRUBBER] Commencing auto-cleaning pass on {totalScrubbed} items...</div>
                            {fixedScrubbed > 0 && (
                              <div>[11:40:05] [SCRUBBER] Successfully auto-corrected {fixedScrubbed} schema class mappings.</div>
                            )}
                            <div>[11:40:06] [SCRUBBER] Clean check pass complete. Lock released.</div>
                          </div>
                        </details>
                      </div>
                    </div>
                  )}

                  {detailActiveStep === 1 && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
                      {/* Left Column: Deduplication Metrics */}
                      <div className="lg:col-span-1 space-y-6">
                        <div className="glass-panel p-5 rounded-2xl border border-outline-variant/10 space-y-4">
                          <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                            <Layers className="size-4 text-primary" />
                            Deduplication Analytics
                          </h4>
                          <div className="space-y-4">
                            <div className="bg-surface-high/20 border border-outline-variant/5 rounded-xl p-4 flex flex-col justify-center text-center">
                              <span className="text-4xl font-black text-emerald-400">
                                {mergedLogs.length}
                              </span>
                              <span className="text-xs font-bold text-outline uppercase tracking-wider mt-1">Duplicate Profiles Merged</span>
                            </div>
                            <div className="space-y-3 bg-surface-lowest/50 rounded-xl p-3 border border-outline-variant/5 text-xs">
                              <div className="flex justify-between text-outline">
                                <span className="font-medium">Matching Strategy</span>
                                <span className="font-bold text-on-surface">Phone & Reference ID</span>
                              </div>
                              <div className="flex justify-between text-outline">
                                <span className="font-medium">Conflict Resolution</span>
                                <span className="font-bold text-emerald-400">Auto-Overwrite</span>
                              </div>
                              <div className="flex justify-between text-outline">
                                <span className="font-medium">History Retained</span>
                                <span className="font-bold text-on-surface">Yes (All entries)</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right 2 Columns: Merged Profile Audit Logs */}
                      <div className="lg:col-span-2 space-y-6">
                        <div className="glass-panel p-5 rounded-2xl border border-outline-variant/10 space-y-3">
                          <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                            <Database className="size-4 text-primary" />
                            Deduplication Merge & Action Logs
                          </h4>
                          <p className="text-xs text-outline">
                            Profiles matched against historical tables. Merged accounts are consolidated under unified profiles to prevent spam and preserve interaction histories.
                          </p>
                          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                            {mergedLogs.map((logMsg, idx) => (
                              <div key={idx} className="bg-surface-high/15 border border-outline-variant/5 rounded-xl p-3 text-xs space-y-1">
                                <div className="flex justify-between items-center font-bold">
                                  <span className="text-on-surface">Consolidation Row #{idx + 1}</span>
                                  <span className="text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded text-[10px] font-black uppercase">Conflict Resolved</span>
                                </div>
                                <p className="text-outline-high leading-relaxed mt-1 text-xs">{logMsg}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {detailActiveStep === 2 && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
                      {/* Left Column: AI Logic Definitions */}
                      <div className="lg:col-span-1 space-y-6">
                        <div className="glass-panel p-5 rounded-2xl border border-outline-variant/10 space-y-4">
                          <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="size-4 text-primary" />
                            AI Stratification Rules
                          </h4>
                          <div className="space-y-3 text-xs">
                            <div className="border-l-2 border-red-400 pl-2 space-y-0.5">
                              <span className="font-bold text-red-400 uppercase text-[10px]">Critical Tier</span>
                              <p className="text-outline-high leading-tight">Outstanding &gt; ₹50,000 OR DPD &gt; 30 days. Auto-escalated to instant AI Voice Bot Outreach.</p>
                            </div>
                            <div className="border-l-2 border-amber-400 pl-2 space-y-0.5">
                              <span className="font-bold text-amber-400 uppercase text-[10px]">High Tier</span>
                              <p className="text-outline-high leading-tight">Outstanding ₹20,000 - ₹50,000 OR DPD 15-30. Addressed via AI Voice scheduled retry flows.</p>
                            </div>
                            <div className="border-l-2 border-primary pl-2 space-y-0.5">
                              <span className="font-bold text-primary uppercase text-[10px]">Medium Tier</span>
                              <p className="text-outline-high leading-tight">Outstanding ₹5,000 - ₹20,000 OR DPD 5-15. Addressed via WhatsApp Interactive & IVR campaigns.</p>
                            </div>
                            <div className="border-l-2 border-emerald-400 pl-2 space-y-0.5">
                              <span className="font-bold text-emerald-400 uppercase text-[10px]">Low Tier</span>
                              <p className="text-outline-high leading-tight">Outstanding &lt; ₹5,000 AND DPD &lt; 5. Routed to SMS Text reminders.</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right 2 Columns: AI Risk Funnel Allocation */}
                      <div className="lg:col-span-2 space-y-6">
                        <div className="glass-panel p-5 rounded-2xl border border-outline-variant/10 space-y-4">
                          <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="size-4 text-primary" />
                            AI Risk Funnel Allocation
                          </h4>
                          <div className="space-y-2">
                            {[
                              { tier: 'Critical' as const, color: 'text-red-400 bg-red-400/10 border-red-400/20', count: detailJob.criticalCount, bar: 'bg-red-400', act: 'AI voice immediate escalations', list: criticalEntities },
                              { tier: 'High' as const, color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', count: detailJob.highCount, bar: 'bg-amber-400', act: 'AI voice scheduled retry', list: highEntities },
                              { tier: 'Medium' as const, color: 'text-primary bg-primary/10 border-primary/20', count: detailJob.mediumCount, bar: 'bg-primary', act: 'IVR & WhatsApp campaigns', list: mediumEntities },
                              { tier: 'Low' as const, color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', count: detailJob.lowCount, bar: 'bg-emerald-400', act: 'Automated SMS nudges', list: lowEntities }
                            ].map(t => {
                              return (
                                <div key={t.tier} className="bg-surface-high/10 border border-outline-variant/5 rounded-xl p-2.5 text-xs space-y-2">
                                  <div className="flex justify-between font-bold">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-black ${t.color}`}>{t.tier}</span>
                                    <span className="text-on-surface">{t.count} accts</span>
                                  </div>
                                  <div className="h-1 bg-surface-high rounded-full overflow-hidden">
                                    <div className={`h-full ${t.bar} transition-all`} style={{ width: `${(t.count / Math.max(jobEntities.length || 1, 1)) * 100}%` }} />
                                  </div>
                                  <p className="text-xs text-outline leading-tight italic">{t.act}</p>
                                  
                                  {/* Accounts & AI Reasons list */}
                                  <div className="mt-2 space-y-1.5 max-h-24 overflow-y-auto pr-1">
                                    {t.list.map((ent, idx) => (
                                      <div key={idx} className="bg-surface-lowest/70 p-1.5 rounded-lg text-xs border border-outline-variant/5">
                                        <div className="flex justify-between font-bold text-on-surface">
                                          <span>{ent.name}</span>
                                          <span className="text-outline">{ent.attributes.OutstandingAmount || ent.attributes.balance}</span>
                                        </div>
                                        <p className="text-outline text-[10px] italic leading-tight mt-0.5">
                                          "{ent.attributes.aiReason || `${t.tier} assigned via portfolio metrics.`}"
                                        </p>
                                      </div>
                                    ))}
                                    {t.list.length === 0 && (
                                      <div className="text-center py-1 text-[10px] text-outline italic">No accounts in this tier.</div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {detailActiveStep === 3 && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
                      {/* Left Column: Channel Allocations & Route Graph */}
                      <div className="lg:col-span-2 space-y-6">
                        {/* Allocations row */}
                        <div className="glass-panel p-5 rounded-2xl border border-outline-variant/10 space-y-4">
                          <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                            <Cpu className="size-4 text-primary" />
                            Campaign Strategy Channels
                          </h4>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { label: 'Voice Bot Call (Critical/High)', value: detailJob.criticalCount + detailJob.highCount, color: 'text-red-400' },
                              { label: 'Interactive IVR (Medium)', value: detailJob.mediumCount, color: 'text-primary' },
                              { label: 'WhatsApp Nudge (Medium)', value: detailJob.mediumCount, color: 'text-primary' },
                              { label: 'Automated SMS (Low)', value: detailJob.lowCount, color: 'text-emerald-400' }
                            ].map((c, i) => (
                              <div key={i} className="flex justify-between items-center text-xs bg-surface-high/10 border border-outline-variant/5 rounded-xl p-2.5 px-3">
                                <span className="text-outline font-bold">{c.label}</span>
                                <span className={`font-black text-sm ${c.color}`}>{c.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Telephony Route Graph */}
                        <div className="bg-surface-high/20 border border-outline-variant/5 p-5 rounded-2xl space-y-4">
                          <h4 className="text-sm font-black uppercase text-outline tracking-wider">
                            Campaign Telephony Route Graph
                          </h4>
                          <div className="bg-surface-lowest border border-outline-variant/10 rounded-xl p-6 relative overflow-hidden flex flex-col md:flex-row justify-around items-center gap-6 md:gap-4">
                            <div className="flex flex-col gap-2">
                              <span className="text-xs font-bold text-red-400 bg-red-400/10 px-3 py-1 rounded-full border border-red-400/20 text-center">Critical/High Risk</span>
                              <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20 text-center">Medium Risk</span>
                              <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20 text-center">Low Risk</span>
                            </div>
                            
                            <div className="flex flex-col gap-1 items-center">
                              <span className="text-primary font-bold text-sm animate-pulse">Routing Engine</span>
                              <ArrowRight className="size-4 text-outline rotate-90 md:rotate-0" />
                            </div>

                            <div className="flex flex-wrap md:flex-nowrap gap-3 justify-center">
                              <div className="bg-surface-high p-3 rounded-xl border border-outline-variant/10 text-center w-24">
                                <Phone className="size-4 text-primary mx-auto mb-1 animate-bounce" />
                                <span className="text-xs font-bold text-outline">AI Bot Call</span>
                              </div>
                              <div className="bg-surface-high p-3 rounded-xl border border-outline-variant/10 text-center w-24">
                                <Activity className="size-4 text-amber-400 mx-auto mb-1 animate-pulse" />
                                <span className="text-xs font-bold text-outline">IVR Playback</span>
                              </div>
                              <div className="bg-surface-high p-3 rounded-xl border border-outline-variant/10 text-center w-24">
                                <MessageSquare className="size-4 text-emerald-400 mx-auto mb-1 animate-pulse" />
                                <span className="text-xs font-bold text-outline">WhatsApp</span>
                              </div>
                              <div className="bg-surface-high p-3 rounded-xl border border-outline-variant/10 text-center w-24">
                                <FileText className="size-4 text-outline-high mx-auto mb-1" />
                                <span className="text-xs font-bold text-outline">SMS Text</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Searchable Record List Table */}
                      <div className="bg-surface-high/15 border border-outline-variant/5 rounded-3xl p-5 space-y-4 flex flex-col h-full max-h-[480px]">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-bold text-sm text-on-surface">Target Accounts</h3>
                            <p className="text-xs text-outline mt-0.5">Click row to explore record</p>
                          </div>
                          <span className="text-xs bg-primary/10 text-primary font-bold px-2.5 py-0.5 rounded-full">
                            {filteredDrawerEntities.length} matching
                          </span>
                        </div>

                        <div className="relative flex items-center bg-surface-lowest border border-outline-variant/15 rounded-xl px-3 py-2">
                          <Search className="size-3.5 text-outline mr-2" />
                          <input
                            type="text"
                            placeholder="Search by name or ID..."
                            value={drawerSearchQuery}
                            onChange={(e) => setDrawerSearchQuery(e.target.value)}
                            className="bg-transparent border-none text-xs focus:ring-0 outline-none w-full placeholder:text-outline text-on-surface"
                          />
                        </div>

                        <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/5 bg-surface-lowest border border-outline-variant/5 rounded-xl pr-1">
                          {filteredDrawerEntities.length === 0 ? (
                            <div className="p-4 text-center text-xs text-outline italic">No matching records found.</div>
                          ) : (
                            filteredDrawerEntities.map(ent => (
                              <div
                                key={ent.id}
                                onClick={() => {
                                  setSelectedJobId(detailJob.id);
                                  setExpandedEntityId(ent.id);
                                  setSelectedJobDetailId(null);
                                  setActiveTab('explorer');
                                  logEvent(`Jumped to explorer record: ${ent.name}`);
                                }}
                                className="p-3 hover:bg-surface-high/30 cursor-pointer flex justify-between items-center transition-colors text-xs"
                              >
                                <div>
                                  <span className="font-bold text-on-surface block">{ent.name}</span>
                                  <span className="text-[10px] text-outline block mt-0.5">{ent.referenceId}</span>
                                </div>
                                
                                <div className="flex gap-2">
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                    ent.riskLevel === 'Critical' ? 'bg-red-400/10 text-red-400' :
                                    ent.riskLevel === 'High' ? 'bg-amber-400/10 text-amber-400' :
                                    ent.riskLevel === 'Medium' ? 'bg-primary/10 text-primary' :
                                    'bg-emerald-400/10 text-emerald-400'
                                  }`}>
                                    {ent.riskLevel}
                                  </span>
                                  <span className="text-[9px] font-bold bg-surface-high text-outline px-1.5 py-0.5 rounded-full">
                                    {ent.status}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {detailActiveStep === 4 && (() => {
                    if (detailJob.status === 'Ingested' || detailJob.status === 'Analyzing') {
                      return (
                        <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 bg-surface-high/15 border border-outline-variant/10 rounded-2xl animate-fadeIn min-h-[350px]">
                          <div className="size-16 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                            <Lock className="size-6 animate-pulse" />
                          </div>
                          <div>
                            <h3 className="font-bold text-base text-on-surface">Outreach Performance Locked</h3>
                            <p className="text-xs text-outline mt-1 max-w-sm">
                              This campaign has not been launched yet. Once approved, the multi-channel broadcast engine will populate this tab with real-time delivery and response statistics.
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedJobDetailId(null);
                              handleApproveAndStartJob(detailJob.id);
                            }}
                            className="px-4 py-2 bg-emerald-400 text-surface-lowest hover:bg-emerald-300 rounded-xl transition-all font-bold text-sm cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-400/10"
                          >
                            Approve & Launch Campaign <Play className="size-3.5 fill-current" />
                          </button>
                        </div>
                      );
                    }

                    // Pull tasks and interactions associated with jobEntities
                    const jobTasks = tasks.filter(t => t.jobId === selectedJobDetailId);
                    const totalAccounts = jobEntities.length;

                    const getEntityOutreachCategory = (entity: any) => {
                      const entityTasks = jobTasks.filter(t => t.entityId === entity.id);
                      if (entityTasks.length > 0) {
                        const hasPTP = entityTasks.some(t => t.outcome === 'wants_to_pay' || t.outcome === 'ptp_promised');
                        if (hasPTP) return 'commitment';
                        
                        const failedTask = entityTasks.find(t => t.status === 'Failed' || !t.outcome || t.outcome === 'NoAnswer' || t.outcome === 'Busy');
                        if (failedTask) {
                          if (failedTask.type === 'sms') return 'sms_fail';
                          if (failedTask.type === 'whatsapp') return 'whatsapp_fail';
                          if (failedTask.type === 'ivr') return 'ivr_fail';
                          if (failedTask.type === 'ai_voice') return 'voice_fail';
                        }
                        return 'failed';
                      }
                      
                      const code = entity.id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
                      const mod = code % 7;
                      if (mod === 0) return 'sms_fail';
                      if (mod === 1) return 'whatsapp_fail';
                      if (mod === 2) return 'ivr_fail';
                      if (mod === 3) return 'voice_fail';
                      return 'commitment';
                    };
                    
                    // Channel-wise breakdowns
                    const getChannelStats = (type: string) => {
                      const channelTasks = jobTasks.filter(t => t.type === type);
                      const count = channelTasks.length;
                      
                      if (count > 0) {
                        const delivered = channelTasks.filter(t => t.status === 'Completed' || t.status === 'Executed').length;
                        const responses = channelTasks.filter(t => t.outcome && t.outcome !== 'NoAnswer' && t.outcome !== 'Busy').length;
                        const achieved = channelTasks.filter(t => t.outcome === 'wants_to_pay' || t.outcome === 'ptp_promised').length;
                        return { sent: count, delivered, responses, achieved };
                      }
                      
                      // Dynamic realistic fallbacks
                      let sentRatio = 0.3;
                      let deliverRatio = 0.95;
                      let responseRatio = 0.25;
                      let achieveRatio = 0.6;
                      
                      if (type === 'sms') { sentRatio = 0.4; deliverRatio = 0.96; responseRatio = 0.15; achieveRatio = 0.4; }
                      else if (type === 'whatsapp') { sentRatio = 0.5; deliverRatio = 0.98; responseRatio = 0.45; achieveRatio = 0.7; }
                      else if (type === 'ivr') { sentRatio = 0.35; deliverRatio = 0.75; responseRatio = 0.25; achieveRatio = 0.5; }
                      else if (type === 'ai_voice') { sentRatio = 0.6; deliverRatio = 0.85; responseRatio = 0.55; achieveRatio = 0.75; }
                      
                      const sent = Math.max(1, Math.round(totalAccounts * sentRatio));
                      const delivered = Math.max(1, Math.round(sent * deliverRatio));
                      const responses = Math.max(1, Math.round(delivered * responseRatio));
                      const achieved = Math.max(1, Math.round(responses * achieveRatio));
                      
                      return { sent, delivered, responses, achieved };
                    };

                    const smsStats = getChannelStats('sms');
                    const waStats = getChannelStats('whatsapp');
                    const ivrStats = getChannelStats('ivr');
                    const voiceStats = getChannelStats('ai_voice');

                    const totalDispatched = smsStats.sent + waStats.sent + ivrStats.sent + voiceStats.sent;
                    const totalDelivered = smsStats.delivered + waStats.delivered + ivrStats.delivered + voiceStats.delivered;
                    const totalResponses = smsStats.responses + waStats.responses + ivrStats.responses + voiceStats.responses;
                    const totalAchieved = smsStats.achieved + waStats.achieved + ivrStats.achieved + voiceStats.achieved;

                    const overallDeliveryRate = totalDispatched > 0 ? Math.round((totalDelivered / totalDispatched) * 100) : 0;
                    const overallResponseRate = totalDelivered > 0 ? Math.round((totalResponses / totalDelivered) * 100) : 0;
                    const overallConversionRate = totalResponses > 0 ? Math.round((totalAchieved / totalResponses) * 100) : 0;

                    // Calculate total financial impact
                    const totalOutstanding = jobEntities.reduce((sum, e) => {
                      const amt = parseFloat((e.attributes.OutstandingAmount || '0').replace(/[^0-9.]/g, ''));
                      return sum + (isNaN(amt) ? 0 : amt);
                    }, 0);
                    const totalRecovered = totalOutstanding * (overallConversionRate / 100) * 0.45;

                    // Next actions dynamic plan
                    const nextActions = [];
                    if (smsStats.sent > smsStats.delivered) {
                      nextActions.push({
                        title: 'Resend Failed SMS via WhatsApp',
                        desc: `Queueing WhatsApp fallback alert for ${smsStats.sent - smsStats.delivered} undelivered SMS numbers.`,
                        time: 'Auto-triggered in 15 mins'
                      });
                    }
                    if (ivrStats.sent > ivrStats.delivered) {
                      nextActions.push({
                        title: 'Reschedule Dialer Retries',
                        desc: `Rescheduling automated IVR outreach for ${ivrStats.sent - ivrStats.delivered} unreachable or busy connections.`,
                        time: 'Scheduled today at 4:00 PM'
                      });
                    }
                    if (waStats.responses > waStats.achieved) {
                      nextActions.push({
                        title: 'Follow-up AI Voice outreach',
                        desc: `Initiate AI Voice call reminders for ${waStats.responses - waStats.achieved} contacts who read WhatsApp but did not confirm a PTP.`,
                        time: 'Queued for tomorrow morning'
                      });
                    }
                    if (nextActions.length === 0) {
                      nextActions.push(
                        { title: 'Trigger WhatsApp Follow-ups', desc: 'Deploy read-receipt follow-up templates for unresponsive accounts.', time: 'Scheduled in 1 hour' },
                        { title: 'Dialer Retry Sweep', desc: 'Initiate dialer sweep for busy/no-answer voice interactions.', time: 'Scheduled in 3 hours' }
                      );
                    }

                    const totalFailed = totalDispatched - totalAchieved;

                    return (
                      <div className="space-y-6 animate-fadeIn">
                        {/* High-level Outreach Counters Dashboard */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div
                            onClick={() => {
                              setOutreachFilterType('all');
                              setSelectedOutreachEntityId(null);
                            }}
                            className={`border rounded-2xl p-4 flex items-center gap-4 cursor-pointer transition-all hover:scale-[1.02] active:scale-95 ${
                              outreachFilterType === 'all'
                                ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/20'
                                : 'bg-surface-high/15 border-outline-variant/10 hover:bg-surface-high/25'
                            }`}
                          >
                            <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                              <Activity className="size-5" />
                            </div>
                            <div>
                              <span className="text-[10px] font-black text-outline uppercase tracking-wider block">Total Outreach Targeted</span>
                              <span className="text-2xl font-black text-on-surface block mt-0.5">{totalDispatched} Records</span>
                              <p className="text-[10px] text-outline mt-0.5">Dispatched across all channels</p>
                            </div>
                          </div>

                          <div
                            onClick={() => {
                              setOutreachFilterType(outreachFilterType === 'commitments' ? 'all' : 'commitments');
                              setSelectedOutreachEntityId(null);
                            }}
                            className={`border rounded-2xl p-4 flex items-center gap-4 cursor-pointer transition-all hover:scale-[1.02] active:scale-95 ${
                              outreachFilterType === 'commitments'
                                ? 'bg-emerald-400/10 border-emerald-400/30 ring-1 ring-emerald-400/25'
                                : 'bg-emerald-400/5 border-emerald-400/10 hover:bg-emerald-400/10'
                            }`}
                          >
                            <div className="size-12 rounded-xl bg-emerald-400/10 text-emerald-400 flex items-center justify-center border border-emerald-400/20">
                              <CheckCircle className="size-5" />
                            </div>
                            <div>
                              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block">Promises Kept / Wants to Pay</span>
                              <span className="text-2xl font-black text-emerald-400 block mt-0.5">{totalAchieved} Commitments</span>
                              <p className="text-[10px] text-emerald-400/85 mt-0.5">Success Conversion: {Math.round(totalAchieved / totalDispatched * 100)}%</p>
                            </div>
                          </div>

                          <div
                            onClick={() => {
                              setOutreachFilterType(outreachFilterType === 'failed' ? 'all' : 'failed');
                              setSelectedOutreachEntityId(null);
                            }}
                            className={`border rounded-2xl p-4 flex items-center gap-4 cursor-pointer transition-all hover:scale-[1.02] active:scale-95 ${
                              outreachFilterType === 'failed'
                                ? 'bg-red-400/10 border-red-400/30 ring-1 ring-red-400/25'
                                : 'bg-red-400/5 border-red-400/10 hover:bg-red-400/10'
                            }`}
                          >
                            <div className="size-12 rounded-xl bg-red-400/10 text-red-400 flex items-center justify-center border border-red-400/20">
                              <AlertTriangle className="size-5" />
                            </div>
                            <div>
                              <span className="text-[10px] font-black text-red-400 uppercase tracking-wider block font-bold">Failed / Unresponded</span>
                              <span className="text-2xl font-black text-red-400 block mt-0.5">{totalFailed} Failed</span>
                              <p className="text-[10px] text-red-400/85 mt-0.5">Failure / Drop-off Rate: {Math.round(totalFailed / totalDispatched * 100)}%</p>
                            </div>
                          </div>
                        </div>

                        {/* Multi-Channel Parallel Batch Engine Console */}
                        <div className="glass-panel p-6 rounded-3xl border border-outline-variant/10 bg-surface-low/5 space-y-6">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/10 pb-4">
                            <div className="space-y-1">
                              <h4 className="text-sm font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
                                <Cpu className={`size-4 text-primary ${detailJob.status === 'Executing' ? 'animate-spin' : ''}`} />
                                Multi-Channel Parallel Batch Dispatcher
                              </h4>
                              <p className="text-[10px] text-outline">
                                Real-time pipeline visualizer for parallelized SMS, WhatsApp, and Voice trunk operations (500+ records)
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] text-outline">Engine Status:</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                detailJob.status === 'Executing' ? 'bg-primary/10 text-primary border-primary/20 animate-pulse' : 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
                              }`}>
                                {detailJob.status === 'Executing' ? 'Executing Parallel Threads' : 'Idle - Run Completed'}
                              </span>
                            </div>
                          </div>

                          {/* Parallel Gateway Pipelines */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* SMS Gateway */}
                            <div className="bg-surface-high/15 border border-outline-variant/5 rounded-2xl p-4 space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                                  <MessageSquare className="size-3.5 text-blue-400" />
                                  SMS Parallel Gateway
                                </span>
                                <span className="text-[9px] bg-blue-400/10 text-blue-400 px-1.5 py-0.5 rounded font-mono">
                                  {detailJob.status === 'Executing' ? '45 msgs/sec' : 'Finished'}
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex justify-between text-[10px] text-outline">
                                  <span>Gateway Output (Concurrency: 100)</span>
                                  <span>{detailJob.status === 'Executing' ? '98%' : '100%'}</span>
                                </div>
                                <div className="w-full bg-surface-high h-2 rounded-full overflow-hidden">
                                  <div
                                    className="bg-blue-400 h-full rounded-full transition-all duration-1000"
                                    style={{ width: detailJob.status === 'Executing' ? '98%' : '100%' }}
                                  />
                                </div>
                                <p className="text-[9px] text-outline-variant italic">
                                  Digital triggers dispatched instantly in bulk via parallelized SMS servers.
                                </p>
                              </div>
                            </div>

                            {/* WhatsApp Broadcast */}
                            <div className="bg-surface-high/15 border border-outline-variant/5 rounded-2xl p-4 space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                                  <Send className="size-3.5 text-emerald-400" />
                                  WhatsApp API Pipeline
                                </span>
                                <span className="text-[9px] bg-emerald-400/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono">
                                  {detailJob.status === 'Executing' ? '30 msgs/sec' : 'Finished'}
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex justify-between text-[10px] text-outline">
                                  <span>Concurrent Senders (Cluster Size: 10)</span>
                                  <span>{detailJob.status === 'Executing' ? '95%' : '100%'}</span>
                                </div>
                                <div className="w-full bg-surface-high h-2 rounded-full overflow-hidden">
                                  <div
                                    className="bg-emerald-400 h-full rounded-full transition-all duration-1000"
                                    style={{ width: detailJob.status === 'Executing' ? '95%' : '100%' }}
                                  />
                                </div>
                                <p className="text-[9px] text-outline-variant italic">
                                  WhatsApp interactive templates broadcast concurrently in parallel threads.
                                </p>
                              </div>
                            </div>

                            {/* Voice Telephony Dialer */}
                            <div className="bg-surface-high/15 border border-outline-variant/5 rounded-2xl p-4 space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                                  <Phone className="size-3.5 text-primary" />
                                  AI Voice Call Dialer
                                </span>
                                <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">
                                  {detailJob.status === 'Executing' ? '12 Active Lines' : '0 Lines'}
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex justify-between text-[10px] text-outline">
                                  <span>Voice Bot Lines Pool (Max: 12)</span>
                                  <span>{detailJob.status === 'Executing' ? `${Math.round((detailJob.processedRecords / detailJob.totalRecords) * 100)}%` : '100%'}</span>
                                </div>
                                <div className="w-full bg-surface-high h-2 rounded-full overflow-hidden">
                                  <div
                                    className="bg-primary h-full rounded-full transition-all duration-300"
                                    style={{ width: detailJob.status === 'Executing' ? `${(detailJob.processedRecords / detailJob.totalRecords) * 100}%` : '100%' }}
                                  />
                                </div>
                                <p className="text-[9px] text-outline-variant italic">
                                  Voice dialers are throttled to 12 parallel lines since calls require active conversation time.
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* 12 Telephony Channels Visual Grid */}
                          <div className="space-y-3">
                            <h5 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                              <Activity className="size-3.5 text-primary" />
                              Virtual SIP Telephony Trunk Monitor (12 Concurrent Channels)
                            </h5>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                              {Array.from({ length: 12 }).map((_, i) => {
                                const channelId = i + 1;
                                // Determine simulated channel status based on current job processing
                                const isExecuting = detailJob.status === 'Executing';
                                const activeChannels = [1, 2, 4, 5, 7, 9, 10, 12];
                                const isActive = isExecuting && activeChannels.includes(channelId);
                                
                                // Fetch a random customer name from entities for display
                                const entityIndex = (detailJob.processedRecords + channelId) % (jobEntities.length || 1);
                                const currentEntity = jobEntities[entityIndex];
                                const customerName = currentEntity ? currentEntity.name : 'Unknown Customer';
                                
                                // Random state
                                const states = ['Connected', 'Ringing', 'Dialing', 'Speaking'];
                                const state = states[channelId % states.length];
                                
                                return (
                                  <div
                                    key={channelId}
                                    className={`p-3 rounded-xl border transition-all ${
                                      isActive
                                        ? 'bg-primary/5 border-primary/20 shadow-sm animate-fadeIn'
                                        : 'bg-surface-high/10 border-outline-variant/5 text-outline-variant'
                                    }`}
                                  >
                                    <div className="flex justify-between items-start">
                                      <span className="text-[9px] font-black uppercase text-outline">Line {channelId}</span>
                                      {isActive ? (
                                        <span className="flex h-2 w-2 relative">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                      ) : (
                                        <span className="h-1.5 w-1.5 rounded-full bg-outline-variant/30" />
                                      )}
                                    </div>
                                    
                                    <div className="mt-2 space-y-0.5">
                                      <p className="text-[10px] font-bold text-on-surface truncate">
                                        {isActive ? customerName : 'Idle'}
                                      </p>
                                      <p className="text-[9px] text-outline font-mono truncate">
                                        {isActive ? `📞 ${state}` : 'Ready'}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Main Grid: Left Column (1) & Right Column (2) */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          {/* Left Column: Overall Metrics & Summary Progress & Console Logs */}
                          <div className="lg:col-span-1 space-y-6">
                            <div className="glass-panel p-5 rounded-2xl border border-outline-variant/10 space-y-4">
                              <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                                <TrendingUp className="size-4 text-primary" />
                                Execution Summary
                              </h4>
                              
                              <div className="space-y-4">
                                <div className="flex items-center gap-4 bg-surface-high/20 border border-outline-variant/5 rounded-xl p-3">
                                  <div className="size-14 rounded-full border-4 border-primary/20 border-t-primary flex items-center justify-center">
                                    <span className="text-xs font-black text-on-surface">{overallDeliveryRate}%</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold text-outline uppercase block">Overall Delivery</span>
                                    <span className="text-sm font-bold text-on-surface block mt-0.5">{totalDelivered} / {totalDispatched} Reached</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-4 bg-surface-high/20 border border-outline-variant/5 rounded-xl p-3">
                                  <div className="size-14 rounded-full border-4 border-emerald-400/20 border-t-emerald-400 flex items-center justify-center">
                                    <span className="text-xs font-black text-emerald-400">{overallResponseRate}%</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold text-outline uppercase block">Response Rate</span>
                                    <span className="text-sm font-bold text-on-surface block mt-0.5">{totalResponses} Interactions</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-4 bg-surface-high/20 border border-outline-variant/5 rounded-xl p-3">
                                  <div className="size-14 rounded-full border-4 border-amber-400/20 border-t-amber-400 flex items-center justify-center">
                                    <span className="text-xs font-black text-amber-400">{overallConversionRate}%</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold text-outline uppercase block">PTP Promise Rate</span>
                                    <span className="text-sm font-bold text-on-surface block mt-0.5">{totalAchieved} Commitments</span>
                                  </div>
                                </div>

                                <div className="border-t border-outline-variant/10 pt-4 space-y-2">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-outline">Total Portfolio Value:</span>
                                    <span className="font-bold text-on-surface">₹{totalOutstanding.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span className="text-outline">Estimated Recovered:</span>
                                    <span className="font-bold text-emerald-400">₹{totalRecovered.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Next Plan Actions */}
                            <div className="glass-panel p-5 rounded-2xl border border-outline-variant/10 space-y-3">
                              <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                                <Clock className="size-4 text-primary" />
                                Automated Next Action Plan
                              </h4>
                              <div className="space-y-3">
                                {nextActions.map((action, idx) => (
                                  <div key={idx} className="bg-surface-high/15 border border-outline-variant/5 rounded-xl p-3 text-xs space-y-1">
                                    <div className="flex justify-between items-center font-bold">
                                      <span className="text-on-surface">{action.title}</span>
                                      <span className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[9px] font-black uppercase">{action.time}</span>
                                    </div>
                                    <p className="text-outline-high leading-relaxed mt-1">{action.desc}</p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Structured Live Remediation Activity Table */}
                            <div className="glass-panel p-5 rounded-2xl border border-outline-variant/10 space-y-4">
                              <div className="flex justify-between items-center">
                                <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                                  <RefreshCw className="size-4 text-primary animate-spin-slow" />
                                  Live Remediation Activity Desk
                                </h4>
                                <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full border border-primary/20 animate-pulse">
                                  Real-Time Loop
                                </span>
                              </div>
                              <div className="overflow-x-auto border border-outline-variant/10 rounded-xl">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="border-b border-outline-variant/10 bg-surface-high/30 text-[10px] font-bold text-outline uppercase tracking-wider select-none">
                                      <th className="p-3">Remediation Loop Route</th>
                                      <th className="p-3 text-center">Status</th>
                                      <th className="p-3 text-center">Active Count</th>
                                      <th className="p-3">Latest Event Log</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-outline-variant/5">
                                    {remediationGroups.map(group => (
                                      <tr key={group.id} className="hover:bg-surface-high/10 transition-colors">
                                        <td className="p-3 font-semibold text-on-surface whitespace-nowrap">
                                          {group.label}
                                        </td>
                                        <td className="p-3 text-center">
                                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border" style={{
                                            backgroundColor: group.status === 'Active' ? 'rgba(74, 222, 128, 0.1)' : group.status === 'Escalated' ? 'rgba(248, 113, 113, 0.1)' : 'rgba(251, 191, 36, 0.1)',
                                            color: group.status === 'Active' ? '#4ade80' : group.status === 'Escalated' ? '#f87171' : '#fbbf24',
                                            borderColor: group.status === 'Active' ? 'rgba(74, 222, 128, 0.2)' : group.status === 'Escalated' ? 'rgba(248, 113, 113, 0.2)' : 'rgba(251, 191, 36, 0.2)'
                                          }}>
                                            <span className={`size-1.5 rounded-full ${
                                              group.status === 'Active' ? 'bg-emerald-400 animate-ping' :
                                              group.status === 'Escalated' ? 'bg-red-400 animate-pulse' :
                                              'bg-amber-400'
                                            }`} />
                                            {group.status}
                                          </div>
                                        </td>
                                        <td className="p-3 text-center font-mono font-bold text-on-surface">
                                          <span className="bg-surface-high border border-outline-variant/10 px-2 py-0.5 rounded-md text-[11px]">
                                            {group.count}
                                          </span>
                                        </td>
                                        <td className="p-3 text-xs font-mono text-emerald-400 max-w-xs truncate" title={group.activity}>
                                          <span className="text-outline mr-1">&gt;</span>
                                          {group.activity}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>

                          {/* Right Columns: Funnel Matrix & Failures Desk */}
                          <div className="lg:col-span-2 space-y-6">
                            {/* Conversion Funnel Matrix */}
                            <div className="glass-panel p-5 rounded-2xl border border-outline-variant/10 space-y-4">
                              <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                                <Layers className="size-4 text-primary" />
                                Multi-Channel Conversion Funnel
                              </h4>
                              <p className="text-xs text-outline">
                                Detailed analysis of outreach, message read rates, interactive responses, and PTP achievement across active channels.
                              </p>

                              <div className="space-y-6">
                                {/* SMS channel */}
                                <div className="space-y-2">
                                  <div className="flex justify-between text-xs font-bold">
                                    <span className="text-on-surface flex items-center gap-1.5">
                                      <span className="size-2 rounded-full bg-blue-400 animate-pulse" />
                                      SMS Broadcast
                                    </span>
                                    <span className="text-outline font-bold">Conversion: {smsStats.sent > 0 ? Math.round((smsStats.achieved / smsStats.sent) * 100) : 0}%</span>
                                  </div>
                                  <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold">
                                    <div className="bg-surface-high/20 border border-outline-variant/5 rounded-lg p-1.5">
                                      <span className="block text-outline text-[8px] uppercase">Sent</span>
                                      <span className="block text-on-surface text-xs mt-0.5">{smsStats.sent}</span>
                                    </div>
                                    <div className="bg-surface-high/20 border border-outline-variant/5 rounded-lg p-1.5">
                                      <span className="block text-outline text-[8px] uppercase">Delivered</span>
                                      <span className="block text-on-surface text-xs mt-0.5">{smsStats.delivered}</span>
                                    </div>
                                    <div className="bg-surface-high/20 border border-outline-variant/5 rounded-lg p-1.5">
                                      <span className="block text-outline text-[8px] uppercase">Link Click</span>
                                      <span className="block text-on-surface text-xs mt-0.5">{smsStats.responses}</span>
                                    </div>
                                    <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-lg p-1.5">
                                      <span className="block text-emerald-400 text-[8px] uppercase">PTP Paid</span>
                                      <span className="block text-emerald-400 text-xs mt-0.5">{smsStats.achieved}</span>
                                    </div>
                                  </div>
                                  {/* Funnel Progress Bar */}
                                  <div className="w-full bg-surface-high/30 h-1.5 rounded-full overflow-hidden flex">
                                    <div className="bg-blue-400/30 h-full" style={{ width: '100%' }} />
                                    <div className="bg-blue-400 h-full" style={{ width: `${smsStats.sent > 0 ? (smsStats.delivered / smsStats.sent) * 100 : 0}%` }} />
                                    <div className="bg-blue-300 h-full" style={{ width: `${smsStats.sent > 0 ? (smsStats.responses / smsStats.sent) * 100 : 0}%` }} />
                                    <div className="bg-emerald-400 h-full" style={{ width: `${smsStats.sent > 0 ? (smsStats.achieved / smsStats.sent) * 100 : 0}%` }} />
                                  </div>
                                </div>

                                {/* WhatsApp channel */}
                                <div className="space-y-2">
                                  <div className="flex justify-between text-xs font-bold">
                                    <span className="text-on-surface flex items-center gap-1.5">
                                      <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                                      WhatsApp Interactive
                                    </span>
                                    <span className="text-outline font-bold">Conversion: {waStats.sent > 0 ? Math.round((waStats.achieved / waStats.sent) * 100) : 0}%</span>
                                  </div>
                                  <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold">
                                    <div className="bg-surface-high/20 border border-outline-variant/5 rounded-lg p-1.5">
                                      <span className="block text-outline text-[8px] uppercase">Sent</span>
                                      <span className="block text-on-surface text-xs mt-0.5">{waStats.sent}</span>
                                    </div>
                                    <div className="bg-surface-high/20 border border-outline-variant/5 rounded-lg p-1.5">
                                      <span className="block text-outline text-[8px] uppercase">Read</span>
                                      <span className="block text-on-surface text-xs mt-0.5">{waStats.delivered}</span>
                                    </div>
                                    <div className="bg-surface-high/20 border border-outline-variant/5 rounded-lg p-1.5">
                                      <span className="block text-outline text-[8px] uppercase">Btn Click</span>
                                      <span className="block text-on-surface text-xs mt-0.5">{waStats.responses}</span>
                                    </div>
                                    <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-lg p-1.5">
                                      <span className="block text-emerald-400 text-[8px] uppercase">PTP Paid</span>
                                      <span className="block text-emerald-400 text-xs mt-0.5">{waStats.achieved}</span>
                                    </div>
                                  </div>
                                  {/* Funnel Progress Bar */}
                                  <div className="w-full bg-surface-high/30 h-1.5 rounded-full overflow-hidden flex">
                                    <div className="bg-emerald-400/30 h-full" style={{ width: '100%' }} />
                                    <div className="bg-emerald-400/50 h-full" style={{ width: `${waStats.sent > 0 ? (waStats.delivered / waStats.sent) * 100 : 0}%` }} />
                                    <div className="bg-emerald-400/70 h-full" style={{ width: `${waStats.sent > 0 ? (waStats.responses / waStats.sent) * 100 : 0}%` }} />
                                    <div className="bg-emerald-400 h-full" style={{ width: `${waStats.sent > 0 ? (waStats.achieved / waStats.sent) * 100 : 0}%` }} />
                                  </div>
                                </div>

                                {/* IVR Call */}
                                <div className="space-y-2">
                                  <div className="flex justify-between text-xs font-bold">
                                    <span className="text-on-surface flex items-center gap-1.5">
                                      <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
                                      Interactive Voice (IVR)
                                    </span>
                                    <span className="text-outline font-bold">Conversion: {ivrStats.sent > 0 ? Math.round((ivrStats.achieved / ivrStats.sent) * 100) : 0}%</span>
                                  </div>
                                  <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold">
                                    <div className="bg-surface-high/20 border border-outline-variant/5 rounded-lg p-1.5">
                                      <span className="block text-outline text-[8px] uppercase">Placed</span>
                                      <span className="block text-on-surface text-xs mt-0.5">{ivrStats.sent}</span>
                                    </div>
                                    <div className="bg-surface-high/20 border border-outline-variant/5 rounded-lg p-1.5">
                                      <span className="block text-outline text-[8px] uppercase">Answered</span>
                                      <span className="block text-on-surface text-xs mt-0.5">{ivrStats.delivered}</span>
                                    </div>
                                    <div className="bg-surface-high/20 border border-outline-variant/5 rounded-lg p-1.5">
                                      <span className="block text-outline text-[8px] uppercase">Keypress</span>
                                      <span className="block text-on-surface text-xs mt-0.5">{ivrStats.responses}</span>
                                    </div>
                                    <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-lg p-1.5">
                                      <span className="block text-emerald-400 text-[8px] uppercase">PTP Paid</span>
                                      <span className="block text-emerald-400 text-xs mt-0.5">{ivrStats.achieved}</span>
                                    </div>
                                  </div>
                                  {/* Funnel Progress Bar */}
                                  <div className="w-full bg-surface-high/30 h-1.5 rounded-full overflow-hidden flex">
                                    <div className="bg-amber-400/30 h-full" style={{ width: '100%' }} />
                                    <div className="bg-amber-400/50 h-full" style={{ width: `${ivrStats.sent > 0 ? (ivrStats.delivered / ivrStats.sent) * 100 : 0}%` }} />
                                    <div className="bg-amber-400/70 h-full" style={{ width: `${ivrStats.sent > 0 ? (ivrStats.responses / ivrStats.sent) * 100 : 0}%` }} />
                                    <div className="bg-emerald-400 h-full" style={{ width: `${ivrStats.sent > 0 ? (ivrStats.achieved / ivrStats.sent) * 100 : 0}%` }} />
                                  </div>
                                </div>

                                {/* AI Voice Call */}
                                <div className="space-y-2">
                                  <div className="flex justify-between text-xs font-bold">
                                    <span className="text-on-surface flex items-center gap-1.5">
                                      <span className="size-2 rounded-full bg-purple-400 animate-pulse" />
                                      AI Human-like Voice Agent
                                    </span>
                                    <span className="text-outline font-bold">Conversion: {voiceStats.sent > 0 ? Math.round((voiceStats.achieved / voiceStats.sent) * 100) : 0}%</span>
                                  </div>
                                  <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold">
                                    <div className="bg-surface-high/20 border border-outline-variant/5 rounded-lg p-1.5">
                                      <span className="block text-outline text-[8px] uppercase">Placed</span>
                                      <span className="block text-on-surface text-xs mt-0.5">{voiceStats.sent}</span>
                                    </div>
                                    <div className="bg-surface-high/20 border border-outline-variant/5 rounded-lg p-1.5">
                                      <span className="block text-outline text-[8px] uppercase">Connected</span>
                                      <span className="block text-on-surface text-xs mt-0.5">{voiceStats.delivered}</span>
                                    </div>
                                    <div className="bg-surface-high/20 border border-outline-variant/5 rounded-lg p-1.5">
                                      <span className="block text-outline text-[8px] uppercase">Interactive</span>
                                      <span className="block text-on-surface text-xs mt-0.5">{voiceStats.responses}</span>
                                    </div>
                                    <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-lg p-1.5">
                                      <span className="block text-emerald-400 text-[8px] uppercase">PTP Paid</span>
                                      <span className="block text-emerald-400 text-xs mt-0.5">{voiceStats.achieved}</span>
                                    </div>
                                  </div>
                                  {/* Funnel Progress Bar */}
                                  <div className="w-full bg-surface-high/30 h-1.5 rounded-full overflow-hidden flex">
                                    <div className="bg-purple-400/30 h-full" style={{ width: '100%' }} />
                                    <div className="bg-purple-400/50 h-full" style={{ width: `${voiceStats.sent > 0 ? (voiceStats.delivered / voiceStats.sent) * 100 : 0}%` }} />
                                    <div className="bg-purple-400/70 h-full" style={{ width: `${voiceStats.sent > 0 ? (voiceStats.responses / voiceStats.sent) * 100 : 0}%` }} />
                                    <div className="bg-emerald-400 h-full" style={{ width: `${voiceStats.sent > 0 ? (voiceStats.achieved / voiceStats.sent) * 100 : 0}%` }} />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Outreach Failures & Automated Remediation Desk */}
                            <div className="glass-panel p-5 rounded-2xl border border-outline-variant/10 space-y-4">
                              <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                                <AlertTriangle className="size-4 text-red-400 animate-pulse" />
                                Outreach Failures & Remediation Desk
                              </h4>
                              <p className="text-xs text-outline">
                                Granular breakdown of bounces, drop-offs, and non-responses along with instant system remediation loops.
                              </p>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                  {
                                    id: 'sms_fail',
                                    channel: 'SMS Broadcast failures',
                                    icon: <MessageSquare className="size-4 text-blue-400" />,
                                    failCount: smsStats.sent - smsStats.achieved,
                                    breakdown: `${smsStats.sent - smsStats.delivered} undelivered/DND, ${smsStats.delivered - smsStats.achieved} link ignored`,
                                    actionPill: 'WhatsApp Fallback',
                                    actionDesc: 'SMS undeliverable numbers were automatically extracted and routed to secondary WhatsApp interactive fallback sweeps.'
                                  },
                                  {
                                    id: 'whatsapp_fail',
                                    channel: 'WhatsApp Drop-offs',
                                    icon: <MessageSquare className="size-4 text-emerald-400" />,
                                    failCount: waStats.sent - waStats.achieved,
                                    breakdown: `${waStats.sent - waStats.delivered} unread, ${waStats.delivered - waStats.achieved} read but no reply`,
                                    actionPill: 'Offer Reminders',
                                    actionDesc: 'Enqueued read-receipt reminders with custom discount link offers scheduled for automated dispatch.'
                                  },
                                  {
                                    id: 'ivr_fail',
                                    channel: 'IVR Dialer bounces',
                                    icon: <Phone className="size-4 text-amber-400" />,
                                    failCount: ivrStats.sent - ivrStats.achieved,
                                    breakdown: `${ivrStats.sent - ivrStats.delivered} busy/no answer, ${ivrStats.delivered - ivrStats.achieved} hung up early`,
                                    actionPill: 'Dialer Sweep',
                                    actionDesc: 'Trunk retry rules triggered. Re-dialing unreachable accounts automatically scheduled at secondary window times.'
                                  },
                                  {
                                    id: 'voice_fail',
                                    channel: 'AI Voice Drops',
                                    icon: <Phone className="size-4 text-purple-400" />,
                                    failCount: voiceStats.sent - voiceStats.achieved,
                                    breakdown: `${voiceStats.sent - voiceStats.delivered} network fail, ${voiceStats.delivered - voiceStats.achieved} disconnected/refused`,
                                    actionPill: 'Human Agent Queue',
                                    actionDesc: 'Customer hung up or explicitly refused bot. Profile escalated immediately to manual recovery lists.'
                                  }
                                ].map((fail, idx) => (
                                  <div
                                    key={idx}
                                    onClick={() => {
                                      setOutreachFilterType(outreachFilterType === fail.id ? 'all' : fail.id as any);
                                      setSelectedOutreachEntityId(null);
                                    }}
                                    className={`border rounded-xl p-3.5 space-y-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] ${
                                      outreachFilterType === fail.id
                                        ? 'bg-red-400/10 border-red-400/30 ring-1 ring-red-400/20'
                                        : 'bg-surface-high/15 border-outline-variant/5 hover:bg-surface-high/25'
                                    }`}
                                  >
                                    <div className="flex justify-between items-start gap-2">
                                      <div className="flex items-center gap-2">
                                        {fail.icon}
                                        <span className="font-bold text-on-surface text-xs leading-none">{fail.channel}</span>
                                      </div>
                                      <span className="text-[10px] bg-red-400/10 text-red-400 font-black px-1.5 py-0.5 rounded leading-none">
                                        {fail.failCount} failed
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-outline italic leading-none">{fail.breakdown}</p>
                                    <div className="pt-1.5 border-t border-outline-variant/5 space-y-1">
                                      <div className="flex justify-between items-center text-[9px] font-bold">
                                        <span className="text-outline uppercase">Remediation Action:</span>
                                        <span className="text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded uppercase">
                                          {fail.actionPill}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-outline-high leading-relaxed">{fail.actionDesc}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                        </div>

                        {/* Filtered Records List Panel */}
                        {outreachFilterType !== 'all' && (() => {
                          const filteredRecords = jobEntities.filter(e => {
                            const cat = getEntityOutreachCategory(e);
                            if (outreachFilterType === 'commitments') return cat === 'commitment';
                            if (outreachFilterType === 'failed') return cat !== 'commitment';
                            return cat === outreachFilterType;
                          });

                          const filterLabels: Record<string, string> = {
                            commitments: 'Promises Kept / Wants to Pay',
                            failed: 'All Failed / Unresponded',
                            sms_fail: 'SMS Broadcast Failures',
                            whatsapp_fail: 'WhatsApp Drop-offs',
                            ivr_fail: 'IVR Dialer Bounces',
                            voice_fail: 'AI Voice Drops'
                          };

                          const totalOutreachPages = Math.ceil(filteredRecords.length / 10);
                          const paginatedRecords = filteredRecords.slice((outreachPage - 1) * 10, outreachPage * 10);

                          return (
                            <div className="glass-panel p-5 rounded-2xl border border-outline-variant/10 space-y-4 animate-fadeIn">
                              <div className="flex justify-between items-center">
                                <div>
                                  <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                                    <Database className="size-4 text-primary" />
                                    Records for: {filterLabels[outreachFilterType]}
                                  </h4>
                                  <p className="text-xs text-outline mt-1">
                                    Showing {filteredRecords.length} records matching selection. Click on any record to view its full outreach and remediation journey.
                                  </p>
                                </div>
                                <button
                                  onClick={() => setOutreachFilterType('all')}
                                  className="px-3 py-1 bg-surface-high border border-outline-variant/10 text-xs font-bold text-outline hover:text-on-surface rounded-lg cursor-pointer transition-all"
                                >
                                  Clear Filter
                                </button>
                              </div>

                              {filteredRecords.length === 0 ? (
                                <div className="text-center py-6 text-xs text-outline italic">
                                  No records found in this category.
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  <div className="border border-outline-variant/5 rounded-xl overflow-hidden overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                      <thead>
                                        <tr className="bg-surface-high/35 border-b border-outline-variant/10 text-outline font-bold">
                                          <th className="p-3">Customer Name</th>
                                          <th className="p-3">Phone</th>
                                          <th className="p-3">DPD</th>
                                          <th className="p-3">Outstanding</th>
                                          <th className="p-3 text-center">Risk Tier</th>
                                          <th className="p-3">Remediation Status</th>
                                          <th className="p-3 text-right">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-outline-variant/5">
                                        {paginatedRecords.map(rec => {
                                          const cat = getEntityOutreachCategory(rec);
                                          let statusBadge = <span className="bg-emerald-400/10 text-emerald-400 px-2 py-0.5 rounded font-black text-[9px] uppercase">Completed PTP</span>;
                                          if (cat === 'sms_fail') {
                                            statusBadge = <span className="bg-blue-400/10 text-blue-400 px-2 py-0.5 rounded font-black text-[9px] uppercase">SMS Failed - WhatsApp Fallback</span>;
                                          } else if (cat === 'whatsapp_fail') {
                                            statusBadge = <span className="bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded font-black text-[9px] uppercase">WA Drop - Scheduled Retry</span>;
                                          } else if (cat === 'ivr_fail') {
                                            statusBadge = <span className="bg-orange-400/10 text-orange-400 px-2 py-0.5 rounded font-black text-[9px] uppercase">IVR Bounce - Dialer Retrying</span>;
                                          } else if (cat === 'voice_fail') {
                                            statusBadge = <span className="bg-purple-400/10 text-purple-400 px-2 py-0.5 rounded font-black text-[9px] uppercase">AI Drop - Escalated to Agent</span>;
                                          } else if (cat === 'failed') {
                                            statusBadge = <span className="bg-red-400/10 text-red-400 px-2 py-0.5 rounded font-black text-[9px] uppercase">General Dropped Out</span>;
                                          }

                                          let riskBadge = <span className="bg-slate-400/10 text-slate-400 px-2 py-0.5 rounded font-black text-[9px] uppercase">Low</span>;
                                          if (rec.riskLevel === 'Critical') {
                                            riskBadge = <span className="bg-red-400/15 text-red-400 border border-red-400/20 px-2 py-0.5 rounded font-black text-[9px] uppercase">Critical</span>;
                                          } else if (rec.riskLevel === 'High') {
                                            riskBadge = <span className="bg-orange-400/10 text-orange-400 px-2 py-0.5 rounded font-black text-[9px] uppercase">High</span>;
                                          } else if (rec.riskLevel === 'Medium') {
                                            riskBadge = <span className="bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded font-black text-[9px] uppercase">Medium</span>;
                                          }

                                          return (
                                            <tr
                                              key={rec.id}
                                              onClick={() => setSelectedOutreachEntityId(rec.id)}
                                              className="hover:bg-surface-high/15 transition-colors cursor-pointer group"
                                            >
                                              <td className="p-3 font-bold text-on-surface group-hover:text-primary transition-colors">
                                                {rec.name}
                                              </td>
                                              <td className="p-3 text-outline font-mono">{rec.attributes.Phone || '+91 XXXXX XXXXX'}</td>
                                              <td className="p-3 font-bold text-on-surface">{rec.attributes.DPD || '0'} Days</td>
                                              <td className="p-3 font-bold text-on-surface">₹{parseFloat(String(rec.attributes.OutstandingAmount || '0').replace(/[^0-9.]/g, '')).toLocaleString()}</td>
                                              <td className="p-3 text-center">{riskBadge}</td>
                                              <td className="p-3">{statusBadge}</td>
                                              <td className="p-3 text-right">
                                                <span className="text-[10px] text-primary font-bold group-hover:underline flex items-center justify-end gap-1">
                                                  View Audit <ArrowRight className="size-3" />
                                                </span>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>

                                  {/* Table Pagination Controls */}
                                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-outline-variant/10 pt-4">
                                    <div className="text-[11px] text-outline">
                                      Showing {filteredRecords.length === 0 ? 0 : (outreachPage - 1) * 10 + 1} - {Math.min(outreachPage * 10, filteredRecords.length)} of {filteredRecords.length} records
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <button
                                        disabled={outreachPage === 1}
                                        onClick={() => setOutreachPage(prev => Math.max(prev - 1, 1))}
                                        className="px-3 py-1.5 rounded-lg bg-surface-high hover:bg-surface-highest border border-outline-variant/10 font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                      >
                                        Previous
                                      </button>
                                      <span className="text-outline text-xs">
                                        Page {outreachPage} of {totalOutreachPages}
                                      </span>
                                      <button
                                        disabled={outreachPage === totalOutreachPages || totalOutreachPages === 0}
                                        onClick={() => setOutreachPage(prev => Math.min(prev + 1, totalOutreachPages))}
                                        className="px-3 py-1.5 rounded-lg bg-surface-high hover:bg-surface-highest border border-outline-variant/10 font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                      >
                                        Next
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Customer Outreach Journey Detail Modal */}
                        {selectedOutreachEntityId && (() => {
                          const entity = jobEntities.find(e => e.id === selectedOutreachEntityId);
                          if (!entity) return null;

                          const cat = getEntityOutreachCategory(entity);
                          
                          const timelineEvents = [
                            {
                              title: 'Record scrubbing and cleaning',
                              status: 'Success',
                              time: '09:00 AM',
                              desc: 'Validated name, corrected phone format prefix, and formatted outstanding balance successfully.'
                            },
                            {
                              title: 'Portfolio deduplication & integration',
                              status: 'Success',
                              time: '09:02 AM',
                              desc: 'Cross-referenced active lists. Deduplicated across 2 existing loan profiles.'
                            },
                            {
                              title: 'Risk tier and strategy allocation',
                              status: 'Success',
                              time: '09:05 AM',
                              desc: `Classified as Risk Tier [${entity.riskLevel || 'Medium'}]. Segment allocation rationale: Outstanding DPD is ${entity.attributes.DPD || 0} days.`
                            }
                          ];

                          if (cat === 'commitment') {
                            timelineEvents.push(
                              {
                                title: 'Multi-Channel outreach routing',
                                status: 'Success',
                                time: '09:08 AM',
                                desc: 'Routed to SMS & WhatsApp smart strategy queue.'
                              },
                              {
                                title: 'WhatsApp outreach delivered',
                                status: 'Success',
                                time: '09:12 AM',
                                desc: 'Read receipt confirmed by customer. Interactive payment options shown.'
                              },
                              {
                                title: 'PTP Commitment Registered',
                                status: 'Success',
                                time: '09:15 AM',
                                desc: 'Customer clicked the interactive "Confirm PTP" button. Stored Promise-To-Pay commitment in db.'
                              }
                            );
                          } else if (cat === 'sms_fail') {
                            timelineEvents.push(
                              {
                                title: 'SMS Outreach Dispatched',
                                status: 'Failed',
                                time: '09:08 AM',
                                desc: 'Broadcast dropped by carrier. DND registry block detected.'
                              },
                              {
                                title: 'Automated Remediation Triggered',
                                status: 'Pending',
                                time: '09:09 AM',
                                desc: 'Extracted failed SMS number. Initiated WhatsApp Fallback sweep protocol.'
                              },
                              {
                                title: 'WhatsApp fallback sweep delivered',
                                status: 'Success',
                                time: '09:15 AM',
                                desc: 'WhatsApp reminder successfully read by customer. Link click tracked.'
                              }
                            );
                          } else if (cat === 'whatsapp_fail') {
                            timelineEvents.push(
                              {
                                title: 'WhatsApp Message Sent',
                                status: 'Success',
                                time: '09:08 AM',
                                desc: 'Message successfully delivered to customer terminal.'
                              },
                              {
                                title: 'Non-response drop-off detected',
                                status: 'Failed',
                                time: '09:30 AM',
                                desc: 'Message read but no interaction. Customer did not click action links.'
                              },
                              {
                                title: 'Offer reminder remediation enqueued',
                                status: 'Pending',
                                time: 'Scheduled',
                                desc: 'Enqueued customized read-receipt follow-up with structured payment discounts.'
                              }
                            );
                          } else if (cat === 'ivr_fail') {
                            timelineEvents.push(
                              {
                                title: 'IVR outbound call placed',
                                status: 'Failed',
                                time: '09:08 AM',
                                desc: 'Outbound trunks dialed customer number. Result: Busy signal or Call Rejected.'
                              },
                              {
                                title: 'Dialer retry sweep scheduled',
                                status: 'Pending',
                                time: 'Scheduled',
                                desc: 'Trunk busy-retry rule invoked. Re-dial queued automatically today at 4:00 PM.'
                              }
                            );
                          } else if (cat === 'voice_fail') {
                            timelineEvents.push(
                              {
                                title: 'AI Voice Call initiated',
                                status: 'Success',
                                time: '09:08 AM',
                                desc: 'AI human-like agent initiated voice session. Customer answered.'
                              },
                              {
                                title: 'Call dropped abruptly',
                                status: 'Failed',
                                time: '09:09 AM',
                                desc: 'Call session ended after 12 seconds. Customer hung up or network drop-off occurred.'
                              },
                              {
                                title: 'Escalated to human agent queue',
                                status: 'Pending',
                                time: 'Immediate',
                                desc: 'Customer account escalated to manual recovery queue for high-priority collector callback.'
                              }
                            );
                          } else {
                            timelineEvents.push(
                              {
                                title: 'Campaign outreach dispatched',
                                status: 'Failed',
                                time: '09:08 AM',
                                desc: 'Outreach dispatched. No interactive session could be completed.'
                              },
                              {
                                title: 'Remediation sweep pending',
                                status: 'Pending',
                                time: 'T+1 Day',
                                desc: 'Profile added to campaign recovery sweep scheduled for tomorrow morning.'
                              }
                            );
                          }

                          return (
                            <div className="fixed inset-0 bg-surface-lowest/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
                              <div className="glass-panel w-full max-w-xl rounded-3xl border border-outline-variant/15 p-6 space-y-6 shadow-2xl relative">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <span className="text-[10px] font-black text-primary uppercase tracking-wider block">Customer Audit Journey Sheet</span>
                                    <h3 className="text-xl font-black text-on-surface mt-1">{entity.name}</h3>
                                    <p className="text-xs text-outline mt-0.5">ID: {entity.id} | Phone: {entity.attributes.Phone || '+91 XXXXX XXXXX'}</p>
                                  </div>
                                  <button
                                    onClick={() => setSelectedOutreachEntityId(null)}
                                    className="p-1.5 hover:bg-surface-high/30 text-outline hover:text-on-surface rounded-full transition-colors cursor-pointer"
                                  >
                                    <span className="text-lg font-bold block leading-none">×</span>
                                  </button>
                                </div>

                                <div className="grid grid-cols-3 gap-3 bg-surface-high/20 border border-outline-variant/5 rounded-2xl p-4 text-xs">
                                  <div>
                                    <span className="text-[9px] text-outline uppercase block">Outstanding Amount</span>
                                    <span className="text-sm font-black text-on-surface mt-0.5 block">₹{parseFloat(String(entity.attributes.OutstandingAmount || '0').replace(/[^0-9.]/g, '')).toLocaleString()}</span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] text-outline uppercase block">Days Overdue (DPD)</span>
                                    <span className="text-sm font-black text-on-surface mt-0.5 block">{entity.attributes.DPD || '0'} Days</span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] text-outline uppercase block">AI Risk Tier</span>
                                    <span className="text-sm font-black text-on-surface mt-0.5 block flex items-center gap-1">
                                      {entity.riskLevel === 'Critical' ? (
                                        <span className="text-red-400 font-bold uppercase">{entity.riskLevel}</span>
                                      ) : entity.riskLevel === 'High' ? (
                                        <span className="text-orange-400 font-bold uppercase">{entity.riskLevel}</span>
                                      ) : (
                                        <span className="text-amber-400 font-bold uppercase">{entity.riskLevel || 'Medium'}</span>
                                      )}
                                    </span>
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">Outreach & Remediation Timeline</h4>
                                  <div className="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1.5px] before:bg-outline-variant/10">
                                    {timelineEvents.map((evt, idx) => (
                                      <div key={idx} className="flex gap-3 text-xs relative animate-fadeIn" style={{ animationDelay: `${idx * 100}ms` }}>
                                        <div className={`size-6 rounded-full border flex items-center justify-center flex-shrink-0 z-10 ${
                                          evt.status === 'Success'
                                            ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400'
                                            : evt.status === 'Failed'
                                              ? 'bg-red-400/10 border-red-400/30 text-red-400'
                                              : 'bg-primary/10 border-primary/30 text-primary'
                                        }`}>
                                          {evt.status === 'Success' ? '✓' : evt.status === 'Failed' ? '!' : '…'}
                                        </div>
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            <span className="font-bold text-on-surface">{evt.title}</span>
                                            <span className="text-[9px] text-outline font-mono">({evt.time})</span>
                                          </div>
                                          <p className="text-outline-high leading-relaxed text-[11px]">{evt.desc}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Next Remediation Action Strategy Block */}
                                <div className="bg-surface-high/35 border border-outline-variant/10 rounded-2xl p-4 space-y-2 animate-fadeIn">
                                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-primary">
                                    <Sparkles className="size-4 animate-pulse" />
                                    Remediation Playbook: What Happens Next?
                                  </div>
                                  <p className="text-xs text-on-surface font-semibold leading-relaxed">
                                    {(() => {
                                      if (cat === 'commitment') {
                                        return 'PTP registered successfully. Payment due date reminder notification is scheduled automatically 24 hours prior to promise date.';
                                      } else if (cat === 'sms_fail') {
                                        return 'Fallback channel (WhatsApp Sweep) has completed successfully. If still unresponded by tonight, the AI Dialing Trunk will attempt an IVR call tomorrow morning.';
                                      } else if (cat === 'whatsapp_fail') {
                                        return 'Read-receipt fallback trigger: Next discount banner offer reminder will dispatch via SMS tomorrow morning with a dynamic UPI payment link.';
                                      } else if (cat === 'ivr_fail') {
                                        return 'Automatic Retry Queue: Outbound SIP Trunk will re-dial the customer with a modified voice preset today at 4:00 PM during high-pickup traffic window.';
                                      } else if (cat === 'voice_fail') {
                                        return 'Agent desk handover: Escalated directly to manual call agent list. Expected callback by dedicated specialist tomorrow morning.';
                                      } else {
                                        return 'System Recovery Sweep: Account is scheduled for an offline bureau verification check and a digital re-engagement message drop tomorrow.';
                                      }
                                    })()}
                                  </p>
                                  <div className="flex gap-2 items-center text-[10px] text-outline">
                                    <span className="inline-block size-2 rounded-full bg-emerald-400 animate-ping"></span>
                                    <span>AI Engine Remediation State: Active & Automated</span>
                                  </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                  <button
                                    onClick={() => alert(`Escalated ${entity.name} to Manual collector desk.`)}
                                    className="px-4 py-2 border border-outline-variant/10 text-xs font-bold text-outline hover:text-on-surface rounded-xl transition-all cursor-pointer"
                                  >
                                    Escalate to Desk
                                  </button>
                                  <button
                                    onClick={() => setSelectedOutreachEntityId(null)}
                                    className="px-4 py-2 bg-primary text-on-primary hover:bg-primary-hover text-xs font-bold rounded-xl transition-all cursor-pointer"
                                  >
                                    Done
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );                  })()}                  {detailActiveStep === 3 && (
                    <span className="hidden">Step 4 fallback</span>
                  )}
                </div>

                {/* Stepper Footer Controls */}
                <div className="flex justify-between items-center border-t border-outline-variant/10 pt-4 mt-auto">
                  <button
                    disabled={detailActiveStep === 0}
                    onClick={() => setDetailActiveStep(prev => prev - 1)}
                    className="px-4 py-2 bg-surface-high border border-outline-variant/10 text-outline hover:text-on-surface hover:bg-surface-high/80 rounded-xl transition-all font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Previous Step
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedJobDetailId(null)}
                      className="px-4 py-2 border border-outline-variant/10 text-outline hover:text-on-surface rounded-xl transition-all text-sm cursor-pointer font-bold"
                    >
                      Close Details
                    </button>

                    {detailActiveStep < 4 ? (
                      <button
                        onClick={() => setDetailActiveStep(prev => prev + 1)}
                        className="px-4 py-2 bg-primary text-on-primary hover:bg-primary/95 rounded-xl transition-all font-bold text-sm cursor-pointer flex items-center gap-1"
                      >
                        Next Step <ArrowRight className="size-3.5" />
                      </button>
                    ) : detailJob.status === 'Ingested' ? (
                      <button
                        onClick={() => {
                          setSelectedJobDetailId(null);
                          handleApproveAndStartJob(detailJob.id);
                        }}
                        className="px-4 py-2 bg-emerald-400 text-surface-lowest hover:bg-emerald-300 rounded-xl transition-all font-bold text-sm cursor-pointer flex items-center gap-1 shadow-lg shadow-emerald-400/10"
                      >
                        Approve & Start Campaign <Play className="size-3.5 fill-current" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleGenerateAuditReport(detailJob)}
                        className="px-4 py-2 bg-gradient-to-r from-primary to-purple-500 text-white hover:opacity-90 rounded-xl transition-all font-bold text-sm cursor-pointer flex items-center gap-1.5 shadow-lg shadow-primary/20 animate-pulse"
                      >
                        <FileText className="size-4" />
                        Generate Executive Audit Report
                      </button>
                    )}
                  </div>
                </div>
              
            </div>
          </main>
        </div>
      );
    }
  }

return (
    <div className="flex-1 bg-surface-lowest min-h-screen text-on-surface overflow-y-auto pb-12">
      <Header
        title="Campaign AI & Action Analyzer"
        subtitle="AUTONOMOUS OUTREACH SYSTEM"
      />

      <main className="w-full px-4 sm:px-6 lg:px-8 mt-6">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-outline-variant/10 mb-8 gap-2">
          <button
            onClick={() => setActiveTab('upload')}
            className={`py-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'upload'
                ? 'border-primary text-primary'
                : 'border-transparent text-outline hover:text-on-surface'
            }`}
          >
            <Upload className="size-4" />
            Upload & Prompt
          </button>
          <button
            onClick={() => setActiveTab('monitor')}
            className={`py-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'monitor'
                ? 'border-primary text-primary'
                : 'border-transparent text-outline hover:text-on-surface'
            }`}
          >
            <Activity className="size-4" />
            Batch Ingestion Monitor
          </button>
          <button
            onClick={() => setActiveTab('explorer')}
            className={`py-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'explorer'
                ? 'border-primary text-primary'
                : 'border-transparent text-outline hover:text-on-surface'
            }`}
          >
            <Users className="size-4" />
            Records & Actions Explorer
          </button>
        </div>

        {/* Tab contents */}
        {activeTab === 'upload' && simulationStage === 'idle' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className={`glass-panel p-6 rounded-3xl border border-outline-variant/10 space-y-4 relative ${isPersonaDropdownOpen ? 'z-30' : 'z-10'}`}>
                <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                  <FileText className="text-primary size-5" />
                  1. Configure Campaign Job
                </h3>
                
                {/* 2-Column Grid for Job Name and target persona dropdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-outline uppercase tracking-wider">Job / Batch Name</label>
                    <input
                      type="text"
                      value={jobName}
                      onChange={(e) => setJobName(e.target.value)}
                      className="w-full bg-surface-high border border-outline-variant/10 rounded-2xl py-3 px-4 focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                    />
                  </div>
                  
                  <div className={`space-y-2 relative ${isPersonaDropdownOpen ? 'z-50' : 'z-0'}`} ref={personaDropdownRef}>
                    <label className="text-xs font-bold text-outline uppercase tracking-wider">Campaign Case & Voice Preset</label>
                    
                    {/* Selected Case Trigger Button */}
                    {(() => {
                      const selectedCase = CAMPAIGN_PRESET_CASES.find(c => c.id === selectedCasePresetId) || CAMPAIGN_PRESET_CASES[0];
                      return (
                        <button
                          type="button"
                          onClick={() => setIsPersonaDropdownOpen(prev => !prev)}
                          className="w-full bg-surface-high border border-outline-variant/10 rounded-2xl py-3 px-4 flex items-center justify-between text-sm text-on-surface hover:bg-surface-high/85 transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <div className="flex items-center gap-3 text-left min-w-0">
                            <div className="size-8 rounded-lg shrink-0 flex items-center justify-center border border-outline-variant/20 bg-linear-to-br from-primary/20 to-secondary/10 text-primary">
                              <Sparkles className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-xs flex items-center gap-1.5">
                                <span>{selectedCase.name}</span>
                              </div>
                              <p className="text-[10px] text-outline truncate max-w-[180px]">
                                Bot: {selectedCase.botName} | Voice: {selectedCase.voice}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full border bg-emerald-400/10 text-emerald-400 border-emerald-400/20">
                              {selectedCase.voiceGender}
                            </span>
                            <ChevronDown className={`size-4 text-outline transition-transform duration-200 ${isPersonaDropdownOpen ? 'rotate-180' : ''}`} />
                          </div>
                        </button>
                      );
                    })()}

                    {/* Dropdown Menu Listbox */}
                    {isPersonaDropdownOpen && (
                      <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-surface-lowest border border-outline-variant/15 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-72 overflow-y-auto divide-y divide-outline-variant/5">
                        {CAMPAIGN_PRESET_CASES.map(c => {
                          const isSelected = c.id === selectedCasePresetId;
                          return (
                            <div
                              key={c.id}
                              onClick={() => {
                                setSelectedCasePresetId(c.id);
                                setSelectedPersonaId(c.botId);
                                setSystemPrompt(c.systemPrompt);
                                setIsPersonaDropdownOpen(false);
                              }}
                              className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                                isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-surface-high/60'
                              }`}
                            >
                              <div className="flex items-center gap-3 text-left min-w-0">
                                <div className={`size-8 rounded-lg shrink-0 flex items-center justify-center border border-outline-variant/20 bg-linear-to-br from-primary/10 to-secondary/5 ${isSelected ? 'text-primary' : 'text-outline'}`}>
                                  <Cpu className="size-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-xs flex items-center gap-1.5">
                                    <span className={isSelected ? 'text-primary' : 'text-on-surface'}>{c.name}</span>
                                    <span className="text-[9px] text-outline font-normal">· {c.botName} ({c.role})</span>
                                  </div>
                                  <p className="text-[10px] text-outline truncate max-w-[200px]">
                                    Voice: {c.voice} | {c.description}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 bg-surface-high text-outline border-outline-variant/10">
                                {c.voiceGender}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Display Current Selected Config Info Badge */}
                {/* {(() => {
                  const selectedCase = CAMPAIGN_PRESET_CASES.find(c => c.id === selectedCasePresetId) || CAMPAIGN_PRESET_CASES[0];
                  return (
                    <div className="flex flex-wrap items-center gap-3 bg-surface-high/20 border border-outline-variant/5 rounded-2xl p-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-outline">Persona:</span>
                        <span className="font-bold text-on-surface">{selectedCase.botName} ({selectedCase.role})</span>
                      </div>
                      <div className="size-1 rounded-full bg-outline-variant/30" />
                      <div className="flex items-center gap-2">
                        <span className="text-outline">Voice Model:</span>
                        <span className="font-bold text-on-surface">{selectedCase.voice}</span>
                      </div>
                      <div className="size-1 rounded-full bg-outline-variant/30" />
                      <div className="flex items-center gap-2">
                        <span className="text-outline">Voice Gender:</span>
                        <span className="font-bold text-on-surface">{selectedCase.voiceGender}</span>
                      </div>
                    </div>
                  );
                })()} */}

                {/* <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-outline uppercase tracking-wider">Campaign Instructions</label>
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">LLM Orchestrator</span>
                  </div>
                  <div className="w-full bg-surface-high/40 border border-outline-variant/10 rounded-2xl p-4 text-sm text-on-surface leading-relaxed whitespace-pre-wrap select-all font-medium min-h-[80px]">
                    {systemPrompt}
                  </div>
                </div> */}
              </div>

              <div className="glass-panel p-6 rounded-3xl border border-outline-variant/10 space-y-4 relative z-0">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                    <Upload className="text-primary size-5" />
                    2. Import Customer Database
                  </h3>
                  
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleGenerateLargeBatch(50)}
                      className="text-xs font-bold text-violet-400 hover:underline flex items-center gap-1"
                    >
                      <Database className="size-3" />
                      Generate Sample DPD Batch
                    </button>
                  </div>
                </div>

                {/* 2-Column Split when CSV is uploaded: Dropzone left, Preview right */}
                <div className={csvContent ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "space-y-4"}>
                  <div className="border border-dashed border-outline-variant/20 rounded-3xl p-8 flex flex-col items-center justify-center bg-surface-low/30 hover:bg-surface-low/50 transition-colors h-full min-h-[140px]">
                    <Upload className="size-10 text-outline mb-3 animate-bounce" />
                    <p className="text-sm font-bold text-on-surface">Drag & Drop CSV File here</p>
                    <p className="text-xs text-outline mt-1">or click to browse from local files</p>
                  </div>

                  {csvContent && (
                    <div className="space-y-2 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs font-bold text-outline uppercase tracking-wider">File Content Preview</label>
                          <span className="text-[10px] font-bold bg-surface-high text-outline px-2.5 py-1 rounded-full">
                            Parsed {parsedRecords.length} records
                          </span>
                        </div>
                        <pre className="w-full bg-surface-high border border-outline-variant/10 rounded-2xl p-4 text-xs font-mono overflow-x-auto max-h-[110px] overflow-y-auto">
                          {csvContent}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleStartAnalysisRun}
                    disabled={isUploading || parsedRecords.length === 0}
                    className="ember-gradient text-white font-bold py-3 px-6 rounded-2xl flex items-center gap-2 shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="size-4 animate-spin" />
                        Creating Job...
                      </>
                    ) : (
                      <>
                        <Play className="size-4" />
                        Run AI Analysis
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6 relative z-0">
              <div className="glass-panel p-6 rounded-3xl border border-outline-variant/10 space-y-4">
                <h4 className="text-xs font-bold text-outline uppercase tracking-wider">How it works</h4>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">1</div>
                    <div>
                      <p className="text-xs font-bold text-on-surface">Import Records</p>
                      <p className="text-[11px] text-outline mt-0.5">Upload records with arbitrary CSV columns containing balances, contact info, and dates.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">2</div>
                    <div>
                      <p className="text-xs font-bold text-on-surface">LLM Rules Translation</p>
                      <p className="text-[11px] text-outline mt-0.5">AI extracts rules from the custom prompt and calculates risk categories across variables.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">3</div>
                    <div>
                      <p className="text-xs font-bold text-on-surface">Recursive Autotask Dispatch</p>
                      <p className="text-[11px] text-outline mt-0.5">The orchestrator launches automated voice calls or WhatsApp payment links based on dynamic schedule loops.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-panel p-6 rounded-3xl border border-outline-variant/10 space-y-3">
                <h4 className="text-xs font-bold text-outline uppercase tracking-wider">Active Campaigns Summary</h4>
                <div className="flex items-center justify-between py-2 border-b border-outline-variant/5">
                  <span className="text-xs text-outline">Total Upload Jobs</span>
                  <span className="text-sm font-bold">{jobs.length}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-outline-variant/5">
                  <span className="text-xs text-outline">Total Monitored Customers</span>
                  <span className="text-sm font-bold">{entities.length}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-outline">Active Automation Rules</span>
                  <span className="text-sm font-bold text-primary flex items-center gap-1">
                    <Sparkles className="size-3" />
                    Adaptive LLM
                  </span>
                </div>
            </div>
          </div>
        </div>
      )}

        {/* Full-Page Ingestion Parsing Simulator Stage */}
        {activeTab === 'upload' && simulationStage === 'parsing' && (() => {
          // Derived stats from cleaning state
          const isCleaningPhase = activeParsingPhase === 'cleaning';
          const totalRecords = parsedRecords.length;
          const issueEvents = cleaningEvents.filter(e => e.status === 'FIXED' || e.status === 'ERROR');

          return (
          <div className="glass-panel rounded-3xl border border-outline-variant/10 animate-fadeIn max-w-5xl mx-auto overflow-hidden">

            {/* ── Top Header ── */}
            <div className="p-6 border-b border-outline-variant/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest animate-pulse">Background Processing Active</span>
                <h2 className="text-xl font-bold text-on-surface flex items-center gap-2 mt-0.5">
                  <RefreshCw className="size-5 text-primary animate-spin" />
                  {isCleaningPhase ? 'File Reading & Cleaning' : 'AI is Analyzing Your Customer Database'}
                </h2>
              </div>
              {/* 4-phase pill strip */}
              <div className="hidden md:flex items-center gap-1.5">
                {[
                  { key: 'cleaning', label: 'Reading' },
                  { key: 'dedup', label: 'Dedup' },
                  { key: 'scoring', label: 'AI Score' },
                  { key: 'done', label: 'Strategy' },
                ].map((ph, i) => {
                  const order = ['cleaning','dedup','scoring','done'];
                  const currentIdx = order.indexOf(activeParsingPhase);
                  const thisIdx = order.indexOf(ph.key);
                  const done = thisIdx < currentIdx;
                  const active = thisIdx === currentIdx;
                  return (
                    <div key={ph.key} className="flex items-center gap-1">
                      <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                        done ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' :
                        active ? 'bg-primary/10 text-primary border-primary/30 ring-1 ring-primary' :
                        'bg-surface-high text-outline border-transparent opacity-40'
                      }`}>{done ? '✓' : `${i+1}.`} {ph.label}</span>
                      {i < 3 && <span className="text-outline/30 text-[9px]">›</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 space-y-6">

              {/* ══ CLEANING PHASE: Animated detail breakdown ══ */}
              {isCleaningPhase && (
                <div className="space-y-5">

                  {/* Live reading counter */}
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="flex items-end gap-3">
                      <span className="text-6xl font-black text-primary tabular-nums" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {cleaningCounter}
                      </span>
                      <span className="text-2xl font-bold text-outline mb-1">/ {totalRecords}</span>
                    </div>
                    <p className="text-xs text-outline uppercase tracking-widest">Records Scanned</p>
                    {/* Progress bar */}
                    <div className="w-full max-w-md h-2.5 bg-surface-high rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-full transition-all duration-300"
                        style={{ width: `${cleaningProgress}%` }}
                      />
                    </div>
                    <span className="text-xs text-outline">{cleaningProgress}% processed</span>
                  </div>

                  {/* Live stat bar */}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Clean', val: cleaningSummary.clean, color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
                        svg: <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg> },
                      { label: 'Auto-Fixed', val: cleaningSummary.fixed, color: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
                        svg: <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L15 9H22L16.5 13.5L18.5 21L12 17L5.5 21L7.5 13.5L2 9H9Z"/></svg> },
                      { label: 'Errors', val: cleaningSummary.errors, color: 'text-red-400 bg-red-400/10 border-red-400/20',
                        svg: <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> },
                      { label: 'Processing', val: Math.max(0, cleaningCounter - cleaningEvents.length), color: 'text-primary bg-primary/10 border-primary/20',
                        svg: <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> },
                    ].map(s => (
                      <div key={s.label} className={`p-3 rounded-2xl border ${s.color} flex flex-col items-center gap-1`}>
                        {s.svg}
                        <span className="text-lg font-black tabular-nums">{s.val}</span>
                        <span className="text-[9px] font-bold uppercase opacity-80">{s.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Per-record animated stream */}
                  <div>
                    <h4 className="text-[10px] font-bold text-outline uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <svg className="size-3.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                      Record Processing Stream
                    </h4>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {cleaningEvents.slice(-12).map((evt, i) => (
                        <div
                          key={evt.rowIndex}
                          className="flex items-center gap-3 bg-surface-high/20 border border-outline-variant/5 rounded-xl px-3 py-2 text-[10px]"
                          style={{ animation: 'slideInLeft 0.3s ease forwards', opacity: 0, animationDelay: `${i * 20}ms`, animationFillMode: 'forwards' }}
                        >
                          {/* Row number */}
                          <span className="text-outline font-mono flex-shrink-0 w-7">#{evt.rowIndex}</span>

                          {/* Name */}
                          <span className="font-bold text-on-surface truncate w-28 flex-shrink-0">{evt.name}</span>

                          {/* Field-check SVG badges */}
                          <div className="flex items-center gap-1 flex-1">
                            {evt.fieldChecks.map((fc, fi) => (
                              <div key={fi} title={`${fc.field}: ${fc.note}`} className="flex-shrink-0">
                                {fc.status === 'OK' && (
                                  <svg className="size-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" className="opacity-20" fill="currentColor"/><path d="M8 12l3 3 5-5"/></svg>
                                )}
                                {fc.status === 'FIXED' && (
                                  <svg className="size-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                )}
                                {fc.status === 'ERROR' && (
                                  <svg className="size-3.5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                                )}
                              </div>
                            ))}
                            <span className="text-outline ml-1 truncate hidden sm:inline">
                              {evt.fieldChecks.map(f => f.field[0]).join(' ')}
                            </span>
                          </div>

                          {/* Status badge */}
                          <span className={`flex-shrink-0 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                            evt.status === 'CLEAN' ? 'bg-emerald-400/15 text-emerald-400' :
                            evt.status === 'FIXED' ? 'bg-amber-400/15 text-amber-400' :
                            evt.status === 'ERROR' ? 'bg-red-400/15 text-red-400' :
                            'bg-primary/15 text-primary'
                          }`}>{evt.status}</span>
                        </div>
                      ))}
                      {cleaningEvents.length === 0 && (
                        <div className="text-center py-6 text-outline text-xs animate-pulse">Reading file headers...</div>
                      )}
                    </div>
                  </div>

                  {/* Issue detail cards */}
                  {issueEvents.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold text-outline uppercase tracking-wider flex items-center gap-1.5">
                        <svg className="size-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        Field Issues Detected ({issueEvents.length})
                      </h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {issueEvents.map(evt => (
                          evt.fieldChecks.filter(fc => fc.status !== 'OK').map((fc, fi) => (
                            <div key={`${evt.rowIndex}-${fi}`}
                              className={`rounded-xl border p-3 space-y-1.5 text-[10px] animate-flash-highlight ${
                                fc.status === 'ERROR'
                                  ? 'border-red-400/20 bg-red-400/5'
                                  : 'border-amber-400/20 bg-amber-400/5'
                              }`}>
                              <div className="flex items-center gap-2">
                                {fc.status === 'ERROR'
                                  ? <svg className="size-3.5 text-red-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                                  : <svg className="size-3.5 text-amber-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                                }
                                <span className="font-bold text-on-surface">Record #{evt.rowIndex} — {evt.name}</span>
                                <span className={`ml-auto font-black text-[8px] px-1.5 py-0.5 rounded-full ${
                                  fc.status === 'ERROR' ? 'bg-red-400/15 text-red-400' : 'bg-amber-400/15 text-amber-400'
                                }`}>{fc.status}</span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 bg-surface-lowest/50 rounded-lg p-2">
                                <div><span className="text-outline">Field</span><p className="font-bold text-on-surface mt-0.5">{fc.field}</p></div>
                                <div><span className="text-outline">Found</span><p className="font-mono text-red-400 mt-0.5 truncate">{fc.originalValue}</p></div>
                                <div><span className="text-outline">{fc.fixedValue ? 'Fixed To' : 'Action'}</span>
                                  <p className={`font-mono mt-0.5 truncate ${fc.fixedValue ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {fc.fixedValue || 'Flagged'}
                                  </p>
                                </div>
                              </div>
                              <p className="text-outline leading-relaxed">{fc.note}</p>
                            </div>
                          ))
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Completion summary */}
                  {cleaningDone && (
                    <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-4 flex items-center gap-4">
                      <svg className="size-8 text-emerald-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>
                      <div className="flex-1">
                        <p className="text-sm font-black text-emerald-400">File Reading Complete</p>
                        <p className="text-[10px] text-outline mt-0.5">
                          {cleaningSummary.total} records read · {cleaningSummary.clean} clean · {cleaningSummary.fixed} auto-fixed · {cleaningSummary.errors} flagged
                        </p>
                      </div>
                      <span className="text-[10px] text-outline animate-pulse">Continuing to Deduplication...</span>
                    </div>
                  )}
                </div>
              )}

              {/* ══ OTHER PHASES: AI tier cards + log feed ══ */}
              {!isCleaningPhase && (
                <div className="space-y-5">
                  {/* 4-phase stepper (compact) */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { key: 'dedup', label: 'Deduplication', desc: 'Cross-referencing contacts' },
                      { key: 'scoring', label: 'AI Risk Scoring', desc: 'LLM per-record analysis' },
                      { key: 'done', label: 'Strategy Map', desc: 'Channel routing' },
                    ].map(ph => {
                      const order = ['dedup','scoring','done'];
                      const currentIdx = order.indexOf(activeParsingPhase);
                      const thisIdx = order.indexOf(ph.key);
                      const done = thisIdx < currentIdx || activeParsingPhase === 'done';
                      const active = ph.key === activeParsingPhase;
                      return (
                        <div key={ph.key} className={`p-3 rounded-xl border transition-all col-span-1 ${
                          active ? 'border-primary bg-primary/5' :
                          done ? 'border-emerald-400/20 bg-emerald-400/5' : 'border-outline-variant/10 opacity-40'
                        }`}>
                          <div className="flex items-center gap-1.5 mb-1">
                            {done ? <svg className="size-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                              : active ? <RefreshCw className="size-3.5 text-primary animate-spin" /> : <Clock className="size-3.5 text-outline" />}
                            <span className={`text-[9px] font-bold ${active ? 'text-primary' : done ? 'text-emerald-400' : 'text-outline'}`}>{done ? '✓ Done' : active ? 'Running...' : 'Queued'}</span>
                          </div>
                          <p className="text-[9px] font-bold text-on-surface">{ph.label}</p>
                        </div>
                      );
                    })}
                    {/* Cleaned summary pill */}
                    <div className="p-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 col-span-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <svg className="size-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                        <span className="text-[9px] font-bold text-emerald-400">✓ Done</span>
                      </div>
                      <p className="text-[9px] font-bold text-on-surface">File Read</p>
                      <p className="text-[8px] text-outline mt-0.5">{cleaningSummary.clean}✓ {cleaningSummary.fixed}⚠ {cleaningSummary.errors}✕</p>
                    </div>
                  </div>

                  {/* AI tier cards */}
                  {(activeParsingPhase === 'scoring' || activeParsingPhase === 'done') && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { tier: 'Critical', badge: 'text-red-400 bg-red-400/10', bar: 'bg-red-400', count: aiInsights.filter(i => i.tier === 'Critical').length, action: '🤖 AI Voice Bot — Immediate' },
                        { tier: 'High', badge: 'text-amber-400 bg-amber-400/10', bar: 'bg-amber-400', count: aiInsights.filter(i => i.tier === 'High').length, action: '🤖 AI Voice Bot — Scheduled' },
                        { tier: 'Medium', badge: 'text-primary bg-primary/10', bar: 'bg-primary', count: aiInsights.filter(i => i.tier === 'Medium').length, action: '📲 IVR + WhatsApp' },
                        { tier: 'Low', badge: 'text-emerald-400 bg-emerald-400/10', bar: 'bg-emerald-400', count: aiInsights.filter(i => i.tier === 'Low').length, action: '💬 SMS Reminder' },
                      ].map(t => (
                        <div key={t.tier} className={`p-3 rounded-xl border ${t.badge.includes('red') ? 'border-red-400/20' : t.badge.includes('amber') ? 'border-amber-400/20' : t.badge.includes('primary') ? 'border-primary/20' : 'border-emerald-400/20'} space-y-2`}>
                          <div className="flex justify-between"><span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${t.badge}`}>{t.tier}</span><span className="text-lg font-black">{t.count || '—'}</span></div>
                          <div className={`text-[8px] font-bold p-1.5 rounded-lg ${t.badge}`}>{t.action}</div>
                          <div className="h-1 bg-surface-high rounded-full overflow-hidden"><div className={`h-full ${t.bar} transition-all duration-700`} style={{width:`${(t.count/Math.max(aiInsights.length,1))*100}%`}}/></div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* AI scoring feed */}
                  {visibleSimLogs.filter(l => l.type === 'LLM' && l.phase === 'risk_scoring').length > 0 && (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {visibleSimLogs.filter(l => l.type === 'LLM' && l.phase === 'risk_scoring').map((log, i) => (
                        <div key={i} className="bg-surface-high/30 border border-outline-variant/5 rounded-xl p-2.5 text-[10px] leading-relaxed">
                          <span className="text-primary font-bold mr-2">AI →</span>{log.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Collapsed dev logs always at bottom */}
              <details className="group border border-outline-variant/10 rounded-xl overflow-hidden">
                <summary className="flex justify-between items-center px-4 py-2.5 cursor-pointer text-[10px] font-bold text-outline select-none hover:bg-surface-high/20">
                  <span className="flex items-center gap-2"><Database className="size-3.5" />View Technical Execution Logs (developers only)</span>
                  <ChevronDown className="size-3.5 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-4 pb-3 border-t border-outline-variant/10 bg-surface-lowest font-mono text-[10px] text-outline h-36 overflow-y-auto space-y-0.5 pt-2">
                  {visibleSimLogs.map((log, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="opacity-40 flex-shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                      <span className={`font-bold flex-shrink-0 ${log.type==='SUCCESS'?'text-emerald-400':log.type==='WARN'?'text-amber-400':log.type==='LLM'?'text-primary':log.type==='ERROR'?'text-red-400':'text-outline-high'}`}>[{log.type}]</span>
                      <span>{log.message}</span>
                    </div>
                  ))}
                  {visibleSimLogs.length === 0 && <span className="italic animate-pulse">Initializing...</span>}
                </div>
              </details>

            </div>
          </div>
          );
        })()}


        {/* Full-Page Ingestion Strategy Mapping Stage */}
        {activeTab === 'upload' && simulationStage === 'strategy' && (
          <div className="glass-panel p-8 rounded-3xl border border-outline-variant/10 space-y-8 animate-fadeIn max-w-4xl mx-auto">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[9px] font-black bg-surface-high border border-outline-variant/10 text-outline px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Setup Phase
                  </span>
                  <button
                    onClick={() => setShowReviewIngestion(true)}
                    className="relative group overflow-hidden px-3 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/35 hover:border-emerald-400 text-emerald-400 transition-all font-bold text-[10px] flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-400/5 animate-pulse"
                  >
                    <span className="relative flex size-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
                    </span>
                    <span>Review Step-by-Step Ingestion Audit</span>
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5 text-emerald-400" />
                  </button>
                </div>
                <h2 className="text-2xl font-bold text-on-surface">Omni-Channel Collection Strategy</h2>
                <p className="text-xs text-outline">Configure and distribute accounts to target communication channels based on risk tiers.</p>
              </div>
              <button 
                onClick={() => setSimulationStage('idle')}
                className="p-1.5 hover:bg-surface-high rounded-full text-outline transition-all"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Risk Tier Allocation Tally */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(() => {
                const total = aiInsights.length || parsedRecords.length;
                const critical = aiInsights.filter(i => i.tier === 'Critical').length || Math.max(1, Math.ceil(total * 0.3));
                const high = aiInsights.filter(i => i.tier === 'High').length || Math.max(1, Math.ceil(total * 0.2));
                const medium = aiInsights.filter(i => i.tier === 'Medium').length || Math.max(1, Math.ceil(total * 0.3));
                const low = aiInsights.filter(i => i.tier === 'Low').length || Math.max(0, total - (critical + high + medium));

                return (
                  <>
                    <div className="bg-surface-high/30 p-3 rounded-2xl border border-outline-variant/5">
                      <div className="text-[10px] font-bold text-red-400/80 uppercase">Critical Risk</div>
                      <div className="text-xl font-black text-on-surface">{critical} <span className="text-xs font-normal text-outline">accts</span></div>
                    </div>
                    <div className="bg-surface-high/30 p-3 rounded-2xl border border-outline-variant/5">
                      <div className="text-[10px] font-bold text-amber-400/80 uppercase">High Risk</div>
                      <div className="text-xl font-black text-on-surface">{high} <span className="text-xs font-normal text-outline">accts</span></div>
                    </div>
                    <div className="bg-surface-high/30 p-3 rounded-2xl border border-outline-variant/5">
                      <div className="text-[10px] font-bold text-primary/80 uppercase">Medium Risk</div>
                      <div className="text-xl font-black text-on-surface">{medium} <span className="text-xs font-normal text-outline">accts</span></div>
                    </div>
                    <div className="bg-surface-high/30 p-3 rounded-2xl border border-outline-variant/5">
                      <div className="text-[10px] font-bold text-outline uppercase">Low Risk</div>
                      <div className="text-xl font-black text-on-surface">{low} <span className="text-xs font-normal text-outline">accts</span></div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Interactive Channel Allocation Grid */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-outline uppercase tracking-wider">Channel Strategy Matrix</h3>
              <div className="border border-outline-variant/10 rounded-2xl overflow-hidden bg-surface-lowest">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface-high/50 border-b border-outline-variant/10 text-outline font-bold">
                      <th className="p-3 text-left">Risk Level</th>
                      <th className="p-3 text-center">AI Voice Bot</th>
                      <th className="p-3 text-center">IVR Gateway</th>
                      <th className="p-3 text-center">WhatsApp Template</th>
                      <th className="p-3 text-center">Automated SMS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/5">
                    {['Critical', 'High', 'Medium', 'Low'].map(risk => (
                      <tr key={risk} className="hover:bg-surface-high/10 transition-colors">
                        <td className="p-3 font-bold text-on-surface">{risk}</td>
                        {['ai_voice', 'ivr', 'whatsapp', 'sms'].map(channel => {
                          const isSelected = channelRules[risk]?.includes(channel);
                          return (
                            <td key={channel} className="p-3 text-center">
                              <button
                                onClick={() => {
                                  setChannelRules(prev => {
                                    const currentList = prev[risk] || [];
                                    const newList = currentList.includes(channel)
                                      ? currentList.filter(c => c !== channel)
                                      : [...currentList, channel];
                                    return { ...prev, [risk]: newList };
                                  });
                                }}
                                className={`px-3 py-1 rounded-full border transition-all ${
                                  isSelected
                                    ? 'bg-primary/20 text-primary border-primary/30 font-bold'
                                    : 'bg-transparent text-outline border-outline-variant/10 hover:border-outline'
                                }`}
                              >
                                {isSelected ? 'Enabled' : 'Disabled'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calculated Strategy Output */}
            <div className="bg-surface-high/20 rounded-2xl p-4 border border-outline-variant/5 grid grid-cols-2 md:grid-cols-4 gap-4">
              {(() => {
                const total = parsedRecords.length;
                const critical = Math.max(1, Math.ceil(total * 0.3));
                const high = Math.max(1, Math.ceil(total * 0.2));
                const medium = Math.max(1, Math.ceil(total * 0.3));
                const low = Math.max(0, total - (critical + high + medium));

                const channelSum = (channel: string) => {
                  let sum = 0;
                  if (channelRules['Critical']?.includes(channel)) sum += critical;
                  if (channelRules['High']?.includes(channel)) sum += high;
                  if (channelRules['Medium']?.includes(channel)) sum += medium;
                  if (channelRules['Low']?.includes(channel)) sum += low;
                  return sum;
                };

                return (
                  <>
                    <div className="text-center">
                      <div className="text-[10px] text-outline font-bold uppercase">AI Voice Campaigns</div>
                      <div className="text-lg font-bold text-primary">{channelSum('ai_voice')} calls</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-outline font-bold uppercase">IVR Broadcasts</div>
                      <div className="text-lg font-bold text-amber-400">{channelSum('ivr')} playbacks</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-outline font-bold uppercase">WhatsApp Reminders</div>
                      <div className="text-lg font-bold text-emerald-400">{channelSum('whatsapp')} texts</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-outline font-bold uppercase">SMS Triggers</div>
                      <div className="text-lg font-bold text-outline-high">{channelSum('sms')} messages</div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Action CTAs */}
            <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/10">
              <button
                onClick={() => setSimulationStage('idle')}
                className="px-5 py-2.5 rounded-full border border-outline-variant/10 text-outline hover:text-on-surface transition-all font-bold text-xs"
              >
                Back to Config
              </button>
              <button
                onClick={handleInitiateBroadcast}
                className="px-6 py-2.5 rounded-full bg-primary text-primary-inverse hover:brightness-110 shadow-lg shadow-primary/20 transition-all font-bold text-xs flex items-center gap-2"
              >
                <Play className="size-4 fill-current" />
                Initiate Omni-Channel Broadcast
              </button>
            </div>
          </div>
        )}

        {/* Full-Page Live Broadcast Simulator Stage */}
        {activeTab === 'upload' && simulationStage === 'broadcasting' && (
          <div className="glass-panel p-8 rounded-3xl border border-outline-variant/10 space-y-8 animate-fadeIn max-w-4xl mx-auto">
            <div className="space-y-1 text-center relative">
              <div className="absolute left-0 top-0">
                <button
                  onClick={() => setShowReviewIngestion(true)}
                  className="px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all font-bold text-[9px] flex items-center gap-1 cursor-pointer"
                >
                  <Activity className="size-2.5" />
                  Review Ingestion Flow
                </button>
              </div>
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest animate-pulse">Campaign Live Broadcast</span>
              <h2 className="text-2xl font-bold text-on-surface">Simulated Outbound Dialing & Messaging</h2>
              <p className="text-xs text-outline">Real-time status updates from our integrated communication pipelines.</p>
            </div>

            {/* Campaign Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-outline">
                <span>Broadcast Dispatch Status</span>
                <span>{broadcastProgress}%</span>
              </div>
              <div className="h-2.5 w-full bg-surface-high/50 rounded-full overflow-hidden border border-outline-variant/5">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-300 shadow-md shadow-primary/20"
                  style={{ width: `${broadcastProgress}%` }}
                />
              </div>
            </div>

            {/* 4 Pipeline Channels Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                {
                  key: 'ai_voice',
                  label: 'AI Bot Calls',
                  steps: ['WebRTC Gateway', 'Call Ringing', 'Active Dialogue', 'PTP Saved'],
                  color: 'border-primary text-primary bg-primary/5',
                  dotColor: 'bg-primary'
                },
                {
                  key: 'ivr',
                  label: 'IVR Broadcast',
                  steps: ['SIP Handshake', 'Ringing User', 'Playing Audio', 'Menu Selection'],
                  color: 'border-amber-400/20 text-amber-400 bg-amber-400/5',
                  dotColor: 'bg-amber-400'
                },
                {
                  key: 'whatsapp',
                  label: 'WhatsApp Text',
                  steps: ['Opt-in Check', 'Build CTA link', 'Dispatch Message', 'Status: Read'],
                  color: 'border-emerald-400/20 text-emerald-400 bg-emerald-400/5',
                  dotColor: 'bg-emerald-400'
                },
                {
                  key: 'sms',
                  label: 'SMS Triggers',
                  steps: ['SMS Queue', 'Verify Contact', 'API Handoff', 'Status: Sent'],
                  color: 'border-outline-variant/10 text-outline bg-surface-high/30',
                  dotColor: 'bg-outline-high'
                }
              ].map(ch => {
                const state = broadcastStates[ch.key] || { customer: '', step: 0 };
                return (
                  <div key={ch.key} className={`p-4 rounded-2xl border ${ch.color} space-y-4`}>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider">{ch.label}</h4>
                      <p className="text-[10px] text-outline font-medium line-clamp-1 mt-0.5">Active: {state.customer || 'Queued'}</p>
                    </div>

                    <div className="space-y-2.5">
                      {ch.steps.map((step, idx) => {
                        const isDone = state.step > idx;
                        const isCurrent = state.step === idx;
                        return (
                          <div key={idx} className={`flex items-center gap-2 text-[10px] ${
                            isDone ? 'opacity-90 font-bold' : isCurrent ? 'font-bold' : 'opacity-30'
                          }`}>
                            {isDone ? <CheckCircle className="size-3 text-emerald-400" /> :
                             isCurrent ? <span className={`size-2.5 rounded-full ${ch.dotColor} animate-ping`} /> :
                             <span className="size-1.5 rounded-full bg-outline/40 ml-0.5" />}
                            <span className="line-clamp-1">{step}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Scrolling activity feed */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-outline uppercase tracking-wider">Outbound Dispatch Stream</h4>
              <div className="bg-surface-lowest border border-outline-variant/10 rounded-2xl p-4 font-mono text-[10px] h-36 overflow-y-auto space-y-1">
                {broadcastLogs.map((log, i) => (
                  <div key={i} className="text-on-surface/90">{log}</div>
                ))}
                {broadcastLogs.length === 0 && (
                  <div className="text-outline italic animate-pulse">Initializing outbound SIP interfaces...</div>
                )}
              </div>
            </div>

            {/* Complete action */}
            {broadcastProgress >= 100 && (
              <div className="flex justify-center pt-2 animate-bounce">
                <button
                  onClick={handleCompleteBroadcast}
                  className="px-8 py-3 rounded-full bg-emerald-400 text-surface-lowest hover:brightness-110 shadow-lg shadow-emerald-400/20 transition-all font-black text-xs flex items-center gap-2"
                >
                  <CheckCircle className="size-4" />
                  Complete Broadcast & View Monitor
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'monitor' && (
          <div className="space-y-6">
            


            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="glass-panel p-5 rounded-2xl border border-outline-variant/5 flex items-center gap-4 bg-surface-low/10">
                <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Database className="size-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Total Batches Ingested</p>
                  <p className="text-xl font-bold">{jobs.length}</p>
                </div>
              </div>
              <div className="glass-panel p-5 rounded-2xl border border-outline-variant/5 flex items-center gap-4 bg-surface-low/10">
                <div className="size-10 rounded-xl bg-indigo-400/10 text-indigo-400 flex items-center justify-center">
                  <Clock className="size-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Pending Approval</p>
                  <p className="text-xl font-bold">{jobs.filter(j => j.status === 'Ingested').length}</p>
                </div>
              </div>
              <div className="glass-panel p-5 rounded-2xl border border-outline-variant/5 flex items-center gap-4 bg-surface-low/10">
                <div className="size-10 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center animate-pulse">
                  <Activity className="size-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Active Run Classifier</p>
                  <p className="text-xl font-bold">{jobs.filter(j => j.status === 'Analyzing' || j.status === 'Executing').length}</p>
                </div>
              </div>
              <div className="glass-panel p-5 rounded-2xl border border-outline-variant/5 flex items-center gap-4 bg-surface-low/10">
                <div className="size-10 rounded-xl bg-emerald-400/10 text-emerald-400 flex items-center justify-center">
                  <CheckCircle className="size-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Completed Runs</p>
                  <p className="text-xl font-bold">{jobs.filter(j => j.status === 'Completed').length}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-sm font-bold text-outline uppercase tracking-wider">Ingested Files & Action Runs</h3>
                
                <div className="glass-panel rounded-2xl border border-outline-variant/10 overflow-hidden bg-surface-low/10 shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-outline-variant/10 bg-surface-high/60 text-[10px] font-bold text-outline uppercase tracking-wider">
                          <th className="p-4">File / Batch Name</th>
                          <th className="p-4">Global AI Prompt</th>
                          <th className="p-4 text-center">Records</th>
                          <th className="p-4 text-center">Progress</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/5 text-xs">
                        {jobs.map(job => (
                          <tr
                            key={job.id}
                            className="hover:bg-surface-high/10 transition-colors cursor-pointer group"
                            onClick={() => setSelectedJobDetailId(job.id)}
                          >
                            <td className="p-4">
                              <div className="font-bold text-on-surface group-hover:text-primary transition-colors flex items-center gap-1.5">
                                <Database className="size-3.5 text-outline group-hover:text-primary shrink-0" />
                                <span>{job.name}</span>
                              </div>
                              <span className="text-[9px] text-outline mt-0.5 block">
                                {new Date(job.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                              {(job.status === 'Executing' || job.status === 'Analyzing') && (
                                <span className="text-[10px] text-primary font-bold mt-1 flex items-center gap-1 animate-pulse">
                                  <span className="inline-block size-1.5 rounded-full bg-primary animate-ping" />
                                  ⚡ {job.status === 'Analyzing' ? 'Analyzing' : 'Executing'}: {job.currentRecordName || 'Processing...'}
                                </span>
                              )}
                            </td>
                            <td className="p-4 max-w-[150px]">
                              <p className="truncate text-outline text-[11px]" title={job.systemPrompt}>
                                {job.systemPrompt}
                              </p>
                            </td>
                            <td className="p-4 text-center font-bold text-on-surface">
                              {job.totalRecords.toLocaleString()}
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col items-center justify-center gap-1">
                                <span className="font-bold text-[10px] text-outline">
                                  {job.processedRecords} / {job.totalRecords}
                                </span>
                                <div className="w-16 bg-surface-high h-1 rounded-full overflow-hidden">
                                  <div
                                    className="bg-primary h-full rounded-full transition-all duration-300"
                                    style={{ width: `${(job.processedRecords / job.totalRecords) * 100}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                job.status === 'Ingested' ? 'bg-indigo-400/10 text-indigo-400 border-indigo-400/20' :
                                job.status === 'Analyzing' ? 'bg-amber-400/10 text-amber-400 border-amber-400/20 animate-pulse' :
                                job.status === 'Executing' ? 'bg-primary/10 text-primary border-primary/20 animate-pulse' :
                                job.status === 'Completed' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' :
                                'bg-surface-high text-outline border-outline-variant/10'
                              }`}>
                                {job.status === 'Ingested' ? 'Ingested' : job.status}
                              </span>
                            </td>
                            <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end gap-2">
                                {job.status === 'Ingested' ? (
                                  <button
                                    onClick={() => handleApproveAndStartJob(job.id)}
                                    className="bg-primary text-white font-bold py-1 px-3 rounded-lg text-[10px] flex items-center gap-1 hover:opacity-90 shadow-md shadow-primary/10 transition-opacity"
                                  >
                                    <Play className="size-2.5" />
                                    Approve & Start
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setSelectedJobDetailId(job.id)}
                                    className="bg-surface-high hover:bg-surface-highest text-on-surface font-bold py-1 px-2.5 rounded-lg text-[10px] border border-outline-variant/10 transition-colors"
                                  >
                                    Details
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

        {activeTab === 'explorer' && (() => {
          const selectedJobEntities = entities.filter(e => e.jobId === selectedJobId);
          const totalSelectedRecords = selectedJobEntities.length;
          const urgentOutbound = selectedJobEntities.filter(e => e.riskLevel === 'Critical' && e.status !== 'Resolved').length;
          const resolvedAccounts = selectedJobEntities.filter(e => e.status === 'Resolved').length;
          const escalationAccounts = selectedJobEntities.filter(e => e.status === 'Escalated').length;

          return (
            <div className="space-y-6">
              
              {/* Top Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-panel p-5 rounded-2xl border border-outline-variant/5 flex items-center gap-4 bg-surface-low/10">
                  <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Users className="size-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Total Job Records</p>
                    <p className="text-xl font-bold">{totalSelectedRecords}</p>
                  </div>
                </div>
                <div className="glass-panel p-5 rounded-2xl border border-outline-variant/5 flex items-center gap-4 bg-surface-low/10">
                  <div className="size-10 rounded-xl bg-red-400/10 text-red-400 flex items-center justify-center animate-pulse">
                    <AlertTriangle className="size-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Urgent Outbound</p>
                    <p className="text-xl font-bold">{urgentOutbound}</p>
                  </div>
                </div>
                <div className="glass-panel p-5 rounded-2xl border border-outline-variant/5 flex items-center gap-4 bg-surface-low/10">
                  <div className="size-10 rounded-xl bg-emerald-400/10 text-emerald-400 flex items-center justify-center">
                    <CheckCircle className="size-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Resolved Accounts</p>
                    <p className="text-xl font-bold">{resolvedAccounts}</p>
                  </div>
                </div>
                <div className="glass-panel p-5 rounded-2xl border border-outline-variant/5 flex items-center gap-4 bg-surface-low/10">
                  <div className="size-10 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center">
                    <TrendingUp className="size-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Escalated Accounts</p>
                    <p className="text-xl font-bold">{escalationAccounts}</p>
                  </div>
                </div>
              </div>

              {/* Filter controls */}
              <div className="glass-panel p-4 rounded-2xl border border-outline-variant/5 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <Search className="size-4 text-outline" />
                  <input
                    type="text"
                    placeholder="Search by name or reference ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none focus:ring-0 text-sm placeholder:text-outline w-full outline-none"
                  />
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Filter className="size-3.5 text-outline" />
                    <span className="text-xs text-outline">Job Run:</span>
                    <select
                      value={selectedJobId}
                      onChange={(e) => {
                        setSelectedJobId(e.target.value);
                        setExpandedEntityId(null);
                      }}
                      className="bg-surface-high border border-outline-variant/10 rounded-xl py-1.5 px-3 text-xs text-on-surface outline-none"
                    >
                      {jobs.map(j => (
                        <option key={j.id} value={j.id}>{j.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-outline">Status:</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-surface-high border border-outline-variant/10 rounded-xl py-1.5 px-3 text-xs text-on-surface outline-none"
                    >
                      <option value="All">All Statuses</option>
                      <option value="Active">Active</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Snoozed">Snoozed</option>
                      <option value="Escalated">Escalated</option>
                      <option value="PaymentLinkSent">PaymentLinkSent</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-outline">Risk:</span>
                    <select
                      value={riskFilter}
                      onChange={(e) => setRiskFilter(e.target.value)}
                      className="bg-surface-high border border-outline-variant/10 rounded-xl py-1.5 px-3 text-xs text-on-surface outline-none"
                    >
                      <option value="All">All Risk Levels</option>
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Timeline Task Buckets Toggle */}
              <div className="flex justify-between items-center border-b border-outline-variant/10 pb-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setTimelineFilter('All')}
                    className={`py-1.5 px-4 text-xs font-bold rounded-lg transition-all ${
                      timelineFilter === 'All'
                        ? 'bg-primary text-white'
                        : 'bg-surface-high/40 text-outline hover:text-on-surface'
                    }`}
                  >
                    All Records ({filteredEntities.length})
                  </button>
                  <button
                    onClick={() => setTimelineFilter('Today')}
                    className={`py-1.5 px-4 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      timelineFilter === 'Today'
                        ? 'bg-amber-400/10 text-amber-400 border border-amber-400/25'
                        : 'bg-surface-high/40 text-outline hover:text-on-surface'
                    }`}
                  >
                    <Phone className="size-3" />
                    Due Today
                  </button>
                  <button
                    onClick={() => setTimelineFilter('Future')}
                    className={`py-1.5 px-4 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      timelineFilter === 'Future'
                        ? 'bg-violet-400/10 text-violet-400 border border-violet-400/25'
                        : 'bg-surface-high/40 text-outline hover:text-on-surface'
                    }`}
                  >
                    <Clock className="size-3" />
                    Future Schedule
                  </button>
                </div>
              </div>

              {/* High-density Explorer Data Table */}
              <div className="glass-panel rounded-2xl border border-outline-variant/10 overflow-hidden bg-surface-low/10 shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant/10 bg-surface-high/60 text-[10px] font-bold text-outline uppercase tracking-wider select-none">
                        <th className="p-4">Ref ID</th>
                        <th className="p-4 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('name')}>
                          Customer Name {sortField === 'name' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </th>
                        <th className="p-4">Contact</th>
                        <th className="p-4">Asset Class</th>
                        <th className="p-4 cursor-pointer hover:text-primary transition-colors text-right" onClick={() => handleSort('OutstandingAmount')}>
                          Outstanding {sortField === 'OutstandingAmount' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </th>
                        <th className="p-4 cursor-pointer hover:text-primary transition-colors text-center" onClick={() => handleSort('DaysPastDue')}>
                          DPD {sortField === 'DaysPastDue' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </th>
                        <th className="p-4 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('riskLevel')}>
                          Risk {sortField === 'riskLevel' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </th>
                        <th className="p-4 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('status')}>
                          Status {sortField === 'status' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </th>
                        <th className="p-4 text-right">Profile</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/5 text-xs">
                      {paginatedEntities.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-outline italic">
                            No records found matching filters.
                          </td>
                        </tr>
                      ) : (
                        paginatedEntities.map(entity => {
                          const entityTasks = tasks.filter(t => t.entityId === entity.id);
                          const hasActiveTaskRunning = entityTasks.some(t => t.status === 'Processing');
                          
                          return (
                            <tr
                              key={entity.id}
                              className={`hover:bg-surface-high/15 transition-colors cursor-pointer ${
                                hasActiveTaskRunning ? 'bg-primary/5 animate-pulse' : ''
                              }`}
                              onClick={() => setSelectedEntityDetailId(entity.id)}
                            >
                              <td className="p-4 font-mono text-[10px] text-outline">
                                {entity.referenceId}
                              </td>
                              <td className="p-4 font-bold text-on-surface">
                                <div className="flex items-center gap-2">
                                  <span>{entity.name}</span>
                                  {hasActiveTaskRunning && (
                                    <span className="size-2 bg-primary rounded-full animate-ping" />
                                  )}
                                </div>
                              </td>
                              <td className="p-4 text-outline text-[11px]">
                                {entity.contactInfo}
                              </td>
                              <td className="p-4 text-outline">
                                {entity.attributes.AssetClass || 'N/A'}
                              </td>
                              <td className="p-4 text-right font-bold text-primary">
                                {entity.attributes.OutstandingAmount || 'N/A'}
                              </td>
                              <td className="p-4 text-center font-bold text-on-surface">
                                {entity.attributes.DaysPastDue || '0'}
                              </td>
                              <td className="p-4">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  entity.riskLevel === 'Critical' ? 'bg-red-400/15 text-red-400' :
                                  entity.riskLevel === 'High' ? 'bg-amber-400/15 text-amber-400' :
                                  entity.riskLevel === 'Medium' ? 'bg-primary/15 text-primary' :
                                  'bg-emerald-400/15 text-emerald-400'
                                }`}>
                                  {entity.riskLevel}
                                </span>
                              </td>
                              <td className="p-4">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  entity.status === 'Resolved' ? 'bg-emerald-400/15 text-emerald-400' :
                                  entity.status === 'PaymentLinkSent' ? 'bg-violet-400/15 text-violet-400 animate-pulse' :
                                  entity.status === 'Escalated' ? 'bg-red-400/15 text-red-400' :
                                  'bg-surface-high text-outline'
                                }`}>
                                  {entity.status}
                                </span>
                              </td>
                              <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => setSelectedEntityDetailId(entity.id)}
                                  className="bg-surface-high hover:bg-surface-highest text-on-surface font-bold py-1 px-2.5 rounded-lg text-[10px] border border-outline-variant/10 transition-colors"
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="p-4 border-t border-outline-variant/10 bg-surface-high/30 flex items-center justify-between flex-wrap gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-outline">Rows per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="bg-surface-high border border-outline-variant/10 rounded-lg py-1 px-2 text-xs text-on-surface outline-none"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                    <span className="text-outline ml-2">
                      Showing {sortedEntities.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, sortedEntities.length)} of {sortedEntities.length} records
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      className="px-3 py-1.5 rounded-lg bg-surface-high hover:bg-surface-highest border border-outline-variant/10 font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Previous
                    </button>
                    <span className="text-outline">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      className="px-3 py-1.5 rounded-lg bg-surface-high hover:bg-surface-highest border border-outline-variant/10 font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>

            </div>
          );
        })()}

      </main>

      {/* Dialer simulation Overlay */}
      {callSession && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
          <div className="bg-surface-lowest border border-outline-variant/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-6">
            
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-base text-on-surface">Voice Dialer Console</h3>
                <p className="text-xs text-outline mt-0.5">Automated Collection Protocol</p>
              </div>
              <button
                onClick={() => setCallSession(null)}
                className="p-1 rounded-lg hover:bg-surface-high text-outline transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Profile Info */}
            <div className="bg-surface-high/60 border border-outline-variant/5 rounded-2xl p-4 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold">{callSession.entity.name}</p>
                <p className="text-[10px] text-outline mt-0.5">{callSession.entity.contactInfo} · {callSession.entity.attributes.AssetClass || 'Asset Category'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-primary">{callSession.entity.attributes.OutstandingAmount}</p>
                <p className="text-[9px] text-outline">Outstanding</p>
              </div>
            </div>

            {/* Status & equalizers */}
            <div className="flex flex-col items-center justify-center py-4 space-y-3">
              <div className="size-16 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20 animate-pulse">
                <Phone className="size-6 animate-bounce" />
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-on-surface uppercase tracking-wider">
                  {callSession.state === 'connecting' ? 'Connecting Dialer...' : 'Call Active'}
                </p>
                {callSession.state === 'connected' && (
                  <div className="flex gap-1 justify-center mt-2 h-4 items-center">
                    <span className="w-0.5 h-3 bg-primary rounded animate-[bounce_0.8s_infinite_100ms]" />
                    <span className="w-0.5 h-4 bg-primary rounded animate-[bounce_0.8s_infinite_200ms]" />
                    <span className="w-0.5 h-2 bg-primary rounded animate-[bounce_0.8s_infinite_300ms]" />
                    <span className="w-0.5 h-4 bg-primary rounded animate-[bounce_0.8s_infinite_400ms]" />
                    <span className="w-0.5 h-3 bg-primary rounded animate-[bounce_0.8s_infinite_500ms]" />
                  </div>
                )}
              </div>
            </div>

            {/* Conversation text log */}
            <div className="bg-surface-high/80 rounded-2xl p-4 border border-outline-variant/10 h-44 overflow-y-auto space-y-3 text-xs leading-relaxed">
              {callSession.transcript.map((line, idx) => (
                <div key={idx} className={`flex flex-col ${line.speaker === 'Agent' ? 'items-start' : 'items-end'}`}>
                  <span className="text-[9px] font-bold text-outline mb-0.5">{line.speaker}</span>
                  <div className={`p-2.5 rounded-2xl max-w-[85%] ${
                    line.speaker === 'Agent' ? 'bg-surface-lowest border border-outline-variant/10 rounded-tl-none' : 'bg-primary text-white rounded-tr-none'
                  }`}>
                    {line.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Choice selectors */}
            {callSession.state === 'connected' && (
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-outline uppercase tracking-wider text-center">Simulate Customer Answer Intent</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleCallBranchSelect('wants_to_pay')}
                    className="bg-emerald-400/10 border border-emerald-400/20 hover:bg-emerald-400/15 text-emerald-400 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <CheckCircle className="size-3.5" />
                    Wants to pay (Auto link)
                  </button>
                  <button
                    onClick={() => handleCallBranchSelect('ptp_promised')}
                    className="bg-primary/10 border border-primary/20 hover:bg-primary/15 text-primary font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Clock className="size-3.5" />
                    Promise to Pay (PTP)
                  </button>
                  <button
                    onClick={() => handleCallBranchSelect('Busy')}
                    className="bg-surface-high hover:bg-surface-highest text-on-surface font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-outline-variant/10 transition-colors"
                  >
                    <AlertTriangle className="size-3.5 text-amber-400" />
                    Line Busy
                  </button>
                  <button
                    onClick={() => handleCallBranchSelect('NoAnswer')}
                    className="bg-surface-high hover:bg-surface-highest text-on-surface font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-outline-variant/10 transition-colors"
                  >
                    <X className="size-3.5 text-red-400" />
                    No Answer
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      

      {/* Slide-over Customer Details Profile Drawer */}
      <AnimatePresence>
        {selectedEntityDetailId && (() => {
          const entity = entities.find(e => e.id === selectedEntityDetailId);
          if (!entity) return null;

          const entityTasks = tasks.filter(t => t.entityId === entity.id);
          const entityLogs = interactions.filter(l => l.entityId === entity.id);
          const entityRec = recommendations.find(r => r.entityId === entity.id);

          return (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedEntityDetailId(null)}
                className="fixed inset-0 bg-black z-[190] cursor-pointer"
              />

              {/* Slide panel */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 h-full w-full max-w-xl bg-surface-lowest border-l border-outline-variant/10 shadow-2xl z-[200] flex flex-col"
              >
                {/* Header */}
                <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-base text-on-surface flex items-center gap-2">
                      <User className="text-primary size-4" />
                      Customer Profile & Actions
                    </h3>
                    <p className="text-xs text-outline mt-0.5">{entity.name} ({entity.referenceId})</p>
                  </div>
                  <button
                    onClick={() => setSelectedEntityDetailId(null)}
                    className="p-1.5 rounded-lg hover:bg-surface-high text-outline transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  
                  {/* Quick Metadata Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-surface-low/50 border border-outline-variant/5 p-4 rounded-xl">
                      <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Outstanding Amount</p>
                      <p className="text-lg font-bold mt-1 text-primary">{entity.attributes.OutstandingAmount || 'N/A'}</p>
                    </div>
                    <div className="bg-surface-low/50 border border-outline-variant/5 p-4 rounded-xl">
                      <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Contact Info</p>
                      <p className="text-xs font-bold mt-1.5 text-on-surface/80">{entity.contactInfo}</p>
                    </div>
                  </div>

                  {/* Attributes Grid */}
                  <div>
                    <h4 className="text-xs font-bold text-outline uppercase tracking-wider mb-2">CSV Field Attributes</h4>
                    <div className="bg-surface-high/40 rounded-xl p-4 border border-outline-variant/5 space-y-2 text-xs">
                      {Object.entries(entity.attributes).map(([key, val]) => (
                        <div key={key} className="flex justify-between py-1 border-b border-outline-variant/5 last:border-0">
                          <span className="text-outline">{key}</span>
                          <span className="font-bold">{String(val || 'N/A')}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Recommendation */}
                  {entityRec && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-outline uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="size-3.5 text-primary animate-pulse" />
                        AI Recommendation Decision
                      </h4>
                      <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-primary uppercase text-[10px]">{entityRec.suggestedAction.replace(/_/g, ' ')}</span>
                          <span className="text-outline text-[10px]">Confidence: {Math.round(entityRec.confidenceScore * 100)}%</span>
                        </div>
                        <p className="text-xs text-on-surface leading-relaxed italic">
                          "{entityRec.reasoning}"
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Autotask Schedule Queue */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-outline uppercase tracking-wider flex items-center gap-1">
                      <Clock className="size-3.5" />
                      Autotask Schedule Queue
                    </h4>

                    <div className="space-y-3">
                      {entityTasks.length === 0 ? (
                        <p className="text-xs text-outline italic">No tasks queued. Lifecycle complete or resolved.</p>
                      ) : (
                        entityTasks.map(task => (
                          <div key={task.id} className="bg-surface-high/50 border border-outline-variant/10 rounded-xl p-4 space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-xs font-bold text-on-surface">{task.taskType}</p>
                                <p className="text-[10px] text-outline mt-0.5">Run date: {new Date(task.scheduledTime).toLocaleString()}</p>
                              </div>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                task.status === 'Pending' ? 'bg-amber-400/15 text-amber-400' :
                                task.status === 'Processing' ? 'bg-primary/15 text-primary animate-pulse' :
                                'bg-surface-high text-outline'
                              }`}>
                                {task.status}
                              </span>
                            </div>

                            {task.status === 'Pending' && (
                              <div className="flex gap-2">
                                {task.taskType === 'CallRetry' ? (
                                  <button
                                    onClick={() => {
                                      triggerLiveDialerSim(entity, task);
                                      setSelectedEntityDetailId(null);
                                    }}
                                    className="flex-1 bg-primary text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1 shadow-md shadow-primary/10 hover:opacity-95"
                                  >
                                    <Phone className="size-3" />
                                    Launch Simulated Call
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      mockDB.executeTask(task.id);
                                      syncDB();
                                      logEvent(`Manually executed task ${task.taskType} for ${entity.name}`);
                                    }}
                                    className="flex-1 bg-surface-high text-on-surface font-bold py-1.5 px-3 rounded-lg text-xs border border-outline-variant/10 hover:bg-surface-highest"
                                  >
                                    Trigger Task Now
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-outline uppercase tracking-wider flex items-center gap-1">
                      <History className="size-3.5" />
                      Campaign Progression History
                    </h4>
                    <div className="bg-surface-high/30 rounded-xl p-3 border border-outline-variant/5 space-y-2">
                      {(() => {
                        const campaignHistoryIds = entity.attributes.campaignHistory || [];
                        const allCampaignIds = Array.from(new Set([...campaignHistoryIds, entity.jobId]));
                        const associatedCampaigns = allCampaignIds.map(id => jobs.find(j => j.id === id)).filter(Boolean) as AnalysisJob[];
                        
                        if (associatedCampaigns.length === 0) {
                          return <p className="text-xs text-outline italic">No campaign history recorded.</p>;
                        }

                        return associatedCampaigns.map(campaign => (
                          <div key={campaign.id} className="flex justify-between items-center py-1 text-xs border-b border-outline-variant/5 last:border-0">
                            <div>
                              <span className="font-bold text-on-surface">{campaign.name}</span>
                              {campaign.id === entity.jobId && (
                                <span className="ml-2 text-[9px] bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 px-1.5 py-0.5 rounded-full font-bold">Active</span>
                              )}
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              campaign.status === 'Completed' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' :
                              campaign.status === 'Executing' ? 'bg-primary/10 text-primary border-primary/20 animate-pulse' :
                              campaign.status === 'Analyzing' ? 'bg-amber-400/10 text-amber-400 border-amber-400/20 animate-pulse' :
                              'bg-surface-high text-outline border-outline-variant/10'
                            }`}>
                              {campaign.status}
                            </span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                  {/* Communication History Log */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-outline uppercase tracking-wider flex items-center gap-1">
                      <Activity className="size-3.5" />
                      Communication Log History
                    </h4>

                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                      {entityLogs.length === 0 ? (
                        <p className="text-xs text-outline italic">No outreach history recorded yet.</p>
                      ) : (
                        entityLogs.map(log => (
                          <div key={log.id} className="border-l-2 border-primary/20 pl-3 py-1 space-y-1 text-xs">
                            <div className="flex justify-between items-center text-[10px] text-outline font-bold">
                              <span className="flex items-center gap-1 flex-wrap">
                                {log.channel === 'VoiceCall' ? <Phone className="size-2.5" /> :
                                 log.channel === 'WhatsApp' ? <MessageSquare className="size-2.5" /> :
                                 <Database className="size-2.5" />}
                                {log.channel} ({log.status})
                                {log.metadata.campaignName && (
                                  <span className="text-[9px] px-1 bg-surface-high border border-outline-variant/10 text-primary rounded leading-none">
                                    {log.metadata.campaignName}
                                  </span>
                                )}
                              </span>
                              <span>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>

                            {log.metadata.messageContent && (
                              <p className="text-xs text-outline italic">"{log.metadata.messageContent}"</p>
                            )}

                            {log.metadata.transcript && (
                              <div className="bg-surface-high/60 rounded-lg p-2 text-[10px] text-outline leading-normal border border-outline-variant/5">
                                <p className="font-bold text-[9px] text-primary uppercase mb-1">Transcript Playback</p>
                                <p className="line-clamp-3 hover:line-clamp-none transition-all">{log.metadata.transcript}</p>
                              </div>
                            )}

                            <p className="text-[10px] font-bold text-on-surface/80">{log.metadata.actionOutcome}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>

      {/* Sidebar Drawer to Review Ingestion Details */}
      <AnimatePresence>
        {showReviewIngestion && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReviewIngestion(false)}
              className="fixed inset-0 bg-surface-lowest/40 backdrop-blur-sm z-[99]"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-[80%] max-w-[85%] bg-surface-lowest border-l border-outline-variant/10 shadow-2xl z-[100] overflow-y-auto p-6 md:p-8 flex flex-col space-y-6"
            >
            {/* Header */}
            <div className="flex justify-between items-start border-b border-outline-variant/10 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                    Background Processing Summary (Audit View)
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-on-surface flex items-center gap-2 mt-1">
                  <Database className="text-primary size-6" />
                  Inbound Data Ingestion & Scrubber Logs
                </h2>
                <p className="text-sm text-outline">
                  Detailed review of schema alignment, contact format corrections, and LLM risk profiling.
                </p>
              </div>
              <button
                onClick={() => setShowReviewIngestion(false)}
                className="p-2 bg-surface-high border border-outline-variant/10 text-outline hover:text-on-surface hover:bg-surface-high/80 rounded-full transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Stepper Header Navigation Component */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-surface-high/15 border border-outline-variant/10 p-3 rounded-2xl">
              {[
                { step: 0, label: 'Data Scrubbing', desc: 'Schema & verify', icon: ShieldAlert },
                { step: 1, label: 'Consolidation', desc: 'Identity merge', icon: Layers },
                { step: 2, label: 'AI Risk Profile', desc: 'Funnel allocations', icon: Sparkles },
                { step: 3, label: 'Smart Strategy', desc: 'Route graphs', icon: Cpu }
              ].map((s) => {
                const Icon = s.icon;
                const isCompleted = s.step < maxUnlockedStep;
                const isActive = s.step === reviewActiveStep;
                const isLocked = s.step > maxUnlockedStep;

                return (
                  <button
                    key={s.step}
                    disabled={isLocked}
                    onClick={() => setReviewActiveStep(s.step)}
                    className={`flex items-center gap-3 text-left p-3 rounded-xl transition-all select-none w-full border ${
                      isActive
                        ? 'bg-primary/10 border-primary/30 text-primary shadow-sm'
                        : isCompleted
                        ? 'bg-emerald-400/5 hover:bg-emerald-400/10 text-emerald-400 border-emerald-400/10 cursor-pointer'
                        : isLocked
                        ? 'opacity-40 cursor-not-allowed text-outline border-transparent'
                        : 'bg-surface-high/30 hover:bg-surface-high/50 text-outline border-transparent cursor-pointer'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${
                      isActive ? 'bg-primary text-on-primary' :
                      isCompleted ? 'bg-emerald-400/20 text-emerald-400' :
                      'bg-surface-high text-outline'
                    }`}>
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-black uppercase tracking-wider">
                          Step {s.step + 1}
                        </span>
                        {isCompleted && (
                          <span className="text-[10px] bg-emerald-400/20 text-emerald-400 px-1.5 py-0.5 rounded font-black uppercase">
                            Done
                          </span>
                        )}
                        {isActive && (
                          <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-black uppercase animate-pulse">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-on-surface truncate leading-tight mt-0.5">{s.label}</p>
                      <p className="text-xs text-outline truncate leading-none mt-0.5">{s.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Step Content Switcher Area */}
            <div className="flex-1 overflow-y-auto min-h-[420px] py-2">
              {reviewActiveStep === 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
                  {/* Left 2 Columns: Cleaning Stats & Record Stream */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Stats row */}
                    <div className="grid grid-cols-4 gap-4">
                      {[
                        { label: 'Total Records', val: cleaningSummary.total || parsedRecords.length, color: 'text-on-surface border-outline-variant/10', svg: <FileText className="size-4 text-outline" /> },
                        { label: 'Clean Fields', val: cleaningSummary.clean, color: 'text-emerald-400 border-emerald-400/20 bg-emerald-400/5', svg: <CheckCircle className="size-4 text-emerald-400" /> },
                        { label: 'Auto-Corrected', val: cleaningSummary.fixed, color: 'text-amber-400 border-amber-400/20 bg-amber-400/5', svg: <AlertTriangle className="size-4 text-amber-400" /> },
                        { label: 'Flagged Errors', val: cleaningSummary.errors, color: 'text-red-400 border-red-400/20 bg-red-400/5', svg: <X className="size-4 text-red-400" /> }
                      ].map((s, idx) => (
                        <div key={idx} className={`p-4 rounded-2xl border ${s.color} flex flex-col items-center justify-center text-center gap-1.5`}>
                          {s.svg}
                          <span className="text-3xl font-black tabular-nums">{s.val}</span>
                          <span className="text-xs font-bold uppercase opacity-85">{s.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Processing Stream */}
                    <div className="glass-panel p-5 rounded-2xl border border-outline-variant/10 space-y-3">
                      <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                        <Database className="size-4 text-primary" />
                        Complete Processing Stream Audit
                      </h4>
                      <p className="text-xs text-outline">
                        Staggered records read directly from file payload. Checked fields: Name [N], Phone [P], Balance [B], DPD [D], Asset Class [A].
                      </p>
                      <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
                        {cleaningEvents.map((evt) => (
                          <div
                            key={evt.rowIndex}
                            className="flex items-center gap-3 bg-surface-high/10 border border-outline-variant/5 rounded-xl px-3 py-2.5 text-xs"
                          >
                            <span className="text-outline font-mono flex-shrink-0 w-8">#{evt.rowIndex}</span>
                            <span className="font-bold text-on-surface truncate w-36 flex-shrink-0">{evt.name}</span>
                            
                            {/* SVGs */}
                            <div className="flex items-center gap-1.5 flex-1">
                              {evt.fieldChecks.map((fc, fi) => (
                                <div key={fi} title={`${fc.field}: ${fc.note}`} className="flex items-center">
                                  {fc.status === 'OK' && (
                                    <span className="text-emerald-400 text-xs bg-emerald-400/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                      {fc.field[0]}✓
                                    </span>
                                  )}
                                  {fc.status === 'FIXED' && (
                                    <span className="text-amber-400 text-xs bg-amber-400/10 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold">
                                      {fc.field[0]}⚠
                                    </span>
                                  )}
                                  {fc.status === 'ERROR' && (
                                    <span className="text-red-400 text-xs bg-red-400/10 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold">
                                      {fc.field[0]}✕
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>

                            <span className={`flex-shrink-0 text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              evt.status === 'CLEAN' ? 'bg-emerald-400/15 text-emerald-400' :
                              evt.status === 'FIXED' ? 'bg-amber-400/15 text-amber-400' :
                              evt.status === 'ERROR' ? 'bg-red-400/15 text-red-400' :
                              'bg-primary/15 text-primary'
                            }`}>{evt.status}</span>
                          </div>
                        ))}
                        {cleaningEvents.length === 0 && (
                          <div className="text-center py-8 text-outline italic text-xs">No cleaning events tracked for this run.</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Schema anomalies */}
                  <div className="space-y-6">
                    {/* Field anomalies */}
                    <div className="glass-panel p-5 rounded-2xl border border-outline-variant/10 space-y-3">
                      <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="size-4 text-amber-400" />
                        Field Errors & Auto-Corrections
                      </h4>
                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                        {cleaningEvents.filter(e => e.status === 'FIXED' || e.status === 'ERROR').map((evt) => (
                          evt.fieldChecks.filter(fc => fc.status !== 'OK').map((fc, fi) => (
                            <div key={`${evt.rowIndex}-${fi}`} className={`rounded-xl border p-3 text-xs space-y-1 ${
                              fc.status === 'ERROR' ? 'border-red-400/20 bg-red-400/5' : 'border-amber-400/20 bg-amber-400/5'
                            }`}>
                              <div className="flex justify-between items-center font-bold">
                                <span className="text-on-surface">Row #{evt.rowIndex} · {fc.field}</span>
                                <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                                  fc.status === 'ERROR' ? 'text-red-400 bg-red-400/15' : 'text-amber-400 bg-amber-400/15'
                                }`}>{fc.status}</span>
                              </div>
                              <p className="text-outline-high mt-1">{fc.note}</p>
                              <div className="flex gap-2 text-[10px] font-mono mt-1 opacity-80">
                                <span className="text-red-400 line-through">Was: {fc.originalValue}</span>
                                {fc.fixedValue && <span className="text-emerald-400">Fixed: {fc.fixedValue}</span>}
                              </div>
                            </div>
                          ))
                        ))}
                        {cleaningEvents.filter(e => e.status === 'FIXED' || e.status === 'ERROR').length === 0 && (
                          <div className="text-center py-6 text-outline italic text-xs">No anomalies or fixes required in this file.</div>
                        )}
                      </div>
                    </div>

                    {/* Technical developer log feed */}
                    <details className="group border border-outline-variant/10 rounded-xl overflow-hidden bg-surface-lowest">
                      <summary className="flex justify-between items-center px-4 py-2.5 cursor-pointer text-xs font-bold text-outline select-none hover:bg-surface-high/20">
                        <span className="flex items-center gap-2"><Database className="size-3.5" />View Raw Scrubber Log Feed</span>
                        <ChevronDown className="size-3.5 group-open:rotate-180 transition-transform" />
                      </summary>
                      <div className="px-4 pb-3 border-t border-outline-variant/10 bg-surface-lowest font-mono text-[11px] text-outline h-36 overflow-y-auto space-y-0.5 pt-2">
                        {visibleSimLogs.map((log, i) => (
                          <div key={i} className="flex gap-2">
                            <span className="opacity-40">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                            <span className={`font-bold ${log.type==='SUCCESS'?'text-emerald-400':log.type==='WARN'?'text-amber-400':'text-outline-high'}`}>[{log.type}]</span>
                            <span>{log.message}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                </div>
              )}

              {reviewActiveStep === 1 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
                  {/* Left Column: Deduplication Metrics */}
                  <div className="lg:col-span-1 space-y-6">
                    <div className="glass-panel p-5 rounded-2xl border border-outline-variant/10 space-y-4">
                      <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="size-4 text-primary" />
                        Deduplication Analytics
                      </h4>
                      <div className="space-y-4">
                        <div className="bg-surface-high/20 border border-outline-variant/5 rounded-xl p-4 flex flex-col justify-center text-center">
                          <span className="text-4xl font-black text-emerald-400">
                            {visibleSimLogs.filter(l => l.phase === 'deduplication').length || 1}
                          </span>
                          <span className="text-xs font-bold text-outline uppercase tracking-wider mt-1">Duplicate Profiles Merged</span>
                        </div>
                        <div className="space-y-3 bg-surface-lowest/50 rounded-xl p-3 border border-outline-variant/5 text-xs">
                          <div className="flex justify-between text-outline">
                            <span className="font-medium">Matching Strategy</span>
                            <span className="font-bold text-on-surface">Phone & Reference ID</span>
                          </div>
                          <div className="flex justify-between text-outline">
                            <span className="font-medium">Conflict Resolution</span>
                            <span className="font-bold text-emerald-400">Auto-Overwrite</span>
                          </div>
                          <div className="flex justify-between text-outline">
                            <span className="font-medium">History Retained</span>
                            <span className="font-bold text-on-surface">Yes (All entries)</span>
                          </div>
                          <div className="flex justify-between text-outline">
                            <span className="font-medium">Cloud Database Sync</span>
                            <span className="font-bold text-emerald-400">Lock Released</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Right 2 Columns: Merged Profile Audit Logs */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="glass-panel p-5 rounded-2xl border border-outline-variant/10 space-y-3">
                      <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                        <Database className="size-4 text-primary" />
                        Deduplication Merge & Action Logs
                      </h4>
                      <p className="text-xs text-outline">
                        Profiles matched against historical tables. Merged accounts are consolidated under unified profiles to prevent spam and preserve interaction histories.
                      </p>
                      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                        {visibleSimLogs.filter(l => l.phase === 'deduplication').map((log, idx) => (
                          <div key={idx} className="bg-surface-high/15 border border-outline-variant/5 rounded-xl p-3 text-xs space-y-1">
                            <div className="flex justify-between items-center font-bold">
                              <span className="text-on-surface">Consolidation Row #{idx + 1}</span>
                              <span className="text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded text-[10px] font-black uppercase">Conflict Resolved</span>
                            </div>
                            <p className="text-outline-high leading-relaxed mt-1 text-xs">{log.message}</p>
                          </div>
                        ))}
                        {/* Fallback logs if deduplication stage is locked or hasn't started */}
                        {visibleSimLogs.filter(l => l.phase === 'deduplication').length === 0 && (
                          <div className="text-center py-12 text-outline italic text-xs">
                            {activeParsingPhase === 'cleaning' 
                              ? 'Deduplication engine will execute immediately after the schema validation checks complete.'
                              : 'Searching database for customer profile duplicates...'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {reviewActiveStep === 2 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
                  {/* Left Column: AI Logic Definitions */}
                  <div className="lg:col-span-1 space-y-6">
                    <div className="glass-panel p-5 rounded-2xl border border-outline-variant/10 space-y-4">
                      <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="size-4 text-primary" />
                        AI Stratification Rules
                      </h4>
                      <div className="space-y-3 text-xs">
                        <div className="border-l-2 border-red-400 pl-2 space-y-0.5">
                          <span className="font-bold text-red-400 uppercase text-[10px]">Critical Tier</span>
                          <p className="text-outline-high leading-tight">Outstanding &gt; ₹50,000 OR DPD &gt; 30 days. Auto-escalated to instant AI Voice Bot Outreach.</p>
                        </div>
                        <div className="border-l-2 border-amber-400 pl-2 space-y-0.5">
                          <span className="font-bold text-amber-400 uppercase text-[10px]">High Tier</span>
                          <p className="text-outline-high leading-tight">Outstanding ₹20,000 - ₹50,000 OR DPD 15-30. Addressed via AI Voice scheduled retry flows.</p>
                        </div>
                        <div className="border-l-2 border-primary pl-2 space-y-0.5">
                          <span className="font-bold text-primary uppercase text-[10px]">Medium Tier</span>
                          <p className="text-outline-high leading-tight">Outstanding ₹5,000 - ₹20,000 OR DPD 5-15. Addressed via WhatsApp Interactive & IVR campaigns.</p>
                        </div>
                        <div className="border-l-2 border-emerald-400 pl-2 space-y-0.5">
                          <span className="font-bold text-emerald-400 uppercase text-[10px]">Low Tier</span>
                          <p className="text-outline-high leading-tight">Outstanding &lt; ₹5,000 AND DPD &lt; 5. Routed to SMS Text reminders.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Right 2 Columns: AI Risk Funnel Allocation */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="glass-panel p-5 rounded-2xl border border-outline-variant/10 space-y-4">
                      <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="size-4 text-primary" />
                        AI Risk Funnel Allocation
                      </h4>
                      <div className="space-y-2">
                        {[
                          { tier: 'Critical', color: 'text-red-400 bg-red-400/10 border-red-400/20', count: aiInsights.filter(i => i.tier === 'Critical').length, bar: 'bg-red-400', act: 'AI voice immediate escalations' },
                          { tier: 'High', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', count: aiInsights.filter(i => i.tier === 'High').length, bar: 'bg-amber-400', act: 'AI voice scheduled retry' },
                          { tier: 'Medium', color: 'text-primary bg-primary/10 border-primary/20', count: aiInsights.filter(i => i.tier === 'Medium').length, bar: 'bg-primary', act: 'IVR & WhatsApp campaigns' },
                          { tier: 'Low', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', count: aiInsights.filter(i => i.tier === 'Low').length, bar: 'bg-emerald-400', act: 'Automated SMS nudges' }
                        ].map(t => {
                          const matchingIns = aiInsights.filter(i => i.tier === t.tier);
                          return (
                            <div key={t.tier} className="bg-surface-high/10 border border-outline-variant/5 rounded-xl p-2.5 text-xs space-y-2">
                              <div className="flex justify-between font-bold">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-black ${t.color}`}>{t.tier}</span>
                                <span className="text-on-surface">{t.count} accts</span>
                              </div>
                              <div className="h-1 bg-surface-high rounded-full overflow-hidden">
                                <div className={`h-full ${t.bar} transition-all`} style={{ width: `${(t.count/Math.max(aiInsights.length||1,1))*100}%` }} />
                              </div>
                              <p className="text-xs text-outline leading-tight italic">{t.act}</p>
                              
                              {/* Accounts & AI Reasons list */}
                              <div className="mt-2 space-y-1.5 max-h-24 overflow-y-auto pr-1">
                                {matchingIns.map((ins, idx) => (
                                  <div key={idx} className="bg-surface-lowest/70 p-1.5 rounded-lg text-xs border border-outline-variant/5">
                                    <div className="flex justify-between font-bold text-on-surface">
                                      <span>{ins.name}</span>
                                      <span className="text-outline">{ins.outstanding}</span>
                                    </div>
                                    <p className="text-outline text-[10px] italic leading-tight mt-0.5">
                                      "{ins.reason}"
                                    </p>
                                  </div>
                                ))}
                                {matchingIns.length === 0 && (
                                  <div className="text-center py-1 text-[10px] text-outline italic">No accounts in this tier.</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {reviewActiveStep === 3 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
                  {/* Left Column: Channel Allocations */}
                  <div className="lg:col-span-1 space-y-6">
                    <div className="glass-panel p-5 rounded-2xl border border-outline-variant/10 space-y-4">
                      <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                        <Cpu className="size-4 text-primary" />
                        Campaign Allocations
                      </h4>
                      <div className="space-y-3">
                        {[
                          { label: 'Voice Bot Call (Critical/High)', value: aiInsights.filter(i => i.tier === 'Critical' || i.tier === 'High').length, color: 'text-red-400' },
                          { label: 'Interactive IVR Call (Medium)', value: aiInsights.filter(i => i.tier === 'Medium').length, color: 'text-primary' },
                          { label: 'WhatsApp Campaign (Medium)', value: aiInsights.filter(i => i.tier === 'Medium').length, color: 'text-primary' },
                          { label: 'Automated SMS Reminders (Low)', value: aiInsights.filter(i => i.tier === 'Low').length, color: 'text-emerald-400' }
                        ].map((c, i) => (
                          <div key={i} className="flex justify-between items-center text-xs bg-surface-high/10 border border-outline-variant/5 rounded-xl p-2.5 px-3">
                            <span className="text-outline font-bold">{c.label}</span>
                            <span className={`font-black text-sm ${c.color}`}>{c.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Right 2 Columns: Telephony graph */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Channel Dispatch Network Animation */}
                    <div className="bg-surface-high/20 border border-outline-variant/5 p-5 rounded-2xl space-y-4">
                      <h4 className="text-sm font-black uppercase text-outline tracking-wider">
                        Outbound Campaign Telephony Route Graph
                      </h4>
                      <div className="bg-surface-lowest border border-outline-variant/10 rounded-xl p-6 relative overflow-hidden flex flex-col md:flex-row justify-around items-center gap-6 md:gap-4">
                        <div className="flex flex-col gap-2">
                          <span className="text-xs font-bold text-red-400 bg-red-400/10 px-3 py-1 rounded-full border border-red-400/20 text-center">Critical/High Risk</span>
                          <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20 text-center">Medium Risk</span>
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20 text-center">Low Risk</span>
                        </div>
                        
                        <div className="flex flex-col gap-1 items-center">
                          <span className="text-primary font-bold text-sm animate-pulse">Routing Engine</span>
                          <ArrowRight className="size-4 text-outline rotate-90 md:rotate-0" />
                        </div>

                        <div className="flex flex-wrap md:flex-nowrap gap-3 justify-center">
                          <div className="bg-surface-high p-3 rounded-xl border border-outline-variant/10 text-center w-24">
                            <Phone className="size-4 text-primary mx-auto mb-1 animate-bounce" />
                            <span className="text-xs font-bold text-outline">AI Bot Call</span>
                          </div>
                          <div className="bg-surface-high p-3 rounded-xl border border-outline-variant/10 text-center w-24">
                            <Activity className="size-4 text-amber-400 mx-auto mb-1 animate-pulse" />
                            <span className="text-xs font-bold text-outline">IVR Playback</span>
                          </div>
                          <div className="bg-surface-high p-3 rounded-xl border border-outline-variant/10 text-center w-24">
                            <MessageSquare className="size-4 text-emerald-400 mx-auto mb-1 animate-pulse" />
                            <span className="text-xs font-bold text-outline">WhatsApp</span>
                          </div>
                          <div className="bg-surface-high p-3 rounded-xl border border-outline-variant/10 text-center w-24">
                            <FileText className="size-4 text-outline-high mx-auto mb-1" />
                            <span className="text-xs font-bold text-outline">SMS Text</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Stepper Footer Controls */}
            <div className="flex justify-between items-center border-t border-outline-variant/10 pt-4 mt-auto">
              <button
                disabled={reviewActiveStep === 0}
                onClick={() => setReviewActiveStep(prev => prev - 1)}
                className="px-4 py-2 bg-surface-high border border-outline-variant/10 text-outline hover:text-on-surface hover:bg-surface-high/80 rounded-xl transition-all font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                Previous Step
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowReviewIngestion(false)}
                  className="px-4 py-2 border border-outline-variant/10 text-outline hover:text-on-surface rounded-xl transition-all text-sm cursor-pointer font-bold"
                >
                  Close Audit View
                </button>

                {reviewActiveStep < 3 ? (
                  <button
                    disabled={reviewActiveStep >= maxUnlockedStep}
                    onClick={() => setReviewActiveStep(prev => prev + 1)}
                    className="px-4 py-2 bg-primary text-on-primary hover:bg-primary/95 rounded-xl transition-all font-bold text-sm disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                  >
                    Next Step <ArrowRight className="size-3.5" />
                  </button>
                ) : (
                  <button
                    disabled={activeParsingPhase !== 'done'}
                    onClick={() => {
                      setShowReviewIngestion(false);
                      handleInitiateBroadcast();
                    }}
                    className="px-4 py-2 bg-emerald-400 text-surface-lowest hover:bg-emerald-300 rounded-xl transition-all font-bold text-sm disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 shadow-lg shadow-emerald-400/10"
                  >
                    Launch Campaign Broadcast <Play className="size-3.5 fill-current" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Executive Audit Report Modal */}
      <AnimatePresence>
        {showReportGeneratorModal && (() => {
          const job = jobs.find(j => j.id === selectedJobDetailId) || jobs[0];
          if (!job) return null;

          const jobEntities = entities.filter(e => e.jobId === job.id);
          const jobTasks = tasks.filter(t => t.jobId === job.id);
          
          // Data Scrubbing Metrics
          const totalScrubbed = jobEntities.length;
          const cleanCount = Math.round(totalScrubbed * 0.85);
          const autoCorrectedCount = totalScrubbed - cleanCount;

          // Consolidation Metrics
          const originalRecordsCount = Math.round(totalScrubbed * 1.15);
          const mergedCount = originalRecordsCount - totalScrubbed;

          // AI Risk categorization counts
          const criticalCount = jobEntities.filter(e => e.riskLevel === 'Critical').length;
          const highCount = jobEntities.filter(e => e.riskLevel === 'High').length;
          const mediumCount = jobEntities.filter(e => e.riskLevel === 'Medium').length;
          const lowCount = jobEntities.filter(e => e.riskLevel === 'Low').length;

          // Channel stats
          const getReportChannelStats = (type: string) => {
            const channelTasks = jobTasks.filter(t => t.type === type);
            const count = channelTasks.length;
            if (count > 0) {
              const delivered = channelTasks.filter(t => t.status === 'Completed' || t.status === 'Executed').length;
              const responses = channelTasks.filter(t => t.outcome && t.outcome !== 'NoAnswer' && t.outcome !== 'Busy').length;
              const achieved = channelTasks.filter(t => t.outcome === 'wants_to_pay' || t.outcome === 'ptp_promised').length;
              return { sent: count, delivered, responses, achieved };
            }
            let sentRatio = 0.3, deliverRatio = 0.95, responseRatio = 0.25, achieveRatio = 0.6;
            if (type === 'sms') { sentRatio = 0.4; deliverRatio = 0.96; responseRatio = 0.15; achieveRatio = 0.4; }
            else if (type === 'whatsapp') { sentRatio = 0.5; deliverRatio = 0.98; responseRatio = 0.45; achieveRatio = 0.7; }
            else if (type === 'ivr') { sentRatio = 0.35; deliverRatio = 0.75; responseRatio = 0.25; achieveRatio = 0.5; }
            else if (type === 'ai_voice') { sentRatio = 0.6; deliverRatio = 0.85; responseRatio = 0.55; achieveRatio = 0.75; }
            
            const sent = Math.max(1, Math.round(totalScrubbed * sentRatio));
            const delivered = Math.max(1, Math.round(sent * deliverRatio));
            const responses = Math.max(1, Math.round(delivered * responseRatio));
            const achieved = Math.max(1, Math.round(responses * achieveRatio));
            return { sent, delivered, responses, achieved };
          };

          const sms = getReportChannelStats('sms');
          const wa = getReportChannelStats('whatsapp');
          const ivr = getReportChannelStats('ivr');
          const voice = getReportChannelStats('ai_voice');

          const totDispatched = sms.sent + wa.sent + ivr.sent + voice.sent;
          const totDelivered = sms.delivered + wa.delivered + ivr.delivered + voice.delivered;
          const totResponses = sms.responses + wa.responses + ivr.responses + voice.responses;
          const totAchieved = sms.achieved + wa.achieved + ivr.achieved + voice.achieved;

          const deliveryRate = totDispatched > 0 ? Math.round((totDelivered / totDispatched) * 100) : 0;
          const responseRate = totDelivered > 0 ? Math.round((totResponses / totDelivered) * 100) : 0;
          const conversionRate = totResponses > 0 ? Math.round((totAchieved / totResponses) * 100) : 0;

          const totOutstanding = jobEntities.reduce((sum, e) => {
            const amt = parseFloat((e.attributes.OutstandingAmount || '0').replace(/[^0-9.]/g, ''));
            return sum + (isNaN(amt) ? 0 : amt);
          }, 0);
          const estRecovered = totOutstanding * (conversionRate / 100) * 0.45;

          return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-300 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-surface-lowest border border-outline-variant/10 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
              >
                {reportGenerationPhase !== 'done' ? (
                  /* Report Generation Animation View */
                  <div className="p-12 flex flex-col items-center justify-center space-y-6 text-center">
                    <div className="size-20 rounded-full border-4 border-primary/20 border-t-primary flex items-center justify-center animate-spin">
                      <Sparkles className="size-8 text-primary animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-bold text-lg text-on-surface">Compiling Campaign Analytics</h3>
                      <p className="text-sm text-outline max-w-md">
                        Our AI engine is gathering ledger changes, telephony responses, voice call transcripts, and mapping the collection impact.
                      </p>
                    </div>

                    {/* Progress stream loader */}
                    <div className="w-full max-w-md bg-surface-high/20 border border-outline-variant/5 rounded-2xl p-4 text-left font-mono text-xs space-y-1.5 text-outline">
                      <div className={`flex items-center gap-2 ${reportGenerationPhase === 'aggregating' ? 'text-primary font-bold' : 'text-outline-high'}`}>
                        <span className="size-1.5 rounded-full bg-current animate-ping" />
                        <span>[1/4] Aggregating Ingestion Scrubber metadata...</span>
                      </div>
                      {(reportGenerationPhase === 'compiling' || reportGenerationPhase === 'scoring' || reportGenerationPhase === 'done') && (
                        <div className={`flex items-center gap-2 ${reportGenerationPhase === 'compiling' ? 'text-primary font-bold' : 'text-outline-high'}`}>
                          <span className="size-1.5 rounded-full bg-current animate-ping" />
                          <span>[2/4] Consolidating duplicate profile action histories...</span>
                        </div>
                      )}
                      {(reportGenerationPhase === 'scoring' || reportGenerationPhase === 'done') && (
                        <div className={`flex items-center gap-2 ${reportGenerationPhase === 'scoring' ? 'text-primary font-bold' : 'text-outline-high'}`}>
                          <span className="size-1.5 rounded-full bg-current animate-ping" />
                          <span>[3/4] Fetching AI Risk Allocation reasoning logs...</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Fully Formed Printable Report Document */
                  <>
                    {/* Header */}
                    <div className="p-6 border-b border-outline-variant/10 bg-surface-high/10 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] font-black uppercase text-primary bg-primary/10 px-2 py-0.5 rounded tracking-widest">Run Executive Audit Report</span>
                        <h3 className="font-bold text-lg text-on-surface mt-1">Campaign Analytics & Execution Summary</h3>
                        <p className="text-xs text-outline mt-0.5">Campaign Name: {job.name} · Generated: {new Date().toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => window.print()}
                          className="px-3.5 py-1.5 bg-surface-high border border-outline-variant/10 text-outline hover:text-on-surface hover:bg-surface-high/80 rounded-xl transition-all font-bold text-xs cursor-pointer flex items-center gap-1.5"
                        >
                          <FileText className="size-3.5" /> Print / Save PDF
                        </button>
                        <button
                          onClick={() => setShowReportGeneratorModal(false)}
                          className="p-2 bg-surface-high border border-outline-variant/10 text-outline hover:text-on-surface hover:bg-surface-high/80 rounded-full transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    </div>

                    {/* Content Body */}
                    <div className="p-6 overflow-y-auto space-y-8 text-xs leading-relaxed max-h-[70vh]">
                      {/* Section 1: Campaign Ledger & Metadata */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-surface-high/10 border border-outline-variant/5 rounded-xl p-3">
                          <span className="text-outline text-[9px] uppercase font-bold block">Portfolio Accounts</span>
                          <span className="text-base font-black text-on-surface mt-0.5 block">{totalScrubbed} Records</span>
                        </div>
                        <div className="bg-surface-high/10 border border-outline-variant/5 rounded-xl p-3">
                          <span className="text-outline text-[9px] uppercase font-bold block">Total Ledger Value</span>
                          <span className="text-base font-black text-on-surface mt-0.5 block">₹{totOutstanding.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                        </div>
                        <div className="bg-emerald-400/5 border border-emerald-400/10 rounded-xl p-3">
                          <span className="text-emerald-400 text-[9px] uppercase font-bold block">Estimated Recovered</span>
                          <span className="text-base font-black text-emerald-400 mt-0.5 block">₹{estRecovered.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                        </div>
                        <div className="bg-surface-high/10 border border-outline-variant/5 rounded-xl p-3">
                          <span className="text-outline text-[9px] uppercase font-bold block">Overall Delivery</span>
                          <span className="text-base font-black text-on-surface mt-0.5 block">{deliveryRate}% Reached</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Part 1: Inbound File Ingestion Health */}
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider border-b border-outline-variant/10 pb-2">1. Inbound Ingestion Audit</h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-outline">Schema Validation Rate:</span>
                              <span className="font-bold text-on-surface">100% Passed</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-outline">Clean Pass Records:</span>
                              <span className="font-bold text-on-surface">{cleanCount} ({Math.round(cleanCount / totalScrubbed * 100)}%)</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-outline">Auto-Corrected Anomalies:</span>
                              <span className="font-bold text-amber-400">{autoCorrectedCount} ({Math.round(autoCorrectedCount / totalScrubbed * 100)}%)</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-outline">Deduplication Profile Merges:</span>
                              <span className="font-bold text-primary">{mergedCount} ({Math.round(mergedCount / originalRecordsCount * 100)}% Match)</span>
                            </div>
                            <div className="bg-surface-high/20 border border-outline-variant/5 rounded-xl p-3 text-[11px] text-outline italic">
                              Note: Field errors like unrecognized asset classes ("Two-Wheeler Loan") were successfully auto-corrected to standard Personal Loan schemas, preventing file rejects.
                            </div>
                          </div>
                        </div>

                        {/* Part 2: Smart Strategy Routing */}
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider border-b border-outline-variant/10 pb-2">2. Pre-Campaign AI Risk Routing</h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-outline flex items-center gap-1">
                                <span className="size-2 rounded-full bg-red-400" /> Critical Risk Tier:
                              </span>
                              <span className="font-bold text-on-surface">{criticalCount} accounts ({Math.round(criticalCount / totalScrubbed * 100)}%)</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-outline flex items-center gap-1">
                                <span className="size-2 rounded-full bg-amber-400" /> High Risk Tier:
                              </span>
                              <span className="font-bold text-on-surface">{highCount} accounts ({Math.round(highCount / totalScrubbed * 100)}%)</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-outline flex items-center gap-1">
                                <span className="size-2 rounded-full bg-primary" /> Medium Risk Tier:
                              </span>
                              <span className="font-bold text-on-surface">{mediumCount} accounts ({Math.round(mediumCount / totalScrubbed * 100)}%)</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-outline flex items-center gap-1">
                                <span className="size-2 rounded-full bg-emerald-400" /> Low Risk Tier:
                              </span>
                              <span className="font-bold text-on-surface">{lowCount} accounts ({Math.round(lowCount / totalScrubbed * 100)}%)</span>
                            </div>
                            <div className="bg-surface-high/20 border border-outline-variant/5 rounded-xl p-3 text-[11px] text-outline italic">
                              Routing: Critical and High risk accounts were automatically targeted for Human-like AI Voice bot sequences. Medium and Low risk targeted WhatsApp and interactive IVR flows.
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Part 3: Post-Campaign Live Outreach Performance */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider border-b border-outline-variant/10 pb-2">3. Multi-Channel Outreach Performance</h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          {/* SMS card */}
                          <div className="bg-surface-high/15 border border-outline-variant/5 rounded-xl p-3 space-y-2">
                            <span className="font-bold text-on-surface block">SMS Broadcast</span>
                            <div className="space-y-1 text-[11px]">
                              <div className="flex justify-between"><span className="text-outline">Sent:</span><span className="font-bold">{sms.sent}</span></div>
                              <div className="flex justify-between"><span className="text-outline">Delivered:</span><span className="font-bold">{sms.delivered}</span></div>
                              <div className="flex justify-between"><span className="text-outline">Clicks:</span><span className="font-bold">{sms.responses}</span></div>
                              <div className="flex justify-between text-emerald-400 font-bold"><span className="text-outline">PTP:</span><span>{sms.achieved}</span></div>
                            </div>
                          </div>
                          {/* WA card */}
                          <div className="bg-surface-high/15 border border-outline-variant/5 rounded-xl p-3 space-y-2">
                            <span className="font-bold text-on-surface block">WhatsApp Interactive</span>
                            <div className="space-y-1 text-[11px]">
                              <div className="flex justify-between"><span className="text-outline">Sent:</span><span className="font-bold">{wa.sent}</span></div>
                              <div className="flex justify-between"><span className="text-outline">Read:</span><span className="font-bold">{wa.delivered}</span></div>
                              <div className="flex justify-between"><span className="text-outline">Button Click:</span><span className="font-bold">{wa.responses}</span></div>
                              <div className="flex justify-between text-emerald-400 font-bold"><span className="text-outline">PTP:</span><span>{wa.achieved}</span></div>
                            </div>
                          </div>
                          {/* IVR card */}
                          <div className="bg-surface-high/15 border border-outline-variant/5 rounded-xl p-3 space-y-2">
                            <span className="font-bold text-on-surface block">IVR Telephony</span>
                            <div className="space-y-1 text-[11px]">
                              <div className="flex justify-between"><span className="text-outline">Placed:</span><span className="font-bold">{ivr.sent}</span></div>
                              <div className="flex justify-between"><span className="text-outline">Connected:</span><span className="font-bold">{ivr.delivered}</span></div>
                              <div className="flex justify-between"><span className="text-outline">Keypress:</span><span className="font-bold">{ivr.responses}</span></div>
                              <div className="flex justify-between text-emerald-400 font-bold"><span className="text-outline">PTP:</span><span>{ivr.achieved}</span></div>
                            </div>
                          </div>
                          {/* AI Voice card */}
                          <div className="bg-surface-high/15 border border-outline-variant/5 rounded-xl p-3 space-y-2">
                            <span className="font-bold text-on-surface block">AI Voice Agent</span>
                            <div className="space-y-1 text-[11px]">
                              <div className="flex justify-between"><span className="text-outline">Placed:</span><span className="font-bold">{voice.sent}</span></div>
                              <div className="flex justify-between"><span className="text-outline">Connected:</span><span className="font-bold">{voice.delivered}</span></div>
                              <div className="flex justify-between"><span className="text-outline">Engagement:</span><span className="font-bold">{voice.responses}</span></div>
                              <div className="flex justify-between text-emerald-400 font-bold"><span className="text-outline">PTP:</span><span>{voice.achieved}</span></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Part 4: Executive Verdict & Recommendations */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider border-b border-outline-variant/10 pb-2">4. Core Recommendations & Next Action Steps</h4>
                        <ul className="list-disc pl-4 space-y-1.5 text-outline-high">
                          <li>SMS click-through rate indicates potential benefit in shifting low-risk accounts to cheap WhatsApp interactive push.</li>
                          <li>AI Human-like Voice Agent achieved a conversion rate of {Math.round((voice.achieved / voice.delivered) * 100)}% on connected calls, demonstrating strong performance for Critical/High-risk recovery.</li>
                          <li>Implement automated WhatsApp fallback within 24 hours for undelivered SMS alerts to ensure complete contact coverage.</li>
                        </ul>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-outline-variant/10 bg-surface-high/5 flex justify-end gap-3">
                      <button
                        onClick={() => setShowReportGeneratorModal(false)}
                        className="px-5 py-2 bg-surface-high text-outline hover:text-on-surface hover:bg-surface-high/80 rounded-xl transition-all font-bold text-sm cursor-pointer"
                      >
                        Close Report
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

    </div>
  );
}
