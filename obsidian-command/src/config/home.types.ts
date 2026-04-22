// ─── HomePageConfig Types ─────────────────────────────────────────────────────

export type ThemeBrand = 'amber' | 'nocturnal' | 'neuralSlate' | 'prismatic';
export type ThemeMode  = 'light' | 'dark';
export type Industry   = 'fintech' | 'banking' | 'insurance' | 'telecom' | 'collections';

export interface AgentCustomization {
  displayName?: string;
  customBenefit?: string;
  customDetails?: string[];
  customRole?: string;
}

export interface IndustryTab {
  key: string;
  label: string;
  headlineAccent: string;
  subheadline: string;
}

export interface HeroConfig {
  badge: string;
  industryTabs: IndustryTab[];
  defaultIndustryTab: string;
  primaryCta: { text: string; action: 'demo' | 'signup' | 'contact' };
  secondaryCta: { text: string; href: string };
  liveChips: { text: string; icon: 'dot' | 'arrow' | 'check' }[];
}

export interface AgentShowcaseConfig {
  enabled: boolean;
  headline: string;
  subheadline: string;
  showFilterTabs: boolean;
  showExploreAll: boolean;
  exploreCtaText: string;
}

export interface StepConfig {
  num: string;
  title: string;
  desc: string;
  tags: string[];
  animationType: 'configure' | 'deploy' | 'monitor';
  animationData?: Record<string, unknown>;
}

export interface HowItWorksConfig {
  enabled: boolean;
  headline: string;
  subheadline: string;
  steps: StepConfig[];
}

export interface TestimonialItem {
  quote: string;
  author: string;
  role: string;
  company: string;
}

export interface PricingTier {
  name: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  highlighted: boolean;
}

export interface CtaConfig {
  headline: string[];
  subheadline: string;
  primaryCta: { text: string; action: 'demo' | 'signup' | 'contact' };
  secondaryCta: { text: string; href: string };
  trustedBy: string[];
  metrics: { val: string; label: string }[];
  testimonials?: TestimonialItem[];
}

export interface HomePageConfig {
  tenantId: string;
  tenantName: string;
  industry: Industry;

  branding: {
    logoText: string;
    logoVersion: string;
    themeBrand: ThemeBrand;
    themeMode: ThemeMode;
  };

  header: {
    navLinks: { label: string; sectionIndex?: number; href?: string }[];
    ctaButton: { text: string; href: string };
  };

  agents: {
    featuredIds: string[];
    defaultDemoId: string;
    customizations: Record<string, AgentCustomization>;
  };

  sections: {
    hero: HeroConfig;
    agentShowcase: AgentShowcaseConfig;
    howItWorks: HowItWorksConfig;
    analytics?: { enabled: boolean };
    integrations?: { enabled: boolean; logos: string[] };
    compliance?: { enabled: boolean; badges: string[]; certifications: string[] };
    testimonials?: { enabled: boolean; items: TestimonialItem[] };
    pricing?: { enabled: boolean; tiers: PricingTier[] };
    cta: CtaConfig;
  };

  footer: {
    copyright: string;
    links: { label: string; href: string }[];
  };
}
