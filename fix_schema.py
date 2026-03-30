import sqlite3
import os

db_path = "data/voicebot.db"
if not os.path.exists(db_path):
    print(f"File not found: {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
c = conn.cursor()

def check_fk(table_name):
    c.execute(f"PRAGMA foreign_key_list({table_name})")
    rows = c.fetchall()
    return rows

tables = ["sessions", "knowledge_base", "conversation_logs", "appointments", "user_facts", "tool_logs", "session_feedback", "loans"]

for t in tables:
    try:
        fks = check_fk(t)
        if any("bots_old" in str(fk) for fk in fks):
            print(f"Table {t} has a bad FK to bots_old. Dropping and recreating.")
            c.execute(f"DROP TABLE IF EXISTS {t}")
        elif any("sessions_old" in str(fk) for fk in fks):
            print(f"Table {t} has a bad FK to sessions_old. Dropping and recreating.")
            c.execute(f"DROP TABLE IF EXISTS {t}")
    except sqlite3.OperationalError:
        pass # Table might not exist yet

conn.commit()
conn.close()
print("Cleanup complete.")
