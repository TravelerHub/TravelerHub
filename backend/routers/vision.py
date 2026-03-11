from fastapi import APIRouter, UploadFile, File, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional
from utils import oauth2
from supabase_client import supabase
from google import genai
from google.genai import types
import os
import json
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini client (new google-genai SDK)
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

router = APIRouter(
    prefix="/vision",
    tags=["Vision"]
)

@router.post("/analyze-receipt")
async def analyze_receipt(
    file: UploadFile = File(...),
    current_user: dict = Depends(oauth2.get_current_user)
):
    """
    Upload a receipt image and extract expense data using Gemini Vision.
    """
    # 1. Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/heic"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {file.content_type} not supported. Use JPEG, PNG, or WebP."
        )

    # 2. Read file content
    file_content = await file.read()
    
    # 3. Create the prompt
    prompt = """Analyze this receipt image and extract the following information.
    Return ONLY valid JSON with no extra text, no markdown backticks, no explanation.

    {
        "merchant_name": "store or restaurant name",
        "date": "date on receipt in YYYY-MM-DD format, or null if not visible",
        "items": [
            {
                "name": "item description",
                "quantity": 1,
                "price": 0.00
            }
        ],
        "subtotal": 0.00,
        "tax": 0.00,
        "tip": 0.00,
        "total": 0.00,
        "currency": "USD",
        "payment_method": "cash/card/other or null if not visible"
    }

    If you cannot read a value, use null. For items you cannot read, skip them.
    Always return valid JSON."""

    # 4. Call Gemini
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                prompt,
                types.Part.from_bytes(data=file_content, mime_type=file.content_type),
            ],
        )

        # 6. Parse the response
        response_text = response.text.strip()
        
        # Clean up if Gemini wraps in markdown
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()

        parsed_data = json.loads(response_text)

        return {
            "success": True,
            "data": parsed_data,
            "raw_text": response.text
        }

    except json.JSONDecodeError:
        return {
            "success": False,
            "error": "Could not parse receipt data",
            "raw_text": response.text
        }
    except Exception as e:
        print(f"Gemini API error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to analyze receipt"
        )


@router.post("/analyze-document")
async def analyze_document(
    file: UploadFile = File(...),
    current_user: dict = Depends(oauth2.get_current_user)
):
    """
    Upload a travel document (ticket, confirmation, etc.) and extract key info.
    """
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {file.content_type} not supported."
        )

    file_content = await file.read()

    prompt = """Analyze this travel document image and extract key information.
    Return ONLY valid JSON with no extra text, no markdown backticks, no explanation.

    {
        "document_type": "flight_ticket/hotel_confirmation/car_rental/event_ticket/other",
        "title": "brief description of the document",
        "details": {
            "confirmation_number": "booking/confirmation number or null",
            "date": "relevant date in YYYY-MM-DD format or null",
            "time": "relevant time or null",
            "location": "venue/airport/hotel name or null",
            "address": "address if visible or null",
            "amount": 0.00,
            "currency": "USD",
            "notes": "any other important details"
        },
        "checklist_items": [
            "actionable item extracted from the document, e.g. Check-in by 3:00 PM",
            "another actionable item"
        ]
    }

    If you cannot read a value, use null. Always return valid JSON."""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                prompt,
                types.Part.from_bytes(data=file_content, mime_type=file.content_type),
            ],
        )

        response_text = response.text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()

        parsed_data = json.loads(response_text)

        return {
            "success": True,
            "data": parsed_data,
            "raw_text": response.text
        }

    except json.JSONDecodeError:
        return {
            "success": False,
            "error": "Could not parse document data",
            "raw_text": response.text
        }
    except Exception as e:
        print(f"Gemini API error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to analyze document"
        )


class ExpenseData(BaseModel):
    merchant_name: Optional[str] = None
    date: Optional[str] = None
    items: Optional[list] = None
    subtotal: Optional[float] = None
    tax: Optional[float] = None
    tip: Optional[float] = None
    total: Optional[float] = None
    currency: Optional[str] = "USD"
    payment_method: Optional[str] = None


@router.post("/save-expense")
async def save_expense(
    expense: ExpenseData,
    current_user: dict = Depends(oauth2.get_current_user)
):
    """Save a parsed receipt/expense to the database."""
    try:
        user_id = current_user.get("id") or current_user.get("user_id")
        row = {
            "user_id": user_id,
            "merchant_name": expense.merchant_name,
            "date": expense.date,
            "items": expense.items,
            "subtotal": expense.subtotal,
            "tax": expense.tax,
            "tip": expense.tip,
            "total": expense.total,
            "currency": expense.currency,
            "payment_method": expense.payment_method,
        }
        result = supabase.table("expenses").insert(row).execute()
        return {"success": True, "id": result.data[0]["id"] if result.data else None}
    except Exception as e:
        print(f"Save expense error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save expense"
        )