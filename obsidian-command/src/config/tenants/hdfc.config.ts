import type { HomePageConfig } from '../home.types';

export const hdfcConfig: HomePageConfig = {
  tenantId: 'hdfc-collections',
  tenantName: 'HDFC Collections',
  industry: 'collections',

  branding: {
    logoText: 'HDFC',
    logoVersion: 'Voice AI',
    themeBrand: 'amber',
    themeMode: 'light',
  },

  header: {
    navLinks: [
      { label: 'Recovery Suite', sectionIndex: 2 },
      { label: 'Compliance',     sectionIndex: 3 },
      { label: 'Contact Sales' },
    ],
    ctaButton: { text: 'Request Demo', href: '/contact' },
  },

  agents: {
    featuredIds: ['astra', 'nova', 'luna'],
    defaultDemoId: 'astra',
    customizations: {
      astra: {
        displayName: 'Astra — Collections',
        customBenefit: 'HDFC-trained recovery agent for personal loan collections.',
        customDetails: [
          'Trained on HDFC loan portfolio data patterns',
          'RBI-compliant soft collection scripts',
          'Auto-escalates to field team at day 90+',
        ],
        customRole: 'HDFC Recovery Specialist',
      },
    },
  },

  sections: {
    hero: {
      badge: 'HDFC AI Collections Suite',
      industryTabs: [
        {
          key: 'personal',
          label: 'Personal Loans',
          headlineAccent: 'Personal Loan Recovery',
          subheadline: 'Reduce personal loan NPAs with empathetic, compliant voice AI.',
        },
        {
          key: 'credit',
          label: 'Credit Cards',
          headlineAccent: 'Credit Card Collections',
          subheadline: 'Resolve credit card delinquencies with AI at scale.',
        },
        {
          key: 'home',
          label: 'Home Loans',
          headlineAccent: 'Home Loan Services',
          subheadline: 'Handle home loan payment reminders and restructuring queries.',
        },
      ],
      defaultIndustryTab: 'personal',
      primaryCta: { text: 'Try Collections Demo', action: 'demo' },
      secondaryCta: { text: 'Contact HDFC AI Team', href: '/contact' },
      liveChips: [
        { text: '2,400 calls active', icon: 'dot' },
        { text: 'RBI Compliant', icon: 'check' },
        { text: '45% Recovery Lift', icon: 'arrow' },
      ],
    },

    agentShowcase: {
      enabled: true,
      headline: 'Your AI Collections Team',
      subheadline: "Purpose-trained agents for HDFC's loan portfolio.",
      showFilterTabs: false,
      showExploreAll: false,
      exploreCtaText: '',
    },

    howItWorks: {
      enabled: true,
      headline: 'Deploy in One Day',
      subheadline: 'From zero to live collections calls in under 24 hours.',
      steps: [
        {
          num: '01',
          title: 'Configure',
          desc: 'Upload your DPD buckets and loan types. Agent auto-calibrates.',
          tags: ['DPD Buckets', 'Loan Types', 'RBI Scripts'],
          animationType: 'configure',
        },
        {
          num: '02',
          title: 'Integrate',
          desc: 'Connect to your LOS/LMS via our REST API. No telephony rewiring.',
          tags: ['REST API', 'LOS/LMS', 'Webhooks'],
          animationType: 'deploy',
        },
        {
          num: '03',
          title: 'Monitor',
          desc: 'Live PTP dashboard, recovery rates, and agent performance.',
          tags: ['PTP Dashboard', 'Recovery Rate', 'NPA Tracking'],
          animationType: 'monitor',
        },
      ],
    },

    compliance: {
      enabled: true,
      badges: ['RBI Compliant', 'TRAI Registered', 'DPDP Act 2023'],
      certifications: ['ISO 27001', 'SOC 2 Type II'],
    },

    cta: {
      headline: ['Start Recovering More.', 'Today.'],
      subheadline: "Join India's leading banks using Sonix AI for collections.",
      primaryCta: { text: 'Request Pilot', action: 'contact' },
      secondaryCta: { text: 'Download Case Study', href: '/hdfc-casestudy.pdf' },
      trustedBy: ['HDFC Bank', 'Standard Chartered', 'Kotak Mahindra', 'Axis Bank'],
      metrics: [
        { val: '45%',   label: 'Recovery lift' },
        { val: '<800ms', label: 'Latency' },
        { val: '100%',  label: 'RBI compliant' },
        { val: '30 min', label: 'Onboarding time' },
      ],
    },
  },

  footer: {
    copyright: '© 2025 Sonix AI · Deployed for HDFC Collections',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms',   href: '/terms' },
    ],
  },
};
