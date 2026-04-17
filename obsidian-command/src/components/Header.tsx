import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Search, ChevronUp, ChevronDown, X,
  PhoneOff, CheckCircle, Trash2, Bot, GitBranch,
} from 'lucide-react';
import { useNotifications, AppNotification } from '../contexts/NotificationContext';
import { cn } from '../lib/utils';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  hideGlass?: boolean;
}

/* ─── Find-in-page helpers ───────────────────────────────────────── */
const HIGHLIGHT_CLASS = '__find-highlight__';
const ACTIVE_CLASS = '__find-highlight-active__';

function clearHighlights() {
  document.querySelectorAll(`mark.${HIGHLIGHT_CLASS}`).forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
    parent.normalize();
  });
}

function highlightAll(term: string): Element[] {
  clearHighlights();
  if (!term.trim()) return [];
  const results: Element[] = [];
  const main = document.querySelector('main');
  if (!main) return [];
  const walk = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName.toLowerCase();
      if (['script', 'style', 'noscript', 'mark'].includes(tag)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes: Text[] = [];
  let n: Node | null;
  while ((n = walk.nextNode())) nodes.push(n as Text);
  const lowerTerm = term.toLowerCase();
  nodes.forEach((textNode) => {
    const text = textNode.textContent || '';
    const lowerText = text.toLowerCase();
    let idx = lowerText.indexOf(lowerTerm);
    if (idx === -1) return;
    const frag = document.createDocumentFragment();
    let lastIdx = 0;
    while (idx !== -1) {
      if (idx > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, idx)));
      const mark = document.createElement('mark');
      mark.className = HIGHLIGHT_CLASS;
      mark.textContent = text.slice(idx, idx + term.length);
      results.push(mark);
      frag.appendChild(mark);
      lastIdx = idx + term.length;
      idx = lowerText.indexOf(lowerTerm, lastIdx);
    }
    if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)));
    textNode.parentNode?.replaceChild(frag, textNode);
  });
  return results;
}

