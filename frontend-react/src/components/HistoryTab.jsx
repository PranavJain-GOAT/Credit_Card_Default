import { useState, useEffect, useCallback } from 'react';
import { fetchHistory, fetchHistoryRecord, deleteHistoryRecord } from '../api';

function fmtCurr(val) {
  return val != null ? '$' + Number(val).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '--';
}

function DetailsModal({ record, onClose, onDelete }) {
  if (!record) return null;

  let raw = {};
  try {
    if (record.raw_inputs) {
      raw = typeof record.raw_inputs === 'string' ? JSON.parse(record.raw_inputs) : record.raw_inputs;
    }
  } catch (e) {}

  const prob = (record.default_probability * 100).toFixed(1);
  const dec = record.lending_decision || '--';
  let decClass = 'review';
  if (dec.includes('APPROVE')) decClass = 'approve';
  else if (dec.includes('DECLINE') || dec.includes('REJECT')) decClass = 'decline';

  const genderText = raw.gender === 'F' ? 'Female' : raw.gender === 'M' ? 'Male' : (raw.gender || '--');
  const ageVal = raw.age || record.age;
  const ext1Val = raw.ext_source_1 ?? record.ext_source_1;
  const ext2Val = raw.ext_source_2 ?? record.ext_source_2;
  const ext3Val = raw.ext_source_3 ?? record.ext_source_3;

  const Row = ({ l, v }) => (
    <tr>
      <td className="modal-td-label">{l}</td>
      <td className="modal-td-val">{v}</td>
    </tr>
  );

  return (
    <div id="details-modal" className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <h3 id="modal-applicant-name">{record.applicant_name || 'Unknown'}</h3>
            <span id="modal-timestamp" className="modal-timestamp">{record.prediction_timestamp ? new Date(record.prediction_timestamp).toLocaleString() : '--'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className={`modal-decision-badge decision-badge-hist ${decClass}`}>{dec}</span>
          </div>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            <strong>Default Probability:</strong> {prob}% &nbsp;|&nbsp;
            <strong>Risk Category:</strong> {record.risk_category || '--'}
          </p>

          <div className="modal-info-grid">
            <div className="modal-info-table">
              <div style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>Applicant Profile & Assets</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <Row l="Age / Gender" v={ageVal ? `${Math.round(ageVal)} yrs / ${genderText}` : '--'} />
                  <Row l="Marital Status" v={raw.marital_status || '--'} />
                  <Row l="Dependents" v={raw.children != null ? raw.children : '--'} />
                  <Row l="Education" v={raw.education || '--'} />
                  <Row l="Housing" v={raw.housing || '--'} />
                  <Row l="Assets" v={`Car: ${raw.own_car === 'Y' ? 'Yes' : 'No'} / Property: ${raw.own_property === 'Y' ? 'Yes' : 'No'}`} />
                  <Row l="Employment" v={raw.employment_type || '--'} />
                  <Row l="Tenure" v={raw.years_employed != null ? `${Number(raw.years_employed).toFixed(1)} yrs` : '--'} />
                </tbody>
              </table>
            </div>

            <div className="modal-info-table">
              <div style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>Financial Details & Request</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <Row l="Annual Income" v={fmtCurr(raw.income || record.annual_income)} />
                  <Row l="Loan Amount" v={fmtCurr(raw.loan_amount || record.loan_amount)} />
                  <Row l="Annuity" v={fmtCurr(raw.annuity)} />
                  <Row l="Goods Price" v={fmtCurr(raw.goods_price)} />
                </tbody>
              </table>
            </div>

            <div className="modal-info-table">
              <div style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>Bureau Credit & Repayment</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <Row l="Total Debt" v={fmtCurr(raw.total_debt || record.total_debt)} />
                  <Row l="Loans" v={`Active: ${raw.active_loans ?? '--'} / Closed: ${raw.closed_loans ?? '--'}`} />
                  <Row l="Credit Age" v={raw.avg_credit_age_days != null ? `${Math.round(raw.avg_credit_age_days)} days` : '--'} />
                  <Row l="Days Late" v={`Avg: ${raw.avg_days_late ?? '--'}d / Max: ${raw.max_days_late ?? '--'}d`} />
                  <Row l="Late Rate" v={`Count: ${raw.late_payment_count ?? '--'} / Rate: ${raw.late_payment_rate != null ? (raw.late_payment_rate * 100).toFixed(1) + '%' : '--'}`} />
                </tbody>
              </table>
            </div>

            <div className="modal-info-table">
              <div style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>Institutional History & Scores</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <Row l="Applications" v={`Total: ${raw.prev_app_count ?? '--'} / Approved: ${raw.approved_count ?? '--'}`} />
                  <Row l="Approval Rate" v={raw.approval_rate != null ? `${(raw.approval_rate * 100).toFixed(0)}%` : '--'} />
                  <Row l="Years Since Last App" v={raw.years_since_last_app != null ? `${Number(raw.years_since_last_app).toFixed(1)} yrs` : '--'} />
                  <Row l="Credit Limits" v={`Avg: ${fmtCurr(raw.avg_prev_credit)} / Max: ${fmtCurr(raw.max_prev_credit)}`} />
                  <Row l="Bureau Scores" v={`(${ext1Val != null ? Number(ext1Val).toFixed(3) : '--'} / ${ext2Val != null ? Number(ext2Val).toFixed(3) : '--'} / ${ext3Val != null ? Number(ext3Val).toFixed(3) : '--'})`} />
                </tbody>
              </table>
            </div>
          </div>

          {record.executive_summary && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '14px', marginTop: '10px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong>AI Summary: </strong>{record.executive_summary}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-danger" onClick={onDelete} style={{ background: 'var(--danger)', color: 'white', border: 'none' }}>🗑 Delete Record</button>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function HistoryTab({ isActive }) {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [searchTimeout, setSearchTimeout] = useState(null);

  const loadHistory = useCallback(async (q, s) => {
    const query = q !== undefined ? q : search;
    const sortVal = s !== undefined ? s : sort;
    setLoading(true);
    try {
      const data = await fetchHistory(query, sortVal);
      setRecords(data.records || []);
    } catch (err) {
      console.error('History load error:', err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [search, sort]);

  useEffect(() => {
    if (isActive) loadHistory(search, sort);
  }, [isActive]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => loadHistory(val, sort), 350));
  };

  const handleSortChange = (e) => {
    const val = e.target.value;
    setSort(val);
    loadHistory(search, val);
  };

  const openModal = async (id) => {
    try {
      const rec = await fetchHistoryRecord(id);
      setSelectedRecord(rec);
    } catch (err) {
      alert('Could not load record details.');
    }
  };

  const closeModal = () => setSelectedRecord(null);

  const handleDelete = async () => {
    if (!selectedRecord) return;
    if (!confirm(`Delete prediction record for "${selectedRecord.applicant_name}"? This cannot be undone.`)) return;
    try {
      const data = await deleteHistoryRecord(selectedRecord.id);
      if (data.deleted) { closeModal(); loadHistory(search, sort); }
      else alert('Could not delete the record.');
    } catch (err) {
      alert('Failed to delete record.');
    }
  };

  return (
    <div className="card" id="tab-history-card">
      <div className="history-controls">
        <div className="history-search-wrap">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm6.32-1.906l3.586 3.586-1.414 1.414-3.586-3.586A8 8 0 1116.32 16.094z"/>
          </svg>
          <input
            type="text"
            id="history-search"
            className="history-search-input"
            placeholder="Search by applicant name..."
            value={search}
            onChange={handleSearchChange}
          />
        </div>
        <select id="history-sort" className="history-sort-select" value={sort} onChange={handleSortChange}>
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="highest_risk">Highest Risk</option>
          <option value="lowest_risk">Lowest Risk</option>
        </select>
        <span id="history-count-label" style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {records.length} record{records.length !== 1 ? 's' : ''} found
        </span>
      </div>

      <div className="history-table-wrapper">
        <table className="history-table">
          <thead>
            <tr>
              <th>Applicant</th><th>Date</th><th>Default Prob.</th>
              <th>Risk Category</th><th>Decision</th><th>Actions</th>
            </tr>
          </thead>
          <tbody id="history-table-body">
            {loading && <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</td></tr>}
            {!loading && records.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No predictions found. Run an evaluation to get started.</td></tr>}
            {!loading && records.map(rec => {
              const prob = rec.default_probability * 100;
              let probClass = 'low';
              if (prob >= 60) probClass = 'high';
              else if (prob >= 30) probClass = 'medium';
              const dec = rec.lending_decision || '';
              let decClass = 'review';
              if (dec.includes('APPROVE')) decClass = 'approve';
              else if (dec.includes('DECLINE') || dec.includes('REJECT')) decClass = 'decline';
              const ts = rec.prediction_timestamp ? new Date(rec.prediction_timestamp).toLocaleString() : '--';
              return (
                <tr key={rec.id}>
                  <td><strong>{rec.applicant_name || 'Unknown'}</strong></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{ts}</td>
                  <td><span className={`prob-badge ${probClass}`}>{prob.toFixed(1)}%</span></td>
                  <td>{rec.risk_category || '--'}</td>
                  <td><span className={`decision-badge-hist ${decClass}`}>{dec}</span></td>
                  <td><button className="history-action-btn" onClick={() => openModal(rec.id)}>🔎 View</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DetailsModal record={selectedRecord} onClose={closeModal} onDelete={handleDelete} />
    </div>
  );
}
