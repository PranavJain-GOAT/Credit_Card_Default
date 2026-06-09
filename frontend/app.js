// Aura Credit Risk Intelligence Platform - Frontend Script

// Global Application State
let appState = {
    theme: 'dark',
    currentTab: 'dashboard',
    currentWizardStep: 1,
    activeApplicant: null,
    predictionResults: null,
    charts: {
        radar: null,
        bar: null
    }
};

// Tab Switching
function switchTab(tabId) {
    appState.currentTab = tabId;
    
    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeNav = document.getElementById(`nav-${tabId}`);
    if (activeNav) activeNav.classList.add('active');
    
    // Update visible tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    const activePane = document.getElementById(`tab-${tabId}`);
    if (activePane) activePane.classList.add('active');
    
    // Customize page header based on active tab
    const title = document.getElementById('page-title');
    const subtitle = document.getElementById('page-subtitle');
    
    if (tabId === 'dashboard') {
        title.innerText = 'Underwriting Dashboard';
        subtitle.innerText = 'Real-time credit risk evaluation and default probability assessment.';
    } else if (tabId === 'underwrite') {
        title.innerText = 'New Credit Assessment';
        subtitle.innerText = 'Submit applicant data through the wizard to generate a risk score.';
    } else if (tabId === 'analysis') {
        title.innerText = 'Financial Health Analysis';
        subtitle.innerText = 'Leverage ratios, cash flow analysis, and financial stability indicators.';
        // Re-render charts to make sure they size properly on visibility change
        if (appState.predictionResults) {
            renderAnalysisCharts();
        }
    } else if (tabId === 'history') {
        title.innerText = 'Assessment Case History';
        subtitle.innerText = 'Search, review, and manage all past credit risk evaluations.';
        loadPredictionHistory();
    }
}

function jumpToStep(stepNum) {
    if (stepNum > appState.currentWizardStep) {
        if (!validateStep(appState.currentWizardStep)) {
            alert("Please fill in all required fields on the current step first.");
            return;
        }
    }
    
    appState.currentWizardStep = stepNum;
    updateWizardUI();
}

function prevStep() {
    if (appState.currentWizardStep > 1) {
        appState.currentWizardStep--;
        updateWizardUI();
    }
}

function nextStep() {
    if (validateStep(appState.currentWizardStep)) {
        if (appState.currentWizardStep < 5) {
            appState.currentWizardStep++;
            updateWizardUI();
        }
    } else {
        alert("Please fill in all required fields on this step.");
    }
}

function validateStep(stepNum) {
    const stepEl = document.getElementById(`step-${stepNum}`);
    const inputs = stepEl.querySelectorAll('input[required], select[required]');
    let valid = true;
    inputs.forEach(input => {
        if (!input.value.trim()) {
            valid = false;
            input.style.borderColor = 'var(--danger-color)';
        } else {
            input.style.borderColor = 'var(--input-border)';
        }
    });
    return valid;
}

function updateWizardUI() {
    // Update node states
    for (let i = 1; i <= 5; i++) {
        const node = document.getElementById(`wizard-node-${i}`);
        if (i < appState.currentWizardStep) {
            node.className = 'wizard-step-node completed';
        } else if (i === appState.currentWizardStep) {
            node.className = 'wizard-step-node active';
        } else {
            node.className = 'wizard-step-node';
        }
        
        // Update contents visibility
        const content = document.getElementById(`step-${i}`);
        if (i === appState.currentWizardStep) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    }
    
    // Update footer buttons
    const btnPrev = document.getElementById('btn-wizard-prev');
    const btnNext = document.getElementById('btn-wizard-next');
    const btnSubmit = document.getElementById('btn-wizard-submit');
    
    btnPrev.disabled = appState.currentWizardStep === 1;
    
    if (appState.currentWizardStep === 5) {
        btnNext.style.display = 'none';
        btnSubmit.style.display = 'inline-flex';
    } else {
        btnNext.style.display = 'inline-flex';
        btnSubmit.style.display = 'none';
    }
}

// Get Form Inputs
function getFormValues() {
    return {
        name: document.getElementById('applicant-name').value || "John Doe",
        age: parseFloat(document.getElementById('age').value),
        gender: document.getElementById('gender').value,
        marital_status: document.getElementById('marital-status').value,
        children: parseInt(document.getElementById('children').value),
        education: document.getElementById('education').value,
        housing: document.getElementById('housing').value,
        own_car: document.getElementById('own-car').value,
        own_property: document.getElementById('own-property').value,
        employment_type: document.getElementById('employment-type').value,
        years_employed: parseFloat(document.getElementById('years-employed').value),
        
        income: parseFloat(document.getElementById('income').value),
        loan_amount: parseFloat(document.getElementById('loan-amount').value),
        annuity: parseFloat(document.getElementById('annuity').value),
        goods_price: parseFloat(document.getElementById('goods-price').value),
        
        total_debt: parseFloat(document.getElementById('total-debt').value),
        active_loans: parseInt(document.getElementById('active-loans').value),
        closed_loans: parseInt(document.getElementById('closed-loans').value),
        avg_credit_age_days: parseFloat(document.getElementById('avg-credit-age-days').value),
        
        prev_app_count: parseInt(document.getElementById('prev-app-count').value),
        approved_count: parseInt(document.getElementById('approved-count').value),
        refused_count: parseInt(document.getElementById('refused-count').value),
        approval_rate: parseFloat(document.getElementById('approval-rate').value),
        years_since_last_app: parseFloat(document.getElementById('years-since-last-app').value),
        avg_prev_credit: parseFloat(document.getElementById('avg-prev-credit').value),
        max_prev_credit: parseFloat(document.getElementById('max-prev-credit').value),
        avg_prev_annuity: parseFloat(document.getElementById('avg-prev-annuity').value),
        
        avg_days_late: parseFloat(document.getElementById('avg-days-late').value),
        max_days_late: parseFloat(document.getElementById('max-days-late').value),
        late_payment_count: parseInt(document.getElementById('late-payment-count').value),
        late_payment_rate: parseFloat(document.getElementById('late-payment-rate').value),
        avg_payment_ratio: parseFloat(document.getElementById('avg-payment-ratio').value),
        total_payment_amount: parseFloat(document.getElementById('total-payment-amount').value),
        
        ext_source_1: parseFloat(document.getElementById('ext-source-1').value),
        ext_source_2: parseFloat(document.getElementById('ext-source-2').value),
        ext_source_3: parseFloat(document.getElementById('ext-source-3').value)
    };
}

