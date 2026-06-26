"""Script to verify PostgreSQL database connection and count predictions."""
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config import DATABASE_URL
from services.db_service import get_conn, init_db

print(f"DATABASE_URL is configured: {bool(DATABASE_URL)}")

try:
    init_db()
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM predictions")
    count = cursor.fetchone()[0]
    cursor.close()
    conn.close()
    print("PostgreSQL connection successful!")
    print(f"Total records in predictions table: {count}")
except Exception as e:
    print(f"Failed to connect to PostgreSQL: {e}")
