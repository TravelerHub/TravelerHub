"""
Run once to generate VAPID keys for web push notifications:
    python generate_vapid_keys.py

Then add the output values to your .env file.
"""
import base64
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.backends import default_backend

def generate_vapid_keys():
    private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
    public_key = private_key.public_key()

    # Get raw bytes
    private_bytes = private_key.private_numbers().private_value.to_bytes(32, 'big')
    public_numbers = public_key.public_key().public_numbers() if hasattr(public_key, 'public_key') else public_key.public_numbers()

    # Uncompressed point format: 0x04 + x + y (65 bytes)
    x = public_numbers.x.to_bytes(32, 'big')
    y = public_numbers.y.to_bytes(32, 'big')
    public_bytes = b'\x04' + x + y

    priv_b64 = base64.urlsafe_b64encode(private_bytes).rstrip(b'=').decode()
    pub_b64  = base64.urlsafe_b64encode(public_bytes).rstrip(b'=').decode()

    print("Add these to your backend .env:\n")
    print(f"VAPID_PUBLIC_KEY={pub_b64}")
    print(f"VAPID_PRIVATE_KEY={priv_b64}")
    print(f"VAPID_EMAIL=mailto:foojanbabaeeian@gmail.com")

if __name__ == '__main__':
    generate_vapid_keys()
