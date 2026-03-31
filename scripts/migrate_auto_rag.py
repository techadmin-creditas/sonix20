import sqlite3
import os

db_path = 'data/voicebot.db'
if not os.path.exists('data'):
    os.makedirs('data')

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

columns_to_add = [
    ("topic_restriction", "TEXT DEFAULT NULL"),
    ("refuse_off_topic", "INTEGER DEFAULT 0")
]

for col_name, col_type in columns_to_add:
    try:
        cursor.execute(f"ALTER TABLE bots ADD COLUMN {col_name} {col_type}")
        print(f"Added column: {col_name}")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print(f"Column {col_name} already exists.")
        else:
            print(f"Error adding column {col_name}: {e}")

conn.commit()
conn.close()
print("Migration script finished.")
