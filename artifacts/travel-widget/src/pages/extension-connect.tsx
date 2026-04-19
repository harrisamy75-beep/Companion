import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

export default function ExtensionConnectPage() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/extension-token");
        if (!res.ok) {
          if (!cancelled) setError(`Couldn't issue token (HTTP ${res.status}).`);
          return;
        }
        const data = await res.json();
        if (!cancelled) setToken(data.token);
      } catch (e) {
        if (!cancelled) setError("Network error while issuing token.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCopy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* fall through */
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FAFAF8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
      }}
    >
      <div
        style={{
          maxWidth: 560,
          width: "100%",
          background: "white",
          border: "1px solid #E5E0D8",
          padding: "40px",
        }}
      >
        <p
          style={{
            fontFamily: "'Raleway', sans-serif",
            fontWeight: 600,
            fontSize: "10px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#A07840",
            marginBottom: "16px",
          }}
        >
          Browser Extension
        </p>
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: "28px",
            color: "#1C1C1C",
            marginBottom: "10px",
            lineHeight: 1.25,
          }}
        >
          Connect your extension
        </h1>
        <p
          style={{
            fontFamily: "'Raleway', sans-serif",
            fontWeight: 300,
            fontSize: "14px",
            color: "#5C5248",
            lineHeight: 1.55,
            marginBottom: "28px",
          }}
        >
          Copy the token below and paste it into the TripProfile extension popup.
          The token is valid for 7&nbsp;days; come back to this page any time to refresh it.
        </p>

        {error && (
          <p
            style={{
              fontFamily: "'Raleway', sans-serif",
              color: "#6B2737",
              fontSize: "13px",
              padding: "12px 14px",
              background: "rgba(107,39,55,0.06)",
              border: "1px solid rgba(107,39,55,0.2)",
              marginBottom: "20px",
            }}
          >
            {error}
          </p>
        )}

        {!token && !error && (
          <p
            style={{
              fontFamily: "'Raleway', sans-serif",
              fontStyle: "italic",
              color: "#94A39B",
              fontSize: "13px",
            }}
          >
            Issuing your token…
          </p>
        )}

        {token && (
          <>
            <div
              style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: "11px",
                color: "#1C1C1C",
                background: "#F5F0E6",
                border: "1px solid #E5E0D8",
                padding: "14px 16px",
                wordBreak: "break-all",
                lineHeight: 1.5,
                marginBottom: "16px",
                userSelect: "all",
              }}
            >
              {token}
            </div>
            <button
              onClick={handleCopy}
              style={{
                background: "#6B2737",
                color: "white",
                border: "none",
                padding: "12px 24px",
                fontFamily: "'Raleway', sans-serif",
                fontWeight: 600,
                fontSize: "11px",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              {copied ? "Copied ✓" : "Copy token"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