// Submit Underwriting Form
function submitUnderwrite(event) {
    event.preventDefault();
    
    const spinner = document.getElementById('btn-spinner');
    const submitBtn = document.getElementById('btn-wizard-submit');
    
    spinner.style.display = 'inline-block';
    submitBtn.disabled = true;
    
    const inputs = getFormValues();
    appState.activeApplicant = inputs;
    
    fetch('/api/predict', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(inputs)
    })
    .then(response => {
        if (!response.ok) throw new Error("Backend inference error");
        return response.json();
    })
    .then(data => {
        appState.predictionResults = data;
        
        // Hide welcome cards and show layout grids
        document.getElementById('no-prediction-welcome').style.display = 'none';
        document.getElementById('prediction-dashboard-grid').style.display = 'block';
        
        document.getElementById('no-prediction-analysis').style.display = 'none';
        document.getElementById('analysis-grid').style.display = 'block';
        
        // Update header badge
        const badge = document.getElementById('current-applicant-badge');
        const badgeName = document.getElementById('active-applicant-name');
        badgeName.innerText = inputs.name;
        badge.style.display = 'inline-flex';
        
        // Render UI panels
        renderDashboardUI(data);
        renderAnalysisCharts();
        
        // Switch view to dashboard
        switchTab('dashboard');
    })
    .catch(err => {
        console.error(err);
        alert("Prediction request failed. Make sure server.py is running!");
    })
    .finally(() => {
        spinner.style.display = 'none';
        submitBtn.disabled = false;
    });
}

