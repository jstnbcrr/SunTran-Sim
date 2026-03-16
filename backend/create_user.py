#!/usr/bin/env python3
"""
Utility script to add or update users in users.json.

Usage:
    python create_user.py <username> <password>

Example:
    python create_user.py newresearcher mypassword123
"""

import bcrypt
import json
import os
import sys

USERS_FILE = os.path.join(os.path.dirname(__file__), "users.json")


def main():
    if len(sys.argv) != 3:
        print("Usage: python create_user.py <username> <password>")
        sys.exit(1)

    username, password = sys.argv[1], sys.argv[2]

    users = {}
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE) as f:
            users = json.load(f)

    users[username] = bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()

    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=2)

    action = "Updated" if username in users else "Created"
    print(f"{action} user '{username}' in {USERS_FILE}")


if __name__ == "__main__":
    main()
