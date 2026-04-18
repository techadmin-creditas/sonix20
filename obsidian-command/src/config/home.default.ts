import type { HomePageConfig } from './home.types';

export const defaultConfig: HomePageConfig = {
  tenantId: 'sonix-default',
  tenantName: 'Sonix AI',
  industry: 'fintech',

  branding: {
    logoText: 'SONIX',
    logoVersion: '2.0',
    themeBrand: 'neuralSlate',
    themeMode: 'dark',
  },

  header: {
    navLinks: [
      { label: 'Features',  sectionIndex: 2 },
      { label: 'Agents',    sectionIndex: 1 },
      // { label: 'Pricing' },
    ],
    ctaButton: { text: 'Login', href: '/login' },
  },

  agents: {
    featuredIds: ['astra', 'midas', 'luna', 'nova', 'apex'],
    defaultDemoId: 'astra',
    customizations: {},
  },

  sections: {
    hero: {
      badge: 'AI Voice Platform',
      industryTabs: [
        {
          key: 'banking',
          label: 'Banking',
          headlineAccent: 'Banking Operations',
          subheadline: 'Serve 10x more customers with sub-800ms AI agents trained for banking compliance.',
        },
        {
          key: 'collections',
          label: 'Collections',
          headlineAccent: 'Debt Recovery',
          subheadline: 'Recover outstanding payments empathetically with AI agents that close PTP in one call.',
        },
        {
          key: 'insurance',
          label: 'Insurance',
          headlineAccent: 'Insurance Services',
          subheadline: 'Handle claims, renewals, and KYC with compliant multilingual voice AI.',
        },
        {
          key: 'telecom',
          label: 'Telecom',
          headlineAccent: 'Telecom Support',
          subheadline: 'Resolve billing disputes and plan changes instantly in 10+ regional languages.',
        },
      ],
      defaultIndustryTab: 'banking',
      primaryCta: { text: 'Try Live Demo', action: 'demo' },
      secondaryCta: { text: 'Get Started', href: '/login' },
      liveChips: [
        { text: '1,247 calls active', icon: 'dot' },
        { text: '34 new agents this week', icon: 'arrow' },
        { text: '99.9% uptime', icon: 'check' },
      ],
    },

    agentShowcase: {
      enabled: true,
      headline: 'Meet Your Intelligent Team',
      subheadline: 'Specialized AI agents trained for real-world finance and banking conversations.',
      showFilterTabs: true,
      showExploreAll: true,
      exploreCtaText: 'Explore Full Library →',
    },

    howItWorks: {
      enabled: true,
      headline: 'Three Steps to Production',
      subheadline: 'From zero to a live AI voice agent in minutes — no infrastructure required.',
      steps: [
        {
          num: '01',
          title: 'Configure',
          desc: "Set your agent's persona, tone, language, and compliance rules in one place.",
          tags: ['Tone tuning', 'Language', 'Compliance'],
          animationType: 'configure',
        },
        {
          num: '02',
          title: 'Deploy',
          desc: 'One-click deployment. Connect to your telephony or web channels instantly.',
          tags: ['One-click', 'Telephony', 'Web SDK'],
          animationType: 'deploy',
        },
        {
          num: '03',
          title: 'Monitor',
          desc: 'Real-time transcripts, sentiment analysis, and performance dashboards.',
          tags: ['Live transcripts', 'Sentiment', 'Analytics'],
          animationType: 'monitor',
        },
      ],
    },

    cta: {
      headline: ['Deploy Your Voice AI Agent', 'Today'],
      subheadline:
        'Sub-800ms latency. Enterprise compliance. 10+ languages. Zero infrastructure — get started in minutes.',
      primaryCta: { text: 'Get Started Free', action: 'demo' },
      secondaryCta: { text: 'Talk to Sales', href: '/login' },
      trustedBy: ['FinBank', 'LoanCo', 'PayShield', 'WealthX'],
      metrics: [
        { val: '<800ms', label: 'Latency' },
        { val: '10+', label: 'Languages' },
        { val: '99.9%', label: 'Uptime' },
        { val: '35%', label: 'DSO reduction' },
      ],
      testimonials: [
        {
          quote: 'DSO dropped by 40% in the first month.',
          author: 'Rahul Mehta',
          role: 'CFO',
          company: 'FinBank',
        },
        {
          quote: 'KYC onboarding now takes 3 minutes.',
          author: 'Priya Shah',
          role: 'Ops Head',
          company: 'LoanCo',
        },
      ],
    },
  },

  footer: {
    copyright: '© 2025 Sonix AI',
    links: [
      { label: 'Privacy', href: '/login' },
      { label: 'Terms', href: '/login' },
    ],
  },
};
