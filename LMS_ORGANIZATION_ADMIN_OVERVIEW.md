# LMS Organization Admin Structure - Comprehensive Overview

## 1. Directory Structure & Page Layout

### Organization Admin Pages
```
frontend/app/organization_admin/
├── login/
│   └── page.tsx          # Organization admin login
└── register/
    └── page.tsx          # Organization admin registration
```

### Super Admin Pages
```
frontend/app/admin/
├── layout.tsx            # Admin layout wrapper
├── page.tsx              # Admin dashboard/overview
├── login/
│   └── page.tsx          # Super admin login
├── register/
│   └── page.tsx          # Super admin registration
├── students/
│   └── page.tsx          # View students
├── users/                # User management
├── payments/             # Payment management
└── register/
    └── page.tsx
```

### Regular User Pages
```
frontend/app/
├── login/
│   └── page.tsx          # Student/Instructor login
└── register/
    └── page.tsx          # Student/Instructor registration
```

## 2. Authentication & Role Management

### JWT Token Structure
When a user logs in, the access token contains:
```json
{
  "sub": "user-uuid",
  "tenant_id": "organization-uuid",
  "role": "organization_admin" | "super_admin" | "instructor" | "student",
  "session_id": "session-uuid",
  "type": "access"
}
```

### Role Hierarchy & Access Control
- **`organization_admin`**: Manages a single organization/tenant
  - Can manage users, students, courses within their organization
  - Can view analytics and payments for their organization
  - Cannot access other organizations' data
  
- **`super_admin`**: Platform-wide administrator
  - Can view all organizations on the platform
  - Can manage platform-level users
  - Has access to `/admin` panel with full platform overview
  
- **`admin`**: Alias for `organization_admin`
- **`instructor`**: Creates and manages courses
- **`student`**: Default role for learners
- **`manager`**: Custom role (for organizational management)

### Role Validation Code
Backend defines allowed roles:
```python
OPEN_REGISTRATION_ROLES = {
  'student',      # Can self-register
  'instructor',   # Can self-register
  'manager'       # Can self-register
}

# Admin roles can only be created via /admin/register (unrestricted)
ALLOWED_ADMIN_ROLES = {'organization_admin', 'super_admin', 'admin'}
```

## 3. Authentication Flow

### User Login Flow

#### Regular User Login → `/login`
1. User enters email/password in `frontend/app/login/page.tsx`
2. Calls `login()` from `@/services/auth` → `POST /auth/login`
3. Backend authenticates user against their organization
4. Returns `access_token` and `refresh_token`
5. Token is saved via `saveAuthToken()`:
   - Stores `access_token` in `localStorage`
   - Stores `refresh_token` in `localStorage`
   - Extracts `tenant_id` from JWT payload and stores it
6. Redirects to `/dashboard`

#### Organization Admin Login → `/organization_admin/login`
1. User enters credentials in `frontend/app/organization_admin/login/page.tsx`
2. Calls `POST /auth/login` directly (uses `api` client)
3. JWT is decoded to verify role:
   ```typescript
   const incomingRole = String(payload.role ?? payload.role_name ?? '')
     .trim().toLowerCase().replace(/\s+/g, '_');
   const adminRoles = ['organization_admin', 'super_admin', 'admin'];
   
   if (!adminRoles.includes(incomingRole)) {
     throw Error("Access denied. This page is for admins only.");
   }
   ```
4. If role is valid admin, redirects to `/admin`
5. If role is not admin, shows error message

#### Super Admin Login → `/admin/login`
1. Same flow as organization admin login
2. Both use the same login page logic
3. Role validation happens in JWT
4. Redirects to `/admin` dashboard

### User Registration Flow

#### Student/Instructor Registration → `/register`
1. User fills form in `frontend/app/register/page.tsx`:
   - Full name, email, password
   - **Organization Name** (required)
2. Frontend generates tenant ID: `org-name.toLowerCase().replace(/\s+/g, '-')`
3. Calls `register()` with `tenantId` header:
   ```typescript
   const generatedTenantId = organizationName.toLowerCase().replace(/\s+/g, '-');
   localStorage.setItem('tenant_id', generatedTenantId);
   
   await register(
     { full_name, email, password, role: 'student' },
     generatedTenantId
   );
   ```
