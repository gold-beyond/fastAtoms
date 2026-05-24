"""add password_hash column to users

Revision ID: c1a2b3c4d5e6
Revises: 1f748d6aaae8
Create Date: 2026-05-22 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = '1f748d6aaae8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add password_hash column to users table."""
    op.add_column('users', sa.Column('password_hash', sa.String(255), nullable=True))


def downgrade() -> None:
    """Remove password_hash column from users table."""
    op.drop_column('users', 'password_hash')
