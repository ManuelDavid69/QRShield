"""code de secours

Revision ID: a7d3e15c8f42
Revises: c4a1f27e9b30
Create Date: 2026-11-03 01:05:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a7d3e15c8f42'
down_revision: Union[str, None] = 'c4a1f27e9b30'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('recovery_code_hash', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'recovery_code_hash')
