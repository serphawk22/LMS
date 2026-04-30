# Video Lesson System Implementation Guide

## Overview
A complete video lesson system has been implemented for the LMS, enabling instructors to create courses, add Vimeo video lessons, and students to view and play videos within the course.

## Architecture Overview

```
Instructor Course Creation Flow:
1. Instructor creates course (name, description, etc.)
2. Instructor visits `/instructor/courses/{course_id}/lessons`
3. Instructor adds lessons with Vimeo links
4. Lessons saved with course_id, title, description, vimeo_id

Student Video Playback Flow:
1. Student browses `/courses` to discover courses
2. Student enrolls in course
3. Student visits `/courses/{course_id}` to view course
4. Student sees list of lessons organized by modules
5. Student clicks lesson to open `/courses/{course_id}/lessons/{lesson_id}`
6. Student views and plays Vimeo video embedded in the course
```

## Database Schema

### Course Model
```python
class Course(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    id: Integer (primary key)
    title: String (required)
    description: Text
    slug: String (unique per organization)
    category_id: Foreign Key to CourseCategory
    is_published: Boolean
    # ... other fields
```

### Module Model
```python
class Module(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    id: Integer (primary key)
    course_id: Foreign Key to Course
    title: String
    description: Text
    position: Integer (for ordering)
```

### Lesson Model
```python
class Lesson(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    id: Integer (primary key)
    course_id: Foreign Key to Course
    module_id: Foreign Key to Module
    title: String
    content: Text (description)
    lesson_type: String (content_type: 'vimeo_embed', 'video_upload', 'text', etc.)
    duration_minutes: Integer
    position: Integer (for ordering within module)
    resource_payload: JSONB (stores content_payload)
    is_locked: Boolean
    # For Vimeo:
    # lesson_type = 'vimeo_embed'
    # resource_payload = { 'vimeo_id': '123456789' }
```

### Enrollment Model
```python
class Enrollment(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    id: Integer (primary key)
    user_id: Foreign Key to User
    course_id: Foreign Key to Course
    status: Enum (pending, active, completed, cancelled)
    progress: Float (0.0 - 100.0)
    enrolled_at: DateTime
    completed_at: DateTime (nullable)
```

### Lesson Completion Model
```python
class LessonCompletion(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    id: Integer (primary key)
    user_id: Foreign Key to User
    course_id: Foreign Key to Course
    lesson_id: Foreign Key to Lesson
    is_completed: Boolean
    completed_at: DateTime (nullable)
```

## API Endpoints

### Course Management
- **GET** `/courses/` - List all courses (with filters)
- **GET** `/courses/{course_id}` - Get course details
- **POST** `/courses/` - Create course (Instructor only)
- **PUT** `/courses/{course_id}` - Update course (Instructor only)
- **DELETE** `/courses/{course_id}` - Delete course (Instructor only)

### Module Management
- **POST** `/courses/modules` - Create module (Instructor only)
- **PUT** `/courses/modules/{module_id}` - Update module (Instructor only)
- **DELETE** `/courses/modules/{module_id}` - Delete module (Instructor only)

### Lesson Management
- **GET** `/courses/{course_id}/lessons` - **NEW** List all lessons for a course
- **POST** `/courses/lessons` - Create lesson (Instructor only)
- **GET** `/courses/lessons/{lesson_id}` - Get lesson details
- **PUT** `/courses/lessons/{lesson_id}` - Update lesson (Instructor only)
- **DELETE** `/courses/lessons/{lesson_id}` - Delete lesson (Instructor only)

### Lesson Completion
- **POST** `/courses/lessons/{lesson_id}/complete` - Mark lesson as completed

### Course Structure
- **GET** `/courses/course/{course_id}/structure` - Get complete course structure with modules and lessons

### Enrollment
- **POST** `/courses/{course_id}/enroll` - Enroll in course
- **DELETE** `/courses/{course_id}/unenroll` - Unenroll from course

## Frontend Pages

### Instructor Pages
- `/instructor` - Instructor dashboard
  - View all courses
  - Create new course
  - Edit course
  - Publish/unpublish course
  - Delete course

- `/instructor/courses/{course_id}/lessons` - **Lesson Management Page**
  - Add lessons with Vimeo links
  - Edit lesson title, description, or video link
  - Delete lessons
  - View/play videos in modal

### Student Pages
- `/courses` - Browse and discover courses
- `/courses/{course_id}` - Course overview
  - Course details (title, description, requirements, etc.)
  - Enroll/unenroll button
  - List of lessons organized by modules
  - Quick links to start lessons or take quizzes

- `/courses/{course_id}/lessons/{lesson_id}` - Lesson Player Page
  - **NEW**: Vimeo video embedded with iframe
  - Video player with standard controls
  - Lesson details and description
  - Navigation to next/previous lessons
  - Sidebar with module/lesson navigation
  - Bookmark lesson
  - Progress tracking
  - Lesson completion tracking

