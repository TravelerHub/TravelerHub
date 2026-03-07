# models.py
from unittest.mock import Base
from sqlalchemy import Column, UUID, relationship, String, UniqueConstraint, Integer, ForeignKey

class User(Base):
    __tablename__ = "users"  # MATCHES EXISTING TABLE NAME
    __table_args__ = {'extend_existing': True} # Important when table already exists

    # Ensure this matches your DB exactly. 
    # If Supabase uses UUIDs for users, this must be UUID.
    id = Column(UUID(as_uuid=True), primary_key=True) 
    
    # Add other columns that ALREADY EXIST in your DB
    email = Column(String, nullable=True) 
    username = Column(String, nullable=True)

    # Relationships
    votes = relationship("Vote", back_populates="user")

    # models.py
class Vote(Base):
    __tablename__ = "voting" # MATCHES EXISTING TABLE NAME
    __table_args__ = (
        # Keep your unique constraint if you have one
        UniqueConstraint('user_id', 'poll_id', name='_user_poll_vote_uc'),
        {'extend_existing': True} 
    )

    # ✅ KEEP AS INTEGER (Matches your existing BigInt column)
    id = Column(Integer, primary_key=True, index=True)
    
    # ⚠️ MUST BE UUID (Matches the 'users.id' column)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    poll_id = Column(Integer, ForeignKey("polls.id"))
    option_id = Column(Integer, ForeignKey("poll_options.id"))