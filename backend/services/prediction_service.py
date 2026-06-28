import pandas as pd
from catboost import Pool
from config import MODEL, FEATURE_COLS, FEATURE_DEFAULTS, CATEGORY_MAPPINGS


# ── Helpers ────────────────────────────────────────────────────────────────────
def _get_float(d: dict, key: str, default: float = 0.0) -> float:
    val = d.get(key)
    if val is None or val == "":
        return default
    try:
        v = float(val)
        return default if pd.isna(v) else v
    except (ValueError, TypeError):
        return default


def _get_int(d: dict, key: str, default: int = 0) -> int:
    return int(_get_float(d, key, float(default)))


# ── Feature Engineering ────────────────────────────────────────────────────────
def build_feature_vector(inputs: dict) -> tuple[list, dict]:
    """
    Transform raw applicant inputs into the full 145-feature vector
    expected by the CatBoost model. Returns (features_list, row_dict).
    """
    row = FEATURE_DEFAULTS.copy()

    # Personal Profile
    age = _get_float(inputs, "age", 35.0)
    row["DAYS_BIRTH"] = -int(age * 365)
    row["AGE"]        = age
    row["CODE_GENDER"]       = inputs.get("gender", "F")
    row["NAME_FAMILY_STATUS"]= inputs.get("marital_status", "Married")
    row["CNT_CHILDREN"]      = _get_int(inputs, "children", 0)
    row["NAME_EDUCATION_TYPE"]= inputs.get("education", "Secondary / secondary special")
    row["NAME_HOUSING_TYPE"] = inputs.get("housing", "House / apartment")
    row["FLAG_OWN_CAR"]      = inputs.get("own_car", "N")
    row["FLAG_OWN_REALTY"]   = inputs.get("own_property", "Y")
    row["NAME_INCOME_TYPE"]  = inputs.get("employment_type", "Working")

    years_employed = _get_float(inputs, "years_employed", 5.0)
    row["DAYS_EMPLOYED"]  = -int(years_employed * 365)
    row["YEARS_EMPLOYED"] = years_employed

    # Financial + Co-variance Scaling (What-If support)
    income = _get_float(inputs, "income", 50000.0)
    credit = _get_float(inputs, "loan_amount", 100000.0)
    original_credit  = _get_float(inputs, "original_loan_amount", credit)
    original_annuity = _get_float(inputs, "original_annuity", _get_float(inputs, "annuity", 10000.0))

    if original_credit > 0:
        annuity     = (credit / original_credit) * original_annuity
        goods_price = (credit / original_credit) * _get_float(inputs, "goods_price", credit)
    else:
        annuity     = _get_float(inputs, "annuity", 10000.0)
        goods_price = _get_float(inputs, "goods_price", credit)

    row["AMT_INCOME_TOTAL"] = income
    row["AMT_CREDIT"]       = credit
    row["AMT_ANNUITY"]      = annuity
    row["AMT_GOODS_PRICE"]  = goods_price
    row["CREDIT_INCOME_RATIO"]  = credit / income if income > 0 else 0.0
    row["ANNUITY_INCOME_RATIO"] = annuity / income if income > 0 else 0.0

    # Credit Bureau
    total_debt    = _get_float(inputs, "total_debt", 0.0)
    active_loans  = _get_int(inputs, "active_loans", 0)
    closed_loans  = _get_int(inputs, "closed_loans", 0)
    total_loans   = max(1, active_loans + closed_loans)
    avg_credit_age= _get_float(inputs, "avg_credit_age_days", 1000.0)

    row["TOTAL_DEBT"]         = total_debt
    row["AVG_DEBT"]           = total_debt / total_loans
    row["ACTIVE_LOAN_COUNT"]  = active_loans
    row["CLOSED_LOAN_COUNT"]  = closed_loans
    row["AVG_CREDIT_AGE"]     = -avg_credit_age
    row["OLDEST_CREDIT"]      = -avg_credit_age * 1.5
    row["NEWEST_CREDIT"]      = -avg_credit_age * 0.5

    est_credit_sum = total_debt * 1.3 + credit
    row["TOTAL_CREDIT_SUM"]   = est_credit_sum
    row["AVG_CREDIT_SUM"]     = est_credit_sum / total_loans

    # Previous Applications
    approval_rate = _get_float(inputs, "approval_rate", 1.0)
    prev_count    = _get_int(inputs, "prev_app_count", 0)
    if prev_count == 0 and approval_rate < 0.99:
        prev_count = 2
    approved_count = int(prev_count * approval_rate)
    refused_count  = prev_count - approved_count

    row["PREV_APP_COUNT"]            = prev_count
    row["APPROVED_COUNT"]            = approved_count
    row["REFUSED_COUNT"]             = refused_count
    row["APPROVAL_RATE"]             = approval_rate
    row["YEARS_SINCE_LAST_APPLICATION"] = _get_float(inputs, "years_since_last_app", 1.0)
    row["AVG_PREV_CREDIT"]           = _get_float(inputs, "avg_prev_credit", credit)
    row["MAX_PREV_CREDIT"]           = _get_float(inputs, "max_prev_credit", credit)
    row["AVG_PREV_ANNUITY"]          = _get_float(inputs, "avg_prev_annuity", annuity)
    row["AVG_PREV_APPLICATION"]      = _get_float(inputs, "avg_prev_credit", credit) * 0.95

    # Payment Behaviour + Co-variance Scaling
    late_rate      = _get_float(inputs, "late_payment_rate", 0.0)
    orig_late_rate = _get_float(inputs, "original_late_payment_rate", 0.0)

    if orig_late_rate > 0.01:
        scale = late_rate / orig_late_rate
        avg_days_late      = _get_float(inputs, "original_avg_days_late", 0.0) * scale
        max_days_late      = _get_float(inputs, "original_max_days_late", 0.0) * scale
        late_payment_count = int(_get_int(inputs, "original_late_payment_count", 0) * scale)
    else:
        avg_days_late      = late_rate * 18.0
        max_days_late      = late_rate * 60.0
        late_payment_count = int(late_rate * 20)

    row["AVG_DAYS_LATE"]       = avg_days_late
    row["MAX_DAYS_LATE"]       = max_days_late
    row["LATE_PAYMENT_COUNT"]  = late_payment_count
    row["LATE_PAYMENT_RATE"]   = late_rate
    row["AVG_PAYMENT_RATIO"]   = _get_float(inputs, "avg_payment_ratio", 1.0)
    row["TOTAL_PAYMENT"]       = _get_float(inputs, "total_payment_amount", 0.0)

    # External Bureau Scores
    row["EXT_SOURCE_1"] = _get_float(inputs, "ext_source_1", 0.5)
    row["EXT_SOURCE_2"] = _get_float(inputs, "ext_source_2", 0.5)
    row["EXT_SOURCE_3"] = _get_float(inputs, "ext_source_3", 0.5)

    # Build final feature vector with categorical encoding
    features_list = []
    for col in FEATURE_COLS:
        val = row.get(col, 0.0)
        if col in CATEGORY_MAPPINGS:
            mapping = CATEGORY_MAPPINGS[col]
            if isinstance(val, str):
                val = mapping.get(val, 0)
        try:
            fval = float(val)
            features_list.append(0.0 if pd.isna(fval) else fval)
        except (ValueError, TypeError):
            features_list.append(0.0)

    return features_list, row