## Video Handling

### Vimeo Videos (Recommended for Instructors)

**How to Add Vimeo Videos:**
1. Instructor logs in and goes to `/instructor/courses/{course_id}/lessons`
2. Fills in:
   - Lesson Name (required)
   - Description (optional)
   - Vimeo URL (required) - e.g., `https://player.vimeo.com/video/123456789`
3. Clicks "Add Lesson"
4. Video is stored with:
   ```json
   {
     "content_type": "vimeo_embed",
     "content_payload": {
       "vimeo_id": "123456789"
     }
   }
   ```

**How Students View Vimeo Videos:**
1. Student opens lesson page
2. CoursePlayer component detects `content_type === 'vimeo_embed'`
3. Vimeo player is embedded as iframe:
   ```html
   <iframe
     src="https://player.vimeo.com/video/{vimeo_id}"
     width="100%"
     height="100%"
     allow="autoplay; fullscreen; picture-in-picture"
     allowFullScreen
   />
   ```
4. Student uses native Vimeo player controls (play, pause, speed, quality, fullscreen, etc.)

### Other Video Types Supported

**HTML5 Video Upload:**
- `content_type: 'video_upload'`
- `content_payload: { 'file_url': 'https://...' }`
- Displayed using HTML5 `<video>` tag
- Supports: Speed control, resume position, subtitles

**External Links:**
- `content_type: 'external_link'`
- `content_payload: { 'url': 'https://...' }`

**YouTube Videos:**
- `content_type: 'youtube_embed'`
- `content_payload: { 'youtube_id': 'xyz123' }`

## Access Control

### Enrollment Required
- Only enrolled students can:
  - View course lessons
  - Play videos
  - Mark lessons complete
  - Take quizzes
  
- Instructors and admins can always access courses they own/manage

### Implementation
```python
# Check enrollment before allowing access
is_instructor = user.role in {"instructor", "organization_admin", "super_admin", "admin"}
if not is_instructor:
    enrollment = get_user_enrollment(user_id, course_id, org_id)
    if not enrollment:
        raise HTTPException(status=403, detail="Not enrolled")
```

## Workflow Example

### Instructor Workflow
```
1. Instructor logs in → /instructor
2. Creates course → "Machine Learning 101"
3. After course creation, redirected to → /instructor/courses/42/lessons
4. Adds lesson:
   - Title: "Introduction to ML"
   - Description: "Learn ML basics"
   - Vimeo Link: https://player.vimeo.com/video/987654321
5. Clicks "Add Lesson"
6. Lesson is saved in database with:
   - course_id: 42
   - title: "Introduction to ML"
   - content: "Learn ML basics"
   - lesson_type: "vimeo_embed"
   - resource_payload: { "vimeo_id": "987654321" }
```

### Student Workflow
```
1. Student logs in → /courses
2. Browses courses → clicks "Machine Learning 101"
3. Redirected to → /courses/42
4. Clicks "Enroll" button
5. Enrollment created in database:
   - user_id: 10
   - course_id: 42
   - status: "active"
   - progress: 0.0
6. Clicks "Start lessons" or "Introduction to ML" from list
7. Redirected to → /courses/42/lessons/100
8. CoursePlayer component:
   - Detects vimeo_embed content_type
   - Renders Vimeo iframe player
   - Displays video URL: https://player.vimeo.com/video/987654321
9. Student watches video with full Vimeo player controls
10. Clicks bookmark, takes notes (stored in localStorage)
11. Clicks "Mark as complete"
12. LessonCompletion record created in database
```

## Frontend Components

### CoursePlayer Component
- **Location**: `frontend/components/CoursePlayer.tsx`
- **Purpose**: Render video player (Vimeo iframe or HTML5 video)
- **Features**:
  - Detects video type (Vimeo vs HTML5)
  - Renders appropriate player (iframe vs <video> tag)
  - Shows Vimeo player with all native controls for Vimeo videos
  - Shows custom controls (speed, resume, subtitles) for HTML5 videos
  - Tracks progress percentage
  - Bookmark functionality
  - Note-taking (localStorage)
  - Lesson details and description
  - Navigation to next/previous lessons

### CourseNavigation Component
- **Location**: `frontend/components/CourseNavigation.tsx`
- **Purpose**: Show course modules and lessons sidebar
- **Features**:
  - List all modules
  - List all lessons within each module
  - Highlight current lesson
  - Quick navigation to any lesson

## Services

### Instructor Service
- `fetchCourseStructure(courseId)` - Get course with modules and lessons
- `createLesson(payload)` - Create lesson (used for adding videos)
- `updateLesson(lessonId, payload)` - Update lesson
- `deleteLesson(lessonId)` - Delete lesson
- `uploadFile(file)` - Upload video file (for HTML5 videos)