4. Backend processes via `POST /auth/register`:
   - Calls `normalize_role_name('student')` → downgrade to student
   - Creates organization if doesn't exist via `ensure_organization_for_tenant()`
   - Creates user with `role_name='student'`
   - **Role downgrade**: Non-admin roles get forced to 'student' during open registration

#### Organization Admin Registration → `/organization_admin/register`
1. User fills form in `frontend/app/organization_admin/register/page.tsx`:
   - Full name, email, password
   - **Organization Name** (human-readable)
   - **Tenant ID** (unique identifier, auto-generated from org name)
2. Calls **`POST /admin/register`** endpoint (not public registration):
   ```typescript
   await api.post('/admin/register', {
     full_name: fullName,
     email,
     password,
     role: 'organization_admin'
   }, {
     headers: { 'x-tenant-id': tenantId.trim() }
   });
   ```
3. Backend processes via `routers/admin.py`:
   - This endpoint **bypasses role downgrade** via `allow_unrestricted_role=True`
   - Creates organization if doesn't exist
   - Creates user with role = `organization_admin`
   - Allows organiztion admin role assignment

#### Super Admin Registration → `/admin/register`
1. Same flow as organization admin registration
2. Uses `POST /admin/register` with role `super_admin` or `organization_admin`

## 4. How Organizations/Schools Are Handled During Registration

### Tenant System Architecture
- **Tenant ID**: Unique slug-style identifier (e.g., `my-school`, `acme-corp`)
- **Organization Model**: Database entity with UUID primary key
  - `id` (UUID)
  - `name` (human-readable: "My School")
  - `slug` (normalized: "my-school")
  - `domain` (optional: domain.com)
  - `is_active` (boolean)
  - `created_at`, `updated_at`

### Organization Creation During Student Registration
```python
def ensure_organization_for_tenant(db, tenant_id: str):
    # Try to find organization by tenant_id
    organization = get_organization_by_tenant(db, tenant_id)
    if organization:
        return organization
    
    # If not found, CREATE new organization
    normalized = tenant_id.strip().lower().replace(" ", "-")
    organization = Organization(
        name=tenant_id.strip(),          # User's organization name
        slug=normalized,                 # Normalized slug
        domain=None,
    )
    db.add(organization)
    db.commit()
    return organization
```

### Tenant Resolution
Backend resolves tenant ID in this order:
1. Try to parse as UUID → lookup by `organization.id`
2. Try to parse as integer → lookup by numeric ID
3. Lookup by `organization.slug` (normalized)
4. Lookup by `organization.domain`

### User Organization Assignment
When user is created:
```python
user = User(
    email=email,
    organization_id=organization.id,  # User belongs to ONE org
    role=role,
    full_name=full_name,
    hashed_password=hashed_password,
)
```

**Data Structure**: 
- Users have `organization_id` (UUID) - **belongs to ONE organization**
- JWT token includes `tenant_id` (organization UUID)
- All user data is scoped to organization via `organization_id`

## 5. AdminHeader Component & Navbar Implementation

### File Locations
- [AdminHeader.tsx](frontend/components/AdminHeader.tsx) - Admin-specific header
- [Navbar.tsx](frontend/components/Navbar.tsx) - Regular user navbar

### AdminHeader Features

#### Minimal Header (Auth Pages)
When on `/admin/login` or `/admin/register`:
```tsx
<header className="admin-header border-b border-slate-800 bg-slate-950">
  {/* Logo + "LMS Admin" branding */}
  {/* Links to /admin/login and /admin/register */}
</header>
```

#### Full Admin Header (Authenticated Admin)
When `authenticated && isAdmin`:
1. **Top Bar**:
   - Logo & "LMS Admin" branding
   - "← Back to site" link
   - Profile menu button (avatar icon)

2. **Profile Menu**:
   - Shows "Admin Account"
   - Shows current role (e.g., "Organization Admin")
   - Logout button

3. **Navigation Tabs** (below header):
   ```tsx
   const adminNav = [
     { href: '/admin', label: 'Overview', exact: true },
     { href: '/admin/users', label: 'Users', exact: false },
     { href: '/admin/students', label: 'Students', exact: false },
     { href: '/admin/payments', label: 'Payments', exact: false },
     { href: '/gamification/admin', label: 'Gamification', exact: false },
   ];
   ```

4. **Active Link Highlighting**:
   - Active links get `border-indigo-500 text-white` style
   - Inactive links get `text-slate-400` style

