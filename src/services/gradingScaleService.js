const { prisma } = require('../config/database');

class GradingScaleService {
  static async createScale(schoolId, data) {
    const { name, description, bands } = data;

    const scale = await prisma.gradingScale.create({
      data: {
        schoolId,
        name,
        description,
        bands: bands && bands.length > 0 ? {
          create: bands.map((b, i) => ({
            label: b.label,
            minPercent: b.minPercent,
            maxPercent: b.maxPercent,
            gradePoints: b.gradePoints ?? null,
            sortOrder: b.sortOrder ?? i
          }))
        } : undefined
      },
      include: { bands: { orderBy: { sortOrder: 'asc' } } }
    });

    return scale;
  }

  static async getScales(schoolId) {
    return prisma.gradingScale.findMany({
      where: { schoolId, isActive: true },
      include: { bands: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getScale(id, schoolId) {
    const scale = await prisma.gradingScale.findFirst({
      where: { id, schoolId },
      include: { bands: { orderBy: { sortOrder: 'asc' } } }
    });

    if (!scale) throw new Error('Grading scale not found');
    return scale;
  }

  static async updateScale(id, schoolId, data) {
    const { name, description } = data;

    const scale = await prisma.gradingScale.findFirst({
      where: { id, schoolId }
    });
    if (!scale) throw new Error('Grading scale not found');

    return prisma.gradingScale.update({
      where: { id },
      data: { ...(name && { name }), ...(description !== undefined && { description }) },
      include: { bands: { orderBy: { sortOrder: 'asc' } } }
    });
  }

  static async deleteScale(id, schoolId) {
    const scale = await prisma.gradingScale.findFirst({
      where: { id, schoolId }
    });
    if (!scale) throw new Error('Grading scale not found');

    return prisma.gradingScale.update({
      where: { id },
      data: { isActive: false }
    });
  }

  static async setDefaultScale(id, schoolId) {
    const scale = await prisma.gradingScale.findFirst({
      where: { id, schoolId }
    });
    if (!scale) throw new Error('Grading scale not found');

    await prisma.gradingScale.updateMany({
      where: { schoolId },
      data: { isDefault: false }
    });

    return prisma.gradingScale.update({
      where: { id },
      data: { isDefault: true },
      include: { bands: { orderBy: { sortOrder: 'asc' } } }
    });
  }

  static async addBand(scaleId, schoolId, data) {
    const scale = await prisma.gradingScale.findFirst({
      where: { id: scaleId, schoolId }
    });
    if (!scale) throw new Error('Grading scale not found');

    const { label, minPercent, maxPercent, gradePoints, sortOrder } = data;

    return prisma.gradeBand.create({
      data: {
        gradingScaleId: scaleId,
        label,
        minPercent,
        maxPercent,
        gradePoints: gradePoints ?? null,
        sortOrder: sortOrder ?? 0
      }
    });
  }

  static async updateBand(bandId, schoolId, data) {
    const band = await prisma.gradeBand.findUnique({
      where: { id: bandId },
      include: { gradingScale: true }
    });
    if (!band || band.gradingScale.schoolId !== schoolId) {
      throw new Error('Grade band not found');
    }

    const { label, minPercent, maxPercent, gradePoints, sortOrder } = data;

    return prisma.gradeBand.update({
      where: { id: bandId },
      data: {
        ...(label && { label }),
        ...(minPercent !== undefined && { minPercent }),
        ...(maxPercent !== undefined && { maxPercent }),
        ...(gradePoints !== undefined && { gradePoints }),
        ...(sortOrder !== undefined && { sortOrder })
      }
    });
  }

  static async deleteBand(bandId, schoolId) {
    const band = await prisma.gradeBand.findUnique({
      where: { id: bandId },
      include: { gradingScale: true }
    });
    if (!band || band.gradingScale.schoolId !== schoolId) {
      throw new Error('Grade band not found');
    }

    return prisma.gradeBand.delete({ where: { id: bandId } });
  }

  static async resolveGrade(percentage, schoolId) {
    if (percentage === null || percentage === undefined) return null;

    const defaultScale = await prisma.gradingScale.findFirst({
      where: { schoolId, isDefault: true, isActive: true },
      include: { bands: { orderBy: { sortOrder: 'asc' } } }
    });

    if (!defaultScale || !defaultScale.bands.length) return null;

    const matchedBand = defaultScale.bands.find(
      b => percentage >= b.minPercent && percentage <= b.maxPercent
    );

    if (!matchedBand) return null;

    return {
      label: matchedBand.label,
      gradePoints: matchedBand.gradePoints,
      gradingScaleId: defaultScale.id
    };
  }
}

module.exports = GradingScaleService;
