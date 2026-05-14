import bcrypt
from jose import JWTError, jwt
from datetime import datetime, timedelta

# from database import get_db


# bcrypt rejects inputs longer than 72 bytes outright. We previously routed
# through passlib's CryptContext, but passlib 1.7.4 (our pin, last released
# 2020) reads `bcrypt.__about__.__version__` to pick its compat path, and
# bcrypt 4.x removed that attribute. The fallback path it falls into now
# raises ValueError on every password — even short ones — because of an
# unrelated argument-encoding mismatch. Calling the bcrypt library directly
# is simpler, has no broken adapter layer, and lets us emulate the
# historical "silently truncate >72 bytes" behavior so existing users keep
# working.
def _to_bcrypt_bytes(password: str) -> bytes:
    encoded = password.encode("utf-8")
    return encoded[:72] if len(encoded) > 72 else encoded


def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(_to_bcrypt_bytes(password), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password, hashed_password) -> bool:
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.encode("utf-8")
    try:
        return bcrypt.checkpw(_to_bcrypt_bytes(plain_password), hashed_password)
    except (ValueError, TypeError):
        return False
