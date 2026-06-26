import pandas as pd
from catboost import Pool
from config import MODEL, FEATURE_COLS

# Human-readable labels for the most important features
FEATURE_LABELS = {
    "EXT_SOURCE_3":    "External Credit Score 3 (Bureau)",
    "EXT_SOURCE_2":    "External Credit Score 2 (Bureau)",
    "EXT_SOURCE_1":    "External Credit Score 1 (Bureau)",
    "AMT_INCOME_TOTAL":"Annual Income",
    "AMT_CREDIT":      "Requested Loan Amount",
    "AMT_ANNUITY":     "Monthly Annuity Payment",
    "ANNUITY_INCOME_RATIO": "Annuity-to-Income Ratio",
    "CREDIT_INCOME_RATIO":  "Credit-to-Income Ratio",
    "YEARS_EMPLOYED":  "Employment Tenure (Years)",
    "DAYS_EMPLOYED":   "Employment Tenure",
    "AGE":             "Applicant Age",
    "DAYS_BIRTH":      "Applicant Age",
    "LATE_PAYMENT_RATE":    "Late Payment Rate",
    "LATE_PAYMENT_COUNT":   "Late Payment Count",
    "AVG_DAYS_LATE":        "Average Days Late",
    "MAX_DAYS_LATE":        "Maximum Days Late",
    "TOTAL_DEBT":           "Outstanding Bureau Debt",
    "ACTIVE_LOAN_COUNT":    "Active Bureau Loans",
    "CLOSED_LOAN_COUNT":    "Closed Bureau Loans",
    "AVG_CREDIT_SUM":       "Average Credit Sum (Bureau)",
    "TOTAL_CREDIT_SUM":     "Total Credit Sum (Bureau)",
    "PREV_APP_COUNT":       "Previous Application Count",
    "APPROVED_COUNT":       "Prior Approved Loans",
    "REFUSED_COUNT":        "Prior Refused Loans",
    "APPROVAL_RATE":        "Prior Loan Approval Rate",
    "YEARS_SINCE_LAST_APPLICATION": "Years Since Last Application",
    "CODE_GENDER":          "Gender",
    "NAME_EDUCATION_TYPE":  "Education Level",
    "NAME_INCOME_TYPE":     "Employment Type",
    "NAME_FAMILY_STATUS":   "Marital Status",
    "NAME_HOUSING_TYPE":    "Housing Type",
    "FLAG_OWN_CAR":         "Car Ownership",
    "FLAG_OWN_REALTY":      "Property Ownership",
    "CNT_CHILDREN":         "Number of Children",
}


def compute_shap(df_pred: pd.DataFrame, row: dict) -> list:
    """
    Compute CatBoost native SHAP values and return the top 7
    feature contributions sorted by absolute impact.
    """
    pool = Pool(df_pred)
    shap_vals = MODEL.get_feature_importance(data=pool, type="ShapValues")[0][:-1]

    contributions = []
    for i, col in enumerate(FEATURE_COLS):
        if col not in FEATURE_LABELS:
            continue
        val = row.get(col, 0.0)

        # Format value for display
        if col in ("EXT_SOURCE_1", "EXT_SOURCE_2", "EXT_SOURCE_3"):
            formatted = f"{val:.2f}"
        elif col in ("AMT_INCOME_TOTAL", "AMT_CREDIT", "AMT_ANNUITY",
                     "TOTAL_DEBT", "TOTAL_CREDIT_SUM", "AVG_CREDIT_SUM"):
            formatted = f"₹{float(val):,.0f}"
        elif col in ("ANNUITY_INCOME_RATIO", "LATE_PAYMENT_RATE", "APPROVAL_RATE"):
            formatted = f"{float(val)*100:.1f}%"
        elif col in ("CREDIT_INCOME_RATIO",):
            formatted = f"{float(val):.2f}x"
        elif col in ("YEARS_EMPLOYED", "AGE"):
            formatted = f"{float(val):.1f} yrs"
        elif col == "DAYS_BIRTH":
            formatted = f"{abs(float(val))/365:.1f} yrs"
        elif col == "DAYS_EMPLOYED":
            formatted = f"{abs(float(val))/365:.1f} yrs" if float(val) < 0 else "0.0 yrs"
        else:
            formatted = str(val)

        contributions.append({
            "feature": FEATURE_LABELS[col],
            "impact":  float(shap_vals[i]),
            "value":   formatted,
        })

    # Sort by absolute SHAP impact, return top 7
    contributions.sort(key=lambda x: abs(x["impact"]), reverse=True)
    return contributions[:7]
