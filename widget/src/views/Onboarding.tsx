import { useState, useEffect } from "preact/hooks";
import { Layout } from "../components/Layout";
import { DOIT_LOGO_BASE64 } from "../icons/doitLogo";

export function Onboarding() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const duration = 4000; // 4 seconds to reach ~95%
    const tick = () => {
      const elapsed = Date.now() - start;
      // Ease-out curve: fast start, slows near the end, never quite reaches 100
      const t = Math.min(elapsed / duration, 1);
      const value = Math.round(t < 1 ? t * (2 - t) * 95 : 95);
      setProgress(value);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
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
          maxWidth: "340px",
          margin: 0,
          lineHeight: 1.4,
        }}>
          Agentic FinOps Platform for AWS, Google Cloud, Azure, OCI and 37 SaaS platforms
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
              background: "var(--dci-accent, #4285F4)",
              transition: "width 0.1s linear",
            }} />
          </div>
          <p style={{
            fontSize: "0.6875rem",
            color: "var(--dci-text-secondary)",
            marginTop: "6px",
          }}>
            Loading your cloud data…
          </p>
        </div>
      </div>
    </Layout>
  );
}
