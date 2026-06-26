import psycopg2
from psycopg2.extras import RealDictCursor
import datetime
import json
import traceback
from config import DATABASE_URL


def get_conn():
    """Returns a new connection to the PostgreSQL database."""
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable is not set.")
    return psycopg2.connect(DATABASE_URL)


def init_db():
    """Create predictions table in PostgreSQL if it does not exist."""
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS predictions (
                id SERIAL PRIMARY KEY,
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
        cursor.close()
        conn.close()
        print("[Nexus Risk] PostgreSQL DB initialized.")
    except Exception as e:
        print(f"[Nexus Risk] DB init error: {e}")
        traceback.print_exc()


def save_prediction(inputs: dict, results: dict) -> int:
    """Persist a prediction to PostgreSQL. Returns the new row ID."""
    try:
        timestamp = datetime.datetime.utcnow().isoformat()
        conn = get_conn()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            INSERT INTO predictions (
                applicant_name, prediction_timestamp, default_probability, non_default_probability,
                risk_category, lending_decision, age, annual_income, loan_amount, total_debt,
                ext_source_1, ext_source_2, ext_source_3, executive_summary, raw_inputs, response_json
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id;
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
        row = cursor.fetchone()
        conn.commit()
        row_id = row['id'] if row else -1
        cursor.close()
        conn.close()
        print(f"[Nexus Risk] Saved prediction ID {row_id} for {inputs.get('name')}")
        return row_id
    except Exception as e:
        traceback.print_exc()
        return -1


def get_history(search: str = "", sort: str = "newest"):
    """Fetch the prediction history list from PostgreSQL."""
    try:
        conn = get_conn()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        query = """
            SELECT id, applicant_name, prediction_timestamp, default_probability,
                   risk_category, lending_decision
            FROM predictions WHERE 1=1
        """
        params = []
        if search:
            query += " AND (applicant_name ILIKE %s OR risk_category ILIKE %s OR lending_decision ILIKE %s)"
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
        rows = [dict(row) for row in cursor.fetchall()]
        cursor.close()
        conn.close()
        return rows
    except Exception as e:
        traceback.print_exc()
        return []


def get_record_by_id(record_id: int):
    """Fetch a single full prediction record by ID from PostgreSQL."""
    try:
        conn = get_conn()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM predictions WHERE id = %s", (record_id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        return dict(row) if row else None
    except Exception as e:
        traceback.print_exc()
        return None


def delete_record(record_id: int) -> bool:
    """Delete a prediction record by ID. Returns True if deleted."""
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM predictions WHERE id = %s", (record_id,))
        affected = cursor.rowcount
        conn.commit()
        cursor.close()
        conn.close()
        return affected > 0
    except Exception as e:
        traceback.print_exc()
        return False
