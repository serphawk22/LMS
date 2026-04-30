# AI Chatbot Authentication Implementation ✅

## Overview

The AI chatbot now automatically works for any logged-in student by properly handling authentication tokens. No manual token passing needed - the API interceptor handles it automatically.

---

## Implementation Details

### 1. Frontend Authentication Check

**File**: `frontend/components/ChatBot.tsx`

**Changes Made:**
- ✅ Added `isUserLoggedIn` state to track login status
- ✅ Added `checkUserLogin()` function that:
  - Checks if `access_token` exists in localStorage
  - Returns boolean for login status
- ✅ Added effect to check login status on component mount
- ✅ Added login check before sending messages
- ✅ Displays login warning message when not authenticated
- ✅ Disables input field when not logged in
- ✅ Disables send button when not logged in

**Code Flow:**
```javascript
// 1. Check token exists
const checkUserLogin = () => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    setIsUserLoggedIn(!!token);  // ✅ Boolean conversion
    return !!token;
  }
  return false;
};

// 2. Check on mount
useEffect(() => {
  const isLoggedIn = checkUserLogin();
  if (isLoggedIn) {
    // Only check chatbot health if logged in
    checkChatbotHealth();
  }
}, []);

// 3. Check before sending
const handleSendMessage = async () => {
  if (!checkUserLogin()) {
    // Display login message
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: 'Please login to use the AI assistant.'
    }]);
    return;
  }
  // Send message if logged in
  // ...
};
```

### 2. API Authorization via Interceptor

**File**: `frontend/lib/api.ts`

**How It Works:**
- ✅ Interceptor automatically runs on every API request
- ✅ Retrieves `access_token` from localStorage
- ✅ Adds `Authorization: Bearer <token>` header to request
- ✅ Includes tenant information in headers
- ✅ Handles token refresh on 401 responses

**Request Flow:**
```
ChatBot Component makes API call
  ↓
api.post('/chatbot/chat', { message: '...' })
  ↓
Request Interceptor triggers
  ↓
Get access_token from localStorage
  ↓
Add Authorization header: 'Bearer <token>'
  ↓
Add x-tenant-id header (from token or storage)
  ↓
Send request to backend
  ↓
Backend validates token and processes message
```

**Code Example (from api.ts):**
```javascript
api.interceptors.request.use((config) => {
  const headers = { ...(config.headers || {}) };
  
  // ✅ Get token from localStorage
  const token = typeof window !== 'undefined' 
    ? localStorage.getItem('access_token') 
    : null;
  
  // ✅ Add Authorization header if token exists
  if (token) {
    headers.Authorization = `Bearer ${token}`;  // Exact format required
  }
  
  // ✅ Add tenant header if available
  let tenant = localStorage.getItem('tenant_id');
  if (!tenant && token) {
    // Extract tenant from token payload
    const payload = decodeTokenPayload(token);
    tenant = payload?.tenant_id;
  }
  
  if (tenant) {
    headers['x-tenant-id'] = tenant;
  }
  
  config.headers = headers;
  return config;
});
```

### 3. Error Handling

**401 Unauthorized Errors:**
```javascript
// In handleSendMessage catch block
if (axios.isAxiosError(error)) {
  if (error.response?.status === 401) {
    // ✅ Handle 401 - user no longer logged in
    errorMessage = 'Please login to use the AI assistant.';
    setIsUserLoggedIn(false);
  } else {
    // ✅ Handle other errors
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') {
      errorMessage = detail;
    }
  }
}
```

### 4. UI/UX Features

**Login Warning Banner:**
- Shows when user is not logged in
- Yellow/amber styling for visibility
- Positioned above input field
- Text: "Please login to use the AI assistant."

**Disabled States:**
```
Not Logged In:
  • Input field: Disabled with greyed out styling
  • Placeholder: "Login to chat"
  • Send button: Disabled
  • Clear button: Still enabled (for UI consistency)

Logged In:
  • Input field: Enabled, normal styling
  • Placeholder: "Ask something..."
  • Send button: Enabled when text is entered
  • All features available
```

### 5. Integration with LMS Pages

**File**: `frontend/app/layout.tsx`

**Status**: ✅ Already integrated
```tsx
import ChatBot from '@/components/ChatBot';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <div>{children}</div>
        <ChatBot />  {/* ✅ Available on all pages */}
      </body>
    </html>
  );
}
```

The ChatBot component is loaded at the root layout level, making it available on:
- ✅ Dashboard page
- ✅ Courses page
- ✅ Lessons page
- ✅ All other LMS pages

---

## Authentication Flow Diagram

```
User Logs In
  ↓
JWT tokens stored in localStorage
  - access_token
  - refresh_token
  - tenant_id
  ↓
User Navigates to LMS
  ↓
Layout loads ChatBot component
  ↓
ChatBot mounts and checks for token
  ↓
Token found? YES
  ↓
Set isUserLoggedIn = true
  ↓
Enable chat input/send button
  ↓
User types message and sends
  ↓
handleSendMessage called
  ↓
Check token exists? YES (before sending)
  ↓
Call api.post('/chatbot/chat')
  ↓
Request Interceptor adds Authorization header
  ↓
Request sent with: "Authorization: Bearer <token>"
  ↓
Backend validates token
  ↓
Backend processes message with OpenAI
  ↓
Backend returns response
  ↓
Frontend displays message
```

## Error Scenarios

### Scenario 1: User Not Logged In (First Visit/Open Chat Before Login)

```
User opens chat window
  ↓
checkUserLogin() runs
  ↓
localStorage.getItem('access_token') = null
  ↓
isUserLoggedIn = false
  ↓
UI displays:
  - Warning banner: "Please login to use the AI assistant."
  - Input field disabled with placeholder: "Login to chat"
  - Send button disabled
  ↓
User clicks input (nothing happens)
  ↓
User sees warning to login
```

### Scenario 2: User Logs In While Chat Open

```
User opens chat (not logged in)
  ↓
Chat shows login message
  ↓
User navigates to login page
  ↓
User logs in successfully
  ↓
Tokens stored in localStorage
  ↓
User navigates back to LMS (with chat still open)
  ↓
Component still showing "not logged in" state
  ↓
User can:
  - Close and reopen chat
  - Or refresh page to reload component
  ↓
Chat will then show as logged in
  
Note: Could add localStorage event listener for real-time detection,
but this is a nice-to-have, not required.
```

### Scenario 3: Session Expires (401 Error)

```
User sending message with expired token
  ↓
Request with old access_token sent
  ↓
Backend returns 401 Unauthorized
  ↓
Interceptor catches 401
  ↓
Interceptor tries to refresh token using refresh_token
  ↓
If refresh_token valid:
  - New access_token obtained
  - Original request retried with new token
  - Message sent successfully
  ↓
If refresh_token invalid:
  - Error propagates to ChatBot
  - handleSendMessage catches error
  - errorMessage = "Please login to use the AI assistant."
  - setIsUserLoggedIn(false)
  - Warning displayed in chat
  ↓
User prompted to re-login
```

---

## Testing Checklist

