import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from 'chart.js';
import { Radar, Bar } from 'react-chartjs-2';

ChartJS.register(
  RadialLinearScale, PointElement, LineElement, Filler,
  Tooltip, Legend, CategoryScale, LinearScale, BarElement
);

export default function AnalysisTab({ results, applicant, theme }) {
  if (!results) {
    return (
      <div className="welcome-card card" id="no-prediction-analysis">
        <div className="welcome-icon">
          <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <h2>No Analysis Available</h2>
        <p>Run a credit assessment first to view financial health charts.</p>
      </div>
    );
  }

  const scores = results.scores || {};
  const app = applicant || {};
  const isDark = theme === 'dark';

  const gridColor = isDark ? 'rgba(48,54,61,0.8)' : 'rgba(221,226,234,1)';
  const textColor = isDark ? '#6e7681' : '#8b949e';
  const labelColor = isDark ? '#e6edf3' : '#0f1923';

  const dtiVal = scores.dti_ratio ?? 0;
  const ltvVal = scores.ltv_ratio ?? 0;
  const surplusVal = scores.monthly_surplus ?? 0;

  const clamp = (val) => Math.min(100, Math.max(0, val ?? 0));

  const radarData = {
    labels: ['Liability Mitigation (Low DTI)', 'Income Margin (Low Annuity)', 'Payment Discipline (Low Delay)', 'Credit Stability (Tenure/Assets)', 'Equity Cover (Low LTV)'],
    datasets: [{
      label: 'Applicant Risk Profile',
      data: [
        clamp(100 - dtiVal),
        clamp(100 - ((scores.annuity_to_income ?? 0) * 200)),
        clamp(100 - (scores.delinquency_rate ?? 0)),
        clamp(scores.stability_score ?? 0),
        clamp(100 - ltvVal),
      ],
      backgroundColor: 'rgba(31,111,235,0.12)',
      borderColor: '#1f6feb',
      borderWidth: 2,
      pointBackgroundColor: '#1f6feb',
      pointBorderColor: isDark ? '#1c2230' : '#ffffff',
      pointHoverBackgroundColor: '#388bfd',
      pointHoverBorderColor: '#388bfd',
    }],
  };

  const radarOptions = {
    responsive: true, maintainAspectRatio: false,
    scales: {
      r: {
        angleLines: { color: gridColor },
        grid: { color: gridColor },
        pointLabels: { color: labelColor, font: { size: 10, family: 'IBM Plex Sans', weight: '600' } },
        ticks: { backdropColor: 'transparent', color: textColor, font: { size: 9 }, stepSize: 20 },
        min: 0, max: 100,
      },
    },
    plugins: { legend: { display: false } },
  };

  const barData = {
    labels: ['Current Request', 'Avg Prior Approved', 'Max Prior Limit', 'Avg Prior Goods'],
    datasets: [{
      data: [app.loan_amount, app.avg_prev_credit || 0, app.max_prev_credit || 0, (app.avg_prev_credit || 0) * 0.95],
      backgroundColor: ['rgba(31,111,235,0.85)', 'rgba(46,160,67,0.75)', 'rgba(46,160,67,0.55)', 'rgba(210,153,34,0.75)'],
      borderRadius: 3, maxBarThickness: 48,
    }],
  };

  const barOptions = {
    responsive: true, maintainAspectRatio: false,
    scales: {
      x: { grid: { display: false }, ticks: { color: textColor, font: { size: 11, family: 'IBM Plex Sans' } } },
      y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10, family: 'IBM Plex Mono' }, callback: (v) => '$' + (v / 1000).toFixed(0) + 'k' } },
    },
    plugins: { legend: { display: false } },
  };

  const dtiColor = dtiVal <= 36 ? 'var(--success)' : dtiVal <= 45 ? 'var(--warning)' : 'var(--danger)';
  const ltvColor = ltvVal <= 80 ? 'var(--success)' : ltvVal <= 95 ? 'var(--warning)' : 'var(--danger)';
  const surplusColor = surplusVal >= 0 ? 'var(--success)' : 'var(--danger)';
  const surplusStr = (surplusVal >= 0 ? '+$' : '-$') + Math.abs(surplusVal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let cfBadgeClass = 'cf-insight-badge good';
  let cfBadgeText = 'Adequate Surplus';
  let cfInsight = 'Applicant exhibits a comfortable monthly surplus and DTI ratio is within normal limits. The cash flow supports this new loan obligation.';
  if (surplusVal < 0) { cfBadgeClass = 'cf-insight-badge danger'; cfBadgeText = 'Deficit Risk'; cfInsight = 'The applicant is facing a negative monthly surplus. Essential cash reserves are insufficient to cover this requested loan servicing.'; }
  else if (dtiVal > 40) { cfBadgeClass = 'cf-insight-badge warning'; cfBadgeText = 'High Debt Leverage'; cfInsight = 'Combined Debt-to-Income is above the warning threshold (40%). Re-check supplementary assets and bureau history.'; }

  const scorecardRows = [
    { title: 'Credit-to-Income Ratio', desc: 'Loan amount relative to annual income', value: scores.credit_to_income?.toFixed(2), color: 'var(--text-primary)' },
    { title: 'Annuity-to-Income Ratio', desc: 'Monthly payment as a % of monthly income', value: scores.annuity_to_income != null ? `${(scores.annuity_to_income * 100).toFixed(1)}%` : '--', color: 'var(--text-primary)' },
    { title: 'Debt-to-Income (DTI)', desc: 'Total debt obligations vs gross income', value: `${dtiVal.toFixed(1)}%`, color: dtiColor },
    { title: 'Loan-to-Value (LTV)', desc: 'Loan amount vs collateral goods price', value: `${ltvVal.toFixed(1)}%`, color: ltvColor },
    { title: 'Monthly Net Surplus', desc: 'Income minus all proposed debt payments', value: surplusStr, color: surplusColor },
  ];

  return (
    <div id="analysis-grid">
      {/* Analysis row 1: Scorecard + Radar */}
      <div className="dashboard-row col-2 analysis-row-1" style={{ marginBottom: '16px' }}>
        <div className="card">
          <div className="card-header"><h3>Financial Health Indicators</h3></div>
          <div className="indicator-scorecard-list">
            {scorecardRows.map((row, i) => (
              <div key={i} className="scorecard-row">
                <div className="scorecard-info">
                  <div className="scorecard-title">{row.title}</div>
                  <div className="scorecard-desc">{row.desc}</div>
                </div>
                <div className="scorecard-metric" style={{ color: row.color }}>{row.value}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>Financial Health Radar</h3></div>
          <div className="chart-wrapper" style={{ height: '280px' }}>
            <Radar data={radarData} options={radarOptions} />
          </div>
        </div>
      </div>

      {/* Analysis row 2: Bar Chart + Cash Flow */}
      <div className="dashboard-row col-2" style={{ marginBottom: '16px' }}>
        <div className="card">
          <div className="card-header"><h3>Credit Limit Comparison</h3></div>
          <div className="chart-wrapper" style={{ height: '260px' }}>
            <Bar data={barData} options={barOptions} />
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>Monthly Cash Flow Breakdown</h3></div>
          <div className="cash-flow-breakdown-grid">
            <div className="breakdown-card">
              <div className="breakdown-label">Monthly Income</div>
              <div id="cf-monthly-income" className="breakdown-value">${scores.monthly_income?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="breakdown-subtext">Gross annual / 12</div>
            </div>
            <div className="breakdown-card">
              <div className="breakdown-label">Proposed Payment</div>
              <div id="cf-proposed-payment" className="breakdown-value">${scores.monthly_proposed_payment?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="breakdown-subtext">New loan annuity / 12</div>
            </div>
            <div className="breakdown-card">
              <div className="breakdown-label">Existing Payments</div>
              <div id="cf-existing-payment" className="breakdown-value">${scores.monthly_existing_payment?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="breakdown-subtext">Current total debt / 12</div>
            </div>
            <div className="breakdown-card">
              <div className="breakdown-label">Net Surplus</div>
              <div id="cf-cash-surplus" className="breakdown-value" style={{ color: surplusColor }}>{surplusStr}</div>
              <div className="breakdown-subtext">Income minus all payments</div>
            </div>
          </div>
          <div className="cf-insights-summary">
            <span className={cfBadgeClass}>{cfBadgeText}</span>
            <p id="cf-insight-text" className="cf-insight-text">{cfInsight}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
