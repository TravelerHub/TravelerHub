"""
End-to-End Encryption utilities for secure messaging.
Uses NaCl (libsodium) for hybrid encryption:
- Public key cryptography for key exchange
- Symmetric encryption for message encryption/decryption
"""

import base64
import os
from typing import Tuple
from nacl.public import PrivateKey, PublicKey, Box
from nacl.secret import SecretBox
from nacl.utils import random
from nacl.pwhash import argon2i
import nacl.bindings


def generate_keypair() -> Tuple[str, str]:
    """
    Generate a new public/private keypair for a user.
    Returns (public_key, private_key) as base64-encoded strings.
    """
    private_key = PrivateKey.generate()
    public_key = private_key.public_key
    
    return (
        base64.b64encode(bytes(public_key)).decode('utf-8'),
        base64.b64encode(bytes(private_key)).decode('utf-8')
    )


def generate_conversation_key() -> str:
    """
    Generate a symmetric key for a conversation.
    This key will be encrypted with each member's public key.
    Returns base64-encoded key.
    """
    key = random(32)  # 256-bit key
    return base64.b64encode(key).decode('utf-8')


def encrypt_key_for_user(session_key: str, user_public_key: str) -> str:
    """
    Encrypt a session key with a user's public key.
    Args:
        session_key: base64-encoded symmetric key
        user_public_key: base64-encoded public key
    Returns: base64-encoded encrypted key
    """
    key_bytes = base64.b64decode(session_key)
    public_key_bytes = base64.b64decode(user_public_key)
    
    public_key = PublicKey(public_key_bytes)
    encrypted = public_key.encrypt(key_bytes)
    
    return base64.b64encode(bytes(encrypted)).decode('utf-8')


def decrypt_key_for_user(encrypted_key: str, user_private_key: str) -> str:
    """
    Decrypt a session key using a user's private key.
    Args:
        encrypted_key: base64-encoded encrypted key
        user_private_key: base64-encoded private key
    Returns: base64-encoded symmetric key
    """
    encrypted_bytes = base64.b64decode(encrypted_key)
    private_key_bytes = base64.b64decode(user_private_key)
    
    private_key = PrivateKey(private_key_bytes)
    decrypted = private_key.decrypt(encrypted_bytes)
    
    return base64.b64encode(decrypted).decode('utf-8')


def encrypt_message(message: str, session_key: str) -> str:
    """
    Encrypt a message using a symmetric session key.
    Args:
        message: plaintext message
        session_key: base64-encoded symmetric key
    Returns: base64-encoded encrypted message (nonce + ciphertext)
    """
    key_bytes = base64.b64decode(session_key)
    box = SecretBox(key_bytes)
    
    ciphertext = box.encrypt(message.encode('utf-8'))
    
    return base64.b64encode(bytes(ciphertext)).decode('utf-8')


def decrypt_message(encrypted_message: str, session_key: str) -> str:
    """
    Decrypt a message using a symmetric session key.
    Args:
        encrypted_message: base64-encoded encrypted message
        session_key: base64-encoded symmetric key
    Returns: plaintext message
    """
    encrypted_bytes = base64.b64decode(encrypted_message)
    key_bytes = base64.b64decode(session_key)
    
    box = SecretBox(key_bytes)
    plaintext = box.decrypt(encrypted_bytes)
    
    return plaintext.decode('utf-8')
