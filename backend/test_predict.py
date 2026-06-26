"""Test prediction via Python urllib — bypasses PowerShell Invoke-WebRequest issues."""
import urllib.request
import json

payload = {
    "name": "Alex Chen",
    "age": 42,
    "gender": "M",
    "marital_status": "Married",
    "children": 2,
    "education": "Higher education",
    "housing": "House / apartment",
    "own_car": "Y",
    "own_property": "Y",
    "employment_type": "Working",
    "years_employed": 12.0,
    "income": 95000,
    "loan_amount": 250000,
    "annuity": 18000,
    "goods_price": 250000,
    "total_debt": 12000,
    "active_loans": 1,
    "closed_loans": 6,
    "avg_credit_age_days": 2100,
    "prev_app_count": 3,
    "approved_count": 3,
    "refused_count": 0,
    "approval_rate": 1.0,
    "years_since_last_app": 3.0,
    "avg_prev_credit": 60000,
    "max_prev_credit": 100000,
    "avg_prev_annuity": 6000,
    "avg_days_late": 0.5,
    "max_days_late": 2,
    "late_payment_count": 1,
    "late_payment_rate": 0.01,
    "avg_payment_ratio": 1.02,
    "total_payment_amount": 45000,
    "ext_source_1": 0.78,
    "ext_source_2": 0.82,
    "ext_source_3": 0.71
}

req = urllib.request.Request(
    "http://localhost:8000/api/predict",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST"
)

with urllib.request.urlopen(req, timeout=60) as resp:
    data = json.loads(resp.read().decode("utf-8"))
    print(f"Status: {resp.status}")
    print(f"Decision: {data.get('decision')}")
    print(f"Default Prob: {data.get('default_probability'):.4f}")
    print(f"Risk Category: {data.get('risk_category')}")
    print(f"DB ID: {data.get('db_id')}")
