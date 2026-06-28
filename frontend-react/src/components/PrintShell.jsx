import { useEffect } from 'react';

export default function PrintShell({ results, applicant }) {
  // Listen for print events and populate the hidden print shell
  useEffect(() => {
    const beforePrint = () => {
      if (!results || !applicant) return;

      const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };

      set('p-name', applicant.name);
      set('p-age-gender', `${Math.round(applicant.age)} / ${applicant.gender}`);
      set('p-date', new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }));

      const decNode = document.getElementById('p-decision');
      if (decNode) { decNode.innerText = results.decision; decNode.style.color = results.decision_color; }

      set('p-prob', `${(results.default_probability * 100).toFixed(1)}%`);
      set('p-risk-cat', results.risk_category);
      set('p-ratio-credit', results.scores.credit_to_income.toFixed(2));
      set('p-ratio-annuity', `${(results.scores.annuity_to_income * 100).toFixed(1)}%`);
      set('p-summary', results.executive_summary);
      set('p-score-dti', `${results.scores.dti_ratio.toFixed(1)}%`);
      set('p-score-ltv', `${results.scores.ltv_ratio.toFixed(1)}%`);
      set('p-score-stability', Math.round(results.scores.stability_score));
      set('p-score-delinquency', `${results.scores.delinquency_rate.toFixed(1)}%`);

      const populateList = (id, items) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = '';
        (items.length > 0 ? items : ['None detected.']).forEach(item => {
          const li = document.createElement('li'); li.innerText = item; el.appendChild(li);
        });
      };
      populateList('p-strengths', results.strengths || []);
      populateList('p-weaknesses', results.weaknesses || []);
      populateList('p-recommendations', results.recommendations || []);
    };

    window.addEventListener('beforeprint', beforePrint);
    return () => window.removeEventListener('beforeprint', beforePrint);
  }, [results, applicant]);

  if (!results || !applicant) return null;

  return (
    <div className="print-shell" id="print-shell">
      <div className="print-header">
        <div className="print-logo">NEXUS RISK</div>
        <div className="print-meta">
          <div><strong>Applicant:</strong> <span id="p-name"></span></div>
          <div><strong>Age / Gender:</strong> <span id="p-age-gender"></span></div>
          <div><strong>Date:</strong> <span id="p-date"></span></div>
        </div>
      </div>

      <div className="print-decision-row">
        <div>
          <strong>Decision: </strong><span id="p-decision" style={{ fontWeight: 'bold', fontSize: '18px' }}></span>
        </div>
        <div><strong>Default Probability:</strong> <span id="p-prob"></span></div>
        <div><strong>Risk Category:</strong> <span id="p-risk-cat"></span></div>
        <div><strong>Credit/Income:</strong> <span id="p-ratio-credit"></span></div>
        <div><strong>Annuity/Income:</strong> <span id="p-ratio-annuity"></span></div>
      </div>

      <div className="print-summary">
        <strong>AI Executive Summary</strong>
        <p id="p-summary"></p>
      </div>

      <div className="print-scores">
        <div><strong>DTI Ratio:</strong> <span id="p-score-dti"></span></div>
        <div><strong>LTV Ratio:</strong> <span id="p-score-ltv"></span></div>
        <div><strong>Stability Score:</strong> <span id="p-score-stability"></span></div>
        <div><strong>Delinquency Rate:</strong> <span id="p-score-delinquency"></span></div>
      </div>

      <div className="print-lists">
        <div>
          <strong>Strengths</strong>
          <ul id="p-strengths"></ul>
        </div>
        <div>
          <strong>Weaknesses</strong>
          <ul id="p-weaknesses"></ul>
        </div>
        <div>
          <strong>Recommendations</strong>
          <ul id="p-recommendations"></ul>
        </div>
      </div>
    </div>
  );
}
