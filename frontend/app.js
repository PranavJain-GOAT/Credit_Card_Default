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
        subtitle.innerText = 'Real-time loan credit evaluation and risk assessment portal.';
    } else if (tabId === 'underwrite') {
        title.innerText = 'Underwriting Wizard';
        subtitle.innerText = 'Input applicant parameters to analyze financial stability and default risk.';
    } else if (tabId === 'analysis') {
        title.innerText = 'Financial Health Analysis';
        subtitle.innerText = 'Deep dive indicators, leverage ratios, and capital stability models.';
        // Re-render charts to make sure they size properly on visibility change
        if (appState.predictionResults) {
            renderAnalysisCharts();
        }
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
        
        // Populate What-If inputs initially from active applicant values
        initWhatIfInputs(inputs);
        
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
    
    // Risk Meter & Needle position
    const needle = document.getElementById('risk-needle');
    const meterBar = document.getElementById('risk-meter-bar');
    needle.style.left = `${results.risk_score}%`;
    meterBar.style.width = `${results.risk_score}%`;
    
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
        // Assume max impact is around 3.0 for scale
        const absVal = Math.min(100, Math.abs(contrib.impact) * 35);
        bar.style.width = `${absVal}%`;
        
        if (contrib.impact >= 0) {
            bar.className = 'shap-bar positive';
            // Align left side
            bar.style.marginLeft = '50%';
        } else {
            bar.className = 'shap-bar negative';
            // Align right side
            bar.style.marginRight = '50%';
            bar.style.transform = 'scaleX(-1)';
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

// Initialize What-If Slider values
function initWhatIfInputs(inputs) {
    const wiIncome = document.getElementById('wi-income');
    if (!wiIncome) return; // Safely abort if What-If section is removed
    
    wiIncome.value = inputs.income;
    document.getElementById('val-wi-income').innerText = `$${inputs.income.toLocaleString()}`;
    
    document.getElementById('wi-loan').value = inputs.loan_amount;
    document.getElementById('val-wi-loan').innerText = `$${inputs.loan_amount.toLocaleString()}`;
    
    document.getElementById('wi-debt').value = inputs.total_debt;
    document.getElementById('val-wi-debt').innerText = `$${inputs.total_debt.toLocaleString()}`;
    
    document.getElementById('wi-approval').value = Math.round(inputs.approval_rate * 100);
    document.getElementById('val-wi-approval').innerText = `${Math.round(inputs.approval_rate * 100)}%`;
    
    document.getElementById('wi-laterate').value = Math.round(inputs.late_payment_rate * 100);
    document.getElementById('val-wi-laterate').innerText = `${Math.round(inputs.late_payment_rate * 100)}%`;
    
    // Set old probability display
    const originalProb = (appState.predictionResults.default_probability * 100).toFixed(1);
    document.getElementById('wi-old-prob').innerText = `${originalProb}%`;
    document.getElementById('wi-new-prob').innerText = `${originalProb}%`;
    
    const absEl = document.getElementById('wi-abs-change');
    const relEl = document.getElementById('wi-rel-change');
    if (absEl) {
        absEl.innerText = '0.0%';
        absEl.style.color = 'var(--text-color)';
    }
    if (relEl) {
        relEl.innerText = '0.0%';
        relEl.style.color = 'var(--text-color)';
    }
    
    const wiBadge = document.getElementById('wi-result-badge');
    if (wiBadge) {
        wiBadge.innerText = appState.predictionResults.decision;
        wiBadge.className = 'wi-result-badge ' + getDecisionClass(appState.predictionResults.decision);
    }
    
    const wiRecalcText = document.getElementById('wi-recalc-text');
    if (wiRecalcText) {
        wiRecalcText.innerText = "Adjust sliders to simulate changes in underwriting parameters.";
    }
}

function getDecisionClass(dec) {
    if (dec === 'APPROVE') return 'approve';
    if (dec === 'APPROVE WITH CONDITIONS') return 'approve';
    if (dec === 'REVIEW') return 'review';
    if (dec === 'MANUAL REVIEW') return 'review';
    return 'reject';
}

// Run What-If Simulation
function runWhatIf() {
    if (!appState.activeApplicant) return;
    const wiIncomeEl = document.getElementById('wi-income');
    if (!wiIncomeEl) return; // Safely abort if What-If section is removed
    
    // Read current slider states
    const wiIncome = parseFloat(wiIncomeEl.value);
    const wiLoan = parseFloat(document.getElementById('wi-loan').value);
    const wiDebt = parseFloat(document.getElementById('wi-debt').value);
    const wiApproval = parseFloat(document.getElementById('wi-approval').value) / 100.0;
    const wiLateRate = parseFloat(document.getElementById('wi-laterate').value) / 100.0;
    
    // Update slider label tags
    document.getElementById('val-wi-income').innerText = `$${wiIncome.toLocaleString()}`;
    document.getElementById('val-wi-loan').innerText = `$${wiLoan.toLocaleString()}`;
    document.getElementById('val-wi-debt').innerText = `$${wiDebt.toLocaleString()}`;
    document.getElementById('val-wi-approval').innerText = `${Math.round(wiApproval * 100)}%`;
    document.getElementById('val-wi-laterate').innerText = `${Math.round(wiLateRate * 100)}%`;
    
    // Copy active applicant and mutate with sliders values
    let simulationInputs = { ...appState.activeApplicant };
    simulationInputs.income = wiIncome;
    simulationInputs.loan_amount = wiLoan;
    simulationInputs.total_debt = wiDebt;
    simulationInputs.approval_rate = wiApproval;
    simulationInputs.late_payment_rate = wiLateRate;
    
    // Include original parameters for backend dynamic scaling
    simulationInputs.original_loan_amount = appState.activeApplicant.loan_amount;
    simulationInputs.original_annuity = appState.activeApplicant.annuity;
    simulationInputs.original_late_payment_rate = appState.activeApplicant.late_payment_rate;
    simulationInputs.original_avg_days_late = appState.activeApplicant.avg_days_late;
    simulationInputs.original_max_days_late = appState.activeApplicant.max_days_late;
    simulationInputs.original_late_payment_count = appState.activeApplicant.late_payment_count;
    
    // Trigger prediction
    fetch('/api/predict', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(simulationInputs)
    })
    .then(response => {
        if (!response.ok) throw new Error("Inference failed");
        return response.json();
    })
    .then(data => {
        const oldProbVal = appState.predictionResults.default_probability;
        const newProbVal = data.default_probability;
        
        const oldProb = (oldProbVal * 100).toFixed(1);
        const newProb = (newProbVal * 100).toFixed(1);
        
        document.getElementById('wi-old-prob').innerText = `${oldProb}%`;
        document.getElementById('wi-new-prob').innerText = `${newProb}%`;
        
        // Calculate Absolute Change and Percentage Change
        const absDiffVal = (newProbVal - oldProbVal) * 100;
        const absDiffText = (absDiffVal >= 0 ? '+' : '') + absDiffVal.toFixed(1) + '%';
        
        let relDiffVal = 0;
        let relDiffText = '0.0%';
        if (oldProbVal > 0) {
            relDiffVal = ((newProbVal - oldProbVal) / oldProbVal) * 100;
            relDiffText = (relDiffVal >= 0 ? '+' : '') + relDiffVal.toFixed(1) + '%';
        } else if (newProbVal > 0) {
            relDiffVal = 100;
            relDiffText = '+100.0%';
        }
        
        const absEl = document.getElementById('wi-abs-change');
        const relEl = document.getElementById('wi-rel-change');
        
        if (absEl) absEl.innerText = absDiffText;
        if (relEl) relEl.innerText = relDiffText;
        
        // Color indicators based on risk delta
        if (absDiffVal > 0.05) {
            if (absEl) absEl.style.color = 'var(--danger-color)';
            if (relEl) relEl.style.color = 'var(--danger-color)';
        } else if (absDiffVal < -0.05) {
            if (absEl) absEl.style.color = 'var(--success-color)';
            if (relEl) relEl.style.color = 'var(--success-color)';
        } else {
            if (absEl) absEl.style.color = 'var(--text-color)';
            if (relEl) relEl.style.color = 'var(--text-color)';
        }
        
        const wiBadge = document.getElementById('wi-result-badge');
        wiBadge.innerText = data.decision;
        wiBadge.className = 'wi-result-badge ' + getDecisionClass(data.decision);
        
        // Rationale comparison text
        const diff = (newProbVal - oldProbVal) * 100;
        let diffText = "";
        if (Math.abs(diff) < 0.05) {
            diffText = "No significant change in default probability risk profile.";
        } else if (diff < 0) {
            diffText = `Simulated adjustments decrease default probability by ${Math.abs(diff).toFixed(1)}% (from ${oldProb}% to ${newProb}%).`;
        } else {
            diffText = `Simulated adjustments increase default probability by ${diff.toFixed(1)}% (from ${oldProb}% to ${newProb}%).`;
        }
        document.getElementById('wi-recalc-text').innerText = `${diffText} Recommended action: ${data.decision}.`;
    })
    .catch(err => {
        console.error("Simulation failed:", err);
    });
}

// Render Financial Health Charts
function renderAnalysisCharts() {
    const results = appState.predictionResults;
    if (!results) return;
    
    const isDark = appState.theme === 'dark';
    const gridColor = isDark ? 'rgba(75, 85, 99, 0.3)' : 'rgba(226, 232, 240, 1)';
    const textColor = isDark ? '#9ca3af' : '#64748b';
    
    // Update metrics scorecard texts
    document.getElementById('scorecard-credit-income').innerText = results.scores.credit_to_income.toFixed(2);
    document.getElementById('scorecard-annuity-income').innerText = `${(results.scores.annuity_to_income * 100).toFixed(1)}%`;
    document.getElementById('scorecard-debt-burden').innerText = Math.round(results.scores.debt_burden);
    document.getElementById('scorecard-payment-discipline').innerText = Math.round(results.scores.payment_discipline);
    document.getElementById('scorecard-credit-stability').innerText = Math.round(results.scores.credit_stability);
    
    // 1. Radar Chart: Financial Health Profile
    const radarCtx = document.getElementById('healthRadarChart').getContext('2d');
    if (appState.charts.radar) {
        appState.charts.radar.destroy();
    }
    
    // Labels for radar axes
    const radarLabels = [
        'Liability Mitigation',
        'Income Coverage',
        'Payment Discipline',
        'Credit Stability',
        'Downpayment Asset Cover'
    ];
    
    const radarData = [
        results.scores.debt_burden,
        Math.max(0, 100 - (results.scores.annuity_to_income * 250)), // Ratio annuity/income
        results.scores.payment_discipline,
        results.scores.credit_stability,
        Math.min(100, Math.round(results.scores.loan_exposure))
    ];
    
    appState.charts.radar = new Chart(radarCtx, {
        type: 'radar',
        data: {
            labels: radarLabels,
            datasets: [{
                label: 'Applicant Risk Profile',
                data: radarData,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderColor: '#3b82f6',
                borderWidth: 2,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#3b82f6'
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
                        color: isDark ? '#f3f4f6' : '#0f172a',
                        font: { size: 11, family: 'Inter', weight: '500' }
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
                'Current Requested Loan',
                'Avg Prior Loans Approved',
                'Max Prior Loan Limit',
                'Avg Prior Goods Purchased'
            ],
            datasets: [{
                data: [
                    app.loan_amount,
                    app.avg_prev_credit || 0.0,
                    app.max_prev_credit || 0.0,
                    app.avg_prev_credit * 0.95 || 0.0 // Proxy
                ],
                backgroundColor: [
                    'rgba(59, 130, 246, 0.85)',
                    'rgba(16, 185, 129, 0.75)',
                    'rgba(16, 185, 129, 0.75)',
                    'rgba(139, 92, 246, 0.75)'
                ],
                borderRadius: 6,
                maxBarThickness: 50
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { size: 10 } }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: {
                        color: textColor,
                        font: { size: 9 },
                        callback: function(value) {
                            return '$' + (value / 1000) + 'k';
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
    
    document.getElementById('p-score-debt').innerText = Math.round(results.scores.debt_burden);
    document.getElementById('p-score-loan').innerText = Math.round(results.scores.loan_exposure);
    document.getElementById('p-score-stability').innerText = Math.round(results.scores.credit_stability);
    document.getElementById('p-score-discipline').innerText = Math.round(results.scores.payment_discipline);
    
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
