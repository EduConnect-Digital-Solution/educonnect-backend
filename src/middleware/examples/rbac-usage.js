/**
 * RBAC Middleware Usage Examples
 * This file demonstrates how to use the RBAC middleware in routes
 */

const express = require('express');
const { authenticateToken } = require('../auth');
const {
  requireAdmin,
  requireTeacher,
  validateSchoolAccess,
  validateResourceOwnership,
  validateParentAccess,
  validateTeacherAccess,
  createRBACChain,
  auditLog,
  requirePermission,
  ROLES
} = require('../rbac');

const router = express.Router();

// Example 1: Admin-only endpoint
router.get('/admin/dashboard', 
  authenticateToken,
  requireAdmin,
  auditLog('VIEW_ADMIN_DASHBOARD'),
  (req, res) => {
    res.json({ message: 'Admin dashboard data' });
  }
);

// Example 2: Teacher or Admin access with school validation
router.get('/classes/:classId/students',
  authenticateToken,
  validateSchoolAccess,
  requireTeacher,
  validateTeacherAccess,
  (req, res) => {
    // Controller logic here
    res.json({ message: 'Class students data' });
  }
);

// Example 3: Parent access to their children's data
router.get('/students/:studentId/grades',
  authenticateToken,
  validateSchoolAccess,
  validateParentAccess,
  (req, res) => {
    // Controller will validate parent-child relationship
    res.json({ message: 'Student grades data' });
  }
);

// Example 4: Resource ownership validation
router.get('/users/:id',
  authenticateToken,
  validateSchoolAccess,
  validateResourceOwnership('user'),
  (req, res) => {
    res.json({ message: 'User profile data' });
  }
);

// Example 5: Using RBAC chain for complex permissions
router.post('/teachers',
  authenticateToken,
  createRBACChain({
    requiredRole: ROLES.ADMIN,
    endpointType: 'admin-only',
    validateSchool: true,
    validateResource: false
  }),
  auditLog('CREATE_TEACHER'),
  (req, res) => {
    res.json({ message: 'Teacher created successfully' });
  }
);

// Example 6: Using permission-based access
router.get('/analytics',
  authenticateToken,
  requirePermission('canAccessAnalytics'),
  (req, res) => {
    res.json({ message: 'Analytics data' });
  }
);

// Example 7: Multiple validation layers
router.put('/students/:studentId',
  authenticateToken,
  validateSchoolAccess,
  validateResourceOwnership('student'),
  auditLog('UPDATE_STUDENT'),
  (req, res) => {
    // The middleware chain ensures:
    // 1. User is authenticated
    // 2. User can only access their school's data
    // 3. User has permission to access this specific student
    // 4. Action is logged for audit purposes
    res.json({ message: 'Student updated successfully' });
  }
);

// Example 8: Error handling for RBAC failures
router.use((err, req, res, next) => {
  if (err.code === 'CROSS_SCHOOL_ACCESS_DENIED') {
    return res.status(403).json({
      success: false,
      message: 'You can only access data from your school',
      code: err.code
    });
  }
  
  if (err.code === 'RESOURCE_ACCESS_DENIED') {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to access this resource',
      code: err.code
    });
  }
  
  next(err);
});

module.exports = router;