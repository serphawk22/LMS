from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Ticket
from app import schemas
from openai import OpenAI
import os
import asyncio
import time
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    logger.warning("OpenAI API key not found")
    client = None
else:
    client = OpenAI(api_key=api_key)

@router.post("/ai-help", response_model=schemas.AIHelpResponse)
async def ai_help(payload: schemas.AIHelpRequest):
    """
    Get AI assistance for a student query.
    
    Args:
        payload: AIHelpRequest containing the student's query
    
    Returns:
        AIHelpResponse with AI-generated answer
    """
    start_time = time.time()
    query = payload.query
    logger.info(f"AI Help request started at {start_time} for query: {query}")
    try:
        if not api_key or not client:
            logger.error("OpenAI API key not configured")
            raise HTTPException(
                status_code=500,
                detail="AI assistant is not configured. Please try again or raise a ticket."
            )
        
        # Call OpenAI API with timeout
        response = await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {
                            "role": "system",
                            "content": "You are an LMS support assistant. Help the student solve this issue clearly and simply. Respond in max 3-4 lines."
                        },
                        {
                            "role": "user",
                            "content": query
                        }
                    ],
                    max_tokens=100,
                    temperature=0.7,
                )
            ),
            timeout=10.0
        )
        
        answer = response.choices[0].message.content
        end_time = time.time()
        logger.info(f"AI Help response received at {end_time}, duration: {end_time - start_time} seconds")
        return {"answer": answer}
        
    except asyncio.TimeoutError:
        logger.warning(f"AI Help timeout for query: {query}")
        return {"answer": "Taking longer than expected. Please try again or raise a ticket."}
    except Exception as e:
        logger.error(f"AI Help error: {str(e)}", exc_info=True)
        return {"answer": "AI is currently unavailable. Please try again or raise a ticket."}

@router.post("/raise-ticket", response_model=schemas.RaiseTicketResponse)
async def raise_ticket(
    student_name: str,
    category: str,
    title: str,
    description: str,
    db: Session = Depends(get_db),
    file: UploadFile = File(None)
):
    """
    Raise a support ticket.
    
    Args:
        student_name: Name of the student
        category: Support category
        title: Ticket title
        description: Detailed description
        db: Database session
        file: Optional file attachment
    
    Returns:
        RaiseTicketResponse with ticket ID
    """
    try:
        # Validate inputs
        if not student_name or not student_name.strip():
            raise HTTPException(
                status_code=400,
                detail="Student name is required"
            )
        if not category or not category.strip():
            raise HTTPException(
                status_code=400,
                detail="Category is required"
            )
        if not title or not title.strip():
            raise HTTPException(
                status_code=400,
                detail="Title is required"
            )
        if not description or not description.strip():
            raise HTTPException(
                status_code=400,
                detail="Description is required"
            )
        
        ticket = Ticket(
            student_name=student_name,
            category=category,
            title=title,
            description=description,
            status="Pending"
        )
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        logger.info(f"Ticket created with ID: {ticket.id}")
        return {
            "message": "Your ticket has been raised successfully",
            "ticket_id": ticket.id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating ticket: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Error creating ticket. Please try again."
        )

@router.get("/tickets", response_model=schemas.TicketsListResponse)
async def get_tickets(db: Session = Depends(get_db)):
    """
    Get all support tickets.
    
    Args:
        db: Database session
    
    Returns:
        TicketsListResponse with list of all tickets
    """
    try:
        tickets = db.query(Ticket).all()
        return {
            "tickets": [
                {
                    "id": t.id,
                    "student_name": t.student_name,
                    "category": t.category,
                    "title": t.title,
                    "status": t.status,
                    "created_at": t.created_at
                } for t in tickets
            ]
        }
    except Exception as e:
        logger.error(f"Error fetching tickets: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Error fetching tickets. Please try again."
        )