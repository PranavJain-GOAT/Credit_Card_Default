import { useState } from 'react';
import { submitPrediction } from '../api';

const INITIAL_FORM = {
  name: '', age: '', gender: 'M', marital_status: 'Married',
  children: '0', education: 'Secondary / secondary special',
  housing: 'House / apartment', own_car: 'N', own_property: 'Y',
  employment_type: 'Working', years_employed: '',
  income: '', loan_amount: '', annuity: '', goods_price: '',
  total_debt: '', active_loans: '', closed_loans: '', avg_credit_age_days: '',
  prev_app_count: '', approved_count: '', refused_count: '',
  approval_rate: '', years_since_last_app: '', avg_prev_credit: '',
  max_prev_credit: '', avg_prev_annuity: '',
  avg_days_late: '', max_days_late: '', late_payment_count: '',
  late_payment_rate: '', avg_payment_ratio: '', total_payment_amount: '',
  ext_source_1: '', ext_source_2: '', ext_source_3: '',
};

// Fields that must be strictly > 0 (matches backend Pydantic schema)
const GT_ZERO = ['income', 'loan_amount', 'annuity', 'goods_price'];

const REQUIRED = {
  1: ['name', 'age', 'years_employed'],
  2: ['income', 'loan_amount', 'annuity', 'goods_price'],
  3: ['total_debt', 'active_loans', 'closed_loans', 'avg_credit_age_days'],
  4: ['prev_app_count', 'approved_count', 'refused_count', 'approval_rate', 'years_since_last_app', 'avg_prev_credit', 'max_prev_credit', 'avg_prev_annuity'],
  5: ['avg_days_late', 'max_days_late', 'late_payment_count', 'late_payment_rate', 'avg_payment_ratio', 'total_payment_amount', 'ext_source_1', 'ext_source_2', 'ext_source_3'],
};

export default function UnderwriteTab({ onPredictionResult }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: false }));
  };

  const validateStep = (s) => {
    const required = REQUIRED[s] || [];
    const newErrors = {};
    let valid = true;
    required.forEach(field => {
      const val = String(form[field]).trim();
      if (!val) { newErrors[field] = true; valid = false; return; }
      // Financial fields must be > 0 (matches backend gt=0 constraint)
      if (GT_ZERO.includes(field) && parseFloat(val) <= 0) {
        newErrors[field] = true; valid = false;
      }
    });
    setErrors(newErrors);
    return valid;
  };

  const nextStep = () => {
    if (validateStep(step) && step < 5) setStep(s => s + 1);
    else if (!validateStep(step)) alert('Please fill in all required fields on this step.');
  };
  const prevStep = () => { if (step > 1) setStep(s => s - 1); };

  const buildPayload = () => ({
    name: form.name || 'John Doe',
    age: parseFloat(form.age),
    gender: form.gender,
    marital_status: form.marital_status,
    children: parseInt(form.children),
    education: form.education,
    housing: form.housing,
    own_car: form.own_car,
    own_property: form.own_property,
    employment_type: form.employment_type,
    years_employed: parseFloat(form.years_employed),
    income: parseFloat(form.income),
    loan_amount: parseFloat(form.loan_amount),
    annuity: parseFloat(form.annuity),
    goods_price: parseFloat(form.goods_price),
    total_debt: parseFloat(form.total_debt),
    active_loans: parseInt(form.active_loans),
    closed_loans: parseInt(form.closed_loans),
    avg_credit_age_days: parseFloat(form.avg_credit_age_days),
    prev_app_count: parseInt(form.prev_app_count),
    approved_count: parseInt(form.approved_count),
    refused_count: parseInt(form.refused_count),
    approval_rate: parseFloat(form.approval_rate),
    years_since_last_app: parseFloat(form.years_since_last_app),
    avg_prev_credit: parseFloat(form.avg_prev_credit),
    max_prev_credit: parseFloat(form.max_prev_credit),
    avg_prev_annuity: parseFloat(form.avg_prev_annuity),
    avg_days_late: parseFloat(form.avg_days_late),
    max_days_late: parseFloat(form.max_days_late),
    late_payment_count: parseInt(form.late_payment_count),
    late_payment_rate: parseFloat(form.late_payment_rate),
    avg_payment_ratio: parseFloat(form.avg_payment_ratio),
    total_payment_amount: parseFloat(form.total_payment_amount),
    ext_source_1: parseFloat(form.ext_source_1),
    ext_source_2: parseFloat(form.ext_source_2),
    ext_source_3: parseFloat(form.ext_source_3),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep(5)) { alert('Please fill all required fields. Income, Loan Amount, Annuity and Goods Price must be greater than 0.'); return; }
    setLoading(true);
    try {
      const inputs = buildPayload();
      const data = await submitPrediction(inputs);
      onPredictionResult(inputs, data);
      setStep(1);
      setForm(INITIAL_FORM);
    } catch (err) {
      console.error('[Nexus Risk] Prediction error:', err);
      const msg = err.message || '';
      if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504') || msg.includes('Failed to fetch')) {
        alert('The server is waking up from sleep. Please click "Run Risk Assessment" again in 10 seconds.');
      } else if (msg.includes('422') || msg.includes('Unprocessable')) {
        alert('Form validation error: one or more values are out of range. Check that Income, Loan Amount, Annuity and Goods Price are greater than 0.');
      } else {
        alert(`Prediction failed: ${msg || 'Unknown error. Check your internet connection.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Field helpers
  const inp = (name, label, type = 'number', placeholder = '', required = false) => (
    <div className="form-group" key={name}>
      <label htmlFor={name}>{label}{required && <span style={{ color: 'var(--danger)' }}> *</span>}</label>
      <input
        id={name} name={name} type={type}
        value={form[name]} onChange={handleChange}
        placeholder={placeholder}
        style={errors[name] ? { borderColor: 'var(--danger)' } : {}}
      />
    </div>
  );

  const sel = (name, label, options) => (
    <div className="form-group" key={name}>
      <label htmlFor={name}>{label}</label>
      <select id={name} name={name} value={form[name]} onChange={handleChange}>
        {options.map(o => <option key={o.v || o} value={o.v || o}>{o.l || o}</option>)}
      </select>
    </div>
  );

  const stepLabels = ['Personal Info', 'Financial Details', 'Credit Bureau', 'Application History', 'Repayment & Scores'];

  return (
    <div className="wizard-container card">
      {/* Wizard Progress Header */}
      <div className="wizard-header">
        {stepLabels.map((label, i) => {
          const num = i + 1;
          let cls = 'wizard-step-node';
          if (num < step) cls += ' completed';
          else if (num === step) cls += ' active';
          return (
            <div key={num} id={`wizard-node-${num}`} className={cls} onClick={() => num < step && setStep(num)}>
              <div className="node-num">{num < step ? '✓' : num}</div>
              <div className="node-text">{label}</div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit}>
        {/* Step 1: Personal Info */}
        <div id="step-1" className={`wizard-step-content${step === 1 ? ' active' : ''}`}>
          <div className="step-title">Personal Information & Employment</div>
          <div className="step-desc">Enter the applicant's personal background and employment details.</div>
          <div className="form-grid">
            {inp('name', 'Full Name', 'text', 'John Doe')}
            {inp('age', 'Age (years)', 'number', '38', true)}
            {sel('gender', 'Gender', [{v:'M',l:'Male'},{v:'F',l:'Female'}])}
            {sel('marital_status', 'Marital Status', ['Married','Single / not married','Civil marriage','Separated','Widow'])}
            {inp('children', 'Number of Children', 'number', '0')}
            {sel('education', 'Education Level', ['Secondary / secondary special','Higher education','Incomplete higher','Lower secondary','Academic degree'])}
            {sel('housing', 'Housing Type', ['House / apartment','With parents','Municipal apartment','Rented apartment','Office apartment','Co-op apartment'])}
            {sel('own_car', 'Owns Car?', [{v:'Y',l:'Yes'},{v:'N',l:'No'}])}
            {sel('own_property', 'Owns Property?', [{v:'Y',l:'Yes'},{v:'N',l:'No'}])}
            {sel('employment_type', 'Employment Type', ['Working','Commercial associate','Pensioner','State servant','Unemployed'])}
            {inp('years_employed', 'Years Employed', 'number', '4.5', true)}
          </div>
        </div>

        {/* Step 2: Financial Details */}
        <div id="step-2" className={`wizard-step-content${step === 2 ? ' active' : ''}`}>
          <div className="step-title">Financial Details & Loan Request</div>
          <div className="step-desc">Enter income, requested loan amount, and associated financial parameters.</div>
          <div className="form-grid">
            {inp('income', 'Annual Income ($)', 'number', '65000', true)}
            {inp('loan_amount', 'Loan Amount ($)', 'number', '180000', true)}
            {inp('annuity', 'Monthly Annuity ($)', 'number', '12000', true)}
            {inp('goods_price', 'Goods Price ($)', 'number', '180000', true)}
          </div>
        </div>

        {/* Step 3: Credit Bureau */}
        <div id="step-3" className={`wizard-step-content${step === 3 ? ' active' : ''}`}>
          <div className="step-title">Credit Bureau Summary</div>
          <div className="step-desc">Enter current debt obligations and credit history data from bureau reports.</div>
          <div className="form-grid">
            {inp('total_debt', 'Total Outstanding Debt ($)', 'number', '8500', true)}
            {inp('active_loans', 'Active Loan Count', 'number', '2', true)}
            {inp('closed_loans', 'Closed Loan Count', 'number', '5', true)}
            {inp('avg_credit_age_days', 'Avg Credit Age (days)', 'number', '1200', true)}
          </div>
        </div>

        {/* Step 4: Application History */}
        <div id="step-4" className={`wizard-step-content${step === 4 ? ' active' : ''}`}>
          <div className="step-title">Previous Application History</div>
          <div className="step-desc">Enter historical application data to assess prior credit engagement with the institution.</div>
          <div className="form-grid">
            {inp('prev_app_count', 'Total Previous Applications', 'number', '3', true)}
            {inp('approved_count', 'Approved Count', 'number', '2', true)}
            {inp('refused_count', 'Refused Count', 'number', '1', true)}
            {inp('approval_rate', 'Approval Rate (0-1)', 'number', '0.67', true)}
            {inp('years_since_last_app', 'Years Since Last Application', 'number', '1.8', true)}
            {inp('avg_prev_credit', 'Avg Previous Credit ($)', 'number', '45000', true)}
            {inp('max_prev_credit', 'Max Previous Credit ($)', 'number', '70000', true)}
            {inp('avg_prev_annuity', 'Avg Previous Annuity ($)', 'number', '4500', true)}
          </div>
        </div>

        {/* Step 5: Repayment & Scores */}
        <div id="step-5" className={`wizard-step-content${step === 5 ? ' active' : ''}`}>
          <div className="step-title">Repayment Behaviour & External Scores</div>
          <div className="step-desc">Enter payment history, delinquency data, and third-party credit bureau scores.</div>
          <div className="form-grid">
            {inp('avg_days_late', 'Avg Days Late', 'number', '2.5', true)}
            {inp('max_days_late', 'Max Days Late', 'number', '15', true)}
            {inp('late_payment_count', 'Late Payment Count', 'number', '3', true)}
            {inp('late_payment_rate', 'Late Payment Rate (0-1)', 'number', '0.08', true)}
            {inp('avg_payment_ratio', 'Avg Payment Ratio', 'number', '1.0', true)}
            {inp('total_payment_amount', 'Total Payment Amount ($)', 'number', '15400', true)}
            {inp('ext_source_1', 'External Score 1 (0-1)', 'number', '0.60', true)}
            {inp('ext_source_2', 'External Score 2 (0-1)', 'number', '0.55', true)}
            {inp('ext_source_3', 'External Score 3 (0-1)', 'number', '0.50', true)}
          </div>
        </div>

        {/* Wizard Footer */}
        <div className="wizard-footer">
          <button type="button" id="btn-wizard-prev" className="btn btn-secondary" onClick={prevStep} disabled={step === 1}>
            ← Previous
          </button>
          {step < 5 && (
            <button type="button" id="btn-wizard-next" className="btn btn-primary" onClick={nextStep}>
              Next →
            </button>
          )}
          {step === 5 && (
            <button type="submit" id="btn-wizard-submit" className="btn btn-success" disabled={loading}>
              {loading ? (
                <><span className="btn-spinner"></span> Scoring...</>
              ) : (
                '⚡ Run Risk Assessment'
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
