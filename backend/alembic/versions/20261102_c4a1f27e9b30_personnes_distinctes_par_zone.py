"""personnes distinctes par zone

Revision ID: c4a1f27e9b30
Revises: e1ed33210da0
Create Date: 2026-11-02 22:10:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c4a1f27e9b30'
down_revision: Union[str, None] = 'e1ed33210da0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Pas de reprise des anciennes lignes : sans l'identifiant de l'utilisateur, on ne peut pas
    # savoir qui les a créées. Elles restent dans les totaux mais ne publient plus de zone.
    op.add_column('community_reports', sa.Column('zone_reporter_hash', sa.String(length=64), nullable=True))
    op.add_column('community_reports', sa.Column('domain_reporter_hash', sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column('community_reports', 'domain_reporter_hash')
    op.drop_column('community_reports', 'zone_reporter_hash')
