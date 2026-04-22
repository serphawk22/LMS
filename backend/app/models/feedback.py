from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from sqlalchemy.sql import func
from app.database import Base

class SupportFeedback(Base):
    __tablename__ = "support_feedback"

    id = Column(Integer, primary_key=True, index=True)
    query = Column(Text, nullable=False)
    helpful = Column(Boolean, nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
