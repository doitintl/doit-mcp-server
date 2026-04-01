import { Layout } from "../components/Layout";
import { ActionButton } from "../components/ActionButton";

export function Onboarding() {
  return (
    <Layout>
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "12px",
        padding: "24px 16px",
      }}>
        <div style={{
          width: "48px",
          height: "48px",
          borderRadius: "12px",
          background: "var(--dci-bg-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.5rem",
        }}
          aria-hidden="true"
        >
          🔒
        </div>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--dci-text)" }}>
          DoiT Cloud Intelligence
        </h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--dci-text-secondary)", maxWidth: "320px" }}>
          Connect your DoiT account to analyze cloud costs, track budgets, and monitor anomalies.
        </p>
        <ActionButton label="Ask about your cloud costs" onClick={() => {}} variant="primary" />
      </div>
    </Layout>
  );
}
