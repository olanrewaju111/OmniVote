#!/usr/bin/env python3
"""Fix seed user passwords to use proper bcrypt hashes that work in production."""
import subprocess, sys

def hash_pw(pw: str) -> str:
    result = subprocess.run(
        ["node", "-e", f""
        const bcrypt = require('bcryptjs');
        bcrypt.hash('{pw}', 12).then(h => console.log(h));
        """],
        capture_output=True, text=True, cwd="/home/z/my-project"
    )
    return result.stdout.strip()

# Hash the default password
hashed = hash_pw("password")
if not hashed or not hashed.startswith("$2"):
    print(f"ERROR: failed to generate hash: {hashed}")
    sys.exit(1)

print(f"Generated bcrypt hash: {hashed[:20]}...")

# Update all seed users with plaintext 'changeme' password hash
import sqlite3
db_path = "/home/z/my-project/db/custom.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.execute("SELECT id, email, passwordHash FROM User WHERE passwordHash = 'changeme'")
users = cur.fetchall()
print(f"Found {len(users)} users with plaintext passwordHash")

for uid, email, _ in users:
    cur.execute("UPDATE User SET passwordHash = ? WHERE id = ?", (hashed, uid))
    print(f"  Fixed: {email}")

conn.commit()
conn.close()
print(f"\nDone! All {len(users)} seed users now have proper bcrypt hashes.")
