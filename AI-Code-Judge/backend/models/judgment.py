"""
models/judgment.py — Stores every AI judgment result.
"""
import json
from datetime import datetime, timezone

from database.database import db


class Judgment(db.Model):
    __tablename__ = "judgments"

    id          = db.Column(db.Integer,  primary_key=True)
    user_id     = db.Column(db.Integer,  db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    language    = db.Column(db.String(32),  nullable=False)
    code        = db.Column(db.Text,        nullable=False)
    score       = db.Column(db.Integer,     nullable=False)
    result_json = db.Column(db.Text,        nullable=False)   # raw AI JSON
    personality = db.Column(db.String(32),  nullable=False, default="friendly")
    created_at  = db.Column(db.DateTime,    default=lambda: datetime.now(timezone.utc))

    @property
    def result(self) -> dict:
        try:
            return json.loads(self.result_json)
        except Exception:
            return {}

    @result.setter
    def result(self, value: dict) -> None:
        self.result_json = json.dumps(value)

    def to_dict(self, include_code: bool = True) -> dict:
        d = {
            "id":          self.id,
            "user_id":     self.user_id,
            "language":    self.language,
            "score":       self.score,
            "result":      self.result,
            "personality": self.personality,
            "created_at":  self.created_at.isoformat(),
        }
        if include_code:
            d["code"] = self.code
        return d

    def __repr__(self) -> str:
        return f"<Judgment id={self.id} score={self.score}>"
