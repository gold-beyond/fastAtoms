"""Password hashing utility using bcrypt."""
import bcrypt


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its bcrypt hash."""
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


# Pre-computed bcrypt hashes for default accounts
DEFAULT_ACCOUNT_HASHES = {
    "admin": hash_password("admin123"),
    "alex": hash_password("alex123"),
    "sarah": hash_password("sarah123"),
}
