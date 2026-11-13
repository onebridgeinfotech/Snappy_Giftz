/**
 * Shape of ContentPage.sections (JSON) — the editable blocks of a product or
 * service SEO landing page. Every list is optional; empty sections are hidden.
 */
export interface LandingSections {
  features?: Array<{ title: string; description?: string }>;
  benefits?: Array<{ title: string; description?: string }>;
  useCases?: Array<{ title: string; description?: string }>;
  industries?: string[];
  screenshots?: Array<{ url: string; caption?: string }>;
  videos?: Array<{ url: string; title?: string }>;
  pricing?: Array<{ name: string; price: string; description?: string; features?: string[]; ctaLabel?: string; ctaHref?: string; highlighted?: boolean }>;
  faqs?: Array<{ question: string; answer: string }>;
  testimonials?: Array<{ quote: string; author: string; role?: string; rating?: number }>;
  caseStudies?: Array<{ title: string; summary: string; result?: string; href?: string }>;
  ctas?: Array<{ title: string; text?: string; label: string; href: string }>;
  internalLinks?: Array<{ label: string; href: string }>;
  externalReferences?: Array<{ label: string; href: string }>;
  showContactForm?: boolean;
}

export const LANDING_SECTION_KEYS: Array<keyof LandingSections> = [
  'features',
  'benefits',
  'useCases',
  'industries',
  'screenshots',
  'videos',
  'pricing',
  'faqs',
  'testimonials',
  'caseStudies',
  'ctas',
  'internalLinks',
  'externalReferences',
  'showContactForm',
];

export function parseSections(value: unknown): LandingSections {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const src = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of LANDING_SECTION_KEYS) {
    if (key === 'showContactForm') {
      if (typeof src[key] === 'boolean') out[key] = src[key];
    } else if (Array.isArray(src[key])) {
      out[key] = (src[key] as unknown[]).filter((item) => item !== null && item !== undefined && item !== '');
    }
  }
  return out as LandingSections;
}

const OCCASION_LABELS: Record<string, string> = {
  birthday: 'Birthdays',
  anniversary: 'Anniversaries',
  wedding: 'Weddings',
  'valentines-day': "Valentine's Day",
  diwali: 'Diwali',
  'raksha-bandhan': 'Raksha Bandhan',
  'fathers-day': "Father's Day",
  'mothers-day': "Mother's Day",
  corporate: 'Corporate gifting',
  housewarming: 'Housewarmings',
};

function titleCase(slug: string) {
  return OCCASION_LABELS[slug] || slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Sensible defaults for a product landing page when the marketing team has not
 * written custom sections yet. Anything set in the CMS overrides these.
 */
export function defaultProductSections(product: {
  name: string;
  isCustomizable: boolean;
  customizationType: string | null;
  occasions: string[];
  recipients: string[];
  minOrderQty: number;
  categoryName: string;
}): LandingSections {
  const features: LandingSections['features'] = [
    { title: 'Handcrafted in Hyderabad', description: 'Finished and quality-checked at our studio before it ships.' },
    { title: 'Signature gift packaging', description: 'Arrives ready to give, with an optional handwritten note.' },
  ];
  if (product.isCustomizable) {
    features.unshift({
      title: product.customizationType === 'engraving' ? 'Custom engraving' : product.customizationType === 'photo' ? 'Your photo, printed' : 'Fully personalised',
      description: 'Add names, dates, messages or photos — you approve a digital proof before production.',
    });
  }

  return {
    features,
    benefits: [
      { title: 'Memorable', description: `A ${product.categoryName.toLowerCase()} keepsake made for one person, not a shelf.` },
      { title: 'Fast local delivery', description: 'Express delivery across Hyderabad with live order tracking.' },
      { title: 'Secure checkout', description: 'UPI, cards and cash on delivery for eligible pincodes.' },
    ],
    useCases: product.occasions.slice(0, 6).map((o) => ({ title: titleCase(o) })),
    industries: product.recipients.slice(0, 8).map(titleCase),
    faqs: [
      {
        question: `How long does the ${product.name} take to deliver?`,
        answer: 'Most orders are prepared within 2 working days and delivered across Hyderabad shortly after. You get tracking updates by email.',
      },
      ...(product.isCustomizable
        ? [
            {
              question: 'Can I see the design before it is made?',
              answer: 'Yes. For personalised gifts we share a digital proof, and production starts only after you approve it.',
            },
          ]
        : []),
      ...(product.minOrderQty > 1
        ? [{ question: 'Is there a minimum order quantity?', answer: `Yes, the minimum order for this item is ${product.minOrderQty} units.` }]
        : [{ question: 'Do you offer bulk or corporate orders?', answer: 'Yes. Contact us on WhatsApp or the form below for bulk pricing and branded packaging.' }]),
      { question: 'What if my gift arrives damaged?', answer: 'Report it from your order page with a photo within 48 hours and we will replace or refund it.' },
    ],
    showContactForm: true,
  };
}

export function mergeSections(defaults: LandingSections, custom: LandingSections): LandingSections {
  const out: LandingSections = { ...defaults };
  for (const key of LANDING_SECTION_KEYS) {
    const value = custom[key];
    if (key === 'showContactForm') {
      if (typeof value === 'boolean') out.showContactForm = value;
    } else if (Array.isArray(value) && value.length > 0) {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}
