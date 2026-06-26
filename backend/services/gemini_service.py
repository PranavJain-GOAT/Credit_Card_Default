import json
import os
import urllib.request
import urllib.error

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.5-flash-lite:generateContent?key={key}"
)


# ── Gemini API ────────────────────────────────────────────────────────────────
def call_gemini_api(api_key: str, system_instruction: str, user_prompt: str) -> str:
    """Call Gemini 2.5 Flash Lite REST API. Returns text or an error string."""
    url = GEMINI_URL.format(key=api_key)
    payload = {
        "contents": [
            {"role": "user",
             "parts": [{"text": f"System: {system_instruction}\nUser: {user_prompt}"}]}
        ],
        "generationConfig": {"temperature": 0.2},
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["candidates"][0]["content"]["parts"][0]["text"]
    except urllib.error.HTTPError as e:
        try:
            return f"Error calling Gemini API: {e}. {e.read().decode()}"
        except Exception:
            return f"Error calling Gemini API: {e}."
    except Exception as e:
        return f"Error calling Gemini API: {str(e)}."


# ── Local Fallback ────────────────────────────────────────────────────────────
def local_chat_responder(
    question: str, applicant_data: dict, prediction_results: dict, case_loaded: bool
) -> str:
    """Rule-based fallback when Gemini API is unavailable."""
    q = question.lower().strip()

    def rate(s: float) -> str:
        if s < 0.4: return "Weak (high-risk zone)"
        if s < 0.6: return "Moderate (intermediate risk)"
        return "Strong (low-risk zone)"

    # Identity
    if any(w in q for w in ["who are you", "what are you", "your name", "introduce"]):
        return (
            "I am **Nexus Risk AI Advisor** — the intelligent underwriting assistant "
            "for this platform. I can explain credit risk assessments, break down DTI, "
            "LTV, bureau scores, and provide personalised recommendations.\n\n"
            "Load an applicant via **New Underwrite** to get started!"
        )

    # Help
    if any(w in q for w in ["help", "what can you", "capabilities"]):
        return (
            "Here's what I can do:\n\n"
            "- **Explain decisions** — why Approve / Reject / Review?\n"
            "- **Break down metrics** — DTI, LTV, bureau scores in plain English\n"
            "- **Personalised recommendations** — specific improvement steps\n"
            "- **Model explainability** — how CatBoost weighted each feature\n\n"
            "Load a case from **New Underwrite** then ask me anything!"
        )

    # Greetings
    greetings = ["hello", "hi", "hey", "good morning", "good afternoon", "sup", "howdy"]
    if any(q.startswith(g) for g in greetings):
        if case_loaded:
            name  = applicant_data.get("name", "the applicant")
            prob  = prediction_results.get("default_probability", 0.0)
            dec   = prediction_results.get("decision", "PENDING")
            return (f"Hello! The case for **{name}** is loaded. Default probability: "
                    f"**{prob*100:.1f}%** — Decision: **{dec}**. Ask me anything!")
        return ("Hello! I'm **Nexus Risk AI Advisor**. Navigate to **New Underwrite**, "
                "evaluate an applicant, then come back to ask questions.")

    # No case loaded
    if not case_loaded:
        return ("No applicant case has been evaluated yet. Go to **New Underwrite**, "
                "fill the form, and click **Evaluate Underwrite**. Then I can answer "
                "detailed questions about risk scores and recommendations.")

    # — Case is loaded from here —
    name     = applicant_data.get("name", "the applicant")
    decision = prediction_results.get("decision", "PENDING")
    prob     = prediction_results.get("default_probability", 0.0)
    category = prediction_results.get("risk_category", "Unknown")
    scores   = prediction_results.get("scores", {})
    ext1     = float(applicant_data.get("ext_source_1", 0.5))
    ext2     = float(applicant_data.get("ext_source_2", 0.5))
    ext3     = float(applicant_data.get("ext_source_3", 0.5))

    # External / bureau scores
    if any(w in q for w in ["ext", "external", "bureau", "credit score", "fico"]):
        avg = (ext1 + ext2 + ext3) / 3
        return (
            f"### External Bureau Scores — {name}\n\n"
            f"Scores are normalised 0–1 (0 = highest risk, 1 = lowest risk).\n\n"
            f"- **EXT_SOURCE_1:** {ext1:.3f} — {rate(ext1)}\n"
            f"- **EXT_SOURCE_2:** {ext2:.3f} — {rate(ext2)}\n"
            f"- **EXT_SOURCE_3:** {ext3:.3f} — {rate(ext3)}\n"
            f"- **Average:** {avg:.3f} — {rate(avg)}\n\n"
            f"EXT_SOURCE_2 is the single most predictive feature in our CatBoost model (15.06% importance)."
        )

    # DTI
    if any(w in q for w in ["dti", "debt to income", "debt-to-income", "debt ratio"]):
        dti = scores.get("dti_ratio", 0)
        return (
            f"### Debt-to-Income (DTI) Ratio — {name}\n\n"
            f"DTI = (monthly loan payment + existing debt payments) ÷ monthly income × 100\n\n"
            f"**{name}'s DTI: {dti:.1f}%**\n"
            f"- < 36%: Safe zone\n- 36–43%: Caution\n- > 43%: High risk\n\n"
            + (f"⚠️ DTI of {dti:.1f}% exceeds the 40% policy limit." if dti > 40 else
               f"✅ DTI of {dti:.1f}% is within acceptable range.")
        )

    # LTV
    if any(w in q for w in ["ltv", "loan to value", "loan-to-value"]):
        ltv = scores.get("ltv_ratio", 0)
        return (
            f"### Loan-to-Value (LTV) Ratio — {name}\n\n"
            f"LTV = Loan Amount ÷ Goods Price × 100\n\n"
            f"**{name}'s LTV: {ltv:.1f}%**\n"
            f"- < 80%: Low risk (standard benchmark)\n"
            f"- 80–90%: Moderate risk\n- > 90%: High risk\n\n"
            + (f"⚠️ LTV of {ltv:.1f}% is above the 80% benchmark — consider a larger downpayment."
               if ltv > 80 else f"✅ LTV of {ltv:.1f}% is within the standard 80% threshold.")
        )

    # Decision explanation
    if any(w in q for w in ["why", "decision", "approve", "reject", "review", "reason"]):
        return (
            f"### Underwriting Decision — {name}\n\n"
            f"**Decision: {decision}** | Default Probability: {prob*100:.1f}%\n\n"
            f"{prediction_results.get('reasoning', '')}\n\n"
            f"**Risk Category:** {category}\n"
            f"**Strengths:** {'; '.join(prediction_results.get('strengths', []))}\n"
            f"**Weaknesses:** {'; '.join(prediction_results.get('weaknesses', []))}"
        )

    # Recommendations
    if any(w in q for w in ["recommend", "improve", "suggestion", "how to", "what should"]):
        recs = prediction_results.get("recommendations", [])
        if recs:
            return (f"### Recommendations for {name}\n\n" +
                    "\n".join(f"{i+1}. {r}" for i, r in enumerate(recs)))
        return f"No specific recommendations for {name} at this time."

    # SHAP / features
    if any(w in q for w in ["shap", "feature", "important", "factor", "contribution"]):
        contribs = prediction_results.get("contributions", [])
        if contribs:
            lines = "\n".join(
                f"{i+1}. **{c['feature']}** ({c['value']}) — impact: {c['impact']:+.4f}"
                for i, c in enumerate(contribs)
            )
            return f"### Top 7 SHAP Feature Contributions — {name}\n\n{lines}\n\nPositive impact = increases default risk. Negative = reduces it."
        return "SHAP values are not available for the current case."

    # Counterfactuals
    if any(w in q for w in ["counterfactual", "what if", "how much", "improve score", "reduce risk"]):
        cfs = prediction_results.get("counterfactuals", [])
        if cfs:
            lines = "\n".join(
                f"{i+1}. **{c['action']}** {c['change_needed']} → {c['new_probability']}% ({c['new_tier']})"
                for i, c in enumerate(cfs)
            )
            return f"### Path to Next Tier — {name}\n\n{lines}"
        return f"{name} is already in the best risk tier."

    # Default
    return (
        f"I can see the case for **{name}** (decision: **{decision}**, "
        f"probability: **{prob*100:.1f}%**). Ask me about bureau scores, DTI, LTV, "
        f"SHAP feature importance, recommendations, or the underwriting decision."
    )


# ── Unified Chat Handler ──────────────────────────────────────────────────────
def get_chat_reply(
    question: str,
    applicant_data: dict,
    prediction_results: dict,
    case_loaded: bool,
    api_key: str = "",
) -> str:
    """Try Gemini first, fall back to local responder on error."""
    env_key = os.environ.get("GEMINI_API_KEY", "")
    key = api_key.strip() or env_key.strip()

    if key:
        system = (
            "You are Nexus Risk AI Advisor, an expert banking credit analyst chatbot. "
            + (
                f"The current applicant is {applicant_data.get('name', 'unknown')}. "
                f"Applicant profile: {json.dumps(applicant_data)}. "
                f"Prediction results: {json.dumps({k:v for k,v in prediction_results.items() if k != 'debug'})}. "
                "Provide highly personalised, numbers-driven insights. Be institutional-grade and direct."
                if case_loaded else
                "No applicant has been evaluated yet. Ask the user to run an evaluation first."
            )
        )
        reply = call_gemini_api(key, system, question)
        if not reply.startswith("Error calling Gemini API"):
            return reply
        print(f"[Nexus Risk] Gemini failed, falling back to local: {reply[:80]}")

    return local_chat_responder(question, applicant_data, prediction_results, case_loaded)
