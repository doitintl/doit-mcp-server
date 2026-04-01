import { useState, useEffect } from "preact/hooks";
import { Layout } from "../components/Layout";
import { DOIT_LOGO_BASE64 } from "../icons/doitLogo";

const LOADING_MESSAGES = [
  "Crunching your cloud numbers...",
  "Asking AWS, GCP, and Azure to share their secrets...",
  "Negotiating with the cloud gods...",
  "Teaching AI to read your invoices...",
  "Turning cloud chaos into clarity...",
  "Hunting for cost anomalies...",
  "Making FinOps look easy...",
  "Calculating how much coffee your cloud bill could buy...",
  "Almost there, just counting the zeros...",
];

export function Onboarding() {
  const [progress, setProgress] = useState(0);
  const [messageIdx, setMessageIdx] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const duration = 4000;
    const tick = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(elapsed / duration, 1);
      const value = Math.round(t < 1 ? t * (2 - t) * 95 : 95);
      setProgress(value);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <Layout>
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "14px",
        padding: "28px 16px",
      }}>
        <img
          src={DOIT_LOGO_BASE64}
          alt="DoiT logo"
          width={48}
          height={48}
          style={{ borderRadius: "10px" }}
        />
        <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--dci-text)", margin: 0 }}>
          DoiT Cloud Intelligence&trade;
        </h2>
        <p style={{
          fontSize: "0.8125rem",
          color: "var(--dci-text-secondary)",
          margin: 0,
          whiteSpace: "nowrap",
        }}>
          FinOps for AWS, Google Cloud, Azure, OCI &amp; 40+ SaaS platforms
        </p>
        <div style={{ width: "100%", maxWidth: "280px", marginTop: "4px" }}>
          <div style={{
            height: "4px",
            borderRadius: "2px",
            background: "var(--dci-border, #e5e7eb)",
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              borderRadius: "2px",
              width: `${progress}%`,
              background: "#FC3165",
              transition: "width 0.1s linear",
            }} />
          </div>
          <p style={{
            fontSize: "0.6875rem",
            color: "var(--dci-text-secondary)",
            marginTop: "6px",
            minHeight: "1.2em",
          }}>
            {LOADING_MESSAGES[messageIdx]}
          </p>
        </div>
      </div>
    </Layout>
  );
}
