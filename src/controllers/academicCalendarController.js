/**
 * Academic Calendar Controller
 * Handles academic year, term, and calendar event management
 */

const { prisma } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Academic Year Management
 */

/**
 * Create academic years
 * POST /api/admin/academic/years
 */
const createAcademicYears = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { years } = req.body;

    if (!years || !Array.isArray(years) || years.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Years array is required and cannot be empty'
      });
    }

    const validationErrors = [];
    const validYears = [];

    for (let i = 0; i < years.length; i++) {
      const yearData = years[i];
      
      if (!yearData.year || !yearData.startDate || !yearData.endDate) {
        validationErrors.push(`Year at index ${i}: year, startDate, and endDate are required`);
        continue;
      }

      // Validate date logic
      const startDate = new Date(yearData.startDate);
      const endDate = new Date(yearData.endDate);
      
      if (startDate >= endDate) {
        validationErrors.push(`Year at index ${i}: startDate must be before endDate`);
        continue;
      }

      validYears.push({
        schoolId,
        year: yearData.year,
        name: yearData.name || `${yearData.year} Academic Year`,
        startDate,
        endDate,
        isCurrent: yearData.isCurrent || false
      });
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: validationErrors
      });
    }

    // Check for duplicate years within the school
    const existingYears = await prisma.academicYear.findMany({
      where: {
        schoolId,
        year: {
          in: validYears.map(y => y.year)
        }
      },
      select: { year: true }
    });

    if (existingYears.length > 0) {
      const duplicates = existingYears.map(y => y.year);
      return res.status(409).json({
        success: false,
        message: 'Academic years with these identifiers already exist',
        duplicates
      });
    }

    // If any year is marked as current, unset other current years
    const hasCurrentYear = validYears.some(y => y.isCurrent);
    if (hasCurrentYear) {
      await prisma.academicYear.updateMany({
        where: { schoolId, isCurrent: true },
        data: { isCurrent: false }
      });
    }

    // Create academic years
    const createdYears = await prisma.academicYear.createMany({
      data: validYears,
      skipDuplicates: false
    });

    // Fetch the created years with their IDs
    const newYears = await prisma.academicYear.findMany({
      where: {
        schoolId,
        year: {
          in: validYears.map(y => y.year)
        }
      },
      select: {
        id: true,
        year: true,
        name: true,
        startDate: true,
        endDate: true,
        isActive: true,
        isCurrent: true,
        createdAt: true
      }
    });

    logger.info(`Created ${createdYears.count} academic years for school ${schoolId}`);

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdYears.count} academic years`,
      data: {
        years: newYears
      }
    });
  } catch (error) {
    logger.error('Error creating academic years:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create academic years',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get academic years
 * GET /api/academic/years
 */
const getAcademicYears = async (req, res) => {
  try {
    const { schoolId } = req.user;

    const years = await prisma.academicYear.findMany({
      where: { schoolId },
      select: {
        id: true,
        year: true,
        name: true,
        startDate: true,
        endDate: true,
        isActive: true,
        isCurrent: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            terms: true
          }
        }
      },
      orderBy: [
        { isCurrent: 'desc' },
        { year: 'desc' }
      ]
    });

    logger.info(`Retrieved ${years.length} academic years for school ${schoolId}`);

    res.json({
      success: true,
      data: {
        years: years.map(year => ({
          id: year.id,
          year: year.year,
          name: year.name,
          startDate: year.startDate,
          endDate: year.endDate,
          isActive: year.isActive,
          isCurrent: year.isCurrent,
          termCount: year._count.terms,
          createdAt: year.createdAt,
          updatedAt: year.updatedAt
        }))
      }
    });
  } catch (error) {
    logger.error('Error fetching academic years:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch academic years',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Set current academic year
 * PUT /api/admin/academic/years/:yearId/current
 */
const setCurrentAcademicYear = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { yearId } = req.params;

    // Check if year exists and belongs to the school
    const year = await prisma.academicYear.findFirst({
      where: { id: yearId, schoolId }
    });

    if (!year) {
      return res.status(404).json({
        success: false,
        message: 'Academic year not found'
      });
    }

    // Unset all other current years
    await prisma.academicYear.updateMany({
      where: { schoolId, isCurrent: true },
      data: { isCurrent: false }
    });

    // Set this year as current
    const updatedYear = await prisma.academicYear.update({
      where: { id: yearId },
      data: { isCurrent: true }
    });

    logger.info(`Set academic year ${yearId} as current for school ${schoolId}`);

    res.json({
      success: true,
      message: 'Current academic year updated successfully',
      data: {
        year: {
          id: updatedYear.id,
          year: updatedYear.year,
          name: updatedYear.name,
          isCurrent: updatedYear.isCurrent
        }
      }
    });
  } catch (error) {
    logger.error('Error setting current academic year:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set current academic year',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Academic Term Management
 */

/**
 * Create academic terms
 * POST /api/admin/academic/terms
 */
const createAcademicTerms = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { terms } = req.body;

    if (!terms || !Array.isArray(terms) || terms.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Terms array is required and cannot be empty'
      });
    }

    const validationErrors = [];
    const validTerms = [];

    for (let i = 0; i < terms.length; i++) {
      const termData = terms[i];
      
      if (!termData.academicYearId || !termData.term || !termData.startDate || !termData.endDate) {
        validationErrors.push(`Term at index ${i}: academicYearId, term, startDate, and endDate are required`);
        continue;
      }

      // Validate date logic
      const startDate = new Date(termData.startDate);
      const endDate = new Date(termData.endDate);
      
      if (startDate >= endDate) {
        validationErrors.push(`Term at index ${i}: startDate must be before endDate`);
        continue;
      }

      // Verify academic year belongs to school
      const academicYear = await prisma.academicYear.findFirst({
        where: { id: termData.academicYearId, schoolId }
      });

      if (!academicYear) {
        validationErrors.push(`Term at index ${i}: Academic year not found`);
        continue;
      }

      validTerms.push({
        schoolId,
        academicYearId: termData.academicYearId,
        name: termData.name || `${termData.term}`,
        term: termData.term,
        startDate,
        endDate,
        isCurrent: termData.isCurrent || false
      });
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: validationErrors
      });
    }

    // Check for duplicate terms within academic year
    const existingTerms = await prisma.academicTerm.findMany({
      where: {
        schoolId,
        OR: validTerms.map(t => ({
          academicYearId: t.academicYearId,
          term: t.term
        }))
      },
      select: { academicYearId: true, term: true }
    });

    if (existingTerms.length > 0) {
      const duplicates = existingTerms.map(t => `Year: ${t.academicYearId}, Term: ${t.term}`);
      return res.status(409).json({
        success: false,
        message: 'Terms already exist for these academic years',
        duplicates
      });
    }

    // If any term is marked as current, unset other current terms
    const hasCurrentTerm = validTerms.some(t => t.isCurrent);
    if (hasCurrentTerm) {
      await prisma.academicTerm.updateMany({
        where: { schoolId, isCurrent: true },
        data: { isCurrent: false }
      });
    }

    // Create academic terms
    const createdTerms = await prisma.academicTerm.createMany({
      data: validTerms,
      skipDuplicates: false
    });

    // Fetch the created terms with their IDs
    const newTerms = await prisma.academicTerm.findMany({
      where: {
        schoolId,
        OR: validTerms.map(t => ({
          academicYearId: t.academicYearId,
          term: t.term
        }))
      },
      include: {
        academicYear: {
          select: { id: true, year: true, name: true }
        }
      }
    });

    logger.info(`Created ${createdTerms.count} academic terms for school ${schoolId}`);

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdTerms.count} academic terms`,
      data: {
        terms: newTerms
      }
    });
  } catch (error) {
    logger.error('Error creating academic terms:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create academic terms',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get academic terms
 * GET /api/academic/terms
 */
const getAcademicTerms = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { academicYearId } = req.query;

    const whereClause = { schoolId };
    if (academicYearId) {
      whereClause.academicYearId = academicYearId;
    }

    const terms = await prisma.academicTerm.findMany({
      where: whereClause,
      include: {
        academicYear: {
          select: { id: true, year: true, name: true }
        }
      },
      orderBy: [
        { isCurrent: 'desc' },
        { academicYear: { year: 'desc' } },
        { term: 'asc' }
      ]
    });

    logger.info(`Retrieved ${terms.length} academic terms for school ${schoolId}`);

    res.json({
      success: true,
      data: {
        terms: terms.map(term => ({
          id: term.id,
          name: term.name,
          term: term.term,
          startDate: term.startDate,
          endDate: term.endDate,
          isActive: term.isActive,
          isCurrent: term.isCurrent,
          academicYear: term.academicYear,
          createdAt: term.createdAt,
          updatedAt: term.updatedAt
        }))
      }
    });
  } catch (error) {
    logger.error('Error fetching academic terms:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch academic terms',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Set current academic term
 * PUT /api/admin/academic/terms/:termId/current
 */
const setCurrentAcademicTerm = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { termId } = req.params;

    // Check if term exists and belongs to the school
    const term = await prisma.academicTerm.findFirst({
      where: { id: termId, schoolId },
      include: {
        academicYear: {
          select: { id: true, year: true }
        }
      }
    });

    if (!term) {
      return res.status(404).json({
        success: false,
        message: 'Academic term not found'
      });
    }

    // Unset all other current terms
    await prisma.academicTerm.updateMany({
      where: { schoolId, isCurrent: true },
      data: { isCurrent: false }
    });

    // Set this term as current
    const updatedTerm = await prisma.academicTerm.update({
      where: { id: termId },
      data: { isCurrent: true }
    });

    logger.info(`Set academic term ${termId} as current for school ${schoolId}`);

    res.json({
      success: true,
      message: 'Current academic term updated successfully',
      data: {
        term: {
          id: updatedTerm.id,
          name: updatedTerm.name,
          term: updatedTerm.term,
          isCurrent: updatedTerm.isCurrent,
          academicYear: term.academicYear
        }
      }
    });
  } catch (error) {
    logger.error('Error setting current academic term:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set current academic term',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get current academic period
 * GET /api/academic/current
 */
const getCurrentAcademicPeriod = async (req, res) => {
  try {
    const { schoolId } = req.user;

    const [currentYear, currentTerm] = await Promise.all([
      prisma.academicYear.findFirst({
        where: { schoolId, isCurrent: true },
        select: {
          id: true,
          year: true,
          name: true,
          startDate: true,
          endDate: true
        }
      }),
      prisma.academicTerm.findFirst({
        where: { schoolId, isCurrent: true },
        include: {
          academicYear: {
            select: { id: true, year: true, name: true }
          }
        }
      })
    ]);

    logger.info(`Retrieved current academic period for school ${schoolId}`);

    res.json({
      success: true,
      data: {
        currentYear,
        currentTerm
      }
    });
  } catch (error) {
    logger.error('Error fetching current academic period:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch current academic period',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  // Academic Year Management
  createAcademicYears,
  getAcademicYears,
  setCurrentAcademicYear,
  
  // Academic Term Management
  createAcademicTerms,
  getAcademicTerms,
  setCurrentAcademicTerm,
  
  // Current Period
  getCurrentAcademicPeriod
};
