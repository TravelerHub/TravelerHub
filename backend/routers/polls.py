from fastapi import APIRouter, HTTPException, Depends, status
from schemas import PollCreate, PollResponse, VoteCreate, PollOptionResponse
from supabase_client import supabase
from utils import oauth2
import uuid

router = APIRouter(
    prefix="/polls",
    tags=["Polls"]
)

@router.post("/trips/{trip_id}/polls", response_model=PollResponse)
def create_poll(
    trip_id: str,
    poll_data: PollCreate,
    current_user: dict = Depends(oauth2.get_current_user)
):
    """Create a new poll for a trip"""
    try:
        # 1. Verify Trip exists and user is the owner
        trip_res = supabase.table("trips").select("*").eq("id", trip_id).execute()
        
        if not trip_res.data:
            raise HTTPException(status_code=404, detail="Trip not found")
        
        trip = trip_res.data[0]
        if trip["owner_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Only the trip leader can create polls.")

        # 2. Create the Poll
        new_poll = {
            "trip_id": trip_id,
            "title": poll_data.title,
            "description": poll_data.description,
            "created_by": current_user["id"],
            "is_active": True
        }
        
        poll_res = supabase.table("polls").insert(new_poll).execute()
        
        if not poll_res.data:
            raise HTTPException(status_code=500, detail="Failed to create poll")
        
        poll = poll_res.data[0]
        poll_id = poll["id"]

        # 3. Create Options
        options_to_create = []
        for option in poll_data.options:
            options_to_create.append({
                "poll_id": poll_id,
                "text": option.text,
                "description": option.description
            })
        
        if options_to_create:
            supabase.table("poll_options").insert(options_to_create).execute()

        # 4. Fetch complete poll with options
        poll_with_options = supabase.table("polls").select("*, poll_options(*)").eq("id", poll_id).execute()
        
        return poll_with_options.data[0]

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating poll: {e}")
        raise HTTPException(status_code=500, detail="Error creating poll")


@router.post("/vote")
def cast_vote(
    vote_data: VoteCreate,
    current_user: dict = Depends(oauth2.get_current_user)
):
    """Cast or update a vote on a poll option"""
    try:
        # 1. Check if Poll is Active
        poll_res = supabase.table("polls").select("*").eq("id", vote_data.poll_id).execute()
        
        if not poll_res.data or not poll_res.data[0]["is_active"]:
            raise HTTPException(status_code=400, detail="Poll is closed or does not exist.")

        # 2. Check for Existing Vote (Upsert Logic)
        existing_vote = supabase.table("voting").select("*").eq("user_id", current_user["id"]).eq("poll_id", vote_data.poll_id).execute()

        if existing_vote.data:
            # Update existing vote
            supabase.table("voting").update({"option_id": vote_data.option_id}).eq("user_id", current_user["id"]).eq("poll_id", vote_data.poll_id).execute()
        else:
            # Create new vote
            new_vote = {
                "user_id": current_user["id"],
                "poll_id": vote_data.poll_id,
                "option_id": vote_data.option_id
            }
            supabase.table("voting").insert(new_vote).execute()

        return {"message": "Vote cast successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error casting vote: {e}")
        raise HTTPException(status_code=500, detail="Error casting vote")


@router.get("/{poll_id}", response_model=PollResponse)
def get_poll_results(
    poll_id: str,
    current_user: dict = Depends(oauth2.get_current_user)
):
    """Get poll results and current user's vote"""
    try:
        # Fetch poll with options
        poll_res = supabase.table("polls").select("*, poll_options(*)").eq("id", poll_id).execute()
        
        if not poll_res.data:
            raise HTTPException(status_code=404, detail="Poll not found")

        poll = poll_res.data[0]

        # Get User's vote
        user_vote_res = supabase.table("voting").select("*").eq("user_id", current_user["id"]).eq("poll_id", poll_id).execute()
        user_vote = user_vote_res.data[0] if user_vote_res.data else None

        # Count votes for each option
        response_options = []
        for option in poll.get("poll_options", []):
            vote_count_res = supabase.table("voting").select("*", count="exact").eq("option_id", option["id"]).execute()
            vote_count = vote_count_res.count if hasattr(vote_count_res, 'count') else len(vote_count_res.data or [])
            
            response_options.append({
                "id": option["id"],
                "text": option["text"],
                "vote_count": vote_count
            })

        return {
            "id": poll["id"],
            "title": poll["title"],
            "is_active": poll["is_active"],
            "options": response_options,
            "user_vote_id": user_vote["option_id"] if user_vote else None
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching poll results: {e}")
        raise HTTPException(status_code=500, detail="Error fetching poll results")