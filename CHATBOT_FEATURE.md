# AI Chatbot Feature Documentation

## Overview

The AI Chatbot is an intelligent learning assistant integrated into the LMS platform that helps students ask questions and receive AI-generated responses. It uses OpenAI's GPT-3.5-turbo model to provide context-aware answers about course content and learning concepts.

## Features

✅ **Floating Chat Interface**: A convenient floating chat icon at the bottom-right corner of the screen
✅ **Live Chat Window**: Interactive chatbot window with message history
✅ **Cross-Platform Integration**: Works across all LMS pages (courses, lessons, dashboard)
✅ **Session Persistence**: Maintains chat history during user session
✅ **Loading Indicators**: Visual feedback while waiting for AI response
✅ **Welcome Message**: Friendly greeting message when chatbot opens
✅ **Clear Chat History**: Button to reset conversation
✅ **Error Handling**: Graceful error messages if API fails
✅ **Responsive Design**: Fully responsive on desktop and mobile devices

## Installation & Setup

### Backend Setup

1. **Install Dependencies**:
   ```bash
   cd backend
   # OpenAI library is already in requirements.txt
   pip install -r requirements.txt
   ```

2. **Configure OpenAI API Key**:
   The API key is stored in the `.env` file. It's already configured with the provided key.
   
   If you need to update it:
   ```bash
   # Edit backend/.env
   OPENAI_API_KEY=your-openai-api-key-here
   ```

3. **Verify Configuration**:
   The system will automatically detect the API key on startup. If no key is configured, the chatbot will show a helpful message to users.

### Frontend Setup

The ChatBot component is automatically integrated into the layout. No additional setup is needed.

1. **Ensure Next.js is Running**:
   ```bash
   cd frontend
   npm run dev
   ```

## How It Works

### User Flow

1. **User sees floating chat icon** at bottom-right corner of the screen
2. **User clicks the icon** to open the chat window
3. **Welcome message appears** automatically
4. **User types a message** and clicks "Send" or presses Enter
5. **Message appears on the right** side of the chat
6. **Loading indicator appears** while waiting for AI
7. **AI response appears on the left** side of the chat
8. **User can continue conversation** or clear chat history

### Technical Flow

```
Frontend (Next.js)
    ↓
    └─ User sends message via ChatBot.tsx
    ↓
API Request: POST /api/v1/chatbot/chat
    ↓
Backend (FastAPI)
    ├─ chatbot.py router receives request
    ├─ Calls chatbot.py service
    └─ chatbot.py service
        ├─ Validates API key exists
        ├─ Builds message history with system prompt
        ├─ Sends to OpenAI API
        └─ Returns response
    ↓
API Response with AI response + updated history
    ↓
Frontend
    └─ Displays AI response in chat
```

## API Endpoints

### Send Message to Chatbot

**Endpoint**: `POST /api/v1/chatbot/chat`

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "message": "How do I understand React hooks?",
  "conversation_history": [
    {"role": "assistant", "content": "Hello! I am your AI learning assistant..."},
    {"role": "user", "content": "Hi there"}
  ]
}
```

**Response**:
```json
{
  "response": "React hooks allow you to use state and other React features...",
  "conversation_history": [
    {"role": "assistant", "content": "Hello! I am your AI learning assistant..."},
    {"role": "user", "content": "Hi there"},
    {"role": "user", "content": "How do I understand React hooks?"},
    {"role": "assistant", "content": "React hooks allow you to use state..."}
  ]
}
```

### Check Chatbot Health

**Endpoint**: `GET /api/v1/chatbot/health`

**Response**:
```json
{
  "chatbot_available": true,
  "message": "AI chatbot is ready"
}
```

## Configuration

### System Prompt

The AI is prompted with a specific system message to guide its behavior:

```
"You are a helpful learning assistant for an LMS platform. 
Help students with their courses, answer questions about lessons, 
provide study tips, and assist with learning concepts. 
Be friendly, encouraging, and concise in your responses. 
If asked about something outside of learning and education, politely redirect the conversation."
```

You can modify this in `backend/app/services/chatbot.py` in the `send_message_to_openai()` function.

### Model Parameters

- **Model**: gpt-3.5-turbo (can be changed to gpt-4 in chatbot.py)
- **Temperature**: 0.7 (affects randomness of responses)
- **Max Tokens**: 500 (maximum response length)
- **Top P**: 0.9 (affects diversity of responses)

## Environment Variables

### Required

- `OPENAI_API_KEY`: Your OpenAI API key (starts with `sk-`)

### Optional

The backend will work fine if the API key is not set, but the chatbot will display "not configured" messages to users.

## File Structure

```
backend/
├── app/
│   ├── config.py (OPENAI_API_KEY added)
│   ├── main.py (chatbot router registered)
│   ├── schemas/
│   │   └── chatbot.py (NEW - request/response models)
│   ├── services/
│   │   └── chatbot.py (NEW - OpenAI integration logic)
│   └── routers/
│       └── chatbot.py (NEW - API endpoints)
└── requirements.txt (openai==1.47.1 added)

