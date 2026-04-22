from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class AIHelpRequest(BaseModel):
    """Request schema for AI help endpoint"""
    query: str = Field(..., description="The student's query for AI assistance", min_length=1)


class AIHelpResponse(BaseModel):
    """Response schema for AI help endpoint"""
    answer: str = Field(..., description="AI-generated response to the query")


class FeedbackRequest(BaseModel):
    """Request schema for submitting feedback on AI help"""
    query: str = Field(..., description="The original query", min_length=1)
    helpful: bool = Field(..., description="Whether the AI response was helpful")
    timestamp: datetime = Field(..., description="When the feedback was submitted")


class FeedbackResponse(BaseModel):
    """Response schema for feedback submission"""
    message: str = Field(..., description="Success message")
    feedback_id: Optional[int] = Field(None, description="Created feedback ID")


class RaiseTicketRequest(BaseModel):
    """Request schema for raising a support ticket"""
    student_name: str = Field(..., description="Name of the student", min_length=1)
    category: str = Field(..., description="Support category", min_length=1)
    title: str = Field(..., description="Ticket title", min_length=1)
    description: str = Field(..., description="Detailed description", min_length=1)


class TicketResponse(BaseModel):
    """Response schema for ticket operations"""
    id: int = Field(..., description="Ticket ID")
    student_name: str = Field(..., description="Student name")
    category: str = Field(..., description="Support category")
    title: str = Field(..., description="Ticket title")
    status: str = Field(..., description="Ticket status")
    created_at: datetime = Field(..., description="When ticket was created")


class RaiseTicketResponse(BaseModel):
    """Response when ticket is created"""
    message: str = Field(..., description="Success message")
    ticket_id: int = Field(..., description="Created ticket ID")


class TicketsListResponse(BaseModel):
    """Response for listing tickets"""
    tickets: list[TicketResponse] = Field(..., description="List of tickets")
