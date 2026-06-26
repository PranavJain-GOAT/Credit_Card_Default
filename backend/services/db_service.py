import sqlite3
import datetime
import json
import traceback
from config import DB_PATH


def init_db():
    """Create predictions table if it does not exist."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                applicant_name TEXT,
                prediction_timestamp TEXT,
                default_probability REAL,
                non_default_probability REAL,
                risk_category TEXT,
                lending_decision TEXT,
                age REAL,
                annual_income REAL,
                loan_amount REAL,
                total_debt REAL,
                ext_source_1 REAL,
                ext_source_2 REAL,
                ext_source_3 REAL,
                executive_summary TEXT,
                raw_inputs TEXT,
                response_json TEXT
            )
        """)
        conn.commit()
        conn.close()
        print("[Nexus Risk] SQLite DB initialized.")
    except Exception as e:
        print(f"[Nexus Risk] DB init error: {e}")


def save_prediction(inputs: dict, results: dict) -> int:
    """Persist a prediction to SQLite. Returns the new row ID."""
    try:
        timestamp = datetime.datetime.utcnow().isoformat()
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO predictions (
                applicant_name, prediction_timestamp, default_probability, non_default_probability,
                risk_category, lending_decision, age, annual_income, loan_amount, total_debt,
                ext_source_1, ext_source_2, ext_source_3, executive_summary, raw_inputs, response_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            inputs.get("name", "Unknown"),
            timestamp,
            float(results.get("default_probability", 0.0)),
            float(results.get("non_default_probability", 1.0)),
            results.get("risk_category", "Unknown"),
            results.get("decision", "PENDING"),
            float(inputs.get("age", 35.0)),
            float(inputs.get("income", 50000.0)),
            float(inputs.get("loan_amount", 100000.0)),
            float(inputs.get("total_debt", 0.0)),
            float(inputs.get("ext_source_1", 0.5)),
            float(inputs.get("ext_source_2", 0.5)),
            float(inputs.get("ext_source_3", 0.5)),
            results.get("executive_summary", ""),
            json.dumps(inputs),
            json.dumps(results),
        ))
        conn.commit()
        row_id = cursor.lastrowid
        conn.close()
        print(f"[Nexus Risk] Saved prediction ID {row_id} for {inputs.get('name')}")
        return row_id
    except Exception as e:
        traceback.print_exc()
        return -1


def get_history(search: str = "", sort: str = "newest"):
    """Fetch the prediction history list."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    query = """
        SELECT id, applicant_name, prediction_timestamp, default_probability,
               risk_category, lending_decision
        FROM predictions WHERE 1=1
    """
    params = []
    if search:
        query += " AND (applicant_name LIKE ? OR risk_category LIKE ? OR lending_decision LIKE ?)"
        like = f"%{search}%"
        params.extend([like, like, like])

    order_map = {
        "newest":       "ORDER BY id DESC",
        "oldest":       "ORDER BY id ASC",
        "highest_risk": "ORDER BY default_probability DESC",
        "lowest_risk":  "ORDER BY default_probability ASC",
    }
    query += f" {order_map.get(sort, 'ORDER BY id DESC')}"

    cursor.execute(query, params)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows


def get_record_by_id(record_id: int):
    """Fetch a single full prediction record by ID."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM predictions WHERE id = ?", (record_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def delete_record(record_id: int) -> bool:
    """Delete a prediction record by ID. Returns True if deleted."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM predictions WHERE id = ?", (record_id,))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    return affected > 0
