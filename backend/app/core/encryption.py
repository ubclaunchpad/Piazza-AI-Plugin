import os

from cryptography.fernet import Fernet


def load_key() -> bytes:
    """
    Load the Fernet key from configuration.

    Priority:
    1. SECRET_KEY environment variable (base64-encoded key string).
    2. secret.key file in the current working directory.

    Raises:
        RuntimeError: If no key is found in either source.
    """
    env_key = os.environ.get("SECRET_KEY")
    if env_key:
        # Environment variables are strings; Fernet expects bytes.
        if isinstance(env_key, str):
            return env_key.encode("utf-8")
        return env_key

    try:
        with open("secret.key", "rb") as key_file:
            return key_file.read()
    except FileNotFoundError as exc:
        raise RuntimeError(
            "Encryption key not found. Set the SECRET_KEY environment variable "
            "or provide a 'secret.key' file in the working directory."
        ) from exc


class LazyFernet:
    """
    Lazily initializes a Fernet instance on first use to avoid
    filesystem access and configuration failures at import time.

    Use as:
        from app.core.encryption import fernet
        encrypted = fernet.encrypt(b"secret")
    """

    def __init__(self) -> None:
        self._fernet: Fernet | None = None

    def _get_fernet(self) -> Fernet:
        if self._fernet is None:
            key = load_key()
            self._fernet = Fernet(key)
        return self._fernet

    def __getattr__(self, name):
        return getattr(self._get_fernet(), name)


# Expose a module-level `fernet` object with lazy initialization.
fernet = LazyFernet()