#### AdminHeader Role Check
```tsx
const ADMIN_ROLES = ['organization_admin', 'super_admin', 'admin'];
const isAdmin = role ? ADMIN_ROLES.includes(role) : false;
```

### Navbar Component

#### Navigation Links (Regular Users)
```tsx
const ADMIN_ROLES = ['organization_admin', 'super_admin', 'admin'];
const INSTRUCTOR_ROLES = ['instructor', ...ADMIN_ROLES];

const navItems = [
  { href: '/courses', label: 'Courses', show: true },
  { href: '/dashboard', label: 'Dashboard', show: authenticated },
  { href: '/assignments', label: 'Assignments', show: authenticated },
  { href: '/instructor', label: 'Instructor', show: isInstructor },
  { href: '/gamification', label: 'Gamification', show: authenticated },
  { href: '/admin', label: 'Admin', show: isAdmin },         // ← Shows this route for super_admin
  { href: '/analytics', label: 'Analytics', show: isAdmin },  // ← Not in tenant admin
  { href: '/certificates', label: 'Certificates', show: authenticated },
  { href: '/account', label: 'Account', show: authenticated },
];
```

#### Authentication Controls
- If authenticated: Shows logout button
- If not authenticated: Shows login & register buttons
- Mobile menu button (hamburger icon) on smaller screens

## 6. Determining if User is Logged in as Organization Admin

### Method 1: Using `useAuth()` Hook
```typescript
import { useAuth } from '@/hooks/useAuth';

function MyComponent() {
  const { authenticated, role } = useAuth();
  
  const isAdmin = role && ['organization_admin', 'super_admin', 'admin'].includes(role);
  
  if (!isAdmin) {
    return <p>You don't have admin access</p>;
  }
  
  return <AdminPanel />;
}
```

### Method 2: Direct JWT Inspection
```typescript
function isUserAdmin(): boolean {
  const token = localStorage.getItem('access_token');
  if (!token) return false;
  
  // Decode JWT
  const base64 = token.split('.')[1];
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const payload = JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')));
  
  const role = String(payload.role ?? '').toLowerCase();
  return ['organization_admin', 'super_admin', 'admin'].includes(role);
}
```

### Method 3: Protected Route Wrapper
```typescript
// Example: Wrap an admin page
const isAdmin = role && ['organization_admin', 'super_admin', 'admin'].includes(role);

if (!isAdmin) {
  router.push('/admin/login');
  return null;
}
```

### useAuth Hook Details
File: [frontend/hooks/useAuth.ts](frontend/hooks/useAuth.ts)

```typescript
interface AuthState {
  authenticated: boolean;
  role: string | null;
  tenantId: string | null;
  userId: string | null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    authenticated: false,
    role: null,
    tenantId: null,
    userId: null,
  });

  useEffect(() => {
    const auth = isAuthenticated();  // Check localStorage
    if (!auth) {
      setState({ authenticated: false, role: null, ... });
      return;
    }

    const token = localStorage.getItem('access_token');
    const payload = decodePayload(token);
    setState({
      authenticated: true,
      role: (payload.role as string) ?? null,
      tenantId: payload.tenant_id ? String(payload.tenant_id) : null,
      userId: payload.sub ? String(payload.sub) : null,
    });
  }, []);

  return state;
}
```

## 7. Data Structures & Models

### Organization
Backend Model: [tenant_models.py](backend/app/models/tenant_models.py)

```python
class Organization(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "organizations"
    
    id = Column(UUID(as_uuid=True), primary_key=True)  # UUID
    name = Column(String(255), nullable=False)         # "My School"
    slug = Column(String(255), unique=True, index=True)# "my-school"
    domain = Column(String(255), unique=True)          # Optional
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    users = relationship("User")
    courses = relationship("Course")
    payments = relationship("Payment")
    # ... many more relationships
    
    created_at = Column(DateTime(timezone=True))
    updated_at = Column(DateTime(timezone=True))
```

### User
Backend Model: [tenant_models.py](backend/app/models/tenant_models.py)

```python
class User(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    email = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_staff = Column(Boolean, default=False)
    
    # Organization & Role
    organization_id = Column(UUID(as_uuid=True))  # Which tenant
    role_id = Column(UUID(as_uuid=True))          # Foreign key to Role
    role = relationship("Role")
    
    # Property to get role name
    @property
    def role_name(self) -> str | None:
        return self.role.name if self.role else None
    
    created_at = Column(DateTime(timezone=True))
    updated_at = Column(DateTime(timezone=True))
```

