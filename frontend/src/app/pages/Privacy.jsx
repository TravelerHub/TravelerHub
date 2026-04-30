import Navbar_Landing from "../../components/navbar/Navbar_landing";
import Footer from "../../components/Footer";

export default function Privacy() {
  const lastUpdated = "April 28, 2026";
  return (
    <div style={{ background: "#160f29", minHeight: "100vh", color: "#fbfbf2" }}>
      <Navbar_Landing />

      <main className="max-w-3xl mx-auto px-6 py-16 leading-relaxed">
        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm opacity-60 mb-10">Last updated: {lastUpdated}</p>

        <Section title="What we are">
          TravelerHub is an open-source group-travel app. This page describes
          how the public hosted instance handles your data. If you self-host,
          you are the data controller for your own deployment — see the
          repository on GitHub for the source code.
        </Section>

        <Section title="What we collect">
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Account data</strong>: email, display name, and a
              hashed password (we never store the plaintext).
            </li>
            <li>
              <strong>Trip content</strong>: trips, itineraries, photos,
              expenses, todos, polls, and chat messages you create.
            </li>
            <li>
              <strong>Live location</strong>: only while you have explicitly
              tapped <em>Share Location</em> on the Navigation page. The pin
              is sent to the other members of your trip via Supabase
              Realtime and is removed when you stop sharing or close the
              app.
            </li>
            <li>
              <strong>Diagnostics</strong>: short request IDs, HTTP status
              codes, and minimal stack traces for our error logs. We do not
              attach your account ID to these logs.
            </li>
          </ul>
        </Section>

        <Section title="What we do not collect">
          <ul className="list-disc pl-6 space-y-2">
            <li>We do not sell your data, ever.</li>
            <li>We do not run third-party advertising or tracking pixels.</li>
            <li>
              We do not read your photos or chat content for training
              models.
            </li>
          </ul>
        </Section>

        <Section title="Third-party services">
          To deliver the app we send necessary data to:
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li><strong>Supabase</strong> — database, realtime, file storage.</li>
            <li><strong>Mapbox</strong> — map tiles and route optimization.</li>
            <li><strong>Google Maps Platform</strong> — place search and geocoding for the rare query Mapbox / OpenStreetMap can't answer.</li>
            <li><strong>Stripe</strong> — payments, only if you use a paid feature.</li>
            <li><strong>SMTP provider</strong> — transactional email for password reset OTPs.</li>
          </ul>
          Each provider has its own privacy policy. We share only what's
          required for the feature you triggered.
        </Section>

        <Section title="Your rights">
          You can:
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>Export your data — Settings → Export.</li>
            <li>
              Delete your account and all associated trip content — Settings
              → Delete account. Deletion is hard-delete and cannot be
              undone.
            </li>
            <li>
              Ask questions or file a complaint — open an issue on GitHub or
              email the maintainers via the SECURITY contact form.
            </li>
          </ul>
        </Section>

        <Section title="Cookies">
          We use a single first-party cookie / localStorage entry to keep
          you signed in. No analytics, no advertising cookies.
        </Section>

        <Section title="Children">
          The hosted instance is not intended for children under 13. Don't
          create an account on a child's behalf.
        </Section>

        <Section title="Changes">
          When we materially change this policy we'll bump the "Last
          updated" date and announce the change in the in-app notifications
          feed.
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
