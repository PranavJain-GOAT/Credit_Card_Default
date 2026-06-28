import { useState, useRef, useCallback } from 'react';
import { submitPrediction } from '../api';

function fmtRupees(v) {
  v = parseFloat(v);
  if (v >= 100000) return '₹' + (v / 100000).toFixed(1) + 'L';
  if (v >= 1000) return '₹' + (v / 1000).toFixed(0) + 'K';
  return '₹' + v.toFixed(0);
}

function renderCounterfactuals(counterfactuals) {
  if (!counterfactuals || counterfactuals.length === 0) {
    return <div style={{ color: 'var(--success)', fontSize: '12px', fontWeight: '600' }}>✅ This applicant is already in the best achievable tier.</div>;
  }
  const icons = ['🎯', '💼', '📊', '⭐', '🏦'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {counterfactuals.map((cf, i) => (
        <div key={i} className="cf-card">
          <div className="cf-icon">{icons[i % icons.length]}</div>
          <div className="cf-body">
            <div className="cf-action">{cf.action}</div>
            <div className="cf-change">{cf.change_needed}</div>
            <div className="cf-result">Simulated probability drops to {cf.new_probability}%</div>
          </div>
          <div className="cf-badge">→ {cf.new_tier}</div>
        </div>
      ))}
    </div>
  );
}

export default function WhatIfSimulator({ applicant, originalProb }) {
  const [income, setIncome] = useState(() => Math.min(500000, Math.max(10000, parseFloat(applicant?.income || 50000))));
  const [loan, setLoan] = useState(() => Math.min(2000000, Math.max(10000, parseFloat(applicant?.loan_amount || 100000))));
  const [ext2, setExt2] = useState(() => Math.min(1, Math.max(0, parseFloat(applicant?.ext_source_2 || 0.5))));
  const [late, setLate] = useState(() => Math.min(1, Math.max(0, parseFloat(applicant?.late_payment_rate || 0.0))));
  const [wiResult, setWiResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimer = useRef(null);

  const runSimulation = useCallback(async (newIncome, newLoan, newExt2, newLate) => {
    if (!applicant) return;
    setIsLoading(true);
    const modifiedInputs = {
      ...applicant,
      income: newIncome, loan_amount: newLoan,
      ext_source_2: newExt2, late_payment_rate: newLate,
      original_loan_amount: parseFloat(applicant.loan_amount || newLoan),
      original_annuity: parseFloat(applicant.annuity || 10000),
      original_late_payment_rate: parseFloat(applicant.late_payment_rate || 0),
    };
    try {
      const result = await submitPrediction(modifiedInputs);
      setWiResult(result);
    } catch (e) {
      console.error('[What-If] Prediction error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [applicant]);

  const debounce = (i, l, e, r) => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => runSimulation(i, l, e, r), 400);
  };

  const handleIncome = (e) => { const v = parseFloat(e.target.value); setIncome(v); debounce(v, loan, ext2, late); };
  const handleLoan   = (e) => { const v = parseFloat(e.target.value); setLoan(v);   debounce(income, v, ext2, late); };
  const handleExt2   = (e) => { const v = parseFloat(e.target.value); setExt2(v);   debounce(income, loan, v, late); };
  const handleLate   = (e) => { const v = parseFloat(e.target.value); setLate(v);   debounce(income, loan, ext2, v); };

  const resetSliders = () => {
    if (!applicant) return;
    const i = Math.min(500000, Math.max(10000, parseFloat(applicant.income || 50000)));
    const l = Math.min(2000000, Math.max(10000, parseFloat(applicant.loan_amount || 100000)));
    const e = Math.min(1, Math.max(0, parseFloat(applicant.ext_source_2 || 0.5)));
    const r = Math.min(1, Math.max(0, parseFloat(applicant.late_payment_rate || 0.0)));
    setIncome(i); setLoan(l); setExt2(e); setLate(r);
    setWiResult(null);
  };

  if (!applicant) return null;

  const delta = wiResult ? (wiResult.default_probability - originalProb) * 100 : null;

  const sliderStyle = {
    WebkitAppearance: 'none', appearance: 'none',
    width: '100%', height: '4px', borderRadius: '2px',
    background: 'var(--border)', outline: 'none', margin: '6px 0 4px', cursor: 'pointer'
  };

  return (
    <>
      {/* What-If Simulator */}
      <div id="whatif-section" className="card" style={{ marginBottom: '16px' }}>
        <div className="card-header">
          <h3>🧪 What-If Scenario Simulator</h3>
          <button className="btn btn-secondary btn-sm" onClick={resetSliders}>↺ Reset</button>
        </div>
        <div className="card-body">
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Adjust key variables to see how the risk score changes in real-time.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { label: 'Annual Income', display: fmtRupees(income), value: income, min: 10000, max: 500000, step: 1000, handler: handleIncome, id: 'wi-income' },
              { label: 'Loan Amount', display: fmtRupees(loan), value: loan, min: 10000, max: 2000000, step: 5000, handler: handleLoan, id: 'wi-loan' },
              { label: 'External Score 2', display: ext2.toFixed(3), value: ext2, min: 0, max: 1, step: 0.001, handler: handleExt2, id: 'wi-ext2' },
              { label: 'Late Payment Rate', display: (late * 100).toFixed(1) + '%', value: late, min: 0, max: 1, step: 0.01, handler: handleLate, id: 'wi-late' },
            ].map(s => (
              <div key={s.id} className="whatif-slider-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>{s.label}</label>
                  <span id={`${s.id}-display`} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: 'var(--accent)', fontWeight: 700 }}>{s.display}</span>
                </div>
                <input
                  type="range" className="whatif-range" id={s.id}
                  min={s.min} max={s.max} step={s.step}
                  value={s.value} onChange={s.handler}
                />
              </div>
            ))}
          </div>

          {isLoading && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Recalculating…</div>}
          {!isLoading && wiResult && <div style={{ fontSize: '12px', color: 'var(--success)', marginTop: '8px' }}>✓ Updated</div>}

          {wiResult && (
            <div id="whatif-result" style={{ marginTop: '16px', padding: '12px 14px', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Simulated Probability: </span>
                  <span id="wi-prob-value" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '18px', fontWeight: 700, color: wiResult.decision_color }}>
                    {(wiResult.default_probability * 100).toFixed(1)}%
                  </span>
                </div>
                <div id="wi-prob-delta" style={{ fontSize: '12px', color: delta > 0 ? '#ef4444' : '#10b981' }}>
                  {delta >= 0 ? '+' : ''}{delta?.toFixed(1)}% vs original
                </div>
                <div id="wi-decision-badge" style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', background: (wiResult.decision_color || '#6366f1') + '22', color: wiResult.decision_color || '#6366f1' }}>
                  {wiResult.decision}
                </div>
              </div>
              <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                <div id="wi-prob-bar" style={{ height: '100%', width: `${Math.min(100, wiResult.default_probability * 100)}%`, background: wiResult.decision_color || '#6366f1', borderRadius: '3px', transition: 'width 0.4s ease' }}></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Counterfactual Cards */}
      <div id="counterfactual-section" className="card" style={{ marginBottom: '16px' }}>
        <div className="card-header"><h3>🛤 Path to Next Tier (Counterfactual Actions)</h3></div>
        <div className="card-body">
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>Actions the applicant can take to move to a better risk tier.</p>
          <div id="counterfactual-list">
            {renderCounterfactuals(applicant?.counterfactuals)}
          </div>
        </div>
      </div>
    </>
  );
}
