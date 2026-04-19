import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { apiFetch } from "@/lib/api";

export default function SettingsExtensionPage() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch("/api/extension/key");
        if (r.ok) {
          const data = await r.json();
          setApiKey(data.apiKey);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const copy = useCallback(() => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [apiKey]);

  const regenerate = useCallback(async () => {
    setRegenerating(true);
    try {
      const r = await apiFetch("/api/extension/key/regenerate", { method: "POST" });
      if (r.ok) {
        const data = await r.json();
        setApiKey(data.apiKey);
        setConfirmRegen(false);
      }
    } finally {
      setRegenerating(false);
    }
  }, []);

  return (
    <Layout>
      <div style={{ maxWidth: 720 }}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: 18 }}>
          <Link
            href="/settings"
            style={{
              fontFamily: "'Raleway', sans-serif",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#5C5248",
              textDecoration: "none",
            }}
          >
            ← Settings
          </Link>
        </div>

        {/* Eyebrow + title */}
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
            Browser Extension
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
            Connect your extension
          </h1>
          <p
            style={{
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 300,
              fontSize: 14,
              color: "#5C5248",
              marginTop: 10,
              lineHeight: 1.6,
            }}
          >
            Use this key to link the Companion Chrome extension to your account.
            Keep it private — anyone with this key can read your travel profile.
          </p>
        </div>

        {/* Key box */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 600,
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#A07840",
              marginBottom: 10,
            }}
          >
            Your API key
          </div>

          <div
            style={{
              border: "1px solid #6B2737",
              background: "#FAFAF8",
              padding: "16px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              borderRadius: 2,
            }}
          >
            <code
              style={{
                fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
                fontSize: 14,
                color: "#1C1C1C",
                wordBreak: "break-all",
                flex: 1,
                userSelect: "all",
              }}
            >
              {loading ? "Loading…" : apiKey ?? "—"}
            </code>
            <button
              type="button"
              onClick={copy}
              disabled={!apiKey}
              style={{
                fontFamily: "'Raleway', sans-serif",
                fontWeight: 600,
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                background: "#6B2737",
                border: "none",
                color: "white",
                padding: "8px 16px",
                cursor: apiKey ? "pointer" : "default",
                flexShrink: 0,
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
            {confirmRegen ? (
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span
                  style={{
                    fontFamily: "'Raleway', sans-serif",
                    fontStyle: "italic",
                    fontSize: 12,
                    color: "#6B2737",
                  }}
                >
                  This invalidates the old key. Continue?
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmRegen(false)}
                  disabled={regenerating}
                  style={{
                    fontFamily: "'Raleway', sans-serif",
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    background: "transparent",
                    border: "none",
                    color: "#5C5248",
                    cursor: regenerating ? "default" : "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={regenerate}
                  disabled={regenerating}
                  style={{
                    fontFamily: "'Raleway', sans-serif",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    background: "#6B2737",
                    border: "none",
                    color: "white",
                    padding: "6px 14px",
                    cursor: regenerating ? "default" : "pointer",
                  }}
                >
                  {regenerating ? "Regenerating…" : "Yes, regenerate"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRegen(true)}
                style={{
                  fontFamily: "'Raleway', sans-serif",
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  background: "transparent",
                  border: "none",
                  color: "#6B2737",
                  textDecoration: "underline",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Regenerate key
              </button>
            )}
          </div>
        </div>

        {/* Steps */}
        <div style={{ marginTop: 36 }}>
          <div
            style={{
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 600,
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#A07840",
              marginBottom: 18,
            }}
          >
            How to connect
          </div>
          <ol
            style={{
              listStyle: "none",
              counterReset: "step",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            {[
              "Copy your API key above.",
              "Click the Companion icon in your Chrome toolbar.",
              "Paste your key and click Save & Sync.",
            ].map((step, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "flex-start",
                  fontFamily: "'Raleway', sans-serif",
                  fontSize: 14,
                  color: "#1C1C1C",
                  lineHeight: 1.6,
                }}
              >
                <span
                  className="font-playfair"
                  style={{
                    fontStyle: "italic",
                    fontSize: 22,
                    color: "#A07840",
                    minWidth: 28,
                    lineHeight: 1.2,
                  }}
                >
                  {i + 1}.
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Layout>
  );
}
