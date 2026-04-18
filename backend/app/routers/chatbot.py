from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
import logging

from app import schemas
from app.services import chatbot as chatbot_service
from app.dependencies import get_current_active_user
from app.models import User
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/chat", response_model=schemas.ChatMessageResponse)
def send_chat_message(
    payload: schemas.ChatMessageRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Send a message to the AI chatbot and get a response.
    
    Args:
        payload: ChatMessageRequest containing user message and optional conversation history
        current_user: Authenticated user making the request
    
    Returns:
        ChatMessageResponse with AI response and updated conversation history
    """
    try:
        # Validate message is not empty
        if not payload.message or not payload.message.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Message cannot be empty"
            )
        
        # Get AI response from OpenAI service
        ai_response = chatbot_service.send_message_to_openai(
            message=payload.message,
            conversation_history=payload.conversation_history,
        )
        
        # Check if response is valid
        if not ai_response:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to generate response. Please try again."
            )
        
        # Build updated conversation history
        conversation_history = list(payload.conversation_history or [])
        
        # Add user message to history
        conversation_history.append({
            "role": "user",
            "content": payload.message
        })
        
        # Add AI response to history
        conversation_history.append({
            "role": "assistant",
            "content": ai_response
        })
        
        return {
            "response": ai_response,
            "conversation_history": conversation_history
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in chat endpoint: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate response. Please try again."
        ) from e


@router.get("/health")
def health_check():
    """
    Check if chatbot service is available.
    
    Returns:
        Dictionary with chatbot availability status
    """
    is_available = chatbot_service.is_openai_available()
    return {
        "chatbot_available": is_available,
        "message": "AI chatbot is ready" if is_available else "AI assistant is not configured."
    }


@router.get("/debug/status")
def debug_status():
    """
    Debug endpoint to check chatbot configuration status.
    Use this to troubleshoot configuration issues.
    """
    has_api_key = bool(settings.openai_api_key)
    is_available = chatbot_service.is_openai_available()
    
    return {
        "openai_library_available": chatbot_service.OPENAI_AVAILABLE,
        "api_key_configured": has_api_key,
        "chatbot_available": is_available,
        "api_key_first_chars": settings.openai_api_key[:10] if settings.openai_api_key else None,
    }