### Role
Backend Model: [tenant_models.py](backend/app/models/tenant_models.py)

```python
class Role(Base, TimestampMixin, SoftDeleteMixin, OrganizationMixin):
    __tablename__ = "roles"
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    name = Column(String(100), nullable=False)  # "student", "instructor", etc
    description = Column(Text)
    permissions = Column(JSONB, default=list)    # ["course:view", "course:enroll"]
    
    organization_id = Column(UUID(as_uuid=True)) # Per-organization roles
    
    users = relationship("User")
```

### Frontend TypeScript Interfaces
File: [frontend/types/auth.ts](frontend/types/auth.ts)

```typescript
export interface TokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  role: string;
  organization_id?: number;
}

export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  full_name: string;
  email: string;
  password: string;
  role: 'student' | 'instructor' | 'admin';
}
```

## 8. Admin Pages - Students Page Structure

File: [frontend/app/admin/students/page.tsx](frontend/app/admin/students/page.tsx)

### What It Currently Displays
1. **Header Section**:
   - Title: "Organization students"
   - Description: "View and manage students enrolled in your organization"
   - "Back to admin dashboard" button

2. **Students Table**:
   - Lists all students in the organization
   - Columns:
     - **Name** (full_name or '—')
     - **Email**
     - **Role**
     - **Status** (Active/Disabled based on is_active flag)

### Data Loading
```typescript
const response = await listOrganizationUsers();  // Call organizations service
const filteredStudents = response.filter(
  user => user.role?.toLowerCase() === 'student'
);
```

### Service Call
From [frontend/services/organizations.ts](frontend/services/organizations.ts):
```typescript
export async function listOrganizationUsers(): Promise<UserProfile[]> {
  const response = await api.get('/organizations/users');
  return response.data;
}
```

### Backend Endpoint
[backend/app/routers/organizations.py](backend/app/routers/organizations.py):
- Endpoint: `GET /organizations/users`
- Requires authentication
- Returns list of users in the organization
- Scoped by `tenant_id` from JWT

## 9. Backend API Endpoints for Organization Admin

### Authentication Endpoints
- `POST /auth/login` - Login any user
- `POST /auth/register` - Register student/instructor (role downgrade)
- `POST /admin/register` - Register admin (unrestricted roles)
- `GET /auth/me` - Get current user profile
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout user

### Organization Endpoints
- `POST /organizations/signup` - Create organization with admin
- `GET /organizations/me` - Get current organization
- `PATCH /organizations/settings` - Update org settings
- `GET /organizations/subscription` - Get subscription info
- `GET /organizations/admin/summary` - Organization report
- `POST /organizations/departments` - Create department
- `GET /organizations/users` - List users
- `POST /organizations/users` - Create user
- `PATCH /organizations/users/{id}` - Update user
- `DELETE /organizations/users/{id}` - Delete user

### Admin (Platform-Level) Endpoints
- `GET /admin/organizations` - List all organizations (super_admin only)
- `GET /admin/users` - List all platform users (super_admin only)

## 10. How It All Connects - Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ REGISTRATION FLOW                                               │
└─────────────────────────────────────────────────────────────────┘

STUDENT/INSTRUCTOR REGISTRATION (/register)
    ↓
    User enters: full_name, email, password, organization_name
    ↓
    Generate tenant_id from org name
    ↓
    Call: registerUser(payload, tenantId)
    ↓
    POST /auth/register (role='student' forced)
    ↓
    Backend: ensure_organization_for_tenant() creates Org if needed
    ↓
    Backend: create_user(role='student', organization_id=org.id)
    ↓
    User created in organization
    ↓
    Redirect to /login

─────────────────────────────────────────────────────────────────

ORGANIZATION ADMIN REGISTRATION (/organization_admin/register)
    ↓
    User enters: full_name, email, password, org_name, tenant_id
    ↓
    Stores tenant_id in localStorage
    ↓
    Call: POST /admin/register (role='organization_admin')
    ↓
    Backend: allow_unrestricted_role=True
    ↓
    Backend: ensure_organization_for_tenant() creates Org if needed
    ↓
    Backend: create_user(role='organization_admin', org.id)
    ↓
    Success modal
    ↓
    Redirect to /organization_admin/login