/* ─── Time helper ───────────────────────────────────────────────── */
function timeAgo(ms: number) {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/* ─── Notification Item ─────────────────────────────────────────── */
function NotifItem({
  n,
  onDismiss,
  onNavigate,
}: {
  n: AppNotification;
  onDismiss: () => void;
  onNavigate: (path: string) => void;
}) {
  const iconMap = {
    session_completed: { Icon: PhoneOff, accent: 'text-amber-400', bg: 'bg-amber-400/10' },
    bot_created: { Icon: Bot, accent: 'text-violet-400', bg: 'bg-violet-400/10' },
    workflow_created: { Icon: GitBranch, accent: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  };
  const { Icon, accent, bg } = iconMap[n.type];

  const handleClick = () => {
    if (n.type === 'session_completed') {
      onNavigate(`/sessions/${n.refId}`);
    } else if (n.type === 'bot_created') {
      onNavigate('/personas');
    } else if (n.type === 'workflow_created') {
      onNavigate('/workflows');
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`flex items-start gap-3 p-3 rounded-2xl transition-all cursor-pointer hover:bg-surface-high/50 ${!n.read ? 'bg-primary/5' : ''}`}
    >
      <div className={`size-9 shrink-0 rounded-xl flex items-center justify-center ${bg}`}>
        <Icon className={`size-4 ${accent}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-bold text-on-surface leading-tight truncate">{n.title}</p>
          {!n.read && <span className="size-1.5 rounded-full bg-primary shrink-0" />}
        </div>
        <p className="text-[11px] text-outline leading-snug mt-0.5">{n.body}</p>
        <p className="text-[10px] text-outline/60 mt-1">{timeAgo(n.timestamp)}</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        className="shrink-0 p-1 rounded-lg hover:bg-surface-highest text-outline hover:text-on-surface transition-all"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

/* ─── Header Component ──────────────────────────────────────────── */
export function Header({ title, subtitle, actions, className, hideGlass }: HeaderProps) {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllRead, dismiss, clearAll } = useNotifications();
  const [bellOpen, setBellOpen] = React.useState(false);
  const bellRef = React.useRef<HTMLDivElement>(null);

  // Find-in-page state
  const [query, setQuery] = React.useState('');
  const [matches, setMatches] = React.useState<Element[]>([]);
  const [activeIdx, setActiveIdx] = React.useState(-1);
  const [focused, setFocused] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Inject highlight styles once
  React.useEffect(() => {
    const id = 'find-highlight-style';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `
        mark.${HIGHLIGHT_CLASS} { background:rgba(251,191,36,.55);color:inherit;border-radius:2px;padding:0 1px; }
        mark.${ACTIVE_CLASS}    { background:rgba(251,146,60,.85);outline:2px solid rgba(251,146,60,.9); }
      `;
      document.head.appendChild(style);
    }
    return () => clearHighlights();
  }, []);

  // Close bell popover on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Mark all read when popover opens
  React.useEffect(() => {
    if (bellOpen) markAllRead();
  }, [bellOpen, markAllRead]);

  // Ctrl/Cmd+F shortcut
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === 'Escape') { clearFindAll(); inputRef.current?.blur(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function activateMatch(list: Element[], idx: number) {
    list.forEach((el, i) => el.classList.toggle(ACTIVE_CLASS, i === idx));
    list[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function runSearch(term: string) {
    const found = highlightAll(term);
    setMatches(found);
    if (found.length > 0) { setActiveIdx(0); activateMatch(found, 0); }
    else setActiveIdx(-1);
  }

  function navigateFind(dir: 1 | -1) {
    if (!matches.length) return;
    const next = (activeIdx + dir + matches.length) % matches.length;
    setActiveIdx(next);
    activateMatch(matches, next);
  }

  function clearFindAll() {
    clearHighlights(); setQuery(''); setMatches([]); setActiveIdx(-1);
  }

  return (
    <header className={cn(
      !hideGlass && "glass-panel",
      "border-b border-outline-variant/10 sticky top-0 z-50",
      className
    )}>
      <div className="px-4 sm:px-6 lg:px-10 h-16 sm:h-[72px] flex items-center justify-between gap-4">

        {/* Title */}
        <div className="flex flex-col">
          {subtitle && (
            <span className="text-[10px] uppercase tracking-[0.2em] text-outline font-bold leading-none mb-0.5">
              {subtitle}
            </span>
          )}
          <h2 className="font-headline text-xl lg:text-2xl font-extrabold text-on-surface tracking-tight leading-tight">
            {title}
          </h2>
        </div>

        {/* Utilities */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">

          {/* Find-in-page */}
          <div className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all ${focused ? 'border-primary/40 bg-surface-container shadow-md shadow-primary/10' : 'border-outline-variant/5 bg-surface-container'}`}>
            <Search className="size-4 text-outline shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              placeholder="Find in page…"
              className="bg-transparent border-none focus:ring-0 text-sm w-36 xl:w-52 placeholder:text-outline outline-none"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(e) => { setQuery(e.target.value); runSearch(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigateFind(e.shiftKey ? -1 : 1);
                if (e.key === 'Escape') { clearFindAll(); (e.target as HTMLElement).blur(); }
              }}
            />
            {query && (
              <span className="text-[11px] text-outline tabular-nums whitespace-nowrap min-w-[44px] text-center">
                {matches.length === 0 ? 'No match' : `${activeIdx + 1}/${matches.length}`}
              </span>
            )}
            {matches.length > 0 && (
              <>
                <button onClick={() => navigateFind(-1)} className="p-0.5 rounded hover:bg-surface-high text-outline hover:text-primary transition-all" title="Previous"><ChevronUp className="size-4" /></button>
                <button onClick={() => navigateFind(1)} className="p-0.5 rounded hover:bg-surface-high text-outline hover:text-primary transition-all" title="Next"><ChevronDown className="size-4" /></button>
              </>
            )}
            {query && <button onClick={clearFindAll} className="p-0.5 rounded hover:bg-surface-high text-outline hover:text-primary transition-all"><X className="size-3.5" /></button>}
          </div>

          {/* Bell + Notification Popover */}
          <div ref={bellRef} className="relative">
            <button
              onClick={() => setBellOpen(v => !v)}
              className="relative size-9 sm:size-10 flex items-center justify-center rounded-xl bg-surface-high hover:bg-surface-highest transition-all border border-outline-variant/10 shrink-0"
            >
              <Bell className="size-4 sm:size-5 text-on-surface-variant" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full ember-gradient text-[10px] font-bold text-white px-1 animate-pulse shadow-lg">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Popover */}
            {bellOpen && (
              <div className="absolute right-0 top-[calc(100%+10px)] bg-white w-80 glass-panel rounded-2xl border border-outline-variant/10 shadow-2xl shadow-black/30 z-100 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/10">
                  <div className="flex items-center gap-2">
                    <Bell className="size-4 text-primary" />
                    <span className="font-bold text-sm">Notifications</span>
                    {notifications.length > 0 && (
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                        {notifications.length}
                      </span>
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAll}
                      className="flex items-center gap-1 text-[11px] text-outline hover:text-on-surface transition-all"
                    >
                      <Trash2 className="size-3" />
                      Clear all
                    </button>
                  )}
                </div>

                {/* List */}
                <div className="max-h-80 overflow-y-auto p-2 flex flex-col gap-1">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 text-outline">
                      <CheckCircle className="size-8 opacity-30" />
                      <p className="text-xs font-bold">All caught up!</p>
                      <p className="text-[11px] opacity-60">Notifications appear here when sessions start or finish.</p>
                    </div>
                  ) : (
                    notifications.map(n => (
                      <React.Fragment key={n.id}>
                        <NotifItem
                          n={n}
                          onDismiss={() => dismiss(n.id)}
                          onNavigate={(path) => { setBellOpen(false); navigate(path); }}
                        />
                      </React.Fragment>
                    ))
                  )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                  <div className="px-4 py-2 border-t border-outline-variant/10 text-center">
                    <p className="text-[10px] text-outline/50">Polls every 20s · Shows last 60 events</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Avatar */}
          <div
            onClick={() => navigate('/profile')}
            className="size-9 sm:size-10 rounded-full border border-primary/20 p-0.5 shrink-0 cursor-pointer hover:border-primary/50 transition-colors"
          >
            <img
              src="https://picsum.photos/seed/admin/100/100"
              alt="Avatar"
              className="w-full h-full rounded-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Row 2: actions */}
      {actions && (
        <div className="px-4 sm:px-6 lg:px-10 py-2.5 border-t border-outline-variant/8 bg-surface-low/40 flex items-center justify-end gap-2 sm:gap-3 flex-wrap">
          {actions}
        </div>
      )}
    </header>
  );
}
