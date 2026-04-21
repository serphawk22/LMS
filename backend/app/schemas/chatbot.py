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


class AILearningAssistantRequest(BaseModel):
    prompt: str = Field(..., description="The prompt to send to the AI assistant")


class AILearningAssistantResponse(BaseModel):
    response: str = Field(..., description="AI response to the learning assistant prompt")


class CourseAIChatRequest(BaseModel):
    question: str = Field(..., description="User's question about the course")
    course_content: str = Field(..., description="The course content to base answers on")
    course_title: str = Field(default="", description="The course title for context")


class CourseAIChatResponse(BaseModel):
    response: str = Field(..., description="AI response to the course question")
