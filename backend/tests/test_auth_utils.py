"""
Tests for backend/utils/hasing.py — password hashing and verification.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.hasing import hash_password, verify_password


def test_hash_and_verify_correct_password():
    """Hashing a password and verifying it with the same plaintext returns True."""
    password = "S3cur3P@ssw0rd!"
    hashed = hash_password(password)
    assert verify_password(password, hashed) is True


def test_verify_wrong_password_returns_false():
    """Verifying with the wrong plaintext returns False."""
    hashed = hash_password("correct-password")
    assert verify_password("wrong-password", hashed) is False


def test_two_hashes_of_same_password_are_different():
    """bcrypt generates a unique salt each time, so two hashes must differ."""
    password = "same-password"
    hash1 = hash_password(password)
    hash2 = hash_password(password)
    assert hash1 != hash2
    # Both must still verify correctly
    assert verify_password(password, hash1) is True
    assert verify_password(password, hash2) is True
