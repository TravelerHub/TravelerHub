import os
import random
import string
import smtplib
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

# OTP Storage (in-memory)
otp_storage = {}

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD")
OTP_EXPIRY_MINUTES = int(os.getenv("OTP_EXPIRY_MINUTES", 10))
MAX_OTP_ATTEMPTS = int(os.getenv("MAX_OTP_ATTEMPTS", 5))


def generate_otp(length=6):
    """Generate a random OTP of specified length"""
    return ''.join(random.choices(string.digits, k=length))


def send_otp_email(email, otp):
    """Send OTP via email"""
    try:
        # Create message
        message = MIMEMultipart("alternative")
        message["Subject"] = "Your Password Reset OTP"
        message["From"] = SENDER_EMAIL
        message["To"] = email

        # HTML body
        html = f"""\
        <html>
          <body>
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
              <h2>Password Reset Request</h2>
              <p>You requested a password reset. Here's your OTP:</p>
              <div style="background-color: #f0f0f0; padding: 20px; border-radius: 5px; text-align: center;">
                <h1 style="letter-spacing: 5px; color: #333;">{otp}</h1>
              </div>
              <p>This OTP will expire in {OTP_EXPIRY_MINUTES} minutes.</p>
              <p>If you didn't request this, please ignore this email.</p>
            </div>
          </body>
        </html>
        """

        part = MIMEText(html, "html")
        message.attach(part)

        # Send email
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, email, message.as_string())
        
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False


def store_otp(email):
    """Generate, store, and send OTP"""
    otp = generate_otp()
    otp_storage[email] = {
        "otp": otp,
        "timestamp": datetime.now(),
        "attempts": 0
    }
    
    # Send email
    if send_otp_email(email, otp):
        return True, "OTP sent successfully"
    else:
        return False, "Failed to send OTP"


def verify_otp(email, otp_input):
    """Verify OTP"""
    if email not in otp_storage:
        return False, "OTP not found or expired"
    
    otp_data = otp_storage[email]
    
    # Check expiry
    expiry_time = otp_data["timestamp"] + timedelta(minutes=OTP_EXPIRY_MINUTES)
    if datetime.now() > expiry_time:
        del otp_storage[email]
        return False, "OTP has expired"
    
    # Check attempts
    if otp_data["attempts"] >= MAX_OTP_ATTEMPTS:
        del otp_storage[email]
        return False, "Too many attempts. Please request a new OTP"
    
    # Verify OTP
    if otp_data["otp"] == otp_input:
        del otp_storage[email]
        return True, "OTP verified successfully"
    else:
        otp_data["attempts"] += 1
        return False, f"Invalid OTP. {MAX_OTP_ATTEMPTS - otp_data['attempts']} attempts remaining"


def cleanup_expired_otps():
    """Remove expired OTPs"""
    current_time = datetime.now()
    expired_emails = []
    
    for email, otp_data in otp_storage.items():
        expiry_time = otp_data["timestamp"] + timedelta(minutes=OTP_EXPIRY_MINUTES)
        if current_time > expiry_time:
            expired_emails.append(email)
    
    for email in expired_emails:
        del otp_storage[email]