# ── Counterfactual Generator ───────────────────────────────────────────────────
def generate_counterfactuals(inputs: dict, current_prob: float) -> list:
    """
    Generate personalised improvement paths for every applicant.
    Always returns up to 3 actionable suggestions, regardless of risk tier.
    Each suggestion is specific to this applicant's actual data.
    """
    suggestions = []

    def probe(modified: dict) -> float:
        try:
            feats, _ = build_feature_vector(modified)
            df = pd.DataFrame([feats], columns=FEATURE_COLS)
            return float(MODEL.predict_proba(df)[0][1])
        except Exception:
            return current_prob

    base = dict(inputs)
    income     = _get_float(inputs, "income",            50000.0)
    loan       = _get_float(inputs, "loan_amount",       100000.0)
    total_debt = _get_float(inputs, "total_debt",        0.0)
    late_rate  = _get_float(inputs, "late_payment_rate", 0.0)
    ext1       = _get_float(inputs, "ext_source_1",      0.5)
    ext2       = _get_float(inputs, "ext_source_2",      0.5)
    ext3       = _get_float(inputs, "ext_source_3",      0.5)
    years_emp  = _get_float(inputs, "years_employed",    5.0)

    # Determine the target probability based on the applicant's current tier.
    # For already-approved applicants we still show "to keep your profile healthy" actions.
    if current_prob >= 0.75:
        target_prob = 0.74          # → MANUAL REVIEW
        target_tier = "MANUAL REVIEW"
    elif current_prob >= 0.50:
        target_prob = 0.49          # → REVIEW
        target_tier = "REVIEW"
    elif current_prob >= 0.20:
        target_prob = 0.19          # → APPROVE
        target_tier = "APPROVE"
    else:
        # Already APPROVE — show what would make the profile even stronger
        target_prob = max(0.0, current_prob - 0.05)
        target_tier = "APPROVE (Stronger)"

    # ── 1. Income increase (personalised % based on leverage ratio) ────────────
    ci_ratio = loan / income if income > 0 else 3.0
    step_pct = 10 if ci_ratio < 3 else 5          # smaller steps for high-leverage
    for pct in range(step_pct, 110, step_pct):
        mod = {**base, "income": income * (1 + pct / 100)}
        p = probe(mod)
        if p <= target_prob or pct >= 50:          # show even if not quite enough
            inc_needed = mod["income"] - income
            suggestions.append({
                "action": "Increase annual income",
                "change_needed": f"by ${inc_needed:,.0f} (+{pct}%) to reduce credit-income leverage from {ci_ratio:.1f}x",
                "new_probability": round(p * 100, 1),
                "new_tier": target_tier,
            })
            break

    # ── 2. Loan amount reduction ───────────────────────────────────────────────
    for pct in range(10, 61, 5):
        mod = {**base, "loan_amount": loan * (1 - pct / 100)}
        p = probe(mod)
        if p <= target_prob or pct >= 30:
            reduction = loan - mod["loan_amount"]
            suggestions.append({
                "action": "Reduce requested loan amount",
                "change_needed": f"by ${reduction:,.0f} (-{pct}%) to lower debt service and credit leverage",
                "new_probability": round(p * 100, 1),
                "new_tier": target_tier,
            })
            break

    # ── 3. Late payment improvement (always shown if any, otherwise bureau improvement) ──
    if late_rate > 0.005:
        # Has late payments — show what clearing them does
        mod = {**base, "late_payment_rate": 0.0, "original_late_payment_rate": 0.0}
        p = probe(mod)
        suggestions.append({
            "action": "Eliminate late payment history",
            "change_needed": f"Clear all {late_rate*100:.1f}% late rate — set up auto-payments and pay overdue balances",
            "new_probability": round(p * 100, 1),
            "new_tier": target_tier,
        })
    elif total_debt > 10000:
        # Has significant debt — show paydown benefit
        mod = {**base, "total_debt": max(0, total_debt * 0.50)}
        p = probe(mod)
        suggestions.append({
            "action": "Pay down outstanding bureau debt",
            "change_needed": f"Reduce ${total_debt:,.0f} bureau debt by 50% (${total_debt*0.50:,.0f}) to improve DTI ratio",
            "new_probability": round(p * 100, 1),
            "new_tier": target_tier,
        })
    else:
        # Low debt, no late payments — show bureau score improvement
        ext_avg = (ext1 + ext2 + ext3) / 3
        boost = min(1.0, ext2 + 0.20)
        mod = {**base, "ext_source_2": boost, "ext_source_3": min(1.0, ext3 + 0.15)}
        p = probe(mod)
        suggestions.append({
            "action": "Strengthen external credit bureau scores",
            "change_needed": f"Improve EXT_SOURCE_2 from {ext2:.2f} to {boost:.2f} by reducing enquiries and paying all balances on time",
            "new_probability": round(p * 100, 1),
            "new_tier": target_tier,
        })

    return suggestions[:3]