### Course Service
- `fetchCourse(courseId)` - Get course details
- `fetchLesson(lessonId)` - Get lesson details
- `enrollInCourse(courseId)` - Enroll student
- `unenrollFromCourse(courseId)` - Unenroll student
- `getEnrollment(courseId)` - Get enrollment status

## Testing the System

### Test Instructor Adding Vimeo Lesson
```bash
1. Navigate to http://localhost:3000/instructor
2. Click "New Course"
3. Fill in course details (title, description, etc.)
4. Click "Create Course"
5. You'll be redirected to /instructor/courses/{id}/lessons
6. Add lesson:
   - Title: "Test Lesson"
   - Description: "Test video lesson"
   - Vimeo URL: https://player.vimeo.com/video/76979871 (sample Vimeo ID)
7. Click "Add Lesson"
8. Lesson should appear in the list
```

### Test Student Viewing Lesson
```bash
1. Navigate to http://localhost:3000/courses
2. Find the course you created
3. Click to view course details
4. Click "Enroll"
5. Click "Start lessons"
6. Video player should appear with Vimeo iframe
7. Use Vimeo player controls to play/pause/adjust quality/fullscreen
8. Click next/prev to navigate lessons
```

## Recent Changes

### 1. CoursePlayer Component Enhancement
**File**: `frontend/components/CoursePlayer.tsx`
- Added Vimeo embed detection (`content_type === 'vimeo_embed'`)
- Added conditional rendering between iframe (Vimeo) and <video> tag (HTML5)
- Hides speed/resume/subtitle controls for Vimeo (uses native player controls)
- Shows helpful text: "Vimeo player controls available in the video above"

### 2. New API Endpoint
**File**: `backend/app/routers/courses.py`
- **Endpoint**: `GET /courses/{course_id}/lessons`
- **Purpose**: List all lessons for a specific course
- **Access Control**: Requires enrollment or instructor role
- **Returns**: List of lessons ordered by module and lesson position

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    LMS Video System                         │
└─────────────────────────────────────────────────────────────┘

INSTRUCTOR SIDE:
┌─────────────────────┐
│  Instructor Panel   │
│  /instructor        │
└──────────┬──────────┘
           │
           ├─→ Create Course
           │     ↓ (saved in DB)
           │   Course {id, title, description}
           │
           ├─→ Add Lessons Page
           │     /instructor/courses/{id}/lessons
           │     ↓
           │   Paste Vimeo URL
           │     ↓ (saved in DB)
           │   Lesson {
           │     course_id: 42,
           │     title: "...",
           │     content: "...",
           │     lesson_type: "vimeo_embed",
           │     resource_payload: { vimeo_id: "123" }
           │   }

STUDENT SIDE:
┌──────────────────────────────┐
│   Student Browse Courses     │
│   /courses                   │
└──────────────┬───────────────┘
               │
               ├─→ View Course Details
               │     /courses/{id}
               │     ├─→ Enroll Button
               │     │     ↓ (saved in DB)
               │     │   Enrollment {user_id, course_id}
               │     │
               │     └─→ Show Lessons List
               │           (from modules)
               │
               └─→ Click Lesson
                     ↓
                   /courses/{courseId}/lessons/{lessonId}
                     ↓
                   CoursePlayer Component
                     ├─→ Detects: content_type === "vimeo_embed"
                     ├─→ Renders: <iframe src="https://player.vimeo.com/video/123" />
                     └─→ Student: Plays video with Vimeo controls
```

## Future Enhancements

1. **Video Quality Selection**: Auto-detect best quality for student's connection
2. **Transcript Support**: Add automatic transcripts from Vimeo
3. **Interactive Markers**: Add chapter markers in Vimeo player
4. **View Analytics**: Track which students watched which parts of videos
5. **Adaptive Streaming**: Support more video platforms (YouTube Live, etc.)
6. **Offline Download**: Allow students to download lessons for offline viewing
7. **Video Commenting**: Add timestamped comments on sections of videos
8. **Peer Learning**: Share video timestamps with other students

## Error Handling

### Common Issues & Solutions

**Issue: Vimeo video doesn't play**
- Solution: Verify the Vimeo URL is correct and video is public/shared
- Check: `https://player.vimeo.com/video/123456789` format

**Issue: Students can't see lessons**
- Solution: Verify enrollment is active
- Check: `Enrollment.status = 'active'`

**Issue: Lesson list is empty**
- Solution: Verify lessons are created with module_id
- Check: `Lesson.module_id` is not null

**Issue: Video player shows "No video source available"**
- Solution: Verify `content_payload` has correct `vimeo_id` or `file_url`
- Check: Database content_payload structure

## Conclusion

The video lesson system is fully implemented and ready for use. Instructors can create courses and add Vimeo video lessons, and students can enroll and watch videos directly within the LMS platform with full access control and progress tracking.
