# Academic Structure API Endpoints
**Classes, Subjects, Arms, Students, Class Assignments, Academic Calendar, Attendance, and Fees**
**Generated:** April 26, 2026
**Last Updated:** May 16, 2026 - Corrected to match actual implementation

---

## Table of Contents
1. [Classes](#classes)
2. [Subjects](#subjects)
3. [Arms](#arms)
4. [Arm Subjects](#arm-subjects)
5. [Student Management](#student-management)
6. [Student Class Assignment](#student-class-assignment)
7. [Academic Calendar](#academic-calendar)
8. [Attendance](#attendance) *(Not Implemented)*
9. [Fees](#fees) *(Not Implemented)*
10. [Unified Request Format](#unified-request-format)

---

## Classes

### Create Classes
```http
POST /api/academic/classes
```
**Access:** Admin
**Body:**
```json
{
  "classes": [
    {
      "name": "string (required)",        // e.g., "Crèche", "Primary 1", "SS 3"
      "level": "number (required)",    // 1-100 (School-defined levels)
      "description": "string (optional)"   // e.g., "Junior Secondary School Year 1"
    }
  ]
}
```
**✅ Status:** **IMPLEMENTED** - Supports flexible class levels (1-100) as provided by schools
**Response (201):**
```json
{
  "success": true,
  "message": "4 class(es) created successfully",
  "data": {
    "classes": [...],
    "total": 4,
    "errors": []
  }
}
```

### List Classes
```http
GET /api/academic/classes
```
**Access:** Admin
**Query:** `?schoolId=SUN8935` (system admin only)
**Response (200):**
```json
{
  "success": true,
  "data": {
    "classes": [
      {
        "_id": "69ed...",
        "schoolId": "SUN8935",
        "name": "Crèche",
        "level": 1,
        "isActive": true
      }
    ],
    "total": 16
  }
}
```
**✅ Status:** **IMPLEMENTED** - Returns all classes for school

### Get Class by ID
```http
GET /api/academic/classes/:classId
```
**Access:** Admin
**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "69ed...",
    "schoolId": "SUN8935",
    "name": "JSS1",
    "level": 1,
    "isActive": true
  }
}
```

### Update Class
```http
PUT /api/academic/classes/:classId
```
**Access:** Admin
**Body:**
```json
{
  "name": "JSS1 Updated",
  "level": 1
}
```
**❌ Status:** **NOT IMPLEMENTED** - Route does not exist in classManagement.js

### Delete Class
```http
DELETE /api/academic/classes/:classId
```
**Access:** Admin
**Response (200):**
```json
{
  "success": true,
  "message": "Class deleted successfully",
  "data": {
    "deleted": 1,
    "errors": []
  }
}
```
**✅ Status:** **IMPLEMENTED** - Deletes single class by ID

---

## Subjects

### Create Subjects
```http
POST /api/academic/subjects
```
**Access:** Admin
**Body:**
```json
{
  "subjects": [
    {
      "name": "string (required)",      // e.g., "Mathematics"
      "code": "string (required)",    // e.g., "MTH"
      "description": "string (optional)",
      "category": "core | elective | optional | religious (optional)"
    }
  ]
}
```
**Response (201):**
```json
{
  "success": true,
  "message": "4 subject(s) created successfully",
  "data": {
    "subjects": [...],
    "total": 4,
    "errors": []
  }
}
```

### List Subjects
```http
GET /api/academic/subjects
```
**Access:** Authenticated
**Response (200):**
```json
{
  "success": true,
  "data": {
    "subjects": [...],
    "total": 10
  }
}
```

### Get Subjects by Class
```http
GET /api/academic/classes/:classId/subjects
```
**Access:** Authenticated
**Response (200):**
```json
{
  "success": true,
  "data": {
    "subjects": [...],
    "total": 5
  }
}
```

### Add Subjects to Class (All Arms)
```http
POST /api/academic/classes/:classId/subjects
```
**Access:** Admin
**Body (Unified - Array):**
```json
{
  "subjectIds": ["65abc123...", "65abc456..."]
}
```
**Effect:** Adds subjects to ALL arms under the class
**Response (200):**
```json
{
  "success": true,
  "message": "5 subject(s) added to class",
  "data": {
    "subjects": [...],
    "total": 5,
    "errors": []
  }
}
```

### Remove Subjects from Class
```http
DELETE /api/academic/classes/:classId/subjects
```
**Access:** Admin
**Body:**
```json
{
  "subjectIds": ["65abc123...", "65abc456..."]
}
```
**Response (200):**
```json
{
  "success": true,
  "message": "Subject(s) removed from class",
  "data": {...}
}
```

### Update Subject
```http
PUT /api/academic/subjects/:subjectId
```
**Access:** Admin
**Body:**
```json
{
  "name": "Mathematics Updated",
  "category": "elective"
}
```
**Response (200):**
```json
{
  "success": true,
  "message": "Subject updated successfully",
  "data": {...}
}
```

### Delete Subjects
```http
DELETE /api/academic/subjects
```
**Access:** Admin
**Body (Unified):**
```json
{
  "subjectIds": "65abc123..."
}
// or
{
  "subjectIds": ["65abc123...", "65abc456..."]
}
```
**Response (200):**
```json
{
  "success": true,
  "message": "2 subject(s) deleted successfully",
  "data": {
    "deleted": 2,
    "errors": []
  }
}
```

---

## Arms

### Create Arms
```http
POST /api/academic/arms
```
**Access:** Admin
**Body:**
```json
{
  "arms": [
    {
      "classId": "string (required)",      // Class ObjectId
      "name": "string (required)",      // e.g., "A", "B", "Science"
      "classTeacherId": "string (optional)"
    }
  ]
}
```
**Response (201):**
```json
{
  "success": true,
  "message": "3 arm(s) created successfully",
  "data": {
    "arms": [...],
    "total": 3,
    "errors": []
  }
}
```

### Get Arms by Class
```http
GET /api/academic/classes/:classId/arms
```
**Access:** Authenticated
**Response (200):**
```json
{
  "success": true,
  "data": {
    "arms": [
      {
        "_id": "69ed...",
        "schoolId": "SUN8935",
        "classId": "69ed...",
        "name": "A",
        "subjects": [],
        "isActive": true
      }
    ],
    "total": 3
  }
}
```

### Update Arm
```http
PUT /api/academic/arms/:armId
```
**Access:** Admin
**Body:**
```json
{
  "name": "Science",
  "classTeacherId": "60abc..."
}
```
**Response (200):**
```json
{
  "success": true,
  "message": "Arm updated successfully",
  "data": {...}
}
```

### Delete Arms
```http
DELETE /api/academic/arms
```
**Access:** Admin
**Body (Unified):**
```json
{
  "armIds": "69ed..."
}
// or
{
  "armIds": ["69ed...", "69ed..."]
}
```
**Response (200):**
```json
{
  "success": true,
  "message": "2 arm(s) deleted successfully",
  "data": {
    "deleted": 2,
    "errors": []
  }
}
```

---

## Arm Subjects

Each Arm (class section) can have its own set of subjects. This is useful when:
- **JSS1-3:** All arms share the same subjects
- **SSS1-3:** Different arms (Science/Art/Commercial) have different subjects

### Get Arm Subjects
```http
GET /api/academic/arms/:armId/subjects
```
**Access:** Authenticated
**Response (200):**
```json
{
  "success": true,
  "data": {
    "subjects": [
      {
        "_id": "65abc...",
        "name": "Mathematics",
        "code": "MTH",
        "category": "core"
      }
    ],
    "total": 5
  }
}
```

### Add Subjects to Arm
```http
POST /api/academic/arms/:armId/subjects
```
**Access:** Admin
**Body (Unified - Array):**
```json
{
  "subjectIds": ["65abc123...", "65abc456...", "65abc789..."]
}
```
**Response (200):**
```json
{
  "success": true,
  "message": "3 subject(s) added to arm",
  "data": {
    "added": [
      { "subjectId": "65abc...", "subjectName": "Mathematics" },
      { "subjectId": "65abc...", "subjectName": "English" }
    ],
    "errors": []
  }
}
```

### Remove Subjects from Arm
```http
DELETE /api/academic/arms/:armId/subjects
```
**Access:** Admin
**Body:**
```json
{
  "subjectIds": ["65abc123...", "65abc456..."]
}
```
**Response (200):**
```json
{
  "success": true,
  "message": "Subject(s) removed from arm",
  "data": {...}
}
```

### Replace Subjects on Arm
Replaces all existing subjects on the arm with new ones.

```http
PUT /api/academic/arms/:armId/subjects/replace
```
**Access:** Admin
**Body:**
```json
{
  "subjectIds": ["65abc123...", "65abc456..."]
}
```
**Response (200):**
```json
{
  "success": true,
  "message": "Arm subjects replaced successfully",
  "data": {
    "armId": "69ed...",
    "armName": "A",
    "subjects": ["65abc...", "65abc..."],
    "errors": []
  }
}
```

### Copy Subjects to Arm
Copies subjects from a source arm to a target arm. Useful for JSS where all arms share the same subjects.

```http
POST /api/academic/arms/:sourceArmId/subjects/copy/:targetArmId
```
**Access:** Admin
**Body:**
```json
{
  "subjectIds": ["65abc123...", "65abc456...", "65abc789..."]
}
```
**Response (200):**
```json
{
  "success": true,
  "message": "Copied 5 subjects to arm",
  "data": {
    "sourceArmId": "69ed...",
    "sourceArmName": "A",
    "targetArmId": "69ed...",
    "targetArmName": "B",
    "subjectsCopied": 5,
    "errors": []
  }
}
```

---

## Student Management

### Create Student
```http
POST /api/students
```
**Access:** Admin
**Body:**
```json
{
  "firstName": "string (required)",
  "lastName": "string (required)",
  "email": "string (optional)",
  "class": "string (optional)",           // e.g., "JSS1"
  "section": "string (optional)",         // e.g., "A"
  "rollNumber": "string (optional)",
  "grade": "string (optional)",
  "dateOfBirth": "string (optional)",  // YYYY-MM-DD
  "gender": "male | female (optional)",
  "address": "string (optional)",
  "phone": "string (optional)",
  "parentIds": ["string"] (optional)",
  "teacherIds": ["string"] (optional)"
}
```
**Response (201):**
```json
{
  "success": true,
  "message": "Student created successfully",
  "data": {
    "student": {...}
  }
}
```

### List Students
```http
GET /api/students
```
**Access:** Admin/Teacher
**Query:**
- `?class=...` - Filter by class name (e.g., JSS1)
- `?section=...` - Filter by section (e.g., A)
- `?search=...` - Search by name
- `?page=1&limit=20` - Pagination

**Response (200):**
```json
{
  "success": true,
  "data": {
    "students": [...],
    "total": 50,
    "page": 1,
    "limit": 20
  }
}
```

### Get Student Details
```http
GET /api/students/:studentId
```
**Access:** Admin/Teacher/Parent
**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "60abc...",
    "schoolId": "SUN8935",
    "firstName": "John",
    "lastName": "Doe",
    "class": "JSS1",
    "section": "A",
    "rollNumber": "001",
    "parentIds": ["60abc..."],
    "isActive": true,
    "createdAt": "2025-01-15T..."
  }
}
```

### Update Student
```http
PUT /api/students/:studentId
```
**Access:** Admin
**Body:**
```json
{
  "firstName": "John Updated",
  "class": "JSS2",
  "section": "A"
}
```
**Response (200):**
```json
{
  "success": true,
  "message": "Student updated successfully",
  "data": {...}
}
```

### Toggle Student Status
```http
POST /api/students/toggle-status
```
**Access:** Admin
**Body:**
```json
{
  "studentId": "60abc...",
  "action": "activate | deactivate",
  "reason": "string (optional)"
}
```
**Response (200):**
```json
{
  "success": true,
  "message": "Student activated successfully",
  "data": {...}
}
```

### Remove Student (Soft Delete)
```http
DELETE /api/students/remove
```
**Access:** Admin
**Body:**
```json
{
  "studentId": "60abc...",
  "reason": "string (optional)"
}
```
**Response (200):**
```json
{
  "success": true,
  "message": "Student removed successfully"
}
```

---

## Student Class Assignment

### Assign Students to Class
```http
POST /api/academic/students/assign
```
**Access:** Admin
**Body:**
```json
{
  "assignments": [
    {
      "studentId": "60abc...",
      "classId": "69ed...",
      "armId": "69ed..."      // optional
    }
  ]
}
```
**Response (200):**
```json
{
  "success": true,
  "message": "3 student(s) assigned to class",
  "data": {...}
}
```

### Unassign Students from Class
```http
POST /api/academic/students/unassign
```
**Access:** Admin
**Body (Unified):**
```json
{
  "studentIds": ["60abc...", "60abc..."]
}
```
**Response (200):**
```json
{
  "success": true,
  "message": "2 student(s) unassigned from class",
  "data": {...}
}
```

### Get Class Population Statistics
Returns count of students in each class (optionally filtered by classId).

```http
GET /api/academic/classes/population
```
**Access:** Admin
**Query:** `?classId=69ed...` (optional)
**Response (200):**
```json
{
  "success": true,
  "data": {
    "populations": [
      {
        "classId": "69ed...",
        "className": "JSS1",
        "totalStudents": 45
      },
      {
        "classId": "69ed...",
        "className": "JSS2",
        "totalStudents": 38
      }
    ]
  }
}
```

### Get Unassigned Students
Returns students not assigned to any class.

```http
GET /api/academic/students/unassigned
```
**Access:** Admin
**Query:** `?page=1&limit=20`
**Response (200):**
```json
{
  "success": true,
  "data": {
    "students": [...],
    "total": 5,
    "page": 1,
    "limit": 20
  }
}
```

### Planned (Not Yet Implemented)
The following student class assignment endpoints are planned but not yet implemented:

```http
GET /api/students/class/:classId/students   # Get Students by Class
GET /api/students/class/:classId/population  # Get Class Population
```

---

## Academic Calendar

Academic years and terms (3-term structure).

### Create Academic Year
```http
POST /api/academic/years
```
**Access:** Admin
**Body:**
```json
{
  "years": [
    {
      "year": "2025-2026",
      "name": "2025/2026 Academic Year",
      "startDate": "2025-09-01T00:00:00.000Z",
      "endDate": "2026-07-31T23:59:59.999Z",
      "isCurrent": true
    }
  ]
}
```
**✅ Status:** **IMPLEMENTED**

### List Academic Years
```http
GET /api/academic/years
```
**Access:** Authenticated
**Response (200):**
```json
{
  "success": true,
  "data": {
    "academicYears": [...],
    "total": 2
  }
}
```
**✅ Status:** **IMPLEMENTED**

### Get Current Academic Period
Returns current academic year and term.

```http
GET /api/academic/current
```
**Access:** Authenticated
**Response (200):**
```json
{
  "success": true,
  "data": {
    "academicYear": {...},
    "term": {...}
  }
}
```
**✅ Status:** **IMPLEMENTED**

### Set Current Academic Year
```http
PUT /api/academic/years/:yearId/current
```
**Access:** Admin
**Response (200):**
```json
{
  "success": true,
  "message": "Current academic year set successfully",
  "data": {...}
}
```
**✅ Status:** **IMPLEMENTED**

### Create Term
```http
POST /api/academic/terms
```
**Access:** Admin
**Body:**
```json
{
  "terms": [
    {
      "academicYearId": "70abc...",
      "term": "First_Term",
      "name": "First Term",
      "startDate": "2025-09-01T00:00:00.000Z",
      "endDate": "2025-12-01T23:59:59.999Z",
      "isCurrent": true
    }
  ]
}
```
**Response (201):**
```json
{
  "success": true,
  "message": "Term created successfully",
  "data": {
    "term": {...}
  }
}
```
**✅ Status:** **IMPLEMENTED** - Note: `term` field uses enum values (First_Term, Second_Term, Third_Term)

### List Terms
```http
GET /api/academic/terms
```
**Access:** Authenticated
**Query:** `?academicYearId=70abc...`
**Response (200):**
```json
{
  "success": true,
  "data": {
    "terms": [...],
    "total": 3
  }
}
```
**✅ Status:** **IMPLEMENTED**

### Set Current Term
```http
PUT /api/academic/terms/:termId/current
```
**Access:** Admin
**Response (200):**
```json
{
  "success": true,
  "message": "Current term set successfully",
  "data": {...}
}
```
**✅ Status:** **IMPLEMENTED**

### Planned (Not Yet Implemented)
The following academic calendar endpoints are planned but not yet implemented:

```http
GET   /api/academic/calendar/years/:yearId/terms     # Get Terms by Academic Year
PUT   /api/academic/calendar/terms/:termId            # Update Term
DELETE /api/academic/calendar/terms/:termId           # Delete Term
DELETE /api/academic/calendar/years/:yearId           # Delete Academic Year
```

---

## Attendance

**❌ Status:** **NOT IMPLEMENTED** - No route files, controllers, or Postman entries exist yet.

The following endpoints are planned for future implementation:

### Mark Attendance
```http
POST /api/attendance/mark
```
### Get Student Attendance
```http
GET /api/attendance/student/:studentId
```
### Get Class Attendance
```http
GET /api/attendance/class/:classId
```
### Get Attendance Stats
```http
GET /api/attendance/stats
```
### Get Chronic Absentees
```http
GET /api/attendance/chronic/absent
```
### Get Chronic Lates
```http
GET /api/attendance/chronic/late
```

---

## Fees

**❌ Status:** **NOT IMPLEMENTED** - No route files, controllers, or Postman entries exist yet.

The following endpoints are planned for future implementation:

### Create Fee Structure
```http
POST /api/fees/structures
```
### List Fee Structures
```http
GET /api/fees/structures
```
### Create Invoices
```http
POST /api/fees/invoices
```
### List Invoices
```http
GET /api/fees/invoices
```
### Get Student Fees
```http
GET /api/fees/student/:studentId
```
### Record Payment
```http
POST /api/fees/invoices/:invoiceId/payment
```
### Get Payment History
```http
GET /api/fees/invoices/:invoiceId/payments
```
### Get Fee Analytics
```http
GET /api/fees/analytics
```

---

## Unified Request Format

All endpoints that accept IDs follow this unified pattern:

### Single ID
```json
{
  "classIds": "65abc123..."
}
```

### Array of IDs
```json
{
  "classIds": ["65abc123...", "65abc456...", "65abc789..."]
}
```

---

## Error Response Format

```json
{
  "success": false,
  "error": {
    "statusCode": 400,
    "status": "error"
  },
  "message": "Error description"
}
```

### Bulk Operation Errors

```json
{
  "success": true,
  "message": "2 class(es) created successfully",
  "data": {
    "classes": [...],
    "total": 2,
    "errors": [
      { "name": "JSS1", "error": "Class name already exists" }
    ]
  }
}
```
