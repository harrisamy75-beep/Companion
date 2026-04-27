import { useState, useEffect, useCallback } from "react";
import { useUser, useClerk } from "@clerk/react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { apiFetch } from "@/lib/api";

interface Preferences {
  id?: number;
  aiReviewScoringEnabled?: boolean;
  personalityEnabled?: boolean;
  consentGivenAt?: string | null;
  consentVersion?: string | null;
}

const sectionStyle: React.CSSProperties = {
  marginBottom: "44px",
};

const sectionHeading: React.CSSProperties = {
  fontFamily: "'Raleway', sans-serif",
  fontWeight: 600,
  fontSize: "10px",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#A07840",
  marginBottom: "18px",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "'Raleway', sans-serif",
  fontWeight: 500,
  fontSize: "14px",
  color: "#1C1C1C",
};

const helpStyle: React.CSSProperties = {
  fontFamily: "'Raleway', sans-serif",
  fontWeight: 300,
  fontSize: "12px",
  color: "#5C5248",
  marginTop: "4px",
  lineHeight: 1.5,
};

const valueStyle: React.CSSProperties = {
  fontFamily: "'Raleway', sans-serif",
  fontWeight: 400,
  fontSize: "14px",
  color: "#5C5248",
};

function Toggle({
  on,
  onChange,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      style={{
        position: "relative",
        width: 40,
        height: 22,
        borderRadius: 12,
        background: on ? "#6B2737" : "#DDD8CE",
        border: "none",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "background 0.15s",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "white",
          transition: "left 0.15s",
          boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  );
}

function Row({
  label,
  help,
  right,
}: {
  label: React.ReactNode;
  help?: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 24,
        padding: "16px 0",
        borderBottom: "1px solid #F0EBE3",
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={labelStyle}>{label}</div>
        {help && <div style={helpStyle}>{help}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{right}</div>
    </div>
  );
}

function DeleteAccountModal({
  onCancel,
  onConfirm,
  busy,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const [text, setText] = useState("");
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(28,28,28,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 100,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FAFAF8",
          border: "1px solid #E5E0D8",
          borderRadius: 4,
          padding: "32px 28px",
          maxWidth: 460,
          width: "100%",
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
        }}
      >
        <h3
          className="font-playfair"
          style={{
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: 22,
            color: "#1C1C1C",
            marginBottom: 12,
          }}
        >
          Delete your account?
        </h3>
        <p
          style={{
            fontFamily: "'Raleway', sans-serif",
            fontWeight: 300,
            fontSize: 14,
            color: "#2A2A2A",
            lineHeight: 1.6,
            marginBottom: 20,
          }}
        >
          This permanently deletes your profile, travel party, favourite stays
          and all preferences. This cannot be undone.
        </p>
        <p
          style={{
            fontFamily: "'Raleway', sans-serif",
            fontSize: 12,
            color: "#5C5248",
            marginBottom: 8,
            letterSpacing: "0.04em",
          }}
        >
          Type <strong style={{ color: "#1C1C1C" }}>DELETE</strong> to confirm.
        </p>
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="input-underline"
          style={{ width: "100%", marginBottom: 24 }}
          placeholder="DELETE"
        />
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              fontFamily: "'Raleway', sans-serif",
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              background: "transparent",
              border: "1px solid #E5E0D8",
              color: "#5C5248",
              padding: "10px 18px",
              cursor: busy ? "default" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={text !== "DELETE" || busy}
            style={{
              fontFamily: "'Raleway', sans-serif",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              background: text === "DELETE" && !busy ? "#6B2737" : "#B6A89B",
              border: "none",
              color: "white",
              padding: "10px 18px",
              cursor: text === "DELETE" && !busy ? "pointer" : "default",
            }}
          >
            {busy ? "Deleting…" : "Delete everything"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const [, setLocation] = useLocation();
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [savingToggle, setSavingToggle] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [emailUpdates, setEmailUpdates] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch("/api/preferences");
        if (r.ok) {
          const data = await r.json();
          setPrefs({
            id: data.id,
            aiReviewScoringEnabled: data.aiReviewScoringEnabled ?? true,
            personalityEnabled: data.personalityEnabled ?? true,
            consentGivenAt: data.consentGivenAt ?? null,
            consentVersion: data.consentVersion ?? null,
          });
        }
      } catch {
        setPrefs({ aiReviewScoringEnabled: true, personalityEnabled: true });
      }
    })();
  }, []);

  const updatePref = useCallback(
    async (
      key: "aiReviewScoringEnabled" | "personalityEnabled",
      value: boolean,
    ) => {
      setSavingToggle(key);
      setPrefs((p) => ({ ...(p ?? {}), [key]: value }));
      try {
        await apiFetch("/api/preferences", {
          method: "PUT",
          body: JSON.stringify({ [key]: value }),
        });
      } finally {
        setSavingToggle(null);
      }
    },
    [],
  );

  const handleExport = useCallback(async () => {
    setExportBusy(true);
    try {
      const r = await apiFetch("/api/account/export");
      if (!r.ok) return;
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "companion-data.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExportBusy(false);
    }
  }, []);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await apiFetch("/api/account", { method: "DELETE" });
      await signOut();
      setLocation("/");
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  }, [signOut, setLocation]);

  const display = user?.fullName || user?.firstName || "—";
  const email = user?.primaryEmailAddress?.emailAddress || "—";

  return (
    <Layout>
      <div style={{ maxWidth: 720 }}>
        <div style={{ marginBottom: 36 }}>
          <span
            style={{
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 600,
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#A07840",
            }}
          >
            Settings
          </span>
          <h1
            className="font-playfair"
            style={{
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 40,
              color: "#1C1C1C",
              letterSpacing: "-0.01em",
              marginTop: 6,
            }}
          >
            Your account
          </h1>
        </div>

        <section style={sectionStyle}>
          <div style={sectionHeading}>Account</div>
          <Row label="Display name" right={<span style={valueStyle}>{display}</span>} />
          <Row label="Email" right={<span style={valueStyle}>{email}</span>} />
          <Row
            label="Manage account"
            help="Change password, email, or social connections via Clerk."
            right={
              <button
                type="button"
                onClick={() => openUserProfile()}
                style={{
                  fontFamily: "'Raleway', sans-serif",
                  fontWeight: 600,
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  background: "transparent",
                  border: "1px solid #E5E0D8",
                  color: "#1C1C1C",
                  padding: "8px 16px",
                  cursor: "pointer",
                }}
              >
                Manage account →
              </button>
            }
          />
        </section>

        <section style={sectionStyle}>
          <div style={sectionHeading}>Privacy &amp; data</div>
          <Row
            label="Export my data"
            help="Download all your travelers, preferences and stays as JSON."
            right={
              <button
                type="button"
                onClick={handleExport}
                disabled={exportBusy}
                style={{
                  fontFamily: "'Raleway', sans-serif",
                  fontWeight: 600,
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  background: "transparent",
                  border: "1px solid #E5E0D8",
                  color: "#1C1C1C",
                  padding: "8px 16px",
                  cursor: exportBusy ? "default" : "pointer",
                }}
              >
                {exportBusy ? "Preparing…" : "Export"}
              </button>
            }
          />
          <Row
            label="Delete my account"
            help="Permanently removes your profile and all related data. Cannot be undone."
            right={
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                style={{
                  fontFamily: "'Raleway', sans-serif",
                  fontWeight: 600,
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  background: "transparent",
                  border: "1px solid #6B2737",
                  color: "#6B2737",
                  padding: "8px 16px",
                  cursor: "pointer",
                }}
              >
                Delete account
              </button>
            }
          />
        </section>

        <section style={sectionStyle}>
          <div style={sectionHeading}>AI features</div>
          <Row
            label="AI review scoring"
            help="Use Claude to score and match hotel & restaurant reviews. Off = neutral scores, no AI calls."
            right={
              <Toggle
                on={prefs?.aiReviewScoringEnabled ?? true}
                disabled={!prefs || savingToggle === "aiReviewScoringEnabled"}
                onChange={(v) => updatePref("aiReviewScoringEnabled", v)}
              />
            }
          />
          <Row
            label="Travel personality profile"
            help="Generate an editorial paragraph describing your travel style. Off = personality is not generated."
            right={
              <Toggle
                on={prefs?.personalityEnabled ?? true}
                disabled={!prefs || savingToggle === "personalityEnabled"}
                onChange={(v) => updatePref("personalityEnabled", v)}
              />
            }
          />
        </section>

        <section style={sectionStyle}>
          <div style={sectionHeading}>Browser extension</div>
          <Row
            label="Connect your extension"
            help="Get an API key for the Companion Chrome extension to auto-fill booking forms."
            right={
              <Link
                href="/settings/extension"
                style={{
                  fontFamily: "'Raleway', sans-serif",
                  fontWeight: 600,
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  background: "transparent",
                  border: "1px solid #E5E0D8",
                  color: "#1C1C1C",
                  padding: "8px 16px",
                  cursor: "pointer",
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                Manage →
              </Link>
            }
          />
        </section>

        <section style={sectionStyle}>
          <div style={sectionHeading}>Notifications</div>
          <Row
            label="Email updates about new features"
            help="Email notifications coming soon."
            right={<Toggle on={emailUpdates} onChange={setEmailUpdates} />}
          />
        </section>

        {showDelete && (
          <DeleteAccountModal
            onCancel={() => !deleting && setShowDelete(false)}
            onConfirm={handleDelete}
            busy={deleting}
          />
        )}
      </div>
    </Layout>
  );
}
