import logging
from typing import Any, List, Optional

logger = logging.getLogger(__name__)

# Import at module level to catch import errors early
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    logger.error("OpenAI library not installed. Install with: pip install openai")

from app.config import settings


def is_openai_available() -> bool:
    """Check if OpenAI API key is configured and library is available."""
    if not OPENAI_AVAILABLE:
        logger.warning("OpenAI library not available")
        return False
    
    if not settings.openai_api_key:
        logger.warning("OpenAI API key not configured in environment")
        return False
    
    return True


def send_message_to_openai(
    message: str,
    conversation_history: Optional[List[dict[str, str]]] = None,
) -> Optional[str]:
    """
    Send a message to OpenAI API and get a response.
    
    Args:
        message: User's message
        conversation_history: List of previous messages in format [{"role": "user"/"assistant", "content": "..."}]
    
    Returns:
        AI response string or error message if request fails
    """
    # Check if OpenAI is available
    if not OPENAI_AVAILABLE:
        error_msg = "AI assistant is not configured."
        logger.error(error_msg)
        return error_msg
    
    if not settings.openai_api_key:
        error_msg = "AI assistant is not configured."
        logger.error("OpenAI API key is not set in environment variables")
        return error_msg
    
    try:
        # Initialize OpenAI client
        client = OpenAI(api_key=settings.openai_api_key)
        
        # Build message history for API call
        messages = []
        
        # Add system prompt
        messages.append({
            "role": "system",
            "content": "You are a helpful learning assistant for an LMS platform. "
                      "Help students with their courses, answer questions about lessons, "
                      "provide study tips, and assist with learning concepts. "
                      "Be friendly, encouraging, and concise in your responses. "
                      "If asked about something outside of learning and education, politely redirect the conversation."
        })
        
        # Add conversation history if provided
        if conversation_history:
            messages.extend(conversation_history)
        
        # Add current message
        messages.append({
            "role": "user",
            "content": message
        })
        
        # Call OpenAI API
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages,
            temperature=0.7,
            max_tokens=500,
            top_p=0.9,
        )
        
        # Extract and return response
        ai_response = response.choices[0].message.content
        logger.info(f"Successfully received response from OpenAI for message: {message[:50]}...")
        return ai_response
        
    except Exception as e:
        error_msg = f"Unable to generate response. Please try again."
        logger.error(f"Error communicating with OpenAI API: {str(e)}", exc_info=True)
        return error_msg
