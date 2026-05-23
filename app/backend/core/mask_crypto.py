# Used to conceal LLM access
import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken

key_prefix = "mgxkey-"


def _derive_fernet_key(key_material: str) -> bytes:
    """Derive a valid Fernet key from arbitrary string using SHA-256 and urlsafe base64."""
    digest = hashlib.sha256(key_material.encode("utf-8")).digest()  # 32 bytes
    return base64.urlsafe_b64encode(digest)


def _get_mask_key() -> str:
    """Get encryption key from environment variable only."""
    key = os.environ.get("MASK_KEY")
    if not key:
        raise ValueError("MASK_KEY environment variable is not set. Encryption operations are unavailable.")
    return key


def _get_fernet(key_str: str) -> Fernet:
    key = _derive_fernet_key(key_str)
    return Fernet(key)


def encrypt_text(plain: str) -> str:
    pwd = _get_mask_key()
    f = _get_fernet(pwd)
    return key_prefix + f.encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt_text(token: str) -> str:
    pwd = _get_mask_key()
    f = _get_fernet(pwd)
    if not token.startswith(key_prefix):
        raise ValueError("Invalid encrypted token: missing expected prefix")
    token = token.removeprefix(key_prefix)
    return f.decrypt(token.encode("utf-8")).decode("utf-8")
