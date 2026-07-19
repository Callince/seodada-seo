import { Clock, Mail, MapPin, Send } from "lucide-react";
import { useState } from "react";

import { api, apiErrorMessage } from "@/api/client";
import { PublicHero } from "@/components/public/PublicHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Seo } from "@/lib/seo";

const SUPPORT_EMAIL = "support@seodada.com";

/** Contact info migrated from the seodada contact template. */
const INFO = {
  address: "Shyamala Towers, 3rd floor No. 136, Arcot Rd, Saligramam, Chennai, Tamil Nadu 600092",
  hours: ["Monday – Friday: 9:00 AM – 6:00 PM", "Saturday: 10:00 AM – 4:00 PM", "Sunday: Closed"],
};

/** Public contact page — submits to POST /public/contact, which lands in the
 *  admin contact inbox. */
export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [serverError, setServerError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const err: Record<string, string> = {};
    if (form.name.trim().length < 2 || form.name.trim().length > 100)
      err.name = "Please enter your full name (2–100 characters).";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      err.email = "Please enter a valid email address.";
    if (form.message.trim().length < 10 || form.message.trim().length > 5000)
      err.message = "Please enter a message (10–5000 characters).";
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setStatus("sending");
    setServerError("");
    try {
      await api.post("/public/contact", {
        name: form.name.trim(),
        email: form.email.trim(),
        message: form.message.trim(),
      });
      setStatus("sent");
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      setStatus("error");
      setServerError(apiErrorMessage(err));
    }
  };

  return (
    <div>
      <Seo
        title="Contact us"
        description="Contact seodada for support, questions, or feedback. Get in touch with our team for any assistance you need."
        path="/contact"
      />
      {/* ===== Hero ===== */}
      <PublicHero
        eyebrow="Contact"
        title="We're here to"
        highlight="help"
        subtitle="Questions about our SEO tools? Need support? Send us a message and our team typically responds within 24 hours on business days."
        compact
      />

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:grid lg:grid-cols-[1.4fr_1fr] lg:gap-10">
        {/* ===== Form ===== */}
        <form onSubmit={onSubmit} noValidate className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <label htmlFor="name" className="text-sm font-medium text-text">Your name *</label>
              <Input id="name" value={form.name} onChange={set("name")} placeholder="Jane Doe" className="mt-1.5" />
              {errors.name && <p className="mt-1 text-xs text-danger">{errors.name}</p>}
            </div>
            <div className="sm:col-span-1">
              <label htmlFor="email" className="text-sm font-medium text-text">Email address *</label>
              <Input id="email" type="email" value={form.email} onChange={set("email")} placeholder="you@company.com" className="mt-1.5" />
              {errors.email && <p className="mt-1 text-xs text-danger">{errors.email}</p>}
            </div>
          </div>
          <div className="mt-5">
            <label htmlFor="message" className="text-sm font-medium text-text">Your message *</label>
            <textarea
              id="message"
              value={form.message}
              onChange={set("message")}
              rows={6}
              maxLength={5000}
              placeholder="How can we help?"
              className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="mt-1 flex items-center justify-between">
              {errors.message ? (
                <p className="text-xs text-danger">{errors.message}</p>
              ) : (
                <span />
              )}
              <span className="text-xs text-text-muted">{form.message.length}/5000</span>
            </div>
          </div>
          {status === "sent" && (
            <p className="mt-4 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              Thanks — your message is on its way. Our team typically replies within 24 hours on business days.
            </p>
          )}
          {status === "error" && serverError && (
            <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {serverError}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            loading={status === "sending"}
            className="mt-6 w-full sm:w-auto"
          >
            Send message <Send size={16} />
          </Button>
        </form>

        {/* ===== Info sidebar ===== */}
        <div className="mt-8 space-y-4 lg:mt-0">
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-ink">
              <Mail size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-text">Email us</p>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sm text-primary-ink hover:underline">
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-ink">
              <MapPin size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-text">Our office</p>
              <p className="text-sm text-text-muted">{INFO.address}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-ink">
              <Clock size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-text">Business hours</p>
              <ul className="mt-1 space-y-0.5 text-sm text-text-muted">
                {INFO.hours.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
