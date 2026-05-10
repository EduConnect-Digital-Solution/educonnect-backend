# Academic Structure API Endpoints
**Classes, Subjects, Arms, Students, Class Assignments, Academic Calendar, Attendance, and Fees**  
**Generated:** April 26, 2026

---

## Table of Contents
1. [Classes](#classes)
2. [Subjects](#subjects)
3. [Arms](#arms)
4. [Arm Subjects](#arm-subjects)
5. [Student Management](#student-management)
6. [Student Class Assignment](#student-class-assignment)
7. [Academic Calendar](#academic-calendar)
8. [Attendance](#attendance)
9. [Fees](#fees)
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
      "name": "string (required)",        // e.g., "JSS1", "SSS2"
      "level": "number (required)",    // 1-6 (JSS1=1, JSS2=2, JSS3=3, SSS1=4, SSS2=5, SSS3=6)
      "description": "string (optional)"
    }
  ]
}
```
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
**Access:** Authenticated  
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
        "name": "JSS1",
        "level": 1,
        "isActive": true
      }
    ],
    "total": 4
  }
}
```

### Get Class by ID
```http
GET /api/academic/classes/:classId
```
**Access:** Authenticated  
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
**Response (200):**
```json
{
  "success": true,
  "message": "Class updated successfully",
  "data": {...}
}
```

### Delete Classes
```http
DELETE /api/academic/classes
```
**Access:** Admin  
**Body (Unified):**
```json
{
  "classIds": "69ed..."
}
// or
{
  "classIds": ["69ed...", "69ed..."]
}
```
**Response (200):**
```json
{
  "success": true,
  "message": "2 class(es) deleted successfully",
  "data": {
    "deleted": 2,
    "errors": []
  }
}
```

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
**Body (Unified - Single):**
```json
{
  "subjectIds": "65abc123..."
}
```
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
**Body (Unified - Single):**
```json
{
  "subjectIds": "65abc123..."
}
```
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

### Replace Subjects on Arm
Replaces all existing subjects on the arm with new ones.

```http
POST /api/academic/arms/:armId/subjects/replace
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

### Copy Subjects to Arms
Copies subjects from a source arm to one or more target arms. Useful for JSS where all arms share the same subjects.

```http
POST /api/academic/arms/:sourceArmId/subjects/copy
```
**Access:** Admin  
**Body (Unified - Single Target):**
```json
{
  "targetArmIds": "69ed..."
}
```
**Body (Unified - Array Targets):**
```json
{
  "targetArmIds": ["69ed...", "69ed...", "69ed..."]
}
```
**Response (200):**
```json
{
  "success": true,
  "message": "Copied 5 subjects to 3 arms",
  "data": {
    "sourceArmId": "69ed...",
    "sourceArmName": "A",
    "subjectsCopied": 5,
    "results": [
      { "targetArmId": "69ed...", "armName": "B", "subjectsCount": 5 },
      { "targetArmId": "69ed...", "armName": "C", "subjectsCount": 5 }
    ],
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
  "classId": "string (optional)",        // Links to Class model
  "section": "string (optional)",        // Legacy field
  "rollNumber": "string (optional)",
  "grade": "string (optional)",
  "dateOfBirth": "string (optional)",  // YYYY-MM-DD
  "gender": "male | female (optional)",
  "address": "string (optional)",
  "phone": "string (optional)",
  "parentIds": ["string"] (optional)", // Array of parent user IDs
  "teacherIds": ["string"] (optional)"
}
```
**Note:** When `classId` is provided, the student is automatically linked to that class.  
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
- `?classId=...` - Filter by class
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
    "classId": "69ed...",          // Links to Class model
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
  "classId": "69ed...",
  "rollNumber": "002"
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
POST /api/students/class/assign
```
**Access:** Admin  
**Body (Unified - Single Student):**
```json
{
  "studentIds": "60abc...",
  "classId": "69ed..."
}
```
**Body (Unified - Array Students):**
```json
{
  "studentIds": ["60abc...", "60abc..."],
  "classId": "69ed..."
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
POST /api/students/class/unassign
```
**Access:** Admin  
**Body (Unified):**
```json
{
  "studentIds": "60abc..."
}
// or
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

### Get All Class Populations
Returns count of students in each class.

```http
GET /api/students/class/populations
```
**Access:** Admin/Teacher  
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

### Get Students by Class
```http
GET /api/students/class/:classId/students
```
**Access:** Admin/Teacher  
**Response (200):**
```json
{
  "success": true,
  "data": {
    "students": [
      {
        "_id": "60abc...",
        "firstName": "John",
        "lastName": "Doe",
        "rollNumber": "001"
      }
    ],
    "total": 45
  }
}
```

### Get Class Population
```http
GET /api/students/class/:classId/population
```
**Access:** Admin/Teacher  
**Response (200):**
```json
{
  "success": true,
  "data": {
    "classId": "69ed...",
    "className": "JSS1",
    "totalStudents": 45
  }
}
```

---

## Academic Calendar

Academic years and terms (3-term structure).

### Create Academic Year
```http
POST /api/academic/calendar/years
```
**Access:** Admin  
**Body:**
```json
{
  "startYear": 2025,
  "endYear": 2026,
  "isCurrent": true
}
```
**Response (201):**
```json
{
  "success": true,
  "message": "Academic year created successfully",
  "data": {
    "academicYear": {
      "_id": "70abc...",
      "schoolId": "SUN8935",
      "startYear": 2025,
      "endYear": 2026,
      "isCurrent": true
    }
  }
}
```

### List Academic Years
```http
GET /api/academic/calendar/years
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

### Get Current Academic Year
```http
GET /api/academic/calendar/years/current
```
**Access:** Authenticated  
**Response (200):**
```json
{
  "success": true,
  "data": {
    "academicYear": {...}
  }
}
```

### Set Current Academic Year
```http
PUT /api/academic/calendar/years/:yearId/current
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

### Delete Academic Year
```http
DELETE /api/academic/calendar/years/:yearId
```
**Access:** Admin  
**Response (200):**
```json
{
  "success": true,
  "message": "Academic year deleted successfully"
}
```

### Create Term
```http
POST /api/academic/calendar/terms
```
**Access:** Admin  
**Body:**
```json
{
  "academicYearId": "70abc...",
  "termNumber": 1,
  "name": "First Term",
  "startDate": "2025-09-01",
  "endDate": "2025-12-01",
  "isCurrent": true
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

### List Terms
```http
GET /api/academic/calendar/terms
```
**Access:** Authenticated  
**Query:** `?yearId=70abc...`  
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

### Get Terms by Academic Year
```http
GET /api/academic/calendar/years/:yearId/terms
```
**Access:** Authenticated  
**Response (200):**
```json
{
  "success": true,
  "data": {
    "terms": [
      {
        "_id": "71abc...",
        "academicYearId": "70abc...",
        "termNumber": 1,
        "name": "First Term",
        "startDate": "2025-09-01",
        "endDate": "2025-12-01",
        "isCurrent": true
      }
    ],
    "total": 3
  }
}
```

### Get Current Term
```http
GET /api/academic/calendar/terms/current
```
**Access:** Authenticated  
**Response (200):**
```json
{
  "success": true,
  "data": {
    "term": {...}
  }
}
```

### Set Current Term
```http
PUT /api/academic/calendar/terms/:termId/current
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

### Update Term
```http
PUT /api/academic/calendar/terms/:termId
```
**Access:** Admin  
**Body:**
```json
{
  "name": "First Term Updated",
  "endDate": "2025-12-15"
}
```
**Response (200):**
```json
{
  "success": true,
  "message": "Term updated successfully",
  "data": {...}
}
```

### Delete Term
```http
DELETE /api/academic/calendar/terms/:termId
```
**Access:** Admin  
**Response (200):**
```json
{
  "success": true,
  "message": "Term deleted successfully"
}
```

---

## Attendance

### Mark Attendance
```http
POST /api/attendance/mark
```
**Access:** Admin/Teacher  
**Body:**
```json
{
  "attendances": [
    {
      "academicYearId": "70abc..." (required),
      "termId": "71abc..." (required),
      "classId": "69ed..." (required),
      "studentId": "60abc..." (required),
      "date": "2025-09-15" (required),
      "status": "present | absent | late | excused" (required),
      "reason": "string (optional)"  // Required if status is absent/excused
    }
  ]
}
```
**Response (201):**
```json
{
  "success": true,
  "message": "10 attendance record(s) marked successfully",
  "data": {...}
}
```

### Get Student Attendance
```http
GET /api/attendance/student/:studentId
```
**Access:** Admin/Teacher/Parent  
**Query:** `?days=30` - Number of days to look back  
**Response (200):**
```json
{
  "success": true,
  "data": {
    "attendance": [...],
    "total": 25,
    "present": 22,
    "absent": 2,
    "late": 1,
    "excused": 0
  }
}
```

### Get Class Attendance
```http
GET /api/attendance/class/:classId
```
**Access:** Admin/Teacher  
**Query:** `?date=2025-09-15`  
**Response (200):**
```json
{
  "success": true,
  "data": {
    "date": "2025-09-15",
    "totalStudents": 45,
    "present": 40,
    "absent": 3,
    "late": 2,
    "excused": 0,
    "records": [...]
  }
}
```

### Get Attendance Stats
```http
GET /api/attendance/stats
```
**Access:** Admin/Teacher  
**Query:** `?classId=...&startDate=2025-09-01&endDate=2025-12-01`  
**Response (200):**
```json
{
  "success": true,
  "data": {
    "classId": "69ed...",
    "totalStudents": 45,
    "averageAttendance": 92.5,
    "byStatus": {
      "present": 828,
      "absent": 45,
      "late": 27,
      "excused": 3
    }
  }
}
```

### Get Chronic Absentees
Students with absences above threshold.

```http
GET /api/attendance/chronic/absent
```
**Access:** Admin/Teacher  
**Query:** `?classId=...&threshold=3`  
**Response (200):**
```json
{
  "success": true,
  "data": {
    "students": [
      {
        "studentId": "60abc...",
        "firstName": "John",
        "lastName": "Doe",
        "absentCount": 5,
        "attendanceRate": 85.0
      }
    ],
    "total": 2
  }
}
```

### Get Chronic Lates
Students with lates above threshold.

```http
GET /api/attendance/chronic/late
```
**Access:** Admin/Teacher  
**Query:** `?classId=...&threshold=2`  
**Response (200):**
```json
{
  "success": true,
  "data": {
    "students": [...],
    "total": 3
  }
}
```

---

## Fees

### Create Fee Structure
```http
POST /api/fees/structures
```
**Access:** Admin  
**Body:**
```json
{
  "academicYearId": "70abc..." (required),
  "name": "string (required)",     // e.g., "School Fees", "Uniform Fee"
  "amount": 50000 (required),      // Amount in kobo
  "dueDate": "2025-09-30" (required),
  "paymentType": "one-time | installment" (optional),
  "installmentPlans": [] (optional)  // For installment payments
}
```
**Response (201):**
```json
{
  "success": true,
  "message": "Fee structure created successfully",
  "data": {
    "feeStructure": {...}
  }
}
```

### List Fee Structures
```http
GET /api/fees/structures
```
**Access:** Authenticated  
**Response (200):**
```json
{
  "success": true,
  "data": {
    "feeStructures": [...],
    "total": 5
  }
}
```

### Create Invoices
```http
POST /api/fees/invoices
```
**Access:** Admin  
**Body:**
```json
{
  "invoices": [
    {
      "feeStructureId": "72abc..." (required),
      "studentId": "60abc..." (required)
    }
  ]
}
```
**Response (201):**
```json
{
  "success": true,
  "message": "10 invoice(s) created successfully",
  "data": {...}
}
```

### List Invoices
```http
GET /api/fees/invoices
```
**Access:** Admin/Teacher  
**Query:** `?classId=...&status=pending|paid|overdue`  
**Response (200):**
```json
{
  "success": true,
  "data": {
    "invoices": [...],
    "total": 50,
    "summary": {
      "totalAmount": 2500000,
      "paid": 1500000,
      "pending": 1000000
    }
  }
}
```

### Get Student Fees
```http
GET /api/fees/student/:studentId
```
**Access:** Admin/Teacher/Parent  
**Response (200):**
```json
{
  "success": true,
  "data": {
    "student": {...},
    "invoices": [
      {
        "feeStructure": {...},
        "amount": 50000,
        "amountPaid": 0,
        "status": "pending"
      }
    ]
  }
}
```

### Record Payment
```http
POST /api/fees/invoices/:invoiceId/payment
```
**Access:** Admin  
**Body:**
```json
{
  "amount": 25000,
  "paymentMethod": "cash | bank_transfer | pos | online",
  "referenceNumber": "TXN123456",
  "receiptNumber": "RCP001" (optional)
}
```
**Response (200):**
```json
{
  "success": true,
  "message": "Payment recorded successfully",
  "data": {
    "payment": {...},
    "invoice": {
      "status": "partial",
      "amountPaid": 25000,
      "amountDue": 25000
    }
  }
}
```

### Get Payment History
```http
GET /api/fees/invoices/:invoiceId/payments
```
**Access:** Admin  
**Response (200):**
```json
{
  "success": true,
  "data": {
    "payments": [...],
    "totalPaid": 50000
  }
}
```

### Get Fee Analytics
```http
GET /api/fees/analytics
```
**Access:** Admin  
**Query:** `?classId=...&academicYearId=...`  
**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalExpected": 5000000,
    "totalCollected": 3500000,
    "totalPending": 1500000,
    "collectionRate": 70.0,
    "byClass": [
      { "className": "JSS1", "expected": 1000000, "collected": 800000 }
    ]
  }
}
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