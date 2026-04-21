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


@router.post("/ai-assistant", response_model=schemas.AILearningAssistantResponse)
def ai_learning_assistant(
    payload: schemas.AILearningAssistantRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Send a prompt to the AI learning assistant and get a response.
    
    Args:
        payload: AILearningAssistantRequest containing the prompt
        current_user: Authenticated user making the request
    
    Returns:
        AILearningAssistantResponse with AI response
    """
    try:
        # Validate prompt is not empty
        if not payload.prompt or not payload.prompt.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Prompt cannot be empty"
            )
        
        # Get AI response from OpenAI service
        ai_response = chatbot_service.send_message_to_openai(
            message=payload.prompt,
            conversation_history=None,  # No conversation history for learning assistant
        )
        
        # Check if response is valid
        if not ai_response:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to generate response. Please try again."
            )
        
        return {
            "response": ai_response
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in AI learning assistant endpoint: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate response. Please try again."
        ) from e


@router.post("/ai-chat", response_model=schemas.CourseAIChatResponse)
def course_ai_chat(
    payload: schemas.CourseAIChatRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Send a course-specific question to the AI assistant and get a response.
    
    Args:
        payload: CourseAIChatRequest containing question and course content
        current_user: Authenticated user making the request
    
    Returns:
        CourseAIChatResponse with AI response based on course content
    """
    try:
        # Validate inputs
        if not payload.question or not payload.question.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Question cannot be empty"
            )
        
        if not payload.course_content or not payload.course_content.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Course content cannot be empty"
            )
        
        # Create the prompt with course context
        prompt = f"""You are an AI tutor. Answer only using the given course content.
If answer is not available, say 'Not available in this course.'

Content:
{payload.course_content}

Question:
{payload.question}"""
        
        # Get AI response from OpenAI service
        ai_response = chatbot_service.send_message_to_openai(
            message=prompt,
            conversation_history=None,  # No conversation history for course chat
        )
        
        # Check if response is valid
        if not ai_response:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to generate response. Please try again."
            )
        
        return {
            "response": ai_response
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in course AI chat endpoint: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate response. Please try again."
        ) from e


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


@router.get("/health")
def health_check():
    """
    Simple health check endpoint for the chatbot service.
    Returns 200 if chatbot is available, useful for frontend to check availability.
    """
    is_available = chatbot_service.is_openai_available()
    
    return {
        "status": "healthy" if is_available else "unavailable",
        "available": is_available
    }
