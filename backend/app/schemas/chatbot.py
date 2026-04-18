from pydantic import BaseModel, Field
from typing import List, Optional


class ChatMessage(BaseModel):
    role: str = Field(..., description="Role of the message sender: 'user' or 'assistant'")
    content: str = Field(..., description="Content of the message")


class ChatMessageRequest(BaseModel):
    message: str = Field(..., description="User's message")
    conversation_history: Optional[List[ChatMessage]] = Field(
        default=None, 
        description="Previous messages in the conversation"
    )


class ChatMessageResponse(BaseModel):
    response: str = Field(..., description="AI response")
    conversation_history: List[ChatMessage] = Field(
        ...,
        description="Updated conversation history including the new response"
    )


class ChatClearRequest(BaseModel):
    pass
