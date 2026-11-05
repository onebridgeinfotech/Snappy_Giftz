'use client';

import React, { useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
        <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-serif font-bold text-white">Message Dispatched</h3>
        <p className="text-xs text-[#94A3B8] leading-relaxed">
          Thank you for reaching out, {name || 'valued customer'}. Our concierge team will review your inquiry and respond within 2–4 business hours.
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setName('');
            setEmail('');
            setSubject('');
            setMessage('');
          }}
          className="text-xs text-[#D5A34A] hover:underline pt-2 font-medium"
        >
          Send another inquiry
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs">
      <div>
        <label className="block text-[#CBD5E1] font-medium mb-1.5">Your Full Name</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Aarav Sharma"
          className="w-full bg-[#08090B] border border-[#D5A34A]/25 rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#64748B] focus:border-[#F5BD48] focus:outline-hidden"
        />
      </div>

      <div>
        <label className="block text-[#CBD5E1] font-medium mb-1.5">Email Address</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e.g. aarav@example.com"
          className="w-full bg-[#08090B] border border-[#D5A34A]/25 rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#64748B] focus:border-[#F5BD48] focus:outline-hidden"
        />
      </div>

      <div>
        <label className="block text-[#CBD5E1] font-medium mb-1.5">Subject</label>
        <input
          type="text"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Order Inquiry, Custom Engraving, Delivery"
          className="w-full bg-[#08090B] border border-[#D5A34A]/25 rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#64748B] focus:border-[#F5BD48] focus:outline-hidden"
        />
      </div>

      <div>
        <label className="block text-[#CBD5E1] font-medium mb-1.5">Your Message</label>
        <textarea
          required
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="How can our atelier assist you today?"
          className="w-full bg-[#08090B] border border-[#D5A34A]/25 rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#64748B] focus:border-[#F5BD48] focus:outline-hidden resize-none"
        />
      </div>

      <button
        type="submit"
        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 hover:brightness-110 transition-all shadow-lg shadow-[#D5A34A]/20 cursor-pointer"
      >
        <Send className="w-3.5 h-3.5" />
        <span>Send Message to Concierge</span>
      </button>
    </form>
  );
}

