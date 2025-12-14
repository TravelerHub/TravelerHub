from passlib.context import CryptContext

# 1. Setup the context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str):
    # --- DEBUGGING SPY ---
    print(f"\n[DEBUG] Hashing Password...")
    print(f"[DEBUG] Type: {type(password)}")
    print(f"[DEBUG] Length: {len(str(password))}")
    print(f"[DEBUG] Value: {password}\n")
    # ---------------------
    
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)