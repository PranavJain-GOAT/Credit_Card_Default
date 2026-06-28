import WhatIfSimulator from './WhatIfSimulator';

function DiagRow({ label, value, status, statusColor }) {
  return (
    <tr>
      <td className="modal-td-label">{label}</td>
      <td className="modal-td-val">{value}</td>
      <td style={{ fontWeight: 'bold', color: statusColor, fontSize: '11px', padding: '6px 0', fontFamily: 'IBM Plex Mono, monospace' }}>{status}</td>
    </tr>
  );
}

function ShapBars({ contributions }) {
  if (!contributions || contributions.length === 0) return null;
  return (
    <div className="shap-bars-container">
      {contributions.map((contrib, i) => {
        const absVal = Math.min(50, Math.abs(contrib.impact) * 45);
        return (
          <div key={i} className="shap-bar-row">
            <span className="shap-feat-name">{contrib.feature}</span>
            <div className="shap-track">
              <div
                className={`shap-bar ${contrib.impact >= 0 ? 'positive' : 'negative'}`}
                style={{ width: `${absVal}%` }}
              ></div>
            </div>
            <span className="shap-feat-val">{contrib.value}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardTab({ results, applicant, theme }) {
  if (!results) {
    return (
      <div className="welcome-card card" id="no-prediction-welcome">
        <div className="welcome-icon">
          <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2>No Assessment Active</h2>
        <p>Submit an applicant through the <strong>New Assessment</strong> tab to view risk analysis here.</p>
      </div>
    );
  }

  const scores = results.scores || {};
  const app = applicant || {};

  const dtiVal = scores.dti_ratio ?? 0;
  const ltvVal = scores.ltv_ratio ?? 0;
  const creditIncomeVal = scores.credit_to_income ?? 0;
  const delinqVal = scores.delinquency_rate ?? 0;
  const ext1 = parseFloat(app.ext_source_1 ?? 0.5);
  const ext2 = parseFloat(app.ext_source_2 ?? 0.5);
  const ext3 = parseFloat(app.ext_source_3 ?? 0.5);
  const extAvg = (ext1 + ext2 + ext3) / 3;
  const creditAge = app.avg_credit_age_days ?? 0;
  const refused = app.refused_count ?? 0;
  const tenure = parseFloat(app.years_employed ?? 0);

  const ok = 'var(--success-color)';
  const bad = 'var(--danger-color)';
  const warn = 'var(--warning-color)';

  return (
    <div id="prediction-dashboard-grid">

      {/* KPI Cards */}
      <div className="kpi-grid" id="kpi-grid-row">
        <div className="kpi-card kpi-danger">
          <span className="kpi-label">Default Probability</span>
          <div id="kpi-default-prob" className="kpi-value mono">{(results.default_probability * 100).toFixed(1)}%</div>
          <span className="kpi-subtext">P(Default | CatBoost)</span>
        </div>
        <div className="kpi-card kpi-success">
          <span className="kpi-label">Non-Default Probability</span>
          <div id="kpi-non-default-prob" className="kpi-value mono">{(results.non_default_probability * 100).toFixed(1)}%</div>
          <span className="kpi-subtext">Repayment likelihood</span>
        </div>
        <div className="kpi-card kpi-accent">
          <span className="kpi-label">Risk Score</span>
          <div id="kpi-risk-score" className="kpi-value mono">{results.risk_score}/100</div>
          <span id="kpi-subtext-risk" className="kpi-subtext">Category: {results.risk_category}</span>
        </div>
        <div id="decision-kpi-card" className="kpi-card highlight-card" style={{ borderLeft: `5px solid ${results.decision_color}` }}>
          <span className="kpi-label">Credit Decision</span>
          <div id="kpi-decision" className="kpi-value" style={{ color: results.decision_color, fontSize: '16px', letterSpacing: '0.02em' }}>{results.decision}</div>
          <span id="kpi-decision-reason" className="kpi-subtext">{results.reasoning}</span>
        </div>
      </div>

      {/* Risk Meter + Summary */}
      <div className="dashboard-row col-8-4" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div className="card fill-height" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <h3>AI Executive Summary</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>📄 Export PDF</button>
          </div>
          <div className="card-body" style={{ padding: '20px' }}>
            {/* Risk Meter */}
            <div className="risk-band-container">
              <div className="risk-band-label">Default Risk Indicator</div>
              <div className="risk-band-track" style={{ position: 'relative' }}>
                <div id="risk-needle" className="risk-needle" style={{ left: `${results.risk_score}%` }}></div>
              </div>
              <div className="risk-band-legend">
                <span>Low Risk</span><span>Moderate</span><span>High Risk</span>
              </div>
            </div>
            <div className="divider" style={{ margin: '16px 0' }}></div>
            {/* Summary */}
            <div className="executive-summary-section" style={{ padding: 0 }}>
              <h4>Executive Summary</h4>
              <p id="summary-ai-content" className="summary-text">{results.executive_summary}</p>
            </div>
          </div>
        </div>

        {/* SHAP Contributions */}
        <div className="card fill-height">
          <div className="card-header"><h3>SHAP Feature Contributions</h3></div>
          <div className="card-desc">Top 7 drivers influencing the model prediction. Red bars = higher default risk.</div>
          <ShapBars contributions={results.contributions} />
        </div>
      </div>

      {/* Factors Row */}
      <div className="dashboard-row col-2" style={{ marginBottom: '16px' }}>
        <div className="card">
          <div className="card-header"><h3>✓ Positive Risk Factors</h3></div>
          <div className="factor-box">
            <ul className="factor-list" id="positive-factors-list">
              {(results.strengths && results.strengths.length > 0)
                ? results.strengths.map((s, i) => <li key={i}>{s}</li>)
                : <li>No outstanding positive risk offsets detected.</li>}
            </ul>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>✗ Risk Warning Factors</h3></div>
          <div className="factor-box">
            <ul className="factor-list" id="risk-factors-list">
              {(results.weaknesses && results.weaknesses.length > 0)
                ? results.weaknesses.map((w, i) => <li key={i}>{w}</li>)
                : <li>No high-priority default warning flags active.</li>}
            </ul>
          </div>
          <div className="recommendations-box">
            <h4>📋 Actionable Recommendations</h4>
            <ul className="rec-list" id="recommendations-list">
              {(results.recommendations || []).map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        </div>
      </div>

      {/* Compliance & Bureau */}
      <div className="diagnostics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div className="card">
          <div className="card-header"><h3>Policy Compliance & Ratios</h3></div>
          <div className="card-body" style={{ padding: '0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <DiagRow label="Debt-to-Income (DTI)" value={`${dtiVal.toFixed(1)}%`} status={dtiVal <= 40 ? 'COMPLIANT' : 'BREACH'} statusColor={dtiVal <= 40 ? ok : bad} />
                <DiagRow label="Loan-to-Value (LTV)" value={`${ltvVal.toFixed(1)}%`} status={ltvVal <= 80 ? 'COMPLIANT' : 'BREACH'} statusColor={ltvVal <= 80 ? ok : bad} />
                <DiagRow label="Credit-to-Income" value={`${creditIncomeVal.toFixed(2)}x`} status={creditIncomeVal <= 3 ? 'COMPLIANT' : 'BREACH'} statusColor={creditIncomeVal <= 3 ? ok : bad} />
                <DiagRow label="Delinquency Rate" value={`${delinqVal.toFixed(1)}%`} status={delinqVal <= 5 ? 'COMPLIANT' : 'BREACH'} statusColor={delinqVal <= 5 ? ok : bad} />
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>Bureau Credit Standing</h3></div>
          <div className="card-body" style={{ padding: '0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <DiagRow label="Avg Bureau Score" value={extAvg.toFixed(3)} status={extAvg >= 0.60 ? 'EXCELLENT' : extAvg >= 0.50 ? 'ACCEPTABLE' : 'SUBSTANDARD'} statusColor={extAvg >= 0.60 ? ok : extAvg >= 0.50 ? warn : bad} />
                <DiagRow label="Credit History Age" value={`${Math.round(creditAge).toLocaleString()} days`} status={creditAge >= 1000 ? 'COMPLIANT' : 'SHORT'} statusColor={creditAge >= 1000 ? ok : warn} />
                <DiagRow label="Refused Applications" value={refused} status={refused === 0 ? 'COMPLIANT' : `BREACH (${refused})`} statusColor={refused === 0 ? ok : bad} />
                <DiagRow label="Employment Tenure" value={`${tenure.toFixed(1)} yrs`} status={tenure >= 3 ? 'COMPLIANT' : 'SHORT'} statusColor={tenure >= 3 ? ok : warn} />
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* What-If Simulator */}
      <WhatIfSimulator applicant={applicant} originalProb={results.default_probability} />
    </div>
  );
}
