"""Codes de secours : remplacent l'e-mail de réinitialisation, sans service tiers à héberger.

Le code n'est affiché qu'une fois et stocké haché, comme un mot de passe. Sans lui, un compte
dont le mot de passe est perdu ne se récupère pas : c'est le prix de ne pas envoyer d'e-mails.
"""

import re
import secrets

# Sans I, L, O, U, 0 ni 1 : un code recopié à la main ne doit pas prêter à confusion
_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789"
_GROUPS = 4
_GROUP_SIZE = 4


def generate_recovery_code() -> str:
    groups = (
        "".join(secrets.choice(_ALPHABET) for _ in range(_GROUP_SIZE))
        for _ in range(_GROUPS)
    )
    return "-".join(groups)


def normalize_recovery_code(code: str) -> str:
    return re.sub(r"[\s-]", "", code).upper()
