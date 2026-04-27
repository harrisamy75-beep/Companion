import { Link } from "wouter";

const LAST_UPDATED = "April 18, 2026";

const sectionStyle: React.CSSProperties = {
  marginTop: "40px",
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

const bulletStyle: React.CSSProperties = {
  ...paragraphStyle,
  paddingLeft: "20px",
  marginBottom: "6px",
  position: "relative",
};

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <p style={bulletStyle}>
      <span
        style={{
          position: "absolute",
          left: "4px",
          top: "0",
          color: "#A07840",
        }}
      >
        ·
      </span>
      {children}
    </p>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={sectionStyle}>
      <h2 style={headingStyle}>{title}</h2>
      {children}
    </section>
  );
}

export default function PrivacyPage() {
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
          Privacy Policy
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
          Last updated: {LAST_UPDATED} · Plain English, no legalese.
        </p>

        <Section title="What we collect">
          <Bullet>Account information (name, email — managed via Clerk).</Bullet>
          <Bullet>Travel party details you enter (names, ages, relationships).</Bullet>
          <Bullet>Travel preferences and style selections.</Bullet>
          <Bullet>Favourite properties and hotel brands.</Bullet>
          <Bullet>Usage data — which features you use, when.</Bullet>
        </Section>

        <Section title="Why we collect it">
          <Bullet>To auto-fill travel booking forms on your behalf.</Bullet>
          <Bullet>To match hotel and restaurant reviews to your preferences.</Bullet>
          <Bullet>To generate your travel personality profile using AI.</Bullet>
          <Bullet>To sync your profile to the browser extension.</Bullet>
        </Section>

        <Section title="How we use AI">
          <Bullet>Review scoring uses Anthropic's Claude API.</Bullet>
          <Bullet>Your travel preferences are sent to Claude to score reviews.</Bullet>
          <Bullet>Your profile data is used to generate a personality description.</Bullet>
          <Bullet>We do not use your data to train AI models.</Bullet>
          <Bullet>Anthropic's privacy policy applies to Claude API usage.</Bullet>
        </Section>

        <Section title="Children's data">
          <Bullet>We collect ages of children in your travel party at your request.</Bullet>
          <Bullet>This data is used solely for booking form auto-fill (guest ages).</Bullet>
          <Bullet>We do not knowingly collect data directly from children under 13.</Bullet>
          <Bullet>Parents/guardians control all data entered about their children.</Bullet>
          <Bullet>You can delete any traveler record at any time.</Bullet>
        </Section>

        <Section title="Your rights (CCPA / GDPR)">
          <Bullet><strong style={{ fontWeight: 600 }}>Access</strong> — request a copy of all your data.</Bullet>
          <Bullet><strong style={{ fontWeight: 600 }}>Deletion</strong> — delete your account and all associated data.</Bullet>
          <Bullet><strong style={{ fontWeight: 600 }}>Portability</strong> — export your data as JSON.</Bullet>
          <Bullet><strong style={{ fontWeight: 600 }}>Opt-out</strong> — you can disable AI review scoring in preferences.</Bullet>
        </Section>

        <Section title="Data storage & security">
          <Bullet>Data stored in PostgreSQL database hosted by Replit / Neon.</Bullet>
          <Bullet>Authentication managed by Clerk.</Bullet>
          <Bullet>We do not sell your data. Ever.</Bullet>
        </Section>

        <Section title="Third party services">
          <Bullet>
            Clerk (authentication) —{" "}
            <a href="https://clerk.com/privacy" target="_blank" rel="noreferrer" style={{ color: "#6B2737" }}>
              clerk.com/privacy
            </a>
          </Bullet>
          <Bullet>
            Anthropic Claude API (AI review scoring) —{" "}
            <a href="https://anthropic.com/privacy" target="_blank" rel="noreferrer" style={{ color: "#6B2737" }}>
              anthropic.com/privacy
            </a>
          </Bullet>
          <Bullet>
            Google Places API (hotel search) —{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" style={{ color: "#6B2737" }}>
              policies.google.com/privacy
            </a>
          </Bullet>
          <Bullet>
            Stripe (payments, when enabled) —{" "}
            <a href="https://stripe.com/privacy" target="_blank" rel="noreferrer" style={{ color: "#6B2737" }}>
              stripe.com/privacy
            </a>
          </Bullet>
        </Section>

        <Section title="Contact">
          <Bullet>For privacy requests: privacy@companion.travel</Bullet>
          <Bullet>To delete your account: use Settings → Delete Account in the app.</Bullet>
          <Bullet>We respond within 30 days as required by CCPA.</Bullet>
        </Section>

        <Section title="Updates">
          <p style={paragraphStyle}>Last updated: {LAST_UPDATED}.</p>
          <p style={paragraphStyle}>
            We'll notify users of material changes via email.
          </p>
        </Section>

        <div style={{ marginTop: "60px", textAlign: "center" }}>
          <Link
            href="/terms"
            style={{
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 400,
              fontSize: "11px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#8C8279",
            }}
          >
            View Terms of Service →
          </Link>
        </div>
      </div>
    </div>
  );
}
