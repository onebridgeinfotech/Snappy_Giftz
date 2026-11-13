import Link from 'next/link';
import { Check, ExternalLink, Quote, Star } from 'lucide-react';
import type { LandingSections } from '@/lib/cms/landing-sections';
import { renderMarkdown } from '@/lib/cms/markdown';
import { BUSINESS_CONFIG } from '@/config/business';
import { EnquiryForm } from './EnquiryForm';
import { SmartImage } from './BlogParts';

const card = 'rounded-2xl border border-[#D5A34A]/20 bg-[#17181C] p-5';
const h2 = 'font-serif text-2xl sm:text-3xl font-bold text-white';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-5">
      <h2 id={id} className={h2}>{title}</h2>
      {children}
    </section>
  );
}

function isExternal(href: string) {
  return /^https?:\/\//i.test(href);
}

/** Renders the optional marketing sections of a product or service landing page. Empty sections are skipped. */
export function LandingSectionsView({ sections, pagePath, overview }: { sections: LandingSections; pagePath: string; overview?: string | null }) {
  const s = sections;
  const overviewHtml = overview ? renderMarkdown(overview).html : '';
  return (
    <div className="space-y-14">
      {overviewHtml && (
        <Section id="overview" title="Overview">
          <div className="cms-prose" dangerouslySetInnerHTML={{ __html: overviewHtml }} />
        </Section>
      )}

      {s.features?.length ? (
        <Section id="features" title="Key features">
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {s.features.map((f, i) => (
              <li key={i} className={card}>
                <p className="flex items-start gap-2 font-bold text-white"><Check className="w-4 h-4 mt-1 text-[#F5BD48] shrink-0" aria-hidden="true" />{f.title}</p>
                {f.description && <p className="text-sm text-[#94A3B8] mt-2">{f.description}</p>}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {s.benefits?.length ? (
        <Section id="benefits" title="Benefits">
          <div className="grid sm:grid-cols-3 gap-4">
            {s.benefits.map((b, i) => (
              <div key={i} className={card}>
                <p className="font-bold text-[#F5BD48]">{b.title}</p>
                {b.description && <p className="text-sm text-[#94A3B8] mt-2">{b.description}</p>}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {s.useCases?.length ? (
        <Section id="use-cases" title="Use cases">
          <ul className="grid sm:grid-cols-2 gap-3">
            {s.useCases.map((u, i) => (
              <li key={i} className="rounded-xl border border-white/10 p-4">
                <p className="font-semibold text-white">{u.title}</p>
                {u.description && <p className="text-sm text-[#94A3B8] mt-1">{u.description}</p>}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {s.industries?.length ? (
        <Section id="industries" title="Who it is for">
          <ul className="flex flex-wrap gap-2">
            {s.industries.map((x, i) => <li key={i} className="px-3.5 py-1.5 rounded-full border border-[#D5A34A]/40 text-sm text-[#E2E8F0]">{x}</li>)}
          </ul>
        </Section>
      ) : null}

      {s.screenshots?.length ? (
        <Section id="gallery" title="Gallery">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {s.screenshots.map((img, i) => (
              <figure key={i} className="space-y-2">
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#0b0c10]">
                  <SmartImage src={img.url} alt={img.caption || 'Gallery image'} sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover" />
                </div>
                {img.caption && <figcaption className="text-xs text-[#94A3B8]">{img.caption}</figcaption>}
              </figure>
            ))}
          </div>
        </Section>
      ) : null}

      {s.videos?.length ? (
        <Section id="videos" title="Watch">
          <div className="grid md:grid-cols-2 gap-5">
            {s.videos.map((v, i) => (
              <div key={i} className="cms-prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(`::video[${v.url}]`).html }} />
            ))}
          </div>
        </Section>
      ) : null}

      {s.pricing?.length ? (
        <Section id="pricing" title="Pricing">
          <div className="grid md:grid-cols-3 gap-5">
            {s.pricing.map((p, i) => (
              <div key={i} className={`${card} flex flex-col ${p.highlighted ? 'border-[#F5BD48] ring-1 ring-[#F5BD48]/40' : ''}`}>
                <p className="font-bold text-white">{p.name}</p>
                <p className="font-serif text-3xl text-[#F5BD48] mt-2">{p.price}</p>
                {p.description && <p className="text-sm text-[#94A3B8] mt-2">{p.description}</p>}
                {p.features?.length ? (
                  <ul className="mt-4 space-y-1.5 text-sm text-[#CBD5E1]">
                    {p.features.map((f, j) => <li key={j} className="flex gap-2"><Check className="w-4 h-4 mt-0.5 text-[#F5BD48] shrink-0" aria-hidden="true" />{f}</li>)}
                  </ul>
                ) : null}
                {p.ctaHref && <Link href={p.ctaHref} className="mt-auto pt-5 text-sm font-bold text-[#F5BD48] hover:underline">{p.ctaLabel || 'Get started'} →</Link>}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {s.testimonials?.length ? (
        <Section id="testimonials" title="What customers say">
          <div className="grid md:grid-cols-2 gap-5">
            {s.testimonials.map((t, i) => (
              <blockquote key={i} className={card}>
                <Quote className="w-5 h-5 text-[#D5A34A]" aria-hidden="true" />
                <p className="text-[#E2E8F0] mt-2 leading-relaxed">{t.quote}</p>
                <footer className="mt-3 text-sm text-[#94A3B8] flex items-center gap-2">
                  <span><strong className="text-white">{t.author}</strong>{t.role ? `, ${t.role}` : ''}</span>
                  {t.rating ? <span className="inline-flex" aria-label={`${t.rating} out of 5 stars`}>{Array.from({ length: Math.round(t.rating) }).map((_, k) => <Star key={k} className="w-3.5 h-3.5 fill-[#F5BD48] text-[#F5BD48]" />)}</span> : null}
                </footer>
              </blockquote>
            ))}
          </div>
        </Section>
      ) : null}

      {s.caseStudies?.length ? (
        <Section id="case-studies" title="Case studies">
          <div className="grid md:grid-cols-2 gap-5">
            {s.caseStudies.map((c, i) => (
              <article key={i} className={card}>
                <h3 className="font-bold text-white">{c.title}</h3>
                <p className="text-sm text-[#94A3B8] mt-2">{c.summary}</p>
                {c.result && <p className="text-sm text-[#F5BD48] mt-2 font-semibold">{c.result}</p>}
                {c.href && <Link href={c.href} className="text-sm text-[#F5BD48] hover:underline mt-3 inline-block">Read more →</Link>}
              </article>
            ))}
          </div>
        </Section>
      ) : null}

      {s.faqs?.length ? (
        <Section id="faqs" title="Frequently asked questions">
          <div className="space-y-3">
            {s.faqs.map((f, i) => (
              <details key={i} className="group rounded-xl border border-white/10 bg-[#17181C] p-4">
                <summary className="cursor-pointer font-semibold text-white list-none flex justify-between gap-4">{f.question}<span className="text-[#F5BD48] group-open:rotate-45 transition-transform" aria-hidden="true">+</span></summary>
                <p className="mt-3 text-sm text-[#94A3B8] leading-relaxed">{f.answer}</p>
              </details>
            ))}
          </div>
        </Section>
      ) : null}

      {s.ctas?.map((c, i) => (
        <aside key={i} className="rounded-2xl border border-[#D5A34A]/40 bg-[#D5A34A]/[0.08] p-8 text-center space-y-3">
          <p className="font-serif text-2xl text-white">{c.title}</p>
          {c.text && <p className="text-[#CBD5E1]">{c.text}</p>}
          <Link href={c.href} className="inline-block px-6 py-3 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#E5A93C] text-[#111215] font-bold">{c.label}</Link>
        </aside>
      ))}

      {s.showContactForm !== false && (
        <Section id="contact" title="Talk to us">
          <div className="grid lg:grid-cols-[1fr_16rem] gap-8">
            <div className={card}><EnquiryForm page={pagePath} /></div>
            <div className="text-sm text-[#94A3B8] space-y-2">
              <p>Prefer chat? Message us on WhatsApp.</p>
              <a href={`https://wa.me/91${BUSINESS_CONFIG.whatsappPhone}`} target="_blank" rel="noopener noreferrer" className="text-[#F5BD48] hover:underline block">{BUSINESS_CONFIG.whatsappFormatted}</a>
              <p>{BUSINESS_CONFIG.operatingHours}</p>
            </div>
          </div>
        </Section>
      )}

      {(s.internalLinks?.length || s.externalReferences?.length) ? (
        <Section id="more" title="Explore more">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {s.internalLinks?.map((l, i) => <li key={`i${i}`}><Link href={l.href} className="text-[#F5BD48] hover:underline">{l.label}</Link></li>)}
            {s.externalReferences?.map((l, i) => (
              <li key={`e${i}`}>
                <a href={l.href} target="_blank" rel="noopener noreferrer nofollow" className="text-[#94A3B8] hover:text-[#F5BD48] inline-flex items-center gap-1">{l.label}<ExternalLink className="w-3 h-3" aria-hidden="true" /></a>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

export { isExternal };
import React from 'react';
