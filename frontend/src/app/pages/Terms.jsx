import Navbar_Landing from "../../components/navbar/Navbar_landing";
import Footer from "../../components/Footer";

export default function Terms() {
  const lastUpdated = "April 28, 2026";
  return (
    <div style={{ background: "#160f29", minHeight: "100vh", color: "#fbfbf2" }}>
      <Navbar_Landing />

      <main className="max-w-3xl mx-auto px-6 py-16 leading-relaxed">
        <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm opacity-60 mb-10">Last updated: {lastUpdated}</p>

        <Section title="Welcome">
          By using TravelerHub you agree to these terms. If you don't agree,
          please don't use the service. The source code is available under
          the MIT license — see the LICENSE file in the GitHub repository.
        </Section>

        <Section title="Your account">
          <ul className="list-disc pl-6 space-y-2">
            <li>You are responsible for activity on your account and for keeping your password secure.</li>
            <li>One person, one account. Don't impersonate someone else.</li>
            <li>You must be at least 13 years old to create an account.</li>
          </ul>
        </Section>

        <Section title="Acceptable use">
          You agree not to:
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>Upload illegal, harassing, or copyright-infringing content.</li>
            <li>Use the service to track someone's location without their consent.</li>
            <li>Reverse-engineer rate limits, scrape data at scale, or abuse the realtime channel.</li>
            <li>Run penetration tests or fuzzing against the hosted instance without prior written consent — see SECURITY.md for the disclosure process.</li>
          </ul>
          We may suspend or remove accounts that break these rules.
        </Section>

        <Section title="Your content">
          You keep ownership of trip content you upload. You grant us a
          limited license to store, transmit, and display that content to
          your trip members so the app can function. We don't claim any
          rights to your photos, chat messages, or itineraries beyond what
          we need to deliver the service.
        </Section>

        <Section title="Service availability">
          The hosted instance is provided "as is" without warranty. We try to
          keep it up but we may have downtime, lose data, or change features
          without notice. Don't use TravelerHub as the sole copy of any
          critical document.
        </Section>

        <Section title="Payments">
          Paid features (if any) are billed via Stripe. Cancellations take
          effect at the end of the current billing period unless local law
          requires otherwise.
        </Section>

        <Section title="Termination">
          You can delete your account at any time via Settings → Delete
          account. We can suspend or terminate accounts that violate these
          terms.
        </Section>

        <Section title="Liability">
          To the maximum extent allowed by law, TravelerHub and its
          contributors are not liable for indirect, incidental, or
          consequential damages arising out of your use of the service. Our
          total liability is limited to the amount you paid us in the 12
          months before the claim, or USD 50, whichever is greater.
        </Section>

        <Section title="Changes">
          We may update these terms occasionally. We'll bump the "Last
          updated" date and announce material changes in the in-app
          notifications feed.
        </Section>

        <Section title="Contact">
          Open an issue on GitHub for questions, or use the SECURITY
          contact form for private matters.
        </Section>
      </main>

      <Footer />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-10">
      <h2 className="text-2xl font-semibold mb-3">{title}</h2>
      <div className="opacity-90">{children}</div>
    </section>
  );
}