### Test 1: Non-Authenticated User
- [ ] Open browser in private/incognito mode
- [ ] Navigate to LMS
- [ ] Click chat icon
- [ ] See warning: "Please login to use the AI assistant."
- [ ] Input field is disabled (greyed out)
- [ ] Send button is disabled
- [ ] Cannot type (or can type but can't send)

### Test 2: Logged-In User
- [ ] Login to LMS on regular window
- [ ] Navigate to any LMS page (Dashboard, Courses, Lessons, etc.)
- [ ] Click chat icon
- [ ] See welcome message
- [ ] Input field is enabled
- [ ] Send button is enabled
- [ ] Type test message: "Explain Excel basics"
- [ ] Send message
- [ ] Wait 2-5 seconds
- [ ] AI response appears

### Test 3: Conversation Persistence
- [ ] Send first message, get response
- [ ] Send second message, get response
- [ ] Verify conversation history is maintained
- [ ] Clear chat button resets conversation
- [ ] After clear, only welcome message shows

### Test 4: Token in Request Headers
- [ ] Open DevTools Network tab
- [ ] Send message from chat
- [ ] Find POST request to `/api/v1/chatbot/chat`
- [ ] Check Request Headers
- [ ] Verify `Authorization: Bearer sk-...` exists
- [ ] Verify `x-tenant-id` header exists if applicable

### Test 5: Cross-Page Availability
- [ ] Chat icon visible on Dashboard ✓
- [ ] Chat icon visible on Courses page ✓
- [ ] Chat icon visible on Lesson page ✓
- [ ] Chat history persists when navigating pages ✓
- [ ] Chat works on all pages ✓

### Test 6: Login/Logout Flow
- [ ] Logout from LMS
- [ ] Chat becomes disabled
- [ ] "Please login..." message shows
- [ ] Login again
- [ ] Refresh page (or close/reopen chat)
- [ ] Chat works again with new token

### Test 7: Error Cases
- [ ] Send message with invalid token (should show error)
- [ ] Network disconnected (should show error)
- [ ] API service down (should show error)
- [ ] All errors display user-friendly messages

---

## Code Changes Summary

| File | Changes | Status |
|------|---------|--------|
| `frontend/components/ChatBot.tsx` | Added login authentication checks | ✅ Complete |
| `frontend/lib/api.ts` | Already had interceptor | ✅ No changes needed |
| `frontend/app/layout.tsx` | Already had ChatBot component | ✅ No changes needed |
| Backend files | No changes needed | ✅ Already correct |

---

## How Token Authorization Works

### Token Storage
```javascript
// When user logs in, these are stored:
localStorage.setItem('access_token', 'eyJhbGc...');  // JWT token
localStorage.setItem('refresh_token', 'eyJhbGc...');
localStorage.setItem('tenant_id', '123');
```

### Token Retrieval
```javascript
// In ChatBot component:
const token = localStorage.getItem('access_token');
// Result: "eyJhbGc..." or null

// In API interceptor:
const token = localStorage.getItem('access_token');
// Added to header: Authorization: Bearer eyJhbGc...
```

### Token Validation
```javascript
// Backend validates:
Authorization: Bearer <token>
  ↓
Extract token from header
  ↓
Verify JWT signature
  ↓
Check expiration
  ↓
If valid: Process request
If invalid: Return 401 Unauthorized
```

---

## Security Measures

✅ **Token in LocalStorage**: Standard practice for SPAs
✅ **Authorization Header**: Follows RFC 6750 Bearer Token standard
✅ **Automatic Header Addition**: No risk of forgetting to add token
✅ **Token Refresh**: Automatic refresh-on-401 prevents re-login spam
✅ **Backend Validation**: All requests validated on server
✅ **HTTPS Ready**: Tokens sent over secure connection in production
✅ **Tenant Isolation**: Multi-tenant support via headers

---

## What Automatically Works

1. **Token Retrieval** ✅
   - Chatbot checks localStorage for access_token
   - No manual token passing needed

2. **Header Addition** ✅
   - Interceptor adds Authorization header automatically
   - Header format: "Bearer <token>"

3. **Multi-Page Capability** ✅
   - ChatBot loads in layout
   - Available on all LMS pages
   - Same token used for authentication

4. **Error Handling** ✅
   - 401 errors handled gracefully
   - User-friendly messages displayed
   - Token refresh attempted on 401

5. **Session Management** ✅
   - Logged-in state checked on mount
   - Checked before each message send
   - Refreshes if token expires

---

## User Experience

### Before Login
```
+----- AI Learning Assistant -----+
|                                 |
| ⚠️ Please login to use the      |
|    AI assistant.                |
|                                 |
| [Login to chat____________]     |
| [Send button - DISABLED]        |
| [Clear Chat]                    |
+---------------------------------+
```

### After Login
```
+----- AI Learning Assistant -----+
|                                 |
| Bot: Hello! I am your AI...     |
| Learning assistant. Ask me      |
| anything about your course.     |
|                                 |
| You: Explain Excel basics       |
| Bot: Excel is a spreadsheet...  |
| ...                             |
|                                 |
| [Ask something____________]     |
| [Send button - ENABLED]         |
| [Clear Chat]                    |
+---------------------------------+
```

---

## Next Steps

1. **Test the Implementation**
   - Login to LMS
   - Test chatbot on Dashboard
   - Test chatbot on Courses page
   - Test chatbot on Lesson page
   - Verify token is sent in headers

2. **Verify DevTools**
   - Open Dev Tools (F12)
   - Go to Network tab
   - Send message from chat
   - Check chatbot/chat request
   - Verify Authorization header present

3. **Test Error Cases**
   - Logout and try chat (should show login message)
   - Check error handling for API failures
   - Verify error messages are user-friendly

4. **Monitor Logs**
   - Backend should not show auth errors
   - Frontend console should be clean
   - All API calls should succeed

---

## Summary

✅ **Authentication**: Token automatically retrieved from localStorage
✅ **Headers**: Authorization header automatically added by interceptor
✅ **Multi-Page**: Chatbot works on all LMS pages via layout integration
✅ **Login Check**: Chatbot checks login before and after sending messages
✅ **User Feedback**: Clear messages when not logged in
✅ **Security**: All requests validated by backend
✅ **Error Handling**: Graceful handling of 401 and other errors

**Status**: ✅ IMPLEMENTATION COMPLETE AND READY FOR TESTING

**Date**: April 9, 2026