// Render Dashboard Panel
function renderDashboardUI(results) {
    // KPI values
    document.getElementById('kpi-default-prob').innerText = `${(results.default_probability * 100).toFixed(1)}%`;
    document.getElementById('kpi-non-default-prob').innerText = `${(results.non_default_probability * 100).toFixed(1)}%`;
    document.getElementById('kpi-risk-score').innerText = `${results.risk_score}/100`;
    document.getElementById('kpi-subtext-risk').innerText = `Category: ${results.risk_category}`;
    
    // Decision card styling
    const decisionCard = document.getElementById('decision-kpi-card');
    const decisionText = document.getElementById('kpi-decision');
    const decisionReason = document.getElementById('kpi-decision-reason');
    
    decisionText.innerText = results.decision;
    decisionReason.innerText = results.reasoning;
    decisionCard.style.borderLeft = `5px solid ${results.decision_color}`;
    
    // Risk Meter — Move needle only (track is a static gradient band)
    const needle = document.getElementById('risk-needle');
    needle.style.left = `${results.risk_score}%`;
    
    // AI executive summary
    document.getElementById('summary-ai-content').innerText = results.executive_summary;
    
    // Positive Factors
    const posList = document.getElementById('positive-factors-list');
    posList.innerHTML = '';
    if (results.strengths && results.strengths.length > 0) {
        results.strengths.forEach(str => {
            const li = document.createElement('li');
            li.innerText = str;
            posList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.innerText = "No outstanding positive risk offsets detected.";
        posList.appendChild(li);
    }
    
    // Risk Factors
    const riskList = document.getElementById('risk-factors-list');
    riskList.innerHTML = '';
    if (results.weaknesses && results.weaknesses.length > 0) {
        results.weaknesses.forEach(weak => {
            const li = document.createElement('li');
            li.innerText = weak;
            riskList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.innerText = "No high-priority default warning flags active.";
        riskList.appendChild(li);
    }
    
    // Actionable Recommendations
    const recList = document.getElementById('recommendations-list');
    recList.innerHTML = '';
    results.recommendations.forEach(rec => {
        const li = document.createElement('li');
        li.innerText = rec;
        recList.appendChild(li);
    });

    // Populate Policy Compliance & Ratios and Bureau Credit Standing
    const scores = results.scores || {};
    const app = appState.activeApplicant || (results.debug ? results.debug.raw_inputs : {}) || {};

    const dtiVal = scores.dti_ratio != null ? scores.dti_ratio : 0.0;
    const ltvVal = scores.ltv_ratio != null ? scores.ltv_ratio : 0.0;
    const creditIncomeVal = scores.credit_to_income != null ? scores.credit_to_income : 0.0;
    const delinqVal = scores.delinquency_rate != null ? scores.delinquency_rate : 0.0;

    const dtiEl = document.getElementById('diag-dti-val');
    const dtiStatus = document.getElementById('diag-dti-status');
    if (dtiEl && dtiStatus) {
        dtiEl.innerText = `${dtiVal.toFixed(1)}%`;
        if (dtiVal <= 40.0) {
            dtiStatus.innerText = 'COMPLIANT';
            dtiStatus.style.color = 'var(--success-color)';
            dtiStatus.style.fontWeight = 'bold';
        } else {
            dtiStatus.innerText = 'BREACH';
            dtiStatus.style.color = 'var(--danger-color)';
            dtiStatus.style.fontWeight = 'bold';
        }
    }

    const ltvEl = document.getElementById('diag-ltv-val');
    const ltvStatus = document.getElementById('diag-ltv-status');
    if (ltvEl && ltvStatus) {
        ltvEl.innerText = `${ltvVal.toFixed(1)}%`;
        if (ltvVal <= 80.0) {
            ltvStatus.innerText = 'COMPLIANT';
            ltvStatus.style.color = 'var(--success-color)';
            ltvStatus.style.fontWeight = 'bold';
        } else {
            ltvStatus.innerText = 'BREACH';
            ltvStatus.style.color = 'var(--danger-color)';
            ltvStatus.style.fontWeight = 'bold';
        }
    }

    const ciEl = document.getElementById('diag-credit-income-val');
    const ciStatus = document.getElementById('diag-credit-income-status');
    if (ciEl && ciStatus) {
        ciEl.innerText = `${creditIncomeVal.toFixed(2)}x`;
        if (creditIncomeVal <= 3.0) {
            ciStatus.innerText = 'COMPLIANT';
            ciStatus.style.color = 'var(--success-color)';
            ciStatus.style.fontWeight = 'bold';
        } else {
            ciStatus.innerText = 'BREACH';
            ciStatus.style.color = 'var(--danger-color)';
            ciStatus.style.fontWeight = 'bold';
        }
    }

    const delEl = document.getElementById('diag-delinq-val');
    const delStatus = document.getElementById('diag-delinq-status');
    if (delEl && delStatus) {
        delEl.innerText = `${delinqVal.toFixed(1)}%`;
        if (delinqVal <= 5.0) {
            delStatus.innerText = 'COMPLIANT';
            delStatus.style.color = 'var(--success-color)';
            delStatus.style.fontWeight = 'bold';
        } else {
            delStatus.innerText = 'BREACH';
            delStatus.style.color = 'var(--danger-color)';
            delStatus.style.fontWeight = 'bold';
        }
    }

    // Bureau Credit Standing
    const ext1 = app.ext_source_1 != null ? parseFloat(app.ext_source_1) : 0.5;
    const ext2 = app.ext_source_2 != null ? parseFloat(app.ext_source_2) : 0.5;
    const ext3 = app.ext_source_3 != null ? parseFloat(app.ext_source_3) : 0.5;
    const extAvg = (ext1 + ext2 + ext3) / 3;

    const extEl = document.getElementById('diag-score-avg-val');
    const extStatus = document.getElementById('diag-score-avg-status');
    if (extEl && extStatus) {
        extEl.innerText = extAvg.toFixed(3);
        if (extAvg >= 0.60) {
            extStatus.innerText = 'EXCELLENT';
            extStatus.style.color = 'var(--success-color)';
            extStatus.style.fontWeight = 'bold';
        } else if (extAvg >= 0.50) {
            extStatus.innerText = 'ACCEPTABLE';
            extStatus.style.color = 'var(--warning-color)';
            extStatus.style.fontWeight = 'bold';
        } else {
            extStatus.innerText = 'SUBSTANDARD';
            extStatus.style.color = 'var(--danger-color)';
            extStatus.style.fontWeight = 'bold';
        }
    }

    const ageEl = document.getElementById('diag-credit-age-val');
    const ageStatus = document.getElementById('diag-credit-age-status');
    if (ageEl && ageStatus) {
        const creditAge = app.avg_credit_age_days != null ? app.avg_credit_age_days : 0;
        ageEl.innerText = `${Math.round(creditAge).toLocaleString()} days`;
        if (creditAge >= 1000) {
            ageStatus.innerText = 'COMPLIANT';
            ageStatus.style.color = 'var(--success-color)';
            ageStatus.style.fontWeight = 'bold';
        } else {
            ageStatus.innerText = 'SHORT';
            ageStatus.style.color = 'var(--warning-color)';
            ageStatus.style.fontWeight = 'bold';
        }
    }

    const refEl = document.getElementById('diag-refused-val');
    const refStatus = document.getElementById('diag-refused-status');
    if (refEl && refStatus) {
        const refused = app.refused_count != null ? app.refused_count : 0;
        refEl.innerText = refused;
        if (refused === 0) {
            refStatus.innerText = 'COMPLIANT';
            refStatus.style.color = 'var(--success-color)';
            refStatus.style.fontWeight = 'bold';
        } else {
            refStatus.innerText = `BREACH (${refused})`;
            refStatus.style.color = 'var(--danger-color)';
            refStatus.style.fontWeight = 'bold';
        }
    }

    const tenEl = document.getElementById('diag-tenure-val');
    const tenStatus = document.getElementById('diag-tenure-status');
    if (tenEl && tenStatus) {
        const tenure = app.years_employed != null ? parseFloat(app.years_employed) : 0.0;
        tenEl.innerText = `${tenure.toFixed(1)} yrs`;
        if (tenure >= 3.0) {
            tenStatus.innerText = 'COMPLIANT';
            tenStatus.style.color = 'var(--success-color)';
            tenStatus.style.fontWeight = 'bold';
        } else {
            tenStatus.innerText = 'SHORT';
            tenStatus.style.color = 'var(--warning-color)';
            tenStatus.style.fontWeight = 'bold';
        }
    }

    // SHAP Explainability Graph bars
    const shapContainer = document.getElementById('shap-contributions-container');
    shapContainer.innerHTML = '';
    results.contributions.forEach(contrib => {
        const row = document.createElement('div');
        row.className = 'shap-bar-row';
        
        // Name
        const nameSpan = document.createElement('span');
        nameSpan.className = 'shap-feat-name';
        nameSpan.innerText = contrib.feature;
        
        // Track
        const track = document.createElement('div');
        track.className = 'shap-track';
        
        const bar = document.createElement('div');
        // Map impact to visual width
        // Max width from center is 50%
        const absVal = Math.min(50, Math.abs(contrib.impact) * 45);
        bar.style.width = `${absVal}%`;
        
        if (contrib.impact >= 0) {
            bar.className = 'shap-bar positive';
        } else {
            bar.className = 'shap-bar negative';
        }
        track.appendChild(bar);
        
        // Value
        const valSpan = document.createElement('span');
        valSpan.className = 'shap-feat-val';
        valSpan.innerText = contrib.value;
        
        row.appendChild(nameSpan);
        row.appendChild(track);
        row.appendChild(valSpan);
        shapContainer.appendChild(row);
    });
}



// Render Financial Health Charts
function renderAnalysisCharts() {
    const results = appState.predictionResults;
    if (!results) return;
    
    const isDark = appState.theme === 'dark';
    const gridColor = isDark ? 'rgba(48,54,61,0.8)' : 'rgba(221,226,234,1)';
    const textColor = isDark ? '#6e7681' : '#8b949e';
    const labelColor = isDark ? '#e6edf3' : '#0f1923';
    
    // Update metrics scorecard texts
    const creditIncomeEl = document.getElementById('scorecard-credit-income');
    const annuityIncomeEl = document.getElementById('scorecard-annuity-income');
    const dtiEl = document.getElementById('scorecard-dti-ratio');
    const ltvEl = document.getElementById('scorecard-ltv-ratio');
    const surplusEl = document.getElementById('scorecard-cash-surplus');

    creditIncomeEl.innerText = results.scores.credit_to_income.toFixed(2);
    annuityIncomeEl.innerText = `${(results.scores.annuity_to_income * 100).toFixed(1)}%`;
    
    const dtiVal = results.scores.dti_ratio;
    dtiEl.innerText = `${dtiVal.toFixed(1)}%`;
    if (dtiVal <= 36.0) {
        dtiEl.style.color = 'var(--success-color)';
    } else if (dtiVal <= 45.0) {
        dtiEl.style.color = 'var(--warning-color)';
    } else {
        dtiEl.style.color = 'var(--danger-color)';
    }
    
    const ltvVal = results.scores.ltv_ratio;
    ltvEl.innerText = `${ltvVal.toFixed(1)}%`;
    if (ltvVal <= 80.0) {
        ltvEl.style.color = 'var(--success-color)';
    } else if (ltvVal <= 95.0) {
        ltvEl.style.color = 'var(--warning-color)';
    } else {
        ltvEl.style.color = 'var(--danger-color)';
    }

    const surplusVal = results.scores.monthly_surplus;
    surplusEl.innerText = (surplusVal >= 0 ? "+$" : "-$") + Math.abs(surplusVal).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    if (surplusVal >= 0) {
        surplusEl.style.color = 'var(--success-color)';
    } else {
        surplusEl.style.color = 'var(--danger-color)';
    }

    // Update cash flow breakdown metrics
    document.getElementById('cf-monthly-income').innerText = `$${results.scores.monthly_income.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('cf-proposed-payment').innerText = `$${results.scores.monthly_proposed_payment.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('cf-existing-payment').innerText = `$${results.scores.monthly_existing_payment.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    
    const cfSurplusEl = document.getElementById('cf-cash-surplus');
    cfSurplusEl.innerText = (surplusVal >= 0 ? "+$" : "-$") + Math.abs(surplusVal).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    if (surplusVal >= 0) {
        cfSurplusEl.style.color = 'var(--success-color)';
    } else {
        cfSurplusEl.style.color = 'var(--danger-color)';
    }

    // Set status badge and insight text
    const cfBadge = document.getElementById('cf-status-badge');
    const cfInsightText = document.getElementById('cf-insight-text');
    if (surplusVal < 0) {
        cfBadge.className = 'cf-insight-badge danger';
        cfBadge.innerText = 'Deficit Risk';
        cfInsightText.innerText = 'The applicant is facing a negative monthly surplus. Essential cash reserves are insufficient to cover this requested loan servicing.';
    } else if (dtiVal > 40.0) {
        cfBadge.className = 'cf-insight-badge warning';
        cfBadge.innerText = 'High Debt Leverage';
        cfInsightText.innerText = 'Combined Debt-to-Income is above the warning threshold (40%). Re-check supplementary assets and bureau history.';
    } else {
        cfBadge.className = 'cf-insight-badge good';
        cfBadge.innerText = 'Adequate Surplus';
        cfInsightText.innerText = 'Applicant exhibits a comfortable monthly surplus and DTI ratio is within normal limits. The cash flow supports this new loan obligation.';
    }
    
    // 1. Radar Chart: Financial Health Profile
    const radarCtx = document.getElementById('healthRadarChart').getContext('2d');
    if (appState.charts.radar) {
        appState.charts.radar.destroy();
    }
    
    // Labels for radar axes
    const radarLabels = [
        'Liability Mitigation (Low DTI)',
        'Income Margin (Low Annuity)',
        'Payment Discipline (Low Delay)',
        'Credit Stability (Tenure/Assets)',
        'Equity Cover (Low LTV)'
    ];
    
    const clamp = (val) => Math.min(100, Math.max(0, val));
    
    const radarData = [
        clamp(100 - dtiVal),
        clamp(100 - (results.scores.annuity_to_income * 200)),
        clamp(100 - results.scores.delinquency_rate),
        clamp(results.scores.stability_score),
        clamp(100 - ltvVal)
    ];
    
    appState.charts.radar = new Chart(radarCtx, {
        type: 'radar',
        data: {
            labels: radarLabels,
            datasets: [{
                label: 'Applicant Risk Profile',
                data: radarData,
                backgroundColor: 'rgba(31,111,235,0.12)',
                borderColor: '#1f6feb',
                borderWidth: 2,
                pointBackgroundColor: '#1f6feb',
                pointBorderColor: isDark ? '#1c2230' : '#ffffff',
                pointHoverBackgroundColor: '#388bfd',
                pointHoverBorderColor: '#388bfd'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: gridColor },
                    grid: { color: gridColor },
                    pointLabels: {
                        color: labelColor,
                        font: { size: 10, family: 'IBM Plex Sans', weight: '600' }
                    },
                    ticks: {
                        backdropColor: 'transparent',
                        color: textColor,
                        font: { size: 9 },
                        stepSize: 20
                    },
                    min: 0,
                    max: 100
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
    
    // 2. Bar Chart: Requested Loan vs. Historic Limits
    const barCtx = document.getElementById('creditBarChart').getContext('2d');
    if (appState.charts.bar) {
        appState.charts.bar.destroy();
    }
    
    const app = appState.activeApplicant;
    appState.charts.bar = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: [
                'Current Request',
                'Avg Prior Approved',
                'Max Prior Limit',
                'Avg Prior Goods'
            ],
            datasets: [{
                data: [
                    app.loan_amount,
                    app.avg_prev_credit || 0.0,
                    app.max_prev_credit || 0.0,
                    app.avg_prev_credit * 0.95 || 0.0
                ],
                backgroundColor: [
                    'rgba(31, 111, 235, 0.85)',
                    'rgba(46, 160, 67, 0.75)',
                    'rgba(46, 160, 67, 0.55)',
                    'rgba(210, 153, 34, 0.75)'
                ],
                borderRadius: 3,
                maxBarThickness: 48
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { size: 11, family: 'IBM Plex Sans' } }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: {
                        color: textColor,
                        font: { size: 10, family: 'IBM Plex Mono' },
                        callback: function(value) {
                            return '$' + (value / 1000).toFixed(0) + 'k';
                        }
                    }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

// Native Browser Printing (PDF generation alternative)
function printReport() {
    const results = appState.predictionResults;
    const app = appState.activeApplicant;
    if (!results || !app) return;
    
    // Copy active variables into print-shell nodes
    document.getElementById('p-name').innerText = app.name;
    document.getElementById('p-age-gender').innerText = `${Math.round(app.age)} / ${app.gender}`;
    document.getElementById('p-date').innerText = new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const decNode = document.getElementById('p-decision');
    decNode.innerText = results.decision;
    decNode.style.color = results.decision_color;
    
    document.getElementById('p-prob').innerText = `${(results.default_probability * 100).toFixed(1)}%`;
    document.getElementById('p-risk-cat').innerText = results.risk_category;
    document.getElementById('p-ratio-credit').innerText = results.scores.credit_to_income.toFixed(2);
    document.getElementById('p-ratio-annuity').innerText = `${(results.scores.annuity_to_income * 100).toFixed(1)}%`;
    
    document.getElementById('p-summary').innerText = results.executive_summary;
    
    document.getElementById('p-score-dti').innerText = `${results.scores.dti_ratio.toFixed(1)}%`;
    document.getElementById('p-score-ltv').innerText = `${results.scores.ltv_ratio.toFixed(1)}%`;
    document.getElementById('p-score-stability').innerText = Math.round(results.scores.stability_score);
    document.getElementById('p-score-delinquency').innerText = `${results.scores.delinquency_rate.toFixed(1)}%`;
    
    // Strengths
    const pSt = document.getElementById('p-strengths');
    pSt.innerHTML = '';
    results.strengths.forEach(str => {
        const li = document.createElement('li');
        li.innerText = str;
        pSt.appendChild(li);
    });
    if (results.strengths.length === 0) {
        const li = document.createElement('li');
        li.innerText = "None detected.";
        pSt.appendChild(li);
    }
    
    // Weaknesses
    const pWk = document.getElementById('p-weaknesses');
    pWk.innerHTML = '';
    results.weaknesses.forEach(wk => {
        const li = document.createElement('li');
        li.innerText = wk;
        pWk.appendChild(li);
    });
    if (results.weaknesses.length === 0) {
        const li = document.createElement('li');
        li.innerText = "None detected.";
        pWk.appendChild(li);
    }
    
    // Recommendations
    const pRec = document.getElementById('p-recommendations');
    pRec.innerHTML = '';
    results.recommendations.forEach(rec => {
        const li = document.createElement('li');
        li.innerText = rec;
        pRec.appendChild(li);
    });
    
    // Trigger printable prompt
    window.print();
}

// Light / Dark Theme toggle
function toggleTheme() {
    const root = document.documentElement;
    const label = document.querySelector('.theme-label');
    
    if (appState.theme === 'dark') {
        appState.theme = 'light';
        root.setAttribute('data-theme', 'light');
        label.innerText = 'Light Mode';
    } else {
        appState.theme = 'dark';
        root.setAttribute('data-theme', 'dark');
        label.innerText = 'Dark Mode';
    }
    
    // Redraw charts using new theme color variables
    if (appState.predictionResults) {
        renderAnalysisCharts();
    }
}



// Toggle chatbot window open/close
function toggleChatWindow() {
    const win = document.getElementById('chat-window');
    if (win) {
        win.classList.toggle('active');
        dismissSpeechBubble();
    }
}

// Dismiss floating speech bubble
function dismissSpeechBubble() {
    const bubble = document.getElementById('chat-speech-bubble');
    if (bubble) {
        bubble.style.opacity = '0';
        bubble.style.transform = 'scale(0.8) translateY(10px)';
        bubble.style.pointerEvents = 'none';
        setTimeout(() => {
            bubble.remove();
        }, 300);
    }
}

// Handle press Enter to submit message
function handleChatEnter(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage(event);
    }
}

// Helper to parse simple markdown to HTML (for bold text and bullets)
function formatMarkdown(text) {
    if (!text) return "";
    
    // Escape HTML to prevent XSS
    let escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
        
    // 1. Bold: **text** -> <strong>text</strong>
    let formatted = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    
    // 2. Bullets: lines starting with * or - -> list items
    let lines = formatted.split('\n');
    let result = [];
    let inList = false;
    
    for (let line of lines) {
        let trimmed = line.trim();
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            let itemContent = trimmed.substring(2).trim();
            if (!inList) {
                result.push('<ul style="margin-left: 20px; margin-top: 6px; margin-bottom: 6px; padding-left: 0; list-style-type: disc;">');
                inList = true;
            }
            result.push(`<li style="margin-bottom: 4px;">${itemContent}</li>`);
        } else {
            if (inList) {
                result.push('</ul>');
                inList = false;
            }
            if (trimmed !== '') {
                result.push(`<p style="margin-bottom: 8px;">${line}</p>`);
            } else {
                result.push('<div style="height: 6px;"></div>');
            }
        }
    }
    if (inList) {
        result.push('</ul>');
    }
    
    return result.join('');
}

// Append new message bubble to message logs
function appendChatMessage(sender, text) {
    const logs = document.getElementById('chat-messages');
    if (!logs) return null;
    const msg = document.createElement('div');
    msg.className = `chat-message ${sender}`;
    msg.innerHTML = formatMarkdown(text);
    logs.appendChild(msg);
    logs.scrollTop = logs.scrollHeight;
    return msg;
}

// Submit question to chat api
function sendChatMessage(event) {
    if (event) event.preventDefault();
    
    const input = document.getElementById('chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    
    input.value = '';
    
    // Append user message
    appendChatMessage('user', text);
    
    // Append bot loading bubble
    const loadingMsg = appendChatMessage('bot', 'AI is thinking...');
    if (!loadingMsg) return;
    
    // Prepare chat inputs
    const key = localStorage.getItem('gemini_api_key') || '';
    const caseLoaded = appState.predictionResults !== null;
    const applicant = appState.activeApplicant || { name: 'Applicant' };
    const prediction = appState.predictionResults || { 
        decision: 'PENDING', 
        default_probability: 0.0, 
        risk_category: 'Unknown', 
        recommendations: [], 
        scores: { credit_to_income: 0.0, annuity_to_income: 0.0 } 
    };
    
    fetch('/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            question: text,
            applicant_data: applicant,
            prediction_results: prediction,
            case_loaded: caseLoaded,
            api_key: key
        })
    })
    .then(response => {
        if (!response.ok) throw new Error("Chat server error");
        return response.json();
    })
    .then(data => {
        loadingMsg.innerHTML = formatMarkdown(data.reply || "No response received.");
        const logs = document.getElementById('chat-messages');
        if (logs) logs.scrollTop = logs.scrollHeight;
    })
    .catch(err => {
        console.error(err);
        loadingMsg.innerText = "Error: Failed to connect to underwriting assistant.";
        loadingMsg.style.color = "var(--danger-color)";
    });
}

// =============================================
// PREDICTION HISTORY TAB
// =============================================

let _historySearchTimeout = null;
let _currentDetailRecord = null;

function debounceSearchHistory() {
    clearTimeout(_historySearchTimeout);
    _historySearchTimeout = setTimeout(() => loadPredictionHistory(), 350);
}

function loadPredictionHistory() {
    const search = (document.getElementById('history-search') || {}).value || '';
    const sort = (document.getElementById('history-sort') || {}).value || 'newest';

    fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search, sort })
    })
    .then(r => r.json())
    .then(data => {
        const tbody = document.getElementById('history-table-body');
        const countLabel = document.getElementById('history-count-label');
        if (!tbody) return;

        const records = data.records || [];
        countLabel.innerText = `${records.length} record${records.length !== 1 ? 's' : ''} found`;

        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--subtext-color);padding:40px;">No predictions found. Run an evaluation to get started.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        records.forEach(rec => {
            const prob = rec.default_probability * 100;
            let probClass = 'low';
            if (prob >= 60) probClass = 'high';
            else if (prob >= 30) probClass = 'medium';

            const dec = rec.lending_decision || '';
            let decClass = 'review';
            if (dec.includes('APPROVE')) decClass = 'approve';
            else if (dec.includes('DECLINE') || dec.includes('REJECT')) decClass = 'decline';

            const ts = rec.prediction_timestamp
                ? new Date(rec.prediction_timestamp).toLocaleString()
                : '--';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${escHtml(rec.applicant_name || 'Unknown')}</strong></td>
                <td style="color:var(--subtext-color);font-size:12px;">${ts}</td>
                <td><span class="prob-badge ${probClass}">${prob.toFixed(1)}%</span></td>
                <td>${escHtml(rec.risk_category || '--')}</td>
                <td><span class="decision-badge-hist ${decClass}">${escHtml(dec)}</span></td>
                <td>
                    <button class="history-action-btn" onclick="openDetailsModal(${rec.id})">&#128270; View</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    })
    .catch(err => {
        console.error('History load error:', err);
        const tbody = document.getElementById('history-table-body');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--danger-color);padding:30px;">Failed to load history. Ensure the server is running.</td></tr>';
    });
}

function openDetailsModal(id) {
    fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    })
    .then(r => {
        if (!r.ok) throw new Error('Record not found');
        return r.json();
    })
    .then(rec => {
        _currentDetailRecord = rec;

        document.getElementById('modal-applicant-name').innerText = rec.applicant_name || 'Unknown';
        document.getElementById('modal-timestamp').innerText = rec.prediction_timestamp
            ? new Date(rec.prediction_timestamp).toLocaleString()
            : '--';

        const prob = (rec.default_probability * 100).toFixed(1);
        const dec = rec.lending_decision || '--';
        let decClass = 'review';
        if (dec.includes('APPROVE')) decClass = 'approve';
        else if (dec.includes('DECLINE') || dec.includes('REJECT')) decClass = 'decline';

        const badge = document.getElementById('modal-decision-badge');
        badge.innerText = dec;
        badge.className = 'modal-decision-badge decision-badge-hist ' + decClass;

        // Parse raw inputs
        let raw = {};
        try {
            if (rec.raw_inputs) {
                raw = typeof rec.raw_inputs === 'string' ? JSON.parse(rec.raw_inputs) : rec.raw_inputs;
            }
        } catch (e) {
            console.error("Failed to parse raw_inputs:", e);
        }

        // Helper to format currency
        const fmtCurr = (val) => val != null ? '$' + Number(val).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '--';
        
        // 1. Applicant Profile & Assets
        const genderText = raw.gender === 'F' ? 'Female' : raw.gender === 'M' ? 'Male' : (raw.gender || '--');
        const ageVal = raw.age || rec.age;
        document.getElementById('modal-profile-age-gender').innerText = ageVal ? `${Math.round(ageVal)} yrs / ${genderText}` : '--';
        document.getElementById('modal-profile-marital').innerText = raw.marital_status || '--';
        document.getElementById('modal-profile-dependents').innerText = raw.children != null ? raw.children : '--';
        document.getElementById('modal-profile-education').innerText = raw.education || '--';
        document.getElementById('modal-profile-housing').innerText = raw.housing || '--';
        document.getElementById('modal-profile-assets').innerText = `Car: ${raw.own_car === 'Y' ? 'Yes' : 'No'} / Property: ${raw.own_property === 'Y' ? 'Yes' : 'No'}`;
        document.getElementById('modal-profile-employment').innerText = raw.employment_type || '--';
        document.getElementById('modal-profile-tenure').innerText = raw.years_employed != null ? `${Number(raw.years_employed).toFixed(1)} yrs` : '--';

        // 2. Financial Details & Request
        document.getElementById('modal-fin-income').innerText = fmtCurr(raw.income || rec.annual_income);
        document.getElementById('modal-fin-loan').innerText = fmtCurr(raw.loan_amount || rec.loan_amount);
        document.getElementById('modal-fin-annuity').innerText = fmtCurr(raw.annuity);
        document.getElementById('modal-fin-goods').innerText = fmtCurr(raw.goods_price);

        // 3. Bureau Credit & Repayment History
        document.getElementById('modal-credit-debt').innerText = fmtCurr(raw.total_debt || rec.total_debt);
        document.getElementById('modal-credit-loans').innerText = `Active: ${raw.active_loans != null ? raw.active_loans : '--'} / Closed: ${raw.closed_loans != null ? raw.closed_loans : '--'}`;
        document.getElementById('modal-credit-age').innerText = raw.avg_credit_age_days != null ? `${Math.round(raw.avg_credit_age_days)} days` : '--';
        document.getElementById('modal-repay-days-late').innerText = `Avg: ${raw.avg_days_late != null ? raw.avg_days_late : '--'}d / Max: ${raw.max_days_late != null ? raw.max_days_late : '--'}d`;
        document.getElementById('modal-repay-late-rate').innerText = `Count: ${raw.late_payment_count != null ? raw.late_payment_count : '--'} / Rate: ${raw.late_payment_rate != null ? (raw.late_payment_rate * 100).toFixed(1) + '%' : '--'}`;
        document.getElementById('modal-repay-ratio').innerText = raw.avg_payment_ratio != null ? `${Number(raw.avg_payment_ratio).toFixed(2)}x` : '--';
        document.getElementById('modal-repay-total').innerText = fmtCurr(raw.total_payment_amount);

        // 4. Institutional History & Bureau Scores
        document.getElementById('modal-inst-apps').innerText = `Total: ${raw.prev_app_count != null ? raw.prev_app_count : '--'} / Approved: ${raw.approved_count != null ? raw.approved_count : '--'}`;
        document.getElementById('modal-inst-rate').innerText = raw.approval_rate != null ? `${(raw.approval_rate * 100).toFixed(0)}%` : '--';
        document.getElementById('modal-inst-years').innerText = raw.years_since_last_app != null ? `${Number(raw.years_since_last_app).toFixed(1)} yrs` : '--';
        document.getElementById('modal-inst-limits').innerText = `Avg: ${fmtCurr(raw.avg_prev_credit)} / Max: ${fmtCurr(raw.max_prev_credit)}`;
        
        const ext1Val = raw.ext_source_1 != null ? raw.ext_source_1 : rec.ext_source_1;
        const ext2Val = raw.ext_source_2 != null ? raw.ext_source_2 : rec.ext_source_2;
        const ext3Val = raw.ext_source_3 != null ? raw.ext_source_3 : rec.ext_source_3;
        document.getElementById('modal-scores-ext').innerText = `(${ext1Val != null ? Number(ext1Val).toFixed(3) : '--'} / ${ext2Val != null ? Number(ext2Val).toFixed(3) : '--'} / ${ext3Val != null ? Number(ext3Val).toFixed(3) : '--'})`;

        // Generate a compact executive summary from saved data
        document.getElementById('modal-summary').innerText = rec.executive_summary ||
            `${rec.applicant_name || 'This applicant'} was assessed with a default probability of ${prob}% and classified as ${rec.risk_category || 'Unknown'}. ` +
            `The lending decision issued was: ${dec}.`;

        document.getElementById('details-modal').classList.add('open');
    })
    .catch(err => {
        console.error('Failed to fetch record details:', err);
        alert('Could not load record details.');
    });
}

function closeDetailsModal() {
    document.getElementById('details-modal').classList.remove('open');
    _currentDetailRecord = null;
}

function handleModalOverlayClick(event) {
    if (event.target === event.currentTarget) {
        closeDetailsModal();
    }
}

function deleteFromModal() {
    if (!_currentDetailRecord) return;
    if (!confirm(`Delete prediction record for "${_currentDetailRecord.applicant_name}"? This cannot be undone.`)) return;

    const id = _currentDetailRecord.id;
    fetch('/api/history/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    })
    .then(r => r.json())
    .then(data => {
        if (data.deleted) {
            closeDetailsModal();
            loadPredictionHistory();
        } else {
            alert('Could not delete the record.');
        }
    })
    .catch(err => {
        console.error('Delete error:', err);
        alert('Failed to delete record.');
    });
}

function loadRecordIntoDashboard() {
    if (!_currentDetailRecord) return;
    const rec = _currentDetailRecord;

    // Parse raw inputs
    let raw = {};
    try {
        if (rec.raw_inputs) {
            raw = typeof rec.raw_inputs === 'string' ? JSON.parse(rec.raw_inputs) : rec.raw_inputs;
        }
    } catch (e) {
        console.error("Failed to parse raw_inputs:", e);
    }

    // Populate the underwriting form with saved values
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el && val != null) el.value = val;
    };

    setVal('applicant-name', rec.applicant_name);
    setVal('age', raw.age || rec.age || 38);
    setVal('gender', raw.gender || 'M');
    setVal('marital-status', raw.marital_status || 'Married');
    setVal('children', raw.children != null ? raw.children : 0);
    setVal('education', raw.education || 'Secondary / secondary special');
    setVal('housing', raw.housing || 'House / apartment');
    setVal('own-car', raw.own_car || 'N');
    setVal('own-property', raw.own_property || 'Y');
    setVal('employment-type', raw.employment_type || 'Working');
    setVal('years-employed', raw.years_employed != null ? raw.years_employed : 4.5);

    setVal('income', raw.income || rec.annual_income || 65000);
    setVal('loan-amount', raw.loan_amount || rec.loan_amount || 180000);
    setVal('annuity', raw.annuity != null ? raw.annuity : 12000);
    setVal('goods-price', raw.goods_price != null ? raw.goods_price : 180000);

    setVal('total-debt', raw.total_debt || rec.total_debt || 8500);
    setVal('active-loans', raw.active_loans != null ? raw.active_loans : 2);
    setVal('closed-loans', raw.closed_loans != null ? raw.closed_loans : 5);
    setVal('avg-credit-age-days', raw.avg_credit_age_days != null ? raw.avg_credit_age_days : 1200);

    setVal('prev-app-count', raw.prev_app_count != null ? raw.prev_app_count : 3);
    setVal('approved-count', raw.approved_count != null ? raw.approved_count : 2);
    setVal('refused-count', raw.refused_count != null ? raw.refused_count : 1);
    setVal('approval-rate', raw.approval_rate != null ? raw.approval_rate : 0.67);
    setVal('years-since-last-app', raw.years_since_last_app != null ? raw.years_since_last_app : 1.8);
    setVal('avg-prev-credit', raw.avg_prev_credit != null ? raw.avg_prev_credit : 45000);
    setVal('max-prev-credit', raw.max_prev_credit != null ? raw.max_prev_credit : 70000);
    setVal('avg-prev-annuity', raw.avg_prev_annuity != null ? raw.avg_prev_annuity : 4500);

    setVal('avg-days-late', raw.avg_days_late != null ? raw.avg_days_late : 2.5);
    setVal('max-days-late', raw.max_days_late != null ? raw.max_days_late : 15);
    setVal('late-payment-count', raw.late_payment_count != null ? raw.late_payment_count : 3);
    setVal('late-payment-rate', raw.late_payment_rate != null ? raw.late_payment_rate : 0.08);
    setVal('avg-payment-ratio', raw.avg_payment_ratio != null ? raw.avg_payment_ratio : 1.0);
    setVal('total-payment-amount', raw.total_payment_amount != null ? raw.total_payment_amount : 15400);

    setVal('ext-source-1', raw.ext_source_1 != null ? raw.ext_source_1 : rec.ext_source_1 || 0.5);
    setVal('ext-source-2', raw.ext_source_2 != null ? raw.ext_source_2 : rec.ext_source_2 || 0.5);
    setVal('ext-source-3', raw.ext_source_3 != null ? raw.ext_source_3 : rec.ext_source_3 || 0.5);

    closeDetailsModal();
    switchTab('underwrite');
    // Go to step 1
    appState.currentWizardStep = 1;
    updateWizardUI();
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