┌─────────────────────────────────────────────────────────────────┐
│ LOGIN FLOW                                                      │
└─────────────────────────────────────────────────────────────────┘

REGULAR LOGIN (/login)
    ↓
    User enters: email, password
    ↓
    Call: login(email, password)
    ↓
    POST /auth/login (no tenant_id provided)
    ↓
    Backend: authenticate_user() with or without tenant context
    ↓
    Return: access_token, refresh_token
    ↓
    Frontend: saveAuthToken(access_token)
    ↓
    localStorage: access_token, refresh_token, tenant_id
    ↓
    Redirect to /dashboard

─────────────────────────────────────────────────────────────────

ADMIN LOGIN (/admin/login or /organization_admin/login)
    ↓
    User enters: email, password
    ↓
    Call: POST /auth/login
    ↓
    Return: access_token, refresh_token
    ↓
    Frontend: Decode JWT → check role
    ↓
    Is role in ['organization_admin', 'super_admin', 'admin']?
    ├─→ YES: saveAuthToken() → redirect to /admin
    └─→ NO: Show error "Admin page only"

┌─────────────────────────────────────────────────────────────────┐
│ ADMIN DASHBOARD ACCESS                                          │
└─────────────────────────────────────────────────────────────────┘

Visit: /admin
    ↓
    useAuth() hook checks localStorage
    ├─→ No access_token?     → render login page
    ├─→ Not admin role?      → show "not admin" message
    └─→ Is admin?            → render admin dashboard
    ↓
    AdminHeader shows navigation tabs:
    ├─ Overview (main dashboard)
    ├─ Users (manage instructors)
    ├─ Students (view students)
    ├─ Payments (payment management)
    └─ Gamification
    ↓
    Admin can click "Students" → /admin/students
    ↓
    Page calls: listOrganizationUsers()
    ↓
    Backend: GET /organizations/users (scoped by tenant_id in JWT)
    ↓
    Filter: Only show students (role === 'student')
    ↓
    Display: Table of students in organization
```

## 11. Important Implementation Details

### Token Storage & Retrieval
- **Access Token**: `localStorage.getItem('access_token')`
- **Refresh Token**: `localStorage.getItem('refresh_token')`
- **Tenant ID**: `localStorage.getItem('tenant_id')`
- On logout: All three are cleared via `clearAuthToken()`

### Organization Scoping
- **Backend**: Uses `get_tenant()` dependency to extract tenant_id from JWT
- **Frontend**: Gets tenant_id from JWT payload → stores in localStorage
- **Data Access**: All queries filtered by organization_id (UUID)

### Role Normalization
```python
ROLE_ALIASES = {
    "super admin": "super_admin",
    "organization admin": "organization_admin",
    "admin": "organization_admin",  # ← "admin" is alias
    "teacher": "instructor",
    "student": "student",
}
```

### Admin Role Detection (Frontend)
```typescript
const ADMIN_ROLES = ['organization_admin', 'super_admin', 'admin'];
const isAdmin = role ? ADMIN_ROLES.includes(role) : false;
```

This two-way check allows:
- Users with explicit `organization_admin` role
- Users with `super_admin` role
- Users with legacy `admin` role

## 12. Key Files Cross-Reference

| File | Purpose |
|------|---------|
| `frontend/app/organization_admin/login/page.tsx` | Org admin login |
| `frontend/app/organization_admin/register/page.tsx` | Org admin registration |
| `frontend/app/admin/login/page.tsx` | Super admin login |
| `frontend/app/admin/page.tsx` | Admin dashboard |
| `frontend/app/admin/students/page.tsx` | Students listing |
| `frontend/components/AdminHeader.tsx` | Admin header with nav |
| `frontend/components/Navbar.tsx` | Regular user navbar |
| `frontend/hooks/useAuth.ts` | Auth state hook |
| `frontend/lib/auth.ts` | Auth utilities (token storage) |
| `frontend/services/auth.ts` | Auth API calls |
| `frontend/services/organizations.ts` | Org API calls |
| `backend/app/models/tenant_models.py` | User, Organization, Role models |
| `backend/app/routers/admin.py` | Admin endpoints |
| `backend/app/routers/organizations.py` | Organization endpoints |
| `backend/app/services/auth.py` | Auth business logic |
