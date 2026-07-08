from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

# Argon2id avec les paramètres par défaut de argon2-cffi (recommandations RFC 9106)
_hasher = PasswordHasher()

# Hash bidon utilisé quand l'email n'existe pas, pour que la réponse prenne
# le même temps et qu'on ne puisse pas deviner quels comptes existent
_DUMMY_HASH = _hasher.hash("mot-de-passe-qui-ne-sert-a-rien")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    try:
        _hasher.verify(password_hash or _DUMMY_HASH, password)
    except (VerificationError, InvalidHashError):
        return False
    return password_hash is not None


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)
