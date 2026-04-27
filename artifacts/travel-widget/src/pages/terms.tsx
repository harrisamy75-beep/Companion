import { Link } from "wouter";

const LAST_UPDATED = "April 18, 2026";

const sectionStyle: React.CSSProperties = {
  marginTop: "36px",
};

const headingStyle: React.CSSProperties = {
  fontFamily: "'Playfair Display', serif",
  fontStyle: "italic",
  fontWeight: 700,
  fontSize: "22px",
  color: "#1C1C1C",
  letterSpacing: "-0.005em",
  marginBottom: "12px",
};

const paragraphStyle: React.CSSProperties = {
  fontFamily: "'Raleway', sans-serif",
  fontWeight: 300,
  fontSize: "15px",
  lineHeight: 1.7,
  color: "#2A2A2A",
  marginBottom: "10px",
};

export default function TermsPage() {
  return (
    <div style={{ minHeight: "100dvh", background: "#FAFAF8", padding: "60px 24px" }}>
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>
        <Link
          href="/"
          style={{
            fontFamily: "'Raleway', sans-serif",
            fontWeight: 500,
            fontSize: "11px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#5C5248",
            textDecoration: "none",
          }}
        >
          ← Back
        </Link>

        <h1
          className="font-playfair"
          style={{
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: "44px",
            color: "#1C1C1C",
            letterSpacing: "-0.01em",
            marginTop: "32px",
            marginBottom: "8px",
          }}
        >
          Terms of Service
        </h1>
        <p
          style={{
            fontFamily: "'Raleway', sans-serif",
            fontStyle: "italic",
            fontWeight: 300,
            fontSize: "13px",
            color: "#8C8279",
            marginBottom: "12px",
          }}
        >
          Last updated: {LAST_UPDATED} · Plain English.
        </p>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>The basics</h2>
          <p style={paragraphStyle}>
            Companion is a personal travel profile, review-matching, and form auto-fill
            tool. By using it, you agree to these terms. If you don't, please don't use
            the service.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Beta service</h2>
          <p style={paragraphStyle}>
            Companion is in beta and provided <em>as-is</em>, without warranties of any
            kind. Features may change, break, or be removed. We'll do our best to keep
            things running smoothly, but we can't guarantee uptime, accuracy of AI-scored
            reviews, or that auto-fill will work on every site.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Your data is yours</h2>
          <p style={paragraphStyle}>
            You own everything you put into Companion — your travel party, preferences
            and favourite stays. You can export it or delete it any time
            from Settings.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Acceptable use</h2>
          <p style={paragraphStyle}>
            Don't use the browser extension or our APIs to scrape travel sites, evade
            their rate limits, harm their infrastructure, or do anything you wouldn't be
            comfortable doing in person at a hotel front desk. Don't impersonate
            others, submit information that isn't yours to submit, or use Companion for
            anything illegal.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Suspension</h2>
          <p style={paragraphStyle}>
            We reserve the right to suspend or terminate accounts that abuse the
            service, attempt to harm other users, or violate these terms.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Governing law</h2>
          <p style={paragraphStyle}>
            These terms are governed by the laws of the State of California, without
            regard to its conflict of law principles.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Disputes &amp; arbitration</h2>
          <p style={paragraphStyle}>
            Any disputes arising out of or relating to these terms or your use of
            Companion will be resolved by binding individual arbitration administered by
            a recognized arbitration body in California, rather than in court. You waive
            the right to a jury trial and to participate in any class action.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Changes</h2>
          <p style={paragraphStyle}>
            We may update these terms occasionally. Material changes will be announced
            via email or in-app notice.
          </p>
        </section>

        <div style={{ marginTop: "60px", textAlign: "center" }}>
          <Link
            href="/privacy"
            style={{
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 400,
              fontSize: "11px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#8C8279",
            }}
          >
            View Privacy Policy →
          </Link>
        </div>
      </div>
    </div>
  );
}
