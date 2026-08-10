"""
models/user.py — User model with password hashing via bcrypt.
"""
from datetime import datetime, timezone

import bcrypt

from database.database import db


class User(db.Model):
    __tablename__ = "users"

    id            = db.Column(db.Integer,  primary_key=True)
    username      = db.Column(db.String(64),  nullable=False, unique=True)
    email         = db.Column(db.String(255), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name    = db.Column(db.String(64))
    is_admin      = db.Column(db.Boolean, default=False, nullable=False)
    created_at    = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    judgments = db.relationship("Judgment", backref="user", lazy="dynamic", cascade="all, delete-orphan")
    commits   = db.relationship("Commit",   backref="user", lazy="dynamic", cascade="all, delete-orphan")

    # ── Password helpers ─────────────────────────────────────────────────────

    def set_password(self, plain: str) -> None:
        """Hash and store a plain-text password."""
        self.password_hash = bcrypt.hashpw(
            plain.encode("utf-8"),
            bcrypt.gensalt(rounds=12)
        ).decode("utf-8")

    def check_password(self, plain: str) -> bool:
        """Return True if the plain-text password matches the stored hash."""
        return bcrypt.checkpw(
            plain.encode("utf-8"),
            self.password_hash.encode("utf-8")
        )

    # ── Serialisation ────────────────────────────────────────────────────────

    def to_dict(self) -> dict:
        return {
            "id":         self.id,
            "username":   self.username,
            "email":      self.email,
            "first_name": self.first_name,
            "is_admin":   self.is_admin,
            "created_at": self.created_at.isoformat(),
        }

    def __repr__(self) -> str:
        return f"<User {self.username}>"
