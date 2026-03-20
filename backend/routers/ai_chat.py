from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional, List
from utils import oauth2
from supabase_client import supabase
from google import genai
from google.genai import types
import os
import json
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

router = APIRouter(
    prefix="/ai-chat",
    tags=["AI Chat"]
)

SYSTEM_PROMPT = """You are TravelBot, an AI travel assistant built into the TravelerHub app.
You appear as a small floating chat widget on every page of the app.

You help users with:
- Trip planning and itinerary suggestions
- Finding nearby places (restaurants, hotels, attractions, gas stations, etc.)
- Currency conversion and travel budgeting
- Translating text for international travel
- Answering questions about their trips, bookings, and expenses
- Suggesting fun activities, games, and entertainment for travelers
- General travel tips, packing lists, and safety advice

You have access to the user's trip data, bookings, and expenses through tool calls.
When a user asks about their trips or bookings, use the appropriate tool to look up real data.
When a user asks about nearby places, use the search_nearby_places tool.
When a user asks to convert currency, use the convert_currency tool.

IMPORTANT - Feature Routing: The app has these features you can direct users to:
- Navigation (/navigation) - route planning, maps, turn-by-turn directions
- Booking (/booking) - hotel and flight reservations
- Smart Scanner (/expenses) - scan receipts and travel documents with AI vision
- Calendar (/calendar) - trip schedule and itinerary view
- Finance (/finance) - budget tracking and expense splitting
- Messenger (/message) - group chat with trip members

When relevant, mention these features by name so the user knows where to go.
For example: "You can scan that receipt using the Smart Scanner feature!" or
"Check your Calendar to see your full itinerary."

STYLE GUIDELINES:
- Be concise since you're in a small chat widget, not a full page.
- Use short paragraphs and bullet points for readability.
- Be warm, friendly, and enthusiastic about travel.
- Keep responses under 200 words unless the user asks for detail.
- Your responses may be read aloud via text-to-speech, so write naturally.
- If you don't know something, say so honestly.
- Always respond in the language the user writes in, unless they ask for translation."""


# --- Tool function declarations for Gemini ---

tool_declarations = [
    types.Tool(function_declarations=[
        types.FunctionDeclaration(
            name="get_user_trips",
            description="Get all trips the user is part of, including trip name and members.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={},
            ),
        ),
        types.FunctionDeclaration(
            name="get_trip_bookings",
            description="Get bookings for a specific trip. Use this when the user asks about their hotel, flight, or booking details.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "trip_id": types.Schema(
                        type=types.Type.STRING,
                        description="The trip ID to get bookings for. Get this from get_user_trips first.",
                    ),
                },
                required=["trip_id"],
            ),
        ),
        types.FunctionDeclaration(
            name="get_user_expenses",
            description="Get the user's recent expenses and receipts.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "limit": types.Schema(
                        type=types.Type.INTEGER,
                        description="Max number of expenses to return. Default 10.",
                    ),
                },
            ),
        ),
        types.FunctionDeclaration(
            name="search_nearby_places",
            description="Search for nearby places like restaurants, hotels, gas stations, attractions, etc. Use when the user asks for recommendations or nearby POIs.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "query": types.Schema(
                        type=types.Type.STRING,
                        description="Search query, e.g. 'Italian restaurants', 'gas stations', 'museums'",
                    ),
                    "location": types.Schema(
                        type=types.Type.STRING,
                        description="Location to search near, e.g. 'New York City', 'near me', or coordinates",
                    ),
                },
                required=["query"],
            ),
        ),
        types.FunctionDeclaration(
            name="convert_currency",
            description="Convert an amount from one currency to another. Use when the user asks about exchange rates or currency conversion.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "amount": types.Schema(
                        type=types.Type.NUMBER,
                        description="The amount to convert",
                    ),
                    "from_currency": types.Schema(
                        type=types.Type.STRING,
                        description="Source currency code, e.g. 'USD', 'EUR', 'JPY'",
                    ),
                    "to_currency": types.Schema(
                        type=types.Type.STRING,
                        description="Target currency code, e.g. 'USD', 'EUR', 'JPY'",
                    ),
                },
                required=["amount", "from_currency", "to_currency"],
            ),
        ),
        types.FunctionDeclaration(
            name="get_saved_routes",
            description="Get the user's saved navigation routes for a trip.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "trip_id": types.Schema(
                        type=types.Type.STRING,
                        description="The trip ID to get routes for.",
                    ),
                },
            ),
        ),
        types.FunctionDeclaration(
            name="get_checklists",
            description="Get checklists for a specific trip.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "trip_id": types.Schema(
                        type=types.Type.STRING,
                        description="The trip ID to get checklists for.",
                    ),
                },
                required=["trip_id"],
            ),
        ),
    ])
]


# --- Tool execution functions ---

def execute_get_user_trips(user_id: str) -> str:
    try:
        # Get groups/trips the user belongs to
        memberships = supabase.table("group_member").select(
            "conversation_id, role"
        ).eq("user_id", user_id).is_("left_datetime", "null").execute()

        if not memberships.data:
            return json.dumps({"trips": [], "message": "No trips found."})

        trip_ids = [m["conversation_id"] for m in memberships.data]
        roles = {m["conversation_id"]: m["role"] for m in memberships.data}

        trips = supabase.table("conversation").select(
            "conversation_id, conversation_name"
        ).in_("conversation_id", trip_ids).execute()

        result = []
        for t in (trips.data or []):
            result.append({
                "trip_id": t["conversation_id"],
                "name": t["conversation_name"],
                "role": roles.get(t["conversation_id"], "member"),
            })

        return json.dumps({"trips": result})
    except Exception as e:
        return json.dumps({"error": str(e)})


def execute_get_trip_bookings(trip_id: str) -> str:
    try:
        bookings = supabase.table("booking").select("*").eq(
            "trip_id", trip_id
        ).execute()
        return json.dumps({"bookings": bookings.data or []})
    except Exception as e:
        return json.dumps({"error": str(e)})


def execute_get_user_expenses(user_id: str, limit: int = 10) -> str:
    try:
        expenses = supabase.table("expenses").select("*").eq(
            "user_id", user_id
        ).order("created_at", desc=True).limit(limit).execute()
        return json.dumps({"expenses": expenses.data or []}, default=str)
    except Exception as e:
        return json.dumps({"error": str(e)})


def execute_search_nearby_places(query: str, location: str = None) -> str:
    """Use Google Places Text Search via the genai client's built-in knowledge.
    For a real integration, call the Google Places API here."""
    # Return a prompt-based fallback — Gemini will use its knowledge
    return json.dumps({
        "note": "Places search executed",
        "query": query,
        "location": location or "not specified",
        "suggestion": f"Based on the query '{query}', provide helpful recommendations using your knowledge of popular places."
    })


def execute_convert_currency(amount: float, from_currency: str, to_currency: str) -> str:
    """Use a free exchange rate API for conversion."""
    try:
        import urllib.request
        url = f"https://open.er-api.com/v6/latest/{from_currency.upper()}"
        with urllib.request.urlopen(url, timeout=5) as resp:
            data = json.loads(resp.read().decode())
        if data.get("result") == "success":
            rate = data["rates"].get(to_currency.upper())
            if rate:
                converted = round(amount * rate, 2)
                return json.dumps({
                    "amount": amount,
                    "from": from_currency.upper(),
                    "to": to_currency.upper(),
                    "rate": rate,
                    "converted": converted,
                })
        return json.dumps({"error": f"Could not find rate for {to_currency}"})
    except Exception as e:
        return json.dumps({"error": f"Currency API unavailable: {str(e)}"})


def execute_get_saved_routes(user_id: str, trip_id: str = None) -> str:
    try:
        query = supabase.table("saved_routes").select("*").eq("created_by", user_id)
        if trip_id:
            query = query.eq("trip_id", trip_id)
        routes = query.order("created_at", desc=True).limit(10).execute()
        items = []
        for r in (routes.data or []):
            items.append({
                "id": r["id"],
                "name": r["name"],
                "total_distance": r.get("total_distance"),
                "total_duration": r.get("total_duration"),
                "created_at": str(r.get("created_at", "")),
            })
        return json.dumps({"routes": items})
    except Exception as e:
        return json.dumps({"error": str(e)})


def execute_get_checklists(trip_id: str) -> str:
    try:
        checklists = supabase.table("checklists").select("*").eq(
            "trip_id", trip_id
        ).execute()
        return json.dumps({"checklists": checklists.data or []}, default=str)
    except Exception as e:
        return json.dumps({"error": str(e)})


def run_tool(name: str, args: dict, user_id: str) -> str:
    """Dispatch a tool call to the appropriate function."""
    if name == "get_user_trips":
        return execute_get_user_trips(user_id)
    elif name == "get_trip_bookings":
        return execute_get_trip_bookings(args.get("trip_id", ""))
    elif name == "get_user_expenses":
        return execute_get_user_expenses(user_id, args.get("limit", 10))
    elif name == "search_nearby_places":
        return execute_search_nearby_places(args.get("query", ""), args.get("location"))
    elif name == "convert_currency":
        return execute_convert_currency(
            args.get("amount", 0),
            args.get("from_currency", "USD"),
            args.get("to_currency", "EUR"),
        )
    elif name == "get_saved_routes":
        return execute_get_saved_routes(user_id, args.get("trip_id"))
    elif name == "get_checklists":
        return execute_get_checklists(args.get("trip_id", ""))
    else:
        return json.dumps({"error": f"Unknown tool: {name}"})


# --- Request/Response models ---

class ChatMessage(BaseModel):
    message: str
    conversation_id: Optional[str] = None


class ChatHistoryItem(BaseModel):
    role: str
    content: str


# --- Endpoints ---

@router.post("/send")
async def send_message(
    payload: ChatMessage,
    current_user: dict = Depends(oauth2.get_current_user),
):
    """Send a message to the AI chatbot and get a response."""
    user_id = current_user.get("id") or current_user.get("user_id")
    username = current_user.get("username", "Traveler")
    conversation_id = payload.conversation_id

    # 1. Create or retrieve conversation
    if not conversation_id:
        res = supabase.table("chatbot_conversations").insert({
            "user_id": user_id,
            "title": payload.message[:50],
        }).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create conversation")
        conversation_id = res.data[0]["id"]

    # 2. Store the user's message
    supabase.table("chatbot_messages").insert({
        "conversation_id": conversation_id,
        "role": "user",
        "content": payload.message,
    }).execute()

    # 3. Load conversation history
    history_res = supabase.table("chatbot_messages").select(
        "role, content"
    ).eq("conversation_id", conversation_id).order("created_at").execute()

    # Build Gemini contents from history
    contents = []
    for msg in (history_res.data or []):
        contents.append(
            types.Content(
                role="user" if msg["role"] == "user" else "model",
                parts=[types.Part.from_text(text=msg["content"])],
            )
        )

    # 4. Call Gemini with tools
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT + f"\nThe current user's name is {username}.",
                tools=tool_declarations,
                temperature=0.7,
            ),
        )

        # 5. Handle tool calls (loop up to 5 rounds)
        max_rounds = 5
        for _ in range(max_rounds):
            # Check if the response has function calls
            has_function_call = False
            if response.candidates and response.candidates[0].content.parts:
                for part in response.candidates[0].content.parts:
                    if part.function_call:
                        has_function_call = True
                        break

            if not has_function_call:
                break

            # Add the model's response (with function calls) to contents
            contents.append(response.candidates[0].content)

            # Execute each function call and build function responses
            function_response_parts = []
            for part in response.candidates[0].content.parts:
                if part.function_call:
                    fc = part.function_call
                    tool_result = run_tool(fc.name, dict(fc.args) if fc.args else {}, user_id)
                    function_response_parts.append(
                        types.Part.from_function_response(
                            name=fc.name,
                            response=json.loads(tool_result),
                        )
                    )

            # Add function responses to contents
            contents.append(
                types.Content(role="user", parts=function_response_parts)
            )

            # Call Gemini again with the tool results
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT + f"\nThe current user's name is {username}.",
                    tools=tool_declarations,
                    temperature=0.7,
                ),
            )

        # 6. Extract final text response
        bot_reply = response.text.strip() if response.text else "I'm sorry, I couldn't generate a response."

    except Exception as e:
        print(f"Gemini AI Chat error: {e}")
        bot_reply = "I'm having trouble processing your request right now. Please try again."

    # 7. Store the bot's response
    supabase.table("chatbot_messages").insert({
        "conversation_id": conversation_id,
        "role": "assistant",
        "content": bot_reply,
    }).execute()

    return {
        "conversation_id": conversation_id,
        "response": bot_reply,
    }


@router.get("/conversations")
async def get_conversations(
    current_user: dict = Depends(oauth2.get_current_user),
):
    """Get all AI chat conversations for the current user."""
    user_id = current_user.get("id") or current_user.get("user_id")
    res = supabase.table("chatbot_conversations").select(
        "id, title, created_at, updated_at"
    ).eq("user_id", user_id).order("updated_at", desc=True).execute()
    return res.data or []


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: str,
    current_user: dict = Depends(oauth2.get_current_user),
):
    """Get all messages in a conversation."""
    user_id = current_user.get("id") or current_user.get("user_id")

    # Verify the conversation belongs to the user
    conv = supabase.table("chatbot_conversations").select("id").eq(
        "id", conversation_id
    ).eq("user_id", user_id).execute()
    if not conv.data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = supabase.table("chatbot_messages").select(
        "id, role, content, created_at"
    ).eq("conversation_id", conversation_id).order("created_at").execute()
    return messages.data or []


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    current_user: dict = Depends(oauth2.get_current_user),
):
    """Delete a conversation and its messages."""
    user_id = current_user.get("id") or current_user.get("user_id")

    conv = supabase.table("chatbot_conversations").select("id").eq(
        "id", conversation_id
    ).eq("user_id", user_id).execute()
    if not conv.data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    supabase.table("chatbot_messages").delete().eq(
        "conversation_id", conversation_id
    ).execute()
    supabase.table("chatbot_conversations").delete().eq(
        "id", conversation_id
    ).execute()
    return {"success": True}
