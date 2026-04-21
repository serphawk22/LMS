from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class AIHelpRequest(BaseModel):
    """Request schema for AI help endpoint"""
    query: str = Field(..., description="The student's query for AI assistance", min_length=1)


class AIHelpResponse(BaseModel):
    """Response schema for AI help endpoint"""
    answer: str = Field(..., description="AI-generated response to the query")


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
