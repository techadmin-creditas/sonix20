import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, Brain, Volume2, ChevronDown, Zap, RotateCcw,
  Pause, Play, TrendingUp, AlertTriangle, Handshake,
  ArrowRight, FileText, PhoneOff, Phone, Info,
} from 'lucide-react';
import { useTheme } from '../../lib/theme';

const FloatingTooltip = ({ text }: { text: string }) => {
  const [pos, setPos] = useState({ top: 'auto', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '8px', marginTop: '0px' });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !el.parentElement) return;
    const parent = el.parentElement;

    const onEnter = () => {
      const parentRect = parent.getBoundingClientRect();
      const tooltipRect = el.getBoundingClientRect();
      let newPos = { ...pos };

      // Vertical Check (Flip to bottom if clipping top)
      if (parentRect.top - tooltipRect.height - 10 < 0) {
        newPos.bottom = 'auto';
        newPos.top = '100%';
        newPos.marginBottom = '0px';
        newPos.marginTop = '8px';
      } else {
        newPos.bottom = '100%';
        newPos.top = 'auto';
        newPos.marginBottom = '8px';
        newPos.marginTop = '0px';
      }

      // Horizontal Check (Prevent side clipping)
      const center = parentRect.left + parentRect.width / 2;
      const halfWidth = tooltipRect.width / 2;
      
      if (center - halfWidth < 10) {
        newPos.left = '0%';
        newPos.transform = 'translateX(0)';
      } else if (center + halfWidth > window.innerWidth - 10) {
        newPos.left = 'auto'; 
        newPos.transform = 'translateX(0)';
      } else {
        newPos.left = '50%';
        newPos.transform = 'translateX(-50%)';
      }
      setPos(newPos);
    };

    parent.addEventListener('mouseenter', onEnter);
    return () => parent.removeEventListener('mouseenter', onEnter);
  }, []);

  return (
    <div 
      ref={ref}
      style={{
        ...pos,
        right: pos.left === 'auto' ? '0%' : 'auto',
      }}
      className="absolute w-max max-w-[220px] p-2.5 bg-surface/95 backdrop-blur-xl border border-outline-variant rounded-lg shadow-xl text-label-xs text-on-surface-variant font-medium leading-relaxed whitespace-normal text-center opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[100] pointer-events-none"
    >
      {text}
    </div>
  );
};

// ─── Voice Personas ────────────────────────────────────────────────────────
const VOICE_PROFILES = [
  { value: 'aria-in-warm',    label: 'Aria (IN) - Warm/Supportive' },
  { value: 'marcus-gb-exec',  label: 'Marcus (GB) - Executive/Sharp' },
  { value: 'zara-us-urgent',  label: 'Zara (US) - Fast/Urgent' },
  { value: 'vikram-in-cas',   label: 'Vikram (IN) - Casual/Relatable' },
  { value: 'sophia-fr-ele',   label: 'Sophia (FR) - Elegant/Patient' },
  { value: 'leo-us-direct',   label: 'Leo (US) - Direct/Logical' },
  { value: 'maya-mx-empath',  label: 'Maya (MX) - High Empathy' },
  { value: 'kenshin-jp-form', label: 'Kenshin (JP) - Formal/Pro' },
  { value: 'elara-sg-conc',   label: 'Elara (SG) - Concierge' },
  { value: 'dante-br-vibr',   label: 'Dante (BR) - Vibrant/Active' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type ScenarioKey = 'debt' | 'kyc' | 'fraud' | 'loan';
type LangKey     = 'hinglish' | 'hindi' | 'english';
type ToneKey     = 'empathetic' | 'neutral' | 'firm';

interface Message {
  speaker: 'bot' | 'user' | 'system';
  text: string;
  compliance?: boolean;
  lang?: string;
}

interface ScenarioReport {
  sentimentArc: number[];
  peakSentiment: number;
  peakAt: string;
  finalSentiment: number;
  keyObjection: { text: string; timestamp: string; confidence: string } | null;
  ptp: { score: number | null; detail: string } | null;
  nextBestAction: string[];
  callScore: number;
}

interface ScenarioData {
  label: string;
  agent: string;
  langLabel: string;
  intent: string;
  systemPrompt: string;
  transcript: Message[];
  hardTranscript: Message[]; // Added for Stress Testing
  report: ScenarioReport;
}

// ─── Scenario Data ────────────────────────────────────────────────────────────

const SCENARIOS: Record<ScenarioKey, ScenarioData> = {
  debt: {
    label: 'Debt Recovery', agent: 'Astra', langLabel: 'Hinglish', intent: 'Payment Query',
    systemPrompt: "You are Astra, a debt recovery specialist. Use a firm but respectful tone. Focus on establishing a PTP (Promise to Pay). Maintain strict compliance with banking regulations #DB-42. Avoid aggressive language; prioritize resolution.",
    transcript: [
      { speaker: 'bot',    text: 'Namaste, Rohan ji. Main Sonix Finance se baat kar rahi hoon.', lang: 'hindi' },
      { speaker: 'user',   text: 'Haan ji, kahiye. Kya baat hai?', lang: 'hindi' },
      { speaker: 'bot',    text: 'Aapka loan account ke baare mein inform karna tha. Abhi baat kar sakte hain?', lang: 'hinglish' },
      { speaker: 'user',   text: 'Mera payment toh ho gaya hai last week!', lang: 'hinglish' },
      { speaker: 'bot',    text: 'Bilkul, hum use verify kar lete hain. Ek minute dijiyega.', lang: 'hinglish' },
      { speaker: 'system', text: 'Cross-referencing payment gateway logs...' },
      { speaker: 'bot',    text: 'Rohan ji, records mein ₹12,400 pending hai. Kya aaj payment arrange kar sakte hain?', lang: 'hinglish' },
      { speaker: 'user',   text: 'Theek hai, kal tak kar deta hoon.', lang: 'hindi', compliance: true },
      { speaker: 'bot',    text: 'Shukriya. Main aapko SMS mein payment link bhej rahi hoon. Koi sawaal?', lang: 'hinglish' },
      { speaker: 'system', text: '✓ PTP Recorded — ₹12,400 by Friday', compliance: true },
    ],
    report: {
      sentimentArc: [42, 50, 55, 48, 65, 75, 82, 74],
      peakSentiment: 82, peakAt: '1:42', finalSentiment: 74,
      keyObjection: { text: '"Payment timing"', timestamp: '0:58', confidence: 'High' },
      ptp: { score: 82, detail: 'Customer committed to pay ₹12,400 by Friday' },
      nextBestAction: ['Send SMS payment link immediately', 'Schedule follow-up call on D+3', 'Flag for supervisor if no payment by D+2'],
      callScore: 87,
    },
    hardTranscript: [
      { speaker: 'bot',    text: 'Namaste, Rohan ji. Main Sonix Finance se baat kar rahi hoon.', lang: 'hindi' },
      { speaker: 'user',   text: 'Yaar, phir se phone? Maine bola na mere paas paise nahi hain abhi!', lang: 'hindi' },
      { speaker: 'bot',    text: 'Samajh sakti hoon. Par aapka account ab bad-debt mein ja raha hai.', lang: 'hinglish' },
      { speaker: 'user',   text: 'Toh kya main ghar bech doon? Har roz 10 call aate hain aapke!', lang: 'hindi' },
      { speaker: 'system', text: '⚠ High Emotional Volatility Detected — Switching to Empathy Script 4' },
      { speaker: 'bot',    text: 'Bilkul nahi, Rohan ji. Hum yahan help ke liye hain. Kya hum EMI restructure kar sakte hain?', lang: 'hinglish' },
      { speaker: 'user',   text: 'Mujhe manager se baat karni hai. Aap log bahut harrass kar rahe ho!', lang: 'hindi' },
      { speaker: 'bot',    text: 'Theek hai, main aapki call senior supervisor ko transfer kar sakti hoon, par pehle...', lang: 'hinglish' },
    ],
  },
  kyc: {
    label: 'KYC Onboarding', agent: 'Nova', langLabel: 'English', intent: 'KYC Verification',
    systemPrompt: "You are Nova, an onboarding concierge. Maintain a high-warmth, helpful personality. Guide the user through document verification steps. Highlight security and ease of use. Ensure all identity checks are acknowledged clearly.",
    transcript: [
      { speaker: 'bot',    text: 'Hello! Welcome to your KYC verification. I\'m Nova, your onboarding assistant.', lang: 'english' },
      { speaker: 'user',   text: 'Hi, I received a message to complete my KYC.', lang: 'english' },
      { speaker: 'bot',    text: 'That\'s correct. To verify your identity, could you please confirm your PAN number?', lang: 'english' },
      { speaker: 'user',   text: 'I don\'t have my documents ready right now.', lang: 'english' },
      { speaker: 'bot',    text: 'No problem. I can send you a secure link to complete it at your convenience — within 48 hours.', lang: 'english' },
      { speaker: 'system', text: 'Generating secure KYC link...' },
      { speaker: 'user',   text: 'Okay, that works. Please send it to my registered email.', lang: 'english', compliance: true },
      { speaker: 'bot',    text: 'Done! KYC link sent to your registered email. It\'s valid for 48 hours.', lang: 'english' },
      { speaker: 'system', text: '✓ KYC Link Dispatched — Valid 48hrs', compliance: true },
    ],
    report: {
      sentimentArc: [60, 65, 58, 52, 70, 78, 82, 80],
      peakSentiment: 82, peakAt: '1:55', finalSentiment: 80,
      keyObjection: { text: '"Document not ready"', timestamp: '0:42', confidence: 'Medium' },
      ptp: null,
      nextBestAction: ['Resend KYC link if not opened within 12hrs', 'Escalate to branch if unverified after 48hrs', 'Flag for AML review'],
      callScore: 91,
    },
    hardTranscript: [
      { speaker: 'bot',    text: 'Hello! I\'m Nova. Let\'s get your KYC completed.', lang: 'english' },
      { speaker: 'user',   text: 'This is the third time I\'m trying. Your app keeps crashing!', lang: 'english' },
      { speaker: 'bot',    text: 'I\'m very sorry about the technical issues. I can guide you manually now.', lang: 'english' },
      { speaker: 'user',   text: 'I don\'t have a "Smartphone". How am I supposed to open your link?', lang: 'english' },
      { speaker: 'system', text: 'Scenario Branch: Non-Digital User Protocol' },
      { speaker: 'bot',    text: 'No problem at all. We can schedule a doorstep verification for you instead.', lang: 'english' },
      { speaker: 'user',   text: 'Will that cost extra? This is so confusing.', lang: 'english' },
      { speaker: 'bot',    text: 'It\'s completely free for our premium members. Shall I book it for tomorrow?', lang: 'english' },
    ],
  },
  fraud: {
    label: 'Fraud Alert', agent: 'Midas', langLabel: 'English', intent: 'Fraud Investigation',
    systemPrompt: "You are Midas, a fraud security lead. Maintain an urgent, professional, and reassuring tone. Focus on security verification and immediate card control. Use technical clarity when describing fraudulent transactions.",
    transcript: [
      { speaker: 'bot',    text: 'This is Midas from Sonix Security. We detected unusual activity on your account ending 4821.', lang: 'english' },
      { speaker: 'user',   text: 'What? What kind of activity?', lang: 'english' },
      { speaker: 'bot',    text: 'A transaction of ₹8,500 was initiated from an unrecognized device in Mumbai at 03:14 AM.', lang: 'english' },
      { speaker: 'user',   text: 'I didn\'t make any transaction. I was asleep!', lang: 'english' },
      { speaker: 'system', text: 'Initiating card block protocol...' },
      { speaker: 'bot',    text: 'I\'ve immediately blocked your card for safety. Please verify: did you share your OTP with anyone recently?', lang: 'english', compliance: true },
      { speaker: 'user',   text: 'No, never. This is really worrying.', lang: 'english' },
      { speaker: 'bot',    text: 'Understood. I\'m escalating this to our fraud investigation team. You\'ll receive a new card within 3 business days.', lang: 'english' },
      { speaker: 'system', text: '⚠ Fraud Case #FR-2847 Opened — Card Blocked', compliance: true },
    ],
    report: {
      sentimentArc: [30, 25, 20, 18, 35, 45, 55, 50],
      peakSentiment: 55, peakAt: '2:10', finalSentiment: 50,
      keyObjection: { text: '"Didn\'t recognize transaction"', timestamp: '0:35', confidence: 'High' },
      ptp: null,
      nextBestAction: ['Escalate case #FR-2847 to fraud team', 'Dispatch replacement card immediately', 'Schedule 24hr follow-up call'],
      callScore: 94,
    },
    hardTranscript: [
      { speaker: 'bot',    text: 'Urgent security alert from Sonix Security. Is this Mr. Kapoor?', lang: 'english' },
      { speaker: 'user',   text: 'Yes, speaking. What happened?', lang: 'english' },
      { speaker: 'bot',    text: 'Someone just tried to withdraw ₹50,000 from an ATM in Dubai.', lang: 'english' },
      { speaker: 'user',   text: 'Oh my god! ₹50,000? That\'s half my savings! Please stop it!', lang: 'english' },
      { speaker: 'system', text: '⚠ User Panicking — Triggering Reassurance Protocol' },
      { speaker: 'bot',    text: 'Don\'t worry, the transaction is blocked. Your funds are safe.', lang: 'english' },
      { speaker: 'user',   text: 'Are you sure? I feel like I\'m going to have a heart attack.', lang: 'english' },
      { speaker: 'bot',    text: 'Please take a deep breath. I am blocking your card permanently and issuing a new one.', lang: 'english' },
    ],
  },
  loan: {
    label: 'Loan Query', agent: 'Luna', langLabel: 'Hinglish', intent: 'EMI Inquiry',
    systemPrompt: "You are Luna, a financial advisor for loans. Use an empathetic, consultative approach. Focus on identifying financial hardship and offering restructuring solutions. Emphasize credit score stability and long-term savings.",
    transcript: [
      { speaker: 'bot',    text: 'Hello, this is Luna from Sonix Lending. Your EMI of ₹12,400 is due this Friday.', lang: 'hinglish' },
      { speaker: 'user',   text: 'Haan, pata hai. But this month thoda tight hai financially.', lang: 'hinglish' },
      { speaker: 'bot',    text: 'I understand. Would you like to explore a restructuring plan or a 10-day extension?', lang: 'hinglish' },
      { speaker: 'user',   text: 'EMI itni zyada kyun hai? Interest rate reduce nahi ho sakta?', lang: 'hinglish' },
      { speaker: 'system', text: 'Fetching loan terms and eligibility for rate revision...' },
      { speaker: 'bot',    text: 'Your current rate is 10.5% p.a. Based on your track record, you qualify for a 9.8% revision — saving ₹420/month.', lang: 'english', compliance: true },
      { speaker: 'user',   text: 'Oh that\'s good! How do I apply?', lang: 'english' },
      { speaker: 'bot',    text: 'I\'ll raise the request now. You\'ll get confirmation via SMS within 2 hours.', lang: 'english' },
      { speaker: 'system', text: '✓ Rate Revision Requested — ₹420/mo savings', compliance: true },
    ],
    report: {
      sentimentArc: [50, 45, 40, 38, 55, 68, 75, 72],
      peakSentiment: 75, peakAt: '2:05', finalSentiment: 72,
      keyObjection: { text: '"EMI too high"', timestamp: '0:50', confidence: 'High' },
      ptp: { score: 65, detail: 'Rate revision request raised — saves ₹420/month' },
      nextBestAction: ['Process rate revision request immediately', 'Send revised EMI schedule via SMS', 'Schedule check-in post rate change'],
      callScore: 89,
    },
    hardTranscript: [
      { speaker: 'bot',    text: 'Hello, this is Luna. I\'m calling regarding your loan application.', lang: 'hinglish' },
      { speaker: 'user',   text: 'Suniye, meri job chali gayi hai last month. Main pay nahi kar paunga.', lang: 'hindi' },
      { speaker: 'bot',    text: 'I am so sorry to hear that. We have a "Credit Protector" plan for such cases.', lang: 'hinglish' },
      { speaker: 'user',   text: 'Kya matlab? Mujhe aur udhaar nahi chahiye!', lang: 'hindi' },
      { speaker: 'system', text: 'Clarifying: Insurance vs New Loan' },
      { speaker: 'bot',    text: 'Nahi, ye insurance hai jo aapki 3 EMIs cover karega. Main ise activate kar doon?', lang: 'hinglish' },
      { speaker: 'user',   text: 'Sach mein? Iske liye koi document chahiye?', lang: 'hindi' },
      { speaker: 'bot',    text: 'Sirf aapki digital consent. Main link bhej rahi hoon.', lang: 'hinglish' },
    ],
  },
};

// ─── SentimentSparkline ───────────────────────────────────────────────────────

const SentimentSparkline = ({ points, animate: shouldAnimate }: { points: number[]; animate: boolean }) => {
  const W = 160, H = 40, pad = 4;
  const minV = Math.min(...points);
  const maxV = Math.max(...points);
  const range = maxV - minV || 1;
  const pts = points.map((v, i) => {
    const x = pad + (i / (points.length - 1)) * (W - pad * 2);
    const y = pad + (1 - (v - minV) / range) * (H - pad * 2);
    return `${x},${y}`;
  });
  const polyline = pts.join(' ');
  const areaPath = `M ${pts[0]} ${pts.slice(1).map(p => `L ${p}`).join(' ')} L ${W - pad},${H} L ${pad},${H} Z`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <motion.path
        d={areaPath} fill="url(#spark-grad)"
        initial={shouldAnimate ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.5 }}
      />
      <motion.polyline
        points={polyline} fill="none" stroke="var(--primary)" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round"
        initial={shouldAnimate ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.8, duration: 0.8, ease: 'easeOut' }}
      />
      {points.map((v, i) => {
        const x = pad + (i / (points.length - 1)) * (W - pad * 2);
        const y = pad + (1 - (v - minV) / range) * (H - pad * 2);
        return (
          <motion.circle key={i} cx={x} cy={y} r="2.5" fill="var(--primary)"
            initial={shouldAnimate ? { opacity: 0, scale: 0 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.85 + i * 0.05 }}
          />
        );
      })}
    </svg>
  );
};

// ─── DemoPanelWaveform ────────────────────────────────────────────────────────

const DemoPanelWaveform = React.memo(({ isActive, isDark }: { isActive: boolean; isDark: boolean }) => {
  const svgRef   = useRef<SVGSVGElement>(null);
  const rafRef   = useRef<number>(0);
  const phaseRef = useRef(0);
  const ampRef   = useRef(2);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const p1 = svg.querySelector<SVGPathElement>('#dpw1');
    const p2 = svg.querySelector<SVGPathElement>('#dpw2');
    if (!p1 || !p2) return;

    const primaryColor  = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()  || (isDark ? '#38bdf8' : '#6366f1');
    const tertiaryColor = getComputedStyle(document.documentElement).getPropertyValue('--tertiary').trim() || (isDark ? '#0ea5e9' : '#a78bfa');
    p1.setAttribute('stroke', primaryColor || (isDark ? '#38bdf8' : '#6366f1'));
    p2.setAttribute('stroke', tertiaryColor || (isDark ? '#0ea5e9' : '#a78bfa'));

    const W = 400, H = 36, cy = H / 2;
    const targetAmp = isActive ? 12 : 2;

    const buildPath = (phase: number, amp: number) => {
      let d = '';
      for (let x = 0; x <= W; x += 3) {
        const y = cy + Math.sin(x * 0.04 + phase) * amp * (1 + Math.sin(x * 0.012) * 0.3);
        d += x === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
      }
      return d;
    };

    const tick = () => {
      ampRef.current += (targetAmp - ampRef.current) * 0.05;
      const noise = isActive ? (Math.random() - 0.5) * 2.5 : 0;
      phaseRef.current += isActive ? 0.065 : 0.012;
      p1.setAttribute('d', buildPath(phaseRef.current, ampRef.current + noise));
      p2.setAttribute('d', buildPath(phaseRef.current + 1.8, ampRef.current * 0.5));
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isActive, isDark]);

  return (
    <svg ref={svgRef} width="100%" height="36" viewBox="0 0 400 36" preserveAspectRatio="none" className="overflow-visible w-full">
      <path id="dpw2" strokeWidth="1.5" fill="none" strokeOpacity="0.4" strokeLinecap="round" />
      <path id="dpw1" strokeWidth="2"   fill="none" strokeOpacity="0.8" strokeLinecap="round" />
    </svg>
  );
});

