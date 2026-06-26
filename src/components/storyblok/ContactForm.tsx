// src/components/storyblok/ContactForm.tsx
// Contact form. react-hook-form + zodResolver for client validation; submits to
// the submitContact Server Action, which re-validates and handles Supabase +
// Resend. Success/error states are written in the interface's own voice.
"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { storyblokEditable } from "@storyblok/react";
import { contactSchema, INTERESTS, type ContactInput } from "@/lib/contact-schema";
import { submitContact } from "@/app/actions/contact";
import { brand } from "@/lib/config";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ContactFormBlok = {
  _uid: string;
  component: string;
  heading?: string;
  lead?: string;
  success_title?: string;
  success_body?: string;
};

function Err({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p style={{ color: "var(--signal)" }} className="mt-1.5 text-xs">
      {msg}
    </p>
  );
}

export default function ContactForm({ blok }: { blok: ContactFormBlok }) {
  const pathname = usePathname();
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: { interest: undefined, website: "" },
  });

  async function onSubmit(values: ContactInput) {
    const res = await submitContact({ ...values, source_page: pathname });
    if (res.ok) {
      setDone(true);
      toast.success("Message sent.");
      return;
    }
    if (res.fieldErrors) {
      for (const [field, msgs] of Object.entries(res.fieldErrors)) {
        if (msgs?.[0]) setError(field as keyof ContactInput, { message: msgs[0] });
      }
    }
    toast.error(res.error || "Something went wrong.");
  }

  if (done) {
    return (
      <section
        {...storyblokEditable(blok)}
        style={{ background: "var(--void)", color: "var(--on-contrast)" }}
        className="px-6 py-24 md:py-32"
      >
        <div className="mx-auto max-w-2xl">
          <p
            style={{ fontFamily: "var(--font-mono)", color: "var(--signal)" }}
            className="mb-4 text-xs uppercase tracking-[0.12em]"
          >
            Message received
          </p>
          <h2
            style={{ fontFamily: "var(--font-heading)" }}
            className="text-3xl md:text-4xl"
          >
            {blok.success_title || "We've got it."}
          </h2>
          <p style={{ color: "var(--mist)" }} className="mt-4 text-lg leading-relaxed">
            {blok.success_body ||
              "Your message reached the team, and we will be in touch. Check your inbox for a confirmation."}
          </p>
        </div>
      </section>
    );
  }

  const inputCls =
    "w-full border bg-[var(--paper-2)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--signal)]";

  return (
    <section
      {...storyblokEditable(blok)}
      style={{ background: "var(--paper)", color: "var(--ink)" }}
      className="px-6 py-20 md:py-28"
    >
      <div className="mx-auto max-w-2xl">
        <p
          style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}
          className="mb-4 text-xs uppercase tracking-[0.12em]"
        >
          Contact
        </p>
        {blok.heading && (
          <h1
            style={{ fontFamily: "var(--font-heading)", color: "var(--ink)" }}
            className="text-3xl leading-tight md:text-5xl"
          >
            {blok.heading}
          </h1>
        )}
        {blok.lead && (
          <p style={{ color: "var(--ink-2)" }} className="mt-4 text-lg leading-relaxed">
            {blok.lead}
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-10 space-y-5" noValidate>
          {/* Honeypot - visually hidden, off the tab order */}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute left-[-9999px] h-0 w-0"
            {...register("website")}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="name" style={{ color: "var(--ink)" }}>Name</Label>
              <input id="name" className={inputCls} style={{ borderColor: "var(--hair)" }} {...register("name")} />
              <Err msg={errors.name?.message} />
            </div>
            <div>
              <Label htmlFor="company" style={{ color: "var(--ink)" }}>Company</Label>
              <input id="company" className={inputCls} style={{ borderColor: "var(--hair)" }} {...register("company")} />
              <Err msg={errors.company?.message} />
            </div>
            <div>
              <Label htmlFor="email" style={{ color: "var(--ink)" }}>Email</Label>
              <input id="email" type="email" className={inputCls} style={{ borderColor: "var(--hair)" }} {...register("email")} />
              <Err msg={errors.email?.message} />
            </div>
            <div>
              <Label htmlFor="role" style={{ color: "var(--ink)" }}>Role / title</Label>
              <input id="role" className={inputCls} style={{ borderColor: "var(--hair)" }} {...register("role")} />
              <Err msg={errors.role?.message} />
            </div>
          </div>

          <div>
            <Label style={{ color: "var(--ink)" }}>Interest</Label>
            <Controller
              control={control}
              name="interest"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    className="w-full rounded-none border-[var(--hair)] bg-[var(--paper-2)]"
                    style={{ color: "var(--ink)" }}
                  >
                    <SelectValue placeholder="What are you interested in?" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERESTS.map((i) => (
                      <SelectItem key={i} value={i}>
                        {i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <Err msg={errors.interest?.message} />
          </div>

          <div>
            <Label htmlFor="message" style={{ color: "var(--ink)" }}>Message</Label>
            <textarea
              id="message"
              rows={5}
              className={inputCls}
              style={{ borderColor: "var(--hair)" }}
              {...register("message")}
            />
            <Err msg={errors.message?.message} />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{ background: "var(--signal)", color: "var(--on-signal)", fontFamily: "var(--font-mono)" }}
            className="inline-flex items-center px-6 py-3 text-sm font-semibold uppercase tracking-[0.08em] disabled:opacity-60"
          >
            {isSubmitting ? "Sending..." : "Send message"}
          </button>

          <p
            style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}
            className="pt-2 text-[0.7rem] uppercase tracking-[0.12em]"
          >
            {brand.contact.email}
          </p>
        </form>
      </div>
    </section>
  );
}
