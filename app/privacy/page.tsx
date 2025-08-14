"use client";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen px-4 py-10 flex justify-center">
      <article className="glass max-w-3xl w-full rounded-2xl p-8 leading-relaxed">
        <h1 className="text-2xl font-semibold mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-6">Last updated: 14 Aug 2025</p>

        <h2 className="text-lg font-semibold mt-6 mb-2">1) Who we are</h2>
        <p>
          Soundboard Lab (“we”, “us”) provides audio tools and related services.
          This policy explains how we collect, use, and share your personal data.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">2) Data we collect</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><b>Account data:</b> name, username, email, password hash, and optional phone.</li>
          <li><b>Usage data:</b> app interactions, device/browser info, crash logs.</li>
          <li><b>Content:</b> audio files and metadata you upload.</li>
          <li><b>Payments:</b> handled by our payment processor (e.g., Stripe). We don’t store full card details.</li>
          <li><b>Communications:</b> support requests and email preferences.</li>
        </ul>

        <h2 className="text-lg font-semibold mt-6 mb-2">3) How we use data</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Provide, secure, and improve the Service.</li>
          <li>Authenticate logins and prevent fraud or abuse.</li>
          <li>Send transactional emails (verification, resets, receipts).</li>
          <li>Send product updates and tips if you opt in (you can unsubscribe anytime).</li>
          <li>Comply with legal obligations.</li>
        </ul>

        <h2 className="text-lg font-semibold mt-6 mb-2">4) Legal bases (GDPR)</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Performance of a contract (providing the Service to you).</li>
          <li>Legitimate interests (security, product improvement).</li>
          <li>Consent (marketing emails, optional features).</li>
          <li>Legal obligations (tax, compliance).</li>
        </ul>

        <h2 className="text-lg font-semibold mt-6 mb-2">5) Sharing</h2>
        <p>
          We share data with service providers that help us run the Service
          (hosting, email delivery, analytics, payments). These providers are
          bound by contracts and only process data on our instructions. We don’t
          sell personal data.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">6) International transfers</h2>
        <p>
          Data may be processed outside your country. Where required, we use
          appropriate safeguards (e.g., SCCs) for transfers.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">7) Data retention</h2>
        <p>
          We keep personal data only as long as needed for the purposes above,
          then delete or anonymize it unless we must retain it by law.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">8) Your rights</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Access, rectify, or delete your data.</li>
          <li>Object to or restrict processing in certain cases.</li>
          <li>Portability of data you provided to us.</li>
          <li>Withdraw consent where processing is based on consent.</li>
          <li>Lodge a complaint with your local data authority.</li>
        </ul>

        <h2 className="text-lg font-semibold mt-6 mb-2">9) Cookies & tracking</h2>
        <p>
          We use strictly necessary cookies for authentication and app features,
          and (optionally) analytics/performance cookies. You can manage
          preferences in your browser and, where available, in our in-app cookie
          settings.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">10) Security</h2>
        <p>
          We use technical and organizational measures (encryption in transit,
          access controls, logging) to protect data. No system is 100% secure,
          so please use a strong password and keep it private.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">11) Children</h2>
        <p>
          The Service is not directed to children under 16. If you believe a
          child provided us data, contact us to remove it.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">12) Changes</h2>
        <p>
          We may update this policy. We’ll notify you of significant changes via
          email or in-app notice.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">13) Contact</h2>
        <p>
          Email <a className="underline" href="mailto:support@soundboardlab.com">support@soundboardlab.com</a> for privacy requests.
        </p>

        <p className="text-xs text-gray-400 mt-6">
          This document is a general template and not legal advice.
        </p>

        <div className="mt-8 text-sm">
          <Link href="/terms" className="underline">Terms of Service</Link>
        </div>
      </article>
    </div>
  );
}