frontend/
├── app/
│   └── layout.tsx (ChatBot component added)
└── components/
    └── ChatBot.tsx (NEW - chat UI component)
```

## Error Handling

### API Key Not Configured
- Message: "Sorry, the AI assistant is not currently available. Please contact support."

### OpenAI Library Not Installed
- Message: "The AI assistant is not properly configured. Please contact support."

### API Communication Error
- Message: "Sorry, I encountered an error: [error details]. Please try again later."

### Network Timeout
- Message: "The AI assistant is currently unavailable. Please try again later."

## Performance Considerations

- **Response Time**: Typically 1-5 seconds depending on OpenAI API load
- **Token Usage**: Each message uses approximately 50-200 tokens from your OpenAI account
- **Session Persistence**: Chat history is maintained only during the user session
- **Message Limit**: Each conversation turn has a maximum of 500 tokens

## Security

✅ **API Key Protection**: Never exposed to frontend - all API calls go through secure backend
✅ **Authentication Required**: Only authenticated users can access the chatbot
✅ **HTTPS Only**: All communication encrypted in production
✅ **Rate Limiting**: Consider implementing rate limiting for production
✅ **Input Validation**: All user messages are validated before processing

## Troubleshooting

### Chatbot not showing up
1. Check that you're viewing the page with JavaScript enabled
2. Verify the layout.tsx includes the ChatBot component
3. Check browser console for errors

### "AI Assistant is not configured" message
1. Check `.env` file has `OPENAI_API_KEY` set
2. Restart the backend server
3. Check API key starts with `sk-`

### Slow responses
1. Check OpenAI API status (status.openai.com)
2. Reduce `max_tokens` in `chatbot.py` if needed
3. Check your internet connection

### API Key error (401 Unauthorized)
1. Verify API key is correct
2. Check API key hasn't reached usage limits
3. Generate a new API key from OpenAI dashboard

## Future Enhancements

Potential improvements for the chatbot:

1. **Persistent Chat History**: Save conversations to database
2. **Course-Specific Context**: Include course materials in prompts
3. **Multi-Language Support**: Support for different languages
4. **Analytics**: Track questions and answers for insights
5. **Custom Knowledge Base**: Fine-tune with course-specific content
6. **Image Support**: Accept and analyze images
7. **Export Chat**: Allow users to download conversations
8. **Conversation Sharing**: Share specific conversations with instructors

## Testing

To test the chatbot endpoints:

```bash
# Health check
curl http://localhost:8000/api/v1/chatbot/health -H "Authorization: Bearer YOUR_TOKEN"

# Send message (requires valid auth token)
curl -X POST http://localhost:8000/api/v1/chatbot/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is machine learning?", "conversation_history": []}'
```

## Costs

OpenAI API usage is charged based on:
- **Input tokens**: $0.0005 per 1K tokens (gpt-3.5-turbo)
- **Output tokens**: $0.0015 per 1K tokens (gpt-3.5-turbo)

A typical conversation might cost $0.001 per message.

## Support & Limitations

### Limitations
- Responses limited to 500 tokens per message
- No image generation
- No file uploads
- Limited context window (4K tokens for gpt-3.5-turbo)

### Get Help
- OpenAI Documentation: https://platform.openai.com/docs
- LMS Support: Contact your system administrator
- API Status: https://status.openai.com

## Changelog

### Version 1.0 (Current)
- Initial chatbot implementation
- Basic chat interface with floating icon
- OpenAI GPT-3.5-turbo integration
- Session-based conversation history
- Cross-platform LMS integration
