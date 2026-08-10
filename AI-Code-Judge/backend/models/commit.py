"""
models/commit.py — Stores auto-commit events from the file watcher.
"""
from datetime import datetime, timezone

from database.database import db


class Commit(db.Model):
    __tablename__ = "commits"

    id             = db.Column(db.Integer, primary_key=True)
    user_id        = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    file_name      = db.Column(db.String(512), nullable=False)
    commit_hash    = db.Column(db.String(40),  nullable=False)
    commit_message = db.Column(db.Text,        nullable=False)
    language       = db.Column(db.String(32))
    score          = db.Column(db.Integer)
    judgment_id    = db.Column(db.Integer, db.ForeignKey("judgments.id", ondelete="SET NULL"), nullable=True)
    created_at     = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    judgment = db.relationship("Judgment", foreign_keys=[judgment_id])

    def to_dict(self) -> dict:
        return {
            "id":             self.id,
            "user_id":        self.user_id,
            "file_name":      self.file_name,
            "commit_hash":    self.commit_hash,
            "commit_message": self.commit_message,
            "language":       self.language,
            "score":          self.score,
            "judgment_id":    self.judgment_id,
            "created_at":     self.created_at.isoformat(),
        }

    def __repr__(self) -> str:
        return f"<Commit {self.commit_hash[:8]} {self.file_name}>"
