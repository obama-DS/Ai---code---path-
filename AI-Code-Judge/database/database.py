"""
database.py — SQLAlchemy instance and initialisation helper.
"""
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def init_db(app):
    """Create all tables if they don't exist yet."""
    # Import models so SQLAlchemy knows about them before create_all
    from backend.models.user       import User       # noqa: F401
    from backend.models.judgment   import Judgment   # noqa: F401
    from backend.models.commit     import Commit     # noqa: F401

    db.create_all()
