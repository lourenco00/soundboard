"use client";
import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen px-4 py-10 flex justify-center">
      <article className="glass max-w-3xl w-full rounded-2xl p-8 leading-relaxed">
        <h1 className="text-2xl font-semibold mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-6">Last updated: 14 Aug 2025</p>

        <h2 className="text-lg font-semibold mt-6 mb-2">1) Overview</h2>
        <p>
          These Terms of Service (“Terms”) govern your use of Soundboard Lab
          (“we”, “us”, “our”) and its websites, apps, and services
          (collectively, the “Service”). By creating an account or using the
          Service, you agree to these Terms.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">2) Eligibility & Accounts</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>You must be at least 16 years old (or the age of digital consent in your country).</li>
          <li>You’re responsible for keeping your credentials secure and for all activity under your account.</li>
          <li>You must provide accurate information and keep it up to date.</li>
        </ul>

        <h2 className="text-lg font-semibold mt-6 mb-2">3) Acceptable Use</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Don’t upload or share content that is illegal, infringing, or harmful.</li>
          <li>Don’t attempt to disrupt or reverse-engineer the Service.</li>
          <li>Respect third-party copyrights and licenses for any audio you upload.</li>
        </ul>

        <h2 className="text-lg font-semibold mt-6 mb-2">4) User Content & Licenses</h2>
        <p>
          You retain ownership of the audio and other content you upload. You grant
          us a worldwide, non-exclusive license to host, process, and display your
          content solely to operate and improve the Service. You represent that you
          have the necessary rights to upload and use the content.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">5) Plans, Billing & Trials</h2>
        <p>
          Paid plans are billed in advance. Unless canceled, subscriptions renew
          automatically at the end of each term. You can cancel anytime, and your
          plan remains active until the end of the billing period. Taxes may apply.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">6) Refunds</h2>
        <p>
          Except where required by law, payments are non-refundable. If the Service
          is unavailable due to our fault for a prolonged period, contact us and we’ll
          try to make it right.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">7) Intellectual Property</h2>
        <p>
          The Service, including the site, software, and brand assets, is our
          intellectual property and may not be copied or modified except as
          permitted by law or an applicable open-source license we provide.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">8) Termination</h2>
        <p>
          We may suspend or terminate access for any breach of these Terms or
          unlawful activity. You may stop using the Service at any time. Sections
          that by their nature should survive (e.g., IP, disclaimers, limitation of
          liability) will survive termination.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">9) Disclaimer</h2>
        <p>
          The Service is provided “as is” without warranties of any kind. We do not
          guarantee that it will be uninterrupted or error-free.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">10) Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, we will not be liable for any
          indirect, incidental, or consequential damages, or any loss of data,
          profits, or business arising out of use of the Service.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">11) Changes to Terms</h2>
        <p>
          We may update these Terms from time to time. If changes are material,
          we’ll notify you by email or in-app. Continued use after changes take
          effect constitutes acceptance.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">12) Contact</h2>
        <p>
          Questions? Email <a className="underline" href="mailto:support@soundboardlab.com">support@soundboardlab.com</a>.
        </p>

        <p className="text-xs text-gray-400 mt-6">
          This document is a general template and not legal advice.
        </p>

        <div className="mt-8 text-sm">
          <Link href="/privacy" className="underline">Privacy Policy</Link>
        </div>
      </article>
    </div>
  );
}