// ─── IntelBar ─────────────────────────────────────────────────────────────────

const IntelBar = ({ value, color = 'bg-primary' }: { value: number; color?: string }) => (
  <div className="h-1 w-full rounded-full bg-outline-variant overflow-hidden">
    <motion.div
      className={`h-full rounded-full intel-bar ${color}`}
      initial={{ scaleX: 0 }}
      animate={{ scaleX: value / 100 }}
      style={{ transformOrigin: 'left' }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
    />
  </div>
);

// ─── ToggleSwitch ──────────────────────────────────────────────────────────────

const ToggleSwitch = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors ${
      on ? 'bg-primary border-primary' : 'bg-outline-variant border-outline-variant'
    }`}
  >
    <motion.span
      className="inline-block size-2.5 rounded-full bg-white shadow-sm"
      animate={{ x: on ? 14 : 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    />
  </button>
);

// ─── Dropdown ─────────────────────────────────────────────────────────────────

const Dropdown = <T extends string>({
  value, options, onChange, label, tooltip
}: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; tooltip?: string }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = options.find(o => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="group relative flex items-center gap-1.5 px-3 py-2 rounded-lg border border-outline-variant bg-surface-low text-label-sm font-semibold text-on-surface-variant hover:border-primary/50 hover:text-on-surface transition-all whitespace-nowrap"
      >
        {tooltip && <FloatingTooltip text={tooltip} />}
        <span className="text-[9px] font-bold text-outline uppercase tracking-wider mr-0.5">{label}</span>
        {current?.label}
        <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute top-[calc(100%+4px)] left-0 z-50 min-w-[140px] rounded-xl border border-outline-variant bg-surface/95 backdrop-blur-xl shadow-xl overflow-hidden"
          >
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full px-3.5 py-2.5 text-left text-label-sm font-medium hover:bg-primary/8 transition-colors ${
                  opt.value === value ? 'text-primary bg-primary/5' : 'text-on-surface-variant'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── SegmentedControl ─────────────────────────────────────────────────────────

const SegmentedControl = <T extends string | number>({
  options, value, onChange, label, tooltip
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
  tooltip?: string;
}) => (
  <div className="group relative flex items-center gap-1 px-3 py-2 rounded-lg border border-outline-variant bg-surface-low cursor-pointer">
    {tooltip && <FloatingTooltip text={tooltip} />}
    {label && <span className="text-[9px] font-bold text-outline uppercase tracking-wider mr-2">{label}</span>}
    <div className="flex items-center gap-0.5">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 text-label-xs font-bold rounded-md transition-all whitespace-nowrap ${
            value === opt.value
              ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
              : 'text-on-surface-variant hover:bg-primary/5 hover:text-on-surface border border-transparent'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  </div>
);

// ─── Call Intelligence Report ─────────────────────────────────────────────────

const CallIntelligenceReport = ({
  report, duration, onReplay,
}: {
  report: ScenarioReport;
  duration: string;
  onReplay: () => void;
}) => {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShown(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      className="h-full flex flex-col overflow-y-auto thin-scrollbar"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.5, ease: 'easeOut' }}
    >
      {/* Report header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-label-xs font-black uppercase tracking-[0.2em] text-on-surface">Call Intelligence Report</span>
        </div>
        <span className="text-label-xs font-medium text-on-surface-variant font-mono">{duration}</span>
      </div>

      <div className="space-y-4 flex-1">

        {/* Sentiment Arc */}
        <motion.div
          className="rounded-xl border border-outline-variant bg-surface-low/50 p-3.5 space-y-2.5"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.4 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              <span className="text-label-xs font-black uppercase tracking-[0.2em] text-primary">Sentiment Arc</span>
            </div>
            <div className="flex items-center gap-2 text-label-xs font-medium text-on-surface-variant">
              <span>Peak <span className="text-primary font-bold">{report.peakSentiment}%</span> @ {report.peakAt}</span>
              <span className="text-outline">·</span>
              <span>Final <span className="text-on-surface font-bold">{report.finalSentiment}%</span></span>
            </div>
          </div>
          <SentimentSparkline points={report.sentimentArc} animate={shown} />
          <div className="flex items-center justify-between text-label-xs text-on-surface-variant opacity-60">
            <span>Start</span>
            <span>Call duration</span>
            <span>End</span>
          </div>
        </motion.div>

        {/* Key Objection */}
        {report.keyObjection && (
          <motion.div
            className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 space-y-1.5"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.4 }}
          >
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="size-3 text-orange-400" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-400">Key Objection</span>
            </div>
            <p className="text-xs font-semibold text-on-surface">{report.keyObjection.text}</p>
            <div className="flex items-center gap-3 text-[9px] text-on-surface-variant">
              <span>@ {report.keyObjection.timestamp}</span>
              <span className="text-outline">·</span>
              <span className={`font-semibold ${report.keyObjection.confidence === 'High' ? 'text-orange-400' : 'text-yellow-400'}`}>
                {report.keyObjection.confidence} confidence
              </span>
            </div>
          </motion.div>
        )}

        {/* PTP Confidence */}
        {report.ptp ? (
          <motion.div
            className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2.5"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.4 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Handshake className="size-4 text-emerald-400" />
                <span className="text-label-xs font-black uppercase tracking-[0.2em] text-emerald-400">PTP Confidence</span>
              </div>
              <span className="text-body-sm font-bold text-emerald-400">{report.ptp.score}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-outline-variant overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-emerald-400"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: (report.ptp.score ?? 0) / 100 }}
                style={{ transformOrigin: 'left' }}
                transition={{ delay: 1.3, duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <p className="text-label-xs text-on-surface-variant leading-relaxed">{report.ptp.detail}</p>
          </motion.div>
        ) : (
          <motion.div
            className="rounded-xl border border-outline-variant bg-surface-low/30 p-4"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.4 }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Handshake className="size-3.5 text-on-surface-variant" />
              <span className="text-label-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">PTP Confidence</span>
            </div>
            <p className="text-label-xs text-on-surface-variant">Not applicable for this call type.</p>
          </motion.div>
        )}

        {/* Next Best Action */}
        <motion.div
          className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2.5"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.4 }}
        >
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-primary" />
            <span className="text-label-xs font-black uppercase tracking-[0.2em] text-primary">Next Best Action</span>
          </div>
          <ul className="space-y-1.5">
            {report.nextBestAction.map((action, i) => (
              <li key={i} className="flex items-start gap-2 text-label-sm text-on-surface-variant">
                <ArrowRight className="size-3 text-primary shrink-0 mt-0.5" />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Call quality score */}
        <motion.div
          className="flex items-center justify-between px-3 py-2 rounded-xl border border-outline-variant bg-surface-low/50"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.4 }}
        >
          <span className="text-[9px] font-medium text-on-surface-variant uppercase tracking-wide">Call Quality Score</span>
          <div className="flex items-center gap-1.5">
            <div className="h-1 w-20 rounded-full bg-outline-variant overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: report.callScore / 100 }}
                style={{ transformOrigin: 'left' }}
                transition={{ delay: 1.7, duration: 0.7 }}
              />
            </div>
            <span className="text-xs font-bold text-primary">{report.callScore}/100</span>
          </div>
        </motion.div>
      </div>

      {/* Action buttons */}
      <motion.div
        className="flex items-center gap-2 pt-3 mt-auto border-t border-outline-variant"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ delay: 1.8, duration: 0.3 }}
      >
        <button
          onClick={onReplay}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/25 text-label-sm font-bold text-primary hover:bg-primary/20 transition-all"
        >
          <RotateCcw className="size-4" /> Replay Call
        </button>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-outline-variant text-label-sm font-semibold text-on-surface-variant hover:border-outline hover:text-on-surface transition-all">
          <FileText className="size-4" /> Export Report
        </button>
      </motion.div>
    </motion.div>
  );
};

// ─── CallDemoPanel ────────────────────────────────────────────────────────────

export const CallDemoPanel: React.FC<{ className?: string; selectedAgent?: any }> = ({ className = '', selectedAgent }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [isRunning,         setIsRunning]         = useState(false);
  const [isStarting,        setIsStarting]        = useState(false);
  const [isPaused,          setIsPaused]          = useState(false);
  const [callEnded,         setCallEnded]         = useState(false);
  const [scenario, setScenario] = useState<ScenarioKey>('debt');
  const [language, setLanguage] = useState<LangKey>('hinglish');
  const [tone,     setTone]     = useState<ToneKey>('empathetic');
  const [voiceProfile, setVoiceProfile] = useState(VOICE_PROFILES[0].value);
  const [editablePrompt, setEditablePrompt] = useState(SCENARIOS.debt.systemPrompt);
  const [transcript,        setTranscript]        = useState<Message[]>([]);
  const [msgIndex,          setMsgIndex]          = useState(0);
  const [sentiment,         setSentiment]         = useState(0);
  const [propensity,        setPropensity]        = useState(0);
  const [complianceActive,  setComplianceActive]  = useState(true);
  const [highlightsActive,  setHighlightsActive]  = useState(true);
  const [callDuration,      setCallDuration]      = useState(0);
  const [durationStr,       setDurationStr]       = useState('00:00');
  const [userHasScrolled,   setUserHasScrolled]   = useState(false);
  const [stressLevel,       setStressLevel]       = useState<'low'|'high'>('low');
  const [latency,           setLatency]           = useState<number>(0);
  const [regionalNuance,    setRegionalNuance]    = useState<string>('urban_delhi');
  const [isHandoffEnabled,  setIsHandoffEnabled]  = useState(false);
  const [handoffTriggered,  setHandoffTriggered]  = useState(false);

  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Agent change logic
  useEffect(() => {
    if (!selectedAgent) return;

    // Map agent ID to scenario
    const mapping: Record<string, ScenarioKey> = {
      astra: 'debt',
      nova: 'kyc',
      midas: 'fraud',
      luna: 'loan',
      apex: 'debt', // Default to debt for now
    };

    const targetScenario = mapping[selectedAgent.id] || 'debt';
    
    // Reset call state
    setScenario(targetScenario);
    setEditablePrompt(SCENARIOS[targetScenario].systemPrompt);
    setTranscript([]);
    setMsgIndex(0);
    setIsRunning(false);
    setIsPaused(false);
    setCallEnded(false);
    setSentiment(0);
    setPropensity(0);
    setCallDuration(0);
    setHandoffTriggered(false);
  }, [selectedAgent?.id]);

  const sc = SCENARIOS[scenario];

  // Timer
  useEffect(() => {
    if (!isRunning || isPaused || callEnded) return;
    const t = setInterval(() => setCallDuration(d => d + 1), 1000);
    return () => clearInterval(t);
  }, [isRunning, isPaused, callEnded]);

  useEffect(() => {
    const m = Math.floor(callDuration / 60).toString().padStart(2, '0');
    const s = (callDuration % 60).toString().padStart(2, '0');
    setDurationStr(`${m}:${s}`);
  }, [callDuration]);

  // Auto-advance transcript
  useEffect(() => {
    if (!isRunning || isPaused || callEnded) return;
    
    const currentTranscript = stressLevel === 'high' ? sc.hardTranscript : sc.transcript;

    if (msgIndex >= currentTranscript.length) {
       if (isHandoffEnabled && !handoffTriggered) {
          const timer = setTimeout(() => {
            setTranscript(prev => [...prev, { speaker: 'system', text: '⚠ Escalating to Human Supervisor...' }]);
            setHandoffTriggered(true);
            setIsRunning(false);
            setCallEnded(true);
          }, 1500 + latency);
          return () => clearTimeout(timer);
       } else if (!isHandoffEnabled) {
          setIsRunning(false);
          setCallEnded(true);
       }
       return;
    }

    const msg = currentTranscript[msgIndex];
    const baseDelay = msg.speaker === 'system' ? 700 : 1900;
    const delay = msg.speaker === 'system' ? baseDelay : baseDelay + latency;

    const t = setTimeout(() => {
      setTranscript(prev => [...prev, msg]);
      setMsgIndex(i => i + 1);

      if (msg.speaker === 'bot') {
        setSentiment(s => Math.min(95, s + Math.floor(Math.random() * 6) + 3));
        setPropensity(p => Math.min(92, p + Math.floor(Math.random() * 4)));
      }
      if (msg.compliance) {
        setSentiment(s => Math.min(98, s + 8));
        setPropensity(p => Math.min(98, p + 12));
      }
    }, delay);

    return () => clearTimeout(t);
  }, [msgIndex, isRunning, isPaused, callEnded, sc, stressLevel, latency, isHandoffEnabled, handoffTriggered]);

  // Auto-scroll logic
  useEffect(() => {
    if (!userHasScrolled && isRunning && transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTo({
        top: transcriptContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [transcript.length, userHasScrolled, isRunning]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    // Buffer of 10px to account for rounding/scaling
    const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 10;
    if (userHasScrolled !== !isAtBottom) {
      setUserHasScrolled(!isAtBottom);
    }
  };

  const handleEndCall = useCallback(() => {
    setIsRunning(false);
    setCallEnded(true);
  }, []);

  const handleRestart = useCallback(() => {
    setCallEnded(false);
    setTranscript([]);
    setMsgIndex(0);
    setIsRunning(true);
    setIsPaused(false);
    setSentiment(42);
    setPropensity(35);
    setCallDuration(0);
    setHandoffTriggered(false);
  }, []);

  const handleStartCall = useCallback(() => {
    setIsStarting(true);
    setTimeout(() => {
      setIsStarting(false);
      handleRestart();
    }, 1500);
  }, [handleRestart]);

  const handleScenarioChange = useCallback((s: ScenarioKey) => {
    setScenario(s);
    setTranscript([]);
    setMsgIndex(0);
    setCallEnded(false);
    setIsRunning(true);
    setIsPaused(false);
    setSentiment(42);
    setPropensity(35);
    setCallDuration(0);
    setHandoffTriggered(false);
  }, []);

  const handleBargeIn = useCallback(() => {
    const interruptMsg: Message = {
      speaker: 'user',
      text: 'Ruko! Main bolna chahta hoon.',
      lang: 'hindi',
    };
    setTranscript(prev => [...prev, interruptMsg]);
    setPropensity(p => Math.max(0, p - 8));
  }, []);

  const cardCls = `rounded-2xl border ${isDark ? 'bg-surface/70 border-outline' : 'bg-surface/80 border-outline-variant shadow-sm'}`;

  const intentLabel = msgIndex > 3 ? sc.intent : 'Detecting...';

  return (
    <div 
      onWheel={(e) => e.stopPropagation()}
      data-lenis-prevent
      className={`flex flex-col h-full ${className}`}
    >

      {/* ── Header ── */}
      <div className={`demo-header flex items-center justify-between px-5 py-3.5 rounded-xl border mb-4 ${
        callEnded
          ? (isDark ? 'bg-red-500/8 border-red-500/20' : 'bg-red-50 border-red-200')
          : (isDark ? 'bg-surface/60 border-outline' : 'bg-surface/80 border-outline-variant shadow-sm')
      }`}>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 ${callEnded ? 'opacity-60' : ''}`}>
            <div className={`size-2.5 rounded-full ${callEnded ? 'bg-red-500' : 'bg-emerald-400 animate-pulse'}`} />
            <span className={`text-label-sm font-black uppercase tracking-[0.2em] ${callEnded ? 'text-red-400' : 'text-emerald-400'}`}>
              {callEnded ? 'Call Ended' : isPaused ? 'Paused' : 'Live Call'}
            </span>
          </div>
          <span className="text-outline/50">·</span>
          <span className="text-label-sm font-bold text-on-surface">
            {selectedAgent?.name || sc.agent} — {selectedAgent?.role || sc.label}
          </span>
          <span className="text-outline/50">·</span>
          <span className="text-label-sm font-mono tabular-nums text-on-surface-variant">{durationStr}</span>
          <span className="text-outline/50">·</span>
          <span className="text-label-xs font-bold text-on-surface-variant bg-surface-high px-3 py-1 rounded-full border border-outline-variant">
            {selectedAgent?.languages || sc.langLabel}
          </span>
        </div>
        <button
          onClick={callEnded || (!isRunning && !isStarting) ? handleStartCall : handleEndCall}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-label-sm font-black uppercase tracking-wider transition-all ${
            callEnded || (!isRunning && !isStarting)
              ? 'bg-primary/10 border border-primary/25 text-primary hover:bg-primary/20 disabled:opacity-50'
              : 'bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20'
          }`}
          disabled={isStarting}
        >
          {isStarting ? (
            <><RotateCcw className="size-3.5 animate-spin" /> Connecting...</>
          ) : callEnded || !isRunning ? (
            <><Phone className="size-3.5" /> Start Simulation</>
          ) : (
            <><PhoneOff className="size-3.5" /> End Call</>
          )}
        </button>
      </div>

      {/* ── 2-column body ── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* Left column: Pipeline + Intel */}
        <div className="w-64 shrink-0 flex flex-col gap-4">

          {/* Pipeline */}
          <div className={`${cardCls} p-4 space-y-2`}>
            <p className="text-label-xs font-black uppercase tracking-[0.2em] text-on-surface-variant mb-3">Core Pipeline</p>

            {[
              { icon: <Mic className="size-4" />, label: 'STT', ms: 45, cls: 'pipe-step' },
              { icon: <Brain className="size-4" />, label: 'LLM', ms: 280, cls: 'pipe-step' },
              { icon: <Volume2 className="size-4" />, label: 'TTS', ms: 120, cls: 'pipe-step' },
            ].map((step, i) => (
              <div key={step.label}>
                <div className={`flex items-center justify-between ${step.cls}`}>
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    {step.icon}
                    <span className="text-label-sm font-semibold">{step.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="pipe-latency text-label-sm font-mono font-bold text-primary tabular-nums">
                      {isRunning ? `${step.ms}ms` : '--'}
                    </span>
                    {isRunning && (
                      <motion.span
                        className="text-emerald-400 text-xs"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 + i * 0.2 }}
                      >✓</motion.span>
                    )}
                  </div>
                </div>
                {i < 2 && <div className="w-px h-2.5 bg-outline-variant/60 ml-[7px] my-0.5" />}
              </div>
            ))}

            <div className="border-t border-outline-variant pt-3 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-label-xs font-bold text-on-surface-variant">E2E LATENCY</span>
                <span className="text-label-sm font-mono font-black text-primary">
                  {isRunning ? '445ms ✓' : 'IDLE'}
                </span>
              </div>
              <div className="text-[10px] text-on-surface-variant mt-1">Target &lt;800ms · <span className="text-emerald-400 font-bold">{isRunning ? '44% headroom' : 'Ready'}</span></div>
            </div>
          </div>

          {/* Live Intel */}
          <div className={`${cardCls} p-4 space-y-4 flex-1`}>
            <p className="text-label-xs font-black uppercase tracking-[0.2em] text-on-surface-variant mb-1">Live Intel</p>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-label-sm">
                <span className="text-on-surface-variant">Sentiment</span>
                <span className="font-black text-primary">{sentiment}%</span>
              </div>
              <IntelBar value={sentiment} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-label-sm">
                <span className="text-on-surface-variant">Propensity</span>
                <span className="font-black text-secondary">{propensity}%</span>
              </div>
              <IntelBar value={propensity} color="bg-secondary" />
            </div>

            <div className="space-y-2.5 pt-2 border-t border-outline-variant">
              <div className="flex items-center justify-between text-label-sm">
                <span className="text-on-surface-variant">Intent</span>
                <span className="font-bold text-on-surface">{isRunning ? intentLabel : 'Idle'}</span>
              </div>
              <div className="flex items-center justify-between text-label-sm">
                <span className="text-on-surface-variant">Compliance</span>
                <span className={`font-black ${complianceActive ? 'text-emerald-400' : 'text-on-surface-variant opacity-60'}`}>
                  {complianceActive ? '✓ ACTIVE' : 'DISABLED'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <AnimatePresence mode="wait">
            {callEnded ? (
              <motion.div
                key="report"
                className={`flex-1 ${cardCls} p-5`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <CallIntelligenceReport
                  report={sc.report}
                  duration={durationStr}
                  onReplay={handleRestart}
                />
              </motion.div>
            ) : (
              <motion.div key="live" className="flex-1 flex flex-col gap-3 min-h-0" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>

                <div 
                  ref={transcriptContainerRef}
                  onScroll={handleScroll}
                  onWheel={(e) => e.stopPropagation()}
                  data-lenis-prevent
                  className={`${cardCls} flex-1 overflow-y-auto no-scrollbar p-5 relative min-h-[350px] max-h-[350px]`}
                >
                  <AnimatePresence mode="wait">
                    {!isRunning && transcript.length === 0 ? (
                      <motion.div
                        key="splash"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="h-full min-h-[300px] flex flex-col items-center justify-center p-6 text-center"
                      >
                        <AnimatePresence mode="wait">
                          {isStarting ? (
                            <motion.div
                              key="loader"
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 1.1 }}
                              className="flex flex-col items-center gap-5"
                            >
                              <div className="relative size-20 flex items-center justify-center">
                                <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                                <Mic className="size-8 text-primary" />
                              </div>
                              <div className="space-y-1.5">
                                <p className="text-body-base font-black text-on-surface tracking-tight">Connecting to {sc.agent}...</p>
                                <p className="text-label-sm text-on-surface-variant animate-pulse font-medium">Initializing neural voice engine</p>
                              </div>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="ready"
                              initial={{ opacity: 0, y: 15 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-surface/40 backdrop-blur-sm rounded-3xl border border-outline-variant p-8 flex flex-col items-center gap-6 w-full max-w-[320px]"
                            >
                              <div className="size-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary">
                                <Phone className="size-7" />
                              </div>
                              <div className="space-y-2">
                                <h4 className="text-label-sm font-black text-on-surface uppercase tracking-[0.2em]">Simulation Ready</h4>
                                <p className="text-label-sm text-on-surface-variant leading-relaxed">
                                  Voice engine calibrated for <strong>{sc.agent}</strong>. Adjust parameters or start simulation.
                                </p>
                              </div>
                              <button
                                onClick={handleStartCall}
                                className="w-full py-3.5 rounded-xl bg-primary text-on-primary-fixed text-label-sm font-black uppercase tracking-widest shadow-xl shadow-primary/30 hover:brightness-110 active:scale-95 transition-all"
                              >
                                Start Simulation
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="transcript"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-3.5"
                      >
                        {transcript.map((msg, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35 }}
                            className={`flex ${msg.speaker === 'user' ? 'justify-end' : msg.speaker === 'system' ? 'justify-center' : 'justify-start'}`}
                          >
                            {msg.speaker === 'system' ? (
                              <div className={`px-4 py-1.5 rounded-full text-label-xs font-bold border tracking-wide ${
                                msg.compliance
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                  : 'bg-surface-high border-outline-variant text-on-surface-variant'
                              }`}>
                                {msg.text}
                              </div>
                            ) : msg.speaker === 'user' ? (
                              <div className="max-w-[70%] px-4 py-3 rounded-2xl rounded-br-sm bg-primary text-on-primary-fixed text-body-base leading-relaxed shadow-lg shadow-primary/10">
                                {msg.text}
                              </div>
                            ) : (
                              <div className={`max-w-[75%] px-4 py-3 rounded-2xl rounded-bl-sm text-body-base leading-relaxed border-l-4 ${
                                msg.compliance && complianceActive
                                  ? 'bg-emerald-500/8 border-l-emerald-400 border border-emerald-500/20 text-on-surface font-medium'
                                  : isDark
                                  ? 'bg-surface-high border-l-primary border border-outline-variant text-on-surface'
                                  : 'bg-surface-low border-l-primary border border-outline-variant text-on-surface shadow-sm'
                              }`}>
                                {highlightsActive
                                  ? <span dangerouslySetInnerHTML={{ __html: msg.text.replace(/(₹[\d,]+|PTP|compliance|verified|confirmed|SMS|payment)/gi, '<strong class="text-primary font-bold">$1</strong>') }} />
                                  : msg.text
                                }
                                {msg.lang && msg.lang !== 'system' && (
                                  <span className="ml-2 text-label-xs text-outline font-bold">[{msg.lang.toUpperCase()}]</span>
                                )}
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div ref={transcriptEndRef} />
                </div>

                {/* Waveform strip */}
                <div className={`wave-strip ${cardCls} px-4 py-2.5 flex items-center gap-4`}>
                  <Mic className="size-4 text-primary shrink-0" />
                  <DemoPanelWaveform isActive={isRunning && !isPaused} isDark={isDark} />
                </div>

                {/* Controls */}
                <div className={`demo-controls ${cardCls} p-4 space-y-4`}>
                  {/* Row 1: Dropdowns */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Dropdown<ScenarioKey>
                      label="Scenario" value={scenario}
                      tooltip="Select the core call objective for the AI to handle."
                      options={[
                        { value: 'debt',  label: 'Debt Recovery' },
                        { value: 'kyc',   label: 'KYC Onboarding' },
                        { value: 'fraud', label: 'Fraud Alert' },
                        { value: 'loan',  label: 'Loan Query' },
                      ]}
                      onChange={(v) => { handleScenarioChange(v); }}
                    />
                    <Dropdown<LangKey>
                      label="Lang" value={language}
                      tooltip="Base language spoken by the customer and AI."
                      options={[
                        { value: 'hinglish', label: 'Hinglish' },
                        { value: 'hindi',    label: 'Hindi' },
                        { value: 'english',  label: 'English' },
                      ]}
                      onChange={setLanguage}
                    />
                    <Dropdown<ToneKey>
                      label="Tone" value={tone}
                      tooltip="Adjust the agent's primary communication style and emotional delivery."
                      options={[
                        { value: 'empathetic', label: 'Empathetic' },
                        { value: 'neutral',    label: 'Neutral' },
                        { value: 'firm',       label: 'Firm' },
                      ]}
                      onChange={setTone}
                    />
                    <Dropdown<string>
                      label="Persona" value={voiceProfile}
                      tooltip="Select the exact sonic persona used to generate audio."
                      options={VOICE_PROFILES}
                      onChange={setVoiceProfile}
                    />
                  </div>

                  {/* Row 1.5: Neural Precision & Stress */}
                  <div className="flex items-center gap-3 flex-wrap pb-1 z-10 relative">
                    <SegmentedControl<'low' | 'high'>
                      label="Mood" value={stressLevel}
                      tooltip="Switch to difficult to simulate an angry or financially stressed customer, testing the AI's empathy and de-escalation skills."
                      options={[{ label: 'Easy', value: 'low' }, { label: 'Hard', value: 'high' }]}
                      onChange={setStressLevel}
                    />
                    <SegmentedControl<number>
                      label="Network" value={latency}
                      tooltip="Injects artificial delay to test how conversational flow feels under 4G or poor network conditions."
                      options={[{ label: 'Fast', value: 0 }, { label: '4G', value: 800 }, { label: 'Poor', value: 2500 }]}
                      onChange={setLatency}
                    />
                    <AnimatePresence>
                      {language === 'hinglish' && (
                        <motion.div
                          initial={{ opacity: 0, width: 0, scale: 0.9 }}
                          animate={{ opacity: 1, width: 'auto', scale: 1 }}
                          exit={{ opacity: 0, width: 0, scale: 0.9 }}
                          className="flex items-center"
                        >
                          <Dropdown<string>
                            label="Accent" value={regionalNuance}
                            tooltip="Specific regional dialects test the AI's language comprehension limits."
                            options={[
                              { value: 'bambaiya', label: 'Bambaiya' },
                              { value: 'urban_delhi', label: 'Urban Delhi' },
                              { value: 'traditional', label: 'Traditional' },
                            ]}
                            onChange={setRegionalNuance}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Neural Prompt Editor */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-label-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">
                        <FileText className="size-4 text-primary" />
                        Neural Context Overlay
                      </div>
                      <div className="flex items-center gap-1.5">
                        {["Strict Compliance", "High Empathy", "Direct"].map(tag => (
                          <button
                            key={tag}
                            onClick={() => {
                              const s = tag === "Strict Compliance" ? "Follow banking regulation #DB-42 scripts to the letter. Do not deviate from the verify-and-commit protocol." :
                                        tag === "High Empathy" ? "Prioritize customer wellbeing. Be extremely flexible with payment terms and use calming language." :
                                        "Focus on speed and risk mitigation. Block cards first, explain later. Maximum urgency.";
                              setEditablePrompt(s);
                            }}
                            className="px-2 py-1 rounded-lg bg-surface-high border border-outline-variant text-[8px] font-black uppercase text-on-surface-variant hover:text-primary hover:border-primary/50 transition-all"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      value={editablePrompt}
                      onChange={(e) => setEditablePrompt(e.target.value)}
                      className="w-full h-16 bg-surface-low border border-outline-variant rounded-xl p-3 text-label-sm text-on-surface-variant font-mono focus:border-primary/50 focus:ring-2 focus:ring-primary/10 outline-none resize-none thin-scrollbar leading-relaxed"
                      placeholder="Enter system instructions..."
                    />
                  </div>

                  {/* Row 2: Action buttons + toggles */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                      onClick={handleBargeIn}
                      className="group relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-primary/30 bg-primary/8 text-label-sm font-bold text-primary hover:bg-primary/15 transition-all"
                    >
                      <FloatingTooltip text="Instantly interrupt the AI to test its rapid context-switching capabilities." />
                      <Zap className="size-3.5" /> Barge-in
                    </button>
                    <button
                      onClick={handleRestart}
                      className={`group relative flex items-center gap-1.5 px-4 py-2 rounded-xl border font-black text-label-xs uppercase tracking-widest transition-all shadow-sm ${
                        !isRunning && transcript.length > 0 
                          ? 'bg-primary text-on-primary-fixed border-primary hover:brightness-110 shadow-primary/20' 
                          : 'border-outline-variant text-on-surface-variant hover:border-outline hover:text-on-surface'
                      }`}
                    >
                      <FloatingTooltip text={transcript.length > 0 ? "Apply new settings and restart the simulation." : "Reset simulation state."} />
                      <RotateCcw className="size-3.5" /> {transcript.length > 0 ? "RESTART" : "RESET"}
                    </button>
                    <button
                      onClick={() => setIsPaused(p => !p)}
                      className="group relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-outline-variant text-label-sm font-bold text-on-surface-variant hover:border-outline hover:text-on-surface transition-all"
                    >
                      <FloatingTooltip text={isPaused ? "Resume the simulation feed." : "Pause the current simulation step."} />
                      {isPaused ? <><Play className="size-3.5" /> Resume</> : <><Pause className="size-3.5" /> Pause</>}
                    </button>

                    <div className="ml-auto flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer select-none group relative">
                        <FloatingTooltip text="Visually highlights strict regulatory compliance statements made by the AI." />
                        <ToggleSwitch on={complianceActive} onToggle={() => setComplianceActive(v => !v)} />
                        <span className="text-label-xs text-on-surface-variant font-bold uppercase tracking-wider">Compliance</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none group relative">
                        <FloatingTooltip text="Dynamically spotlights extracted entities like amounts and confirmation actions." />
                        <ToggleSwitch on={highlightsActive} onToggle={() => setHighlightsActive(v => !v)} />
                        <span className="text-label-xs text-on-surface-variant font-bold uppercase tracking-wider">Highlights</span>
                      </label>
                      <div className="w-px h-4 bg-outline-variant mx-1" />
                      <label className="flex items-center gap-2 cursor-pointer select-none group relative">
                        <FloatingTooltip text="Triggers an automatic escalation to a human supervisor if the AI cannot resolve the request." />
                        <ToggleSwitch on={isHandoffEnabled} onToggle={() => setIsHandoffEnabled(v => !v)} />
                        <span className="text-label-xs text-on-surface-variant font-bold uppercase tracking-wider">Handoff</span>
                      </label>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