# ── Main Prediction Function ───────────────────────────────────────────────────
def predict(inputs: dict) -> dict:
    """
    Full prediction pipeline:
    1. Feature engineering
    2. CatBoost inference
    3. Risk tier + decision
    4. Strengths / weaknesses
    5. Recommendations
    6. Counterfactuals
    Returns a complete result dict.
    """
    features_list, row = build_feature_vector(inputs)
    df_pred = pd.DataFrame([features_list], columns=FEATURE_COLS)

    probs        = MODEL.predict_proba(df_pred)[0]
    default_prob = float(probs[1])
    risk_score   = round(default_prob * 100, 1)

    # ── Risk Tier ──────────────────────────────────────────────────────────────
    if risk_score < 20.0:
        risk_category, decision, decision_color = "Low Risk",      "APPROVE",        "#10b981"
    elif risk_score < 50.0:
        risk_category, decision, decision_color = "Medium Risk",   "REVIEW",         "#f59e0b"
    elif risk_score < 75.0:
        risk_category, decision, decision_color = "High Risk",     "MANUAL REVIEW",  "#3b82f6"
    else:
        risk_category, decision, decision_color = "Critical Risk", "REJECT",         "#ef4444"

    # ── Extracted row values ───────────────────────────────────────────────────
    income             = float(row.get("AMT_INCOME_TOTAL", 50000))
    credit             = float(row.get("AMT_CREDIT", 100000))
    annuity            = float(row.get("AMT_ANNUITY", 10000))
    goods_price        = float(row.get("AMT_GOODS_PRICE", credit))
    total_debt         = float(row.get("TOTAL_DEBT", 0))
    years_employed     = float(row.get("YEARS_EMPLOYED", 5))
    refused_count      = int(row.get("REFUSED_COUNT", 0))
    late_rate          = float(row.get("LATE_PAYMENT_RATE", 0))
    avg_days_late      = float(row.get("AVG_DAYS_LATE", 0))
    late_count         = int(row.get("LATE_PAYMENT_COUNT", 0))
    credit_income_ratio= float(row.get("CREDIT_INCOME_RATIO", 0))
    annuity_income_ratio=float(row.get("ANNUITY_INCOME_RATIO", 0))
    ext_1 = float(row.get("EXT_SOURCE_1", 0.5))
    ext_2 = float(row.get("EXT_SOURCE_2", 0.5))
    ext_3 = float(row.get("EXT_SOURCE_3", 0.5))

    # ── Underwriting Metrics ───────────────────────────────────────────────────
    ltv_ratio              = (credit / goods_price * 100.0) if goods_price > 0 else 0.0
    monthly_income         = income / 12.0
    monthly_proposed       = annuity / 12.0
    monthly_existing       = total_debt * 0.03
    total_monthly_oblig    = monthly_proposed + monthly_existing
    dti_ratio              = (total_monthly_oblig / monthly_income * 100.0) if monthly_income > 0 else 0.0
    monthly_surplus        = monthly_income - total_monthly_oblig
    delinquency_rate       = late_rate * 100.0
    has_car                = 15.0 if inputs.get("own_car") == "Y" else 0.0
    has_realty             = 15.0 if inputs.get("own_property") == "Y" else 0.0
    tenure_score           = min(40.0, years_employed * 4.0)
    history_score          = max(0.0, 30.0 - (refused_count * 15.0))
    stability_score        = has_car + has_realty + tenure_score + history_score

    scores = {
        "credit_to_income":         credit_income_ratio,
        "annuity_to_income":        annuity_income_ratio,
        "ltv_ratio":                ltv_ratio,
        "dti_ratio":                dti_ratio,
        "monthly_surplus":          monthly_surplus,
        "delinquency_rate":         delinquency_rate,
        "stability_score":          stability_score,
        "monthly_income":           monthly_income,
        "monthly_proposed_payment": monthly_proposed,
        "monthly_existing_payment": monthly_existing,
    }

    # ── Strengths / Weaknesses ─────────────────────────────────────────────────
    strengths, weaknesses = [], []
    if max(ext_2, ext_3) > 0.6:
        strengths.append(f"Strong external credit bureau scores (peak {max(ext_2, ext_3):.2f})")
    else:
        weaknesses.append(f"Weak external credit indices (minimum {min(ext_1, ext_2, ext_3):.2f})")
    if years_employed >= 5:
        strengths.append(f"Stable employment tenure ({years_employed:.1f} yrs)")
    elif years_employed < 2:
        weaknesses.append(f"Short employment history ({years_employed:.1f} yrs)")
    if credit_income_ratio < 2.0:
        strengths.append(f"Low credit leverage ({credit_income_ratio:.2f}x income)")
    elif credit_income_ratio > 4.0:
        weaknesses.append(f"High credit-to-income ratio ({credit_income_ratio:.2f}x)")
    if annuity_income_ratio < 0.12:
        strengths.append(f"Comfortable debt service ({annuity_income_ratio*100:.1f}% of income)")
    elif annuity_income_ratio > 0.25:
        weaknesses.append(f"Elevated monthly debt burden ({annuity_income_ratio*100:.1f}% DSR)")
    if late_rate < 0.05:
        strengths.append(f"High repayment consistency ({late_rate*100:.1f}% late rate)")
    else:
        weaknesses.append(f"Payment delinquencies ({late_count} late, avg {avg_days_late:.1f} days)")
    if refused_count == 0:
        strengths.append("Clean application record — no prior refusals")
    elif refused_count > 1:
        weaknesses.append(f"Multiple credit rejections ({refused_count} refusals on record)")

    # ── Reasoning ─────────────────────────────────────────────────────────────
    reasoning_map = {
        "APPROVE":       "Exceptional financial indicators and clean credit history justify immediate approval.",
        "REVIEW":        "Solid overall profile with minor risk flags — recommend review with standard conditions.",
        "MANUAL REVIEW": "Borderline risk zone; elevated DTI and payment indicators require manual verification.",
        "REJECT":        "Critical thresholds breached — high debt burden and frequent delinquencies pose unacceptable risk.",
    }
    reasoning = reasoning_map[decision]

    # ── Executive Summary ──────────────────────────────────────────────────────
    exec_summary = (
        f"Evaluation indicates a default probability of {risk_score}%, placing the applicant in the "
        f"{risk_category} category. Annual income of ₹{income:,.0f} against a requested loan of "
        f"₹{credit:,.0f} yields a credit-to-income ratio of {credit_income_ratio:.2f}. "
        + (f"Key strengths: {'; '.join(strengths[:2])}. " if strengths else "")
        + (f"Risk concerns: {'; '.join(weaknesses[:2])}. " if weaknesses else "")
        + f"External scores (EXT1: {ext_1:.2f}, EXT2: {ext_2:.2f}, EXT3: {ext_3:.2f}). "
        f"Recommended decision: {decision}."
    )

    # ── Recommendations ────────────────────────────────────────────────────────
    recs = []
    if min(ext_1, ext_2, ext_3) < 0.4:
        recs.append(f"Minimum bureau score is low ({min(ext_1,ext_2,ext_3):.3f}). Provide a "
                    f"₹{credit*0.20:,.0f} collateral pledge or institutional guarantor.")
    if credit_income_ratio > 3.0:
        target = income * 2.0
        recs.append(f"Loan leverage {credit_income_ratio:.2f}x income is high. Restructure "
                    f"downward by ₹{credit-target:,.0f} to reach the ₹{target:,.0f} low-risk limit.")
    if annuity_income_ratio > 0.15:
        recs.append(f"Monthly debt service {annuity_income_ratio*100:.1f}% of income. Extend "
                    f"amortisation or reduce principal by ₹{(annuity-income*0.12)/12.0:,.0f}/mo.")
    if late_rate > 0.05:
        recs.append(f"Set up auto-payments to clear {late_rate*100:.1f}% late rate "
                    f"({late_count} delays averaging {avg_days_late:.1f} days).")
    if years_employed < 3.0:
        recs.append(f"Maintain current employment for {max(1,int((3.0-years_employed)*12))} more "
                    f"months to reach the 3-year low-risk benchmark.")
    if total_debt > 20000:
        recs.append(f"Pay down ₹{total_debt-10000:,.0f} of outstanding bureau debt "
                    f"(currently ₹{total_debt:,.0f}) to improve DTI.")
    if refused_count > 0:
        recs.append(f"Observe a {max(6, refused_count*4)}-month cooling-off before reapplying "
                    f"to allow {refused_count} bureau refusals to age out.")
    if dti_ratio > 40.0:
        recs.append(f"DTI is {dti_ratio:.1f}%. Reduce monthly obligations or increase income "
                    f"to stay under the 40% policy threshold.")
    if ltv_ratio > 80.0:
        recs.append(f"LTV {ltv_ratio:.1f}% — inject ₹{credit-goods_price*0.80:,.0f} additional "
                    f"downpayment to reach the 80% institutional benchmark.")
    if len(recs) < 3:
        recs.append(f"Maintain annuity below 12% of income (currently {annuity_income_ratio*100:.1f}%).")
        recs.append(f"Keep all credit utilisation under 30% to sustain the current risk profile.")

    # ── Counterfactuals ────────────────────────────────────────────────────────
    counterfactuals = generate_counterfactuals(inputs, default_prob)

    return {
        "default_probability":     default_prob,
        "non_default_probability": 1.0 - default_prob,
        "risk_score":              risk_score,
        "risk_category":           risk_category,
        "decision":                decision,
        "decision_color":          decision_color,
        "reasoning":               reasoning,
        "executive_summary":       exec_summary,
        "strengths":               strengths,
        "weaknesses":              weaknesses,
        "scores":                  scores,
        "recommendations":         recs[:4],
        "counterfactuals":         counterfactuals,
        "model_version":           "catboost_v1",
    }
