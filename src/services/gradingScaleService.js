const { prisma } = require('../config/database');
const logger = require('../utils/logger');

class GradingScaleService {
  static async createScale(schoolId, data) {
    const { name, description, isDefault, bands } = data;

    const existing = await prisma.gradingScale.findUnique({
      where: { schoolId_name: { schoolId, name } }
    });
    if (existing) {
      throw new Error('A grading scale with this name already exists in your school');
    }

    const scale = await prisma.gradingScale.create({
      data: {
        schoolId,
        name,
        description,
        isDefault: isDefault || false,
        bands: bands && bands.length > 0 ? {
          createMany: { data: bands.map(b => ({
            label: b.label,
            minPercent: b.minPercent,
            maxPercent: b.maxPercent,
            gradePoints: b.gradePoints,
            description: b.description
          })) }
        } : undefined
      },
      include: { bands: { orderBy: { minPercent: 'asc' } } }
    });

    if (scale.isDefault) {
      await this._setAsDefault(schoolId, scale.id);
    }

    logger.info(`Grading scale created: ${name} for school ${schoolId}`);
    return scale;
  }

  static async getScales(schoolId) {
    return prisma.gradingScale.findMany({
      where: { schoolId },
      include: { bands: { orderBy: { minPercent: 'asc' } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getScaleById(schoolId, scaleId) {
    const scale = await prisma.gradingScale.findFirst({
      where: { id: scaleId, schoolId },
      include: { bands: { orderBy: { minPercent: 'asc' } } }
    });
    if (!scale) throw new Error('Grading scale not found');
    return scale;
  }

  static async updateScale(schoolId, scaleId, data) {
    const scale = await prisma.gradingScale.findFirst({
      where: { id: scaleId, schoolId }
    });
    if (!scale) throw new Error('Grading scale not found');

    const { name, description, isDefault, bands } = data;

    if (name && name !== scale.name) {
      const existing = await prisma.gradingScale.findUnique({
        where: { schoolId_name: { schoolId, name } }
      });
      if (existing) throw new Error('A grading scale with this name already exists');
    }

    const updated = await prisma.gradingScale.update({
      where: { id: scaleId },
      data: {
        name: name || undefined,
        description: description !== undefined ? description : undefined,
        isDefault: isDefault !== undefined ? isDefault : undefined
      },
      include: { bands: { orderBy: { minPercent: 'asc' } } }
    });

    if (bands && bands.length > 0) {
      await prisma.gradeBand.deleteMany({ where: { gradingScaleId: scaleId } });
      await prisma.gradeBand.createMany({
        data: bands.map(b => ({
          gradingScaleId: scaleId,
          label: b.label,
          minPercent: b.minPercent,
          maxPercent: b.maxPercent,
          gradePoints: b.gradePoints,
          description: b.description
        }))
      });
      updated.bands = await prisma.gradeBand.findMany({
        where: { gradingScaleId: scaleId },
        orderBy: { minPercent: 'asc' }
      });
    }

    if (updated.isDefault) {
      await this._setAsDefault(schoolId, scaleId);
    }

    logger.info(`Grading scale updated: ${updated.name}`);
    return updated;
  }

  static async deleteScale(schoolId, scaleId) {
    const scale = await prisma.gradingScale.findFirst({
      where: { id: scaleId, schoolId }
    });
    if (!scale) throw new Error('Grading scale not found');

    if (scale.isDefault) {
      await prisma.school.update({
        where: { id: schoolId },
        data: { defaultGradingScaleId: null }
      });
    }

    await prisma.gradingScale.delete({ where: { id: scaleId } });
    logger.info(`Grading scale deleted: ${scale.name}`);
    return { success: true };
  }

  static async setDefaultScale(schoolId, scaleId) {
    const scale = await prisma.gradingScale.findFirst({
      where: { id: scaleId, schoolId }
    });
    if (!scale) throw new Error('Grading scale not found');

    await this._setAsDefault(schoolId, scaleId);
    return prisma.gradingScale.findUnique({
      where: { id: scaleId },
      include: { bands: { orderBy: { minPercent: 'asc' } } }
    });
  }

  static async addBand(schoolId, scaleId, data) {
    const scale = await prisma.gradingScale.findFirst({
      where: { id: scaleId, schoolId }
    });
    if (!scale) throw new Error('Grading scale not found');

    const band = await prisma.gradeBand.create({
      data: {
        gradingScaleId: scaleId,
        label: data.label,
        minPercent: data.minPercent,
        maxPercent: data.maxPercent,
        gradePoints: data.gradePoints,
        description: data.description
      }
    });

    logger.info(`Grade band added: ${data.label} to scale ${scale.name}`);
    return band;
  }

  static async updateBand(schoolId, bandId, data) {
    const band = await prisma.gradeBand.findUnique({
      where: { id: bandId },
      include: { gradingScale: true }
    });
    if (!band || band.gradingScale.schoolId !== schoolId) {
      throw new Error('Grade band not found');
    }

    const updated = await prisma.gradeBand.update({
      where: { id: bandId },
      data: {
        label: data.label !== undefined ? data.label : undefined,
        minPercent: data.minPercent !== undefined ? data.minPercent : undefined,
        maxPercent: data.maxPercent !== undefined ? data.maxPercent : undefined,
        gradePoints: data.gradePoints !== undefined ? data.gradePoints : undefined,
        description: data.description !== undefined ? data.description : undefined
      }
    });

    logger.info(`Grade band updated: ${updated.label}`);
    return updated;
  }

  static async deleteBand(schoolId, bandId) {
    const band = await prisma.gradeBand.findUnique({
      where: { id: bandId },
      include: { gradingScale: true }
    });
    if (!band || band.gradingScale.schoolId !== schoolId) {
      throw new Error('Grade band not found');
    }

    await prisma.gradeBand.delete({ where: { id: bandId } });
    logger.info(`Grade band deleted: ${band.label}`);
    return { success: true };
  }

  static async resolveGrade(schoolId, percentage) {
    if (percentage === null || percentage === undefined) return null;

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { defaultGradingScaleId: true }
    });

    if (!school?.defaultGradingScaleId) return null;

    const band = await prisma.gradeBand.findFirst({
      where: {
        gradingScaleId: school.defaultGradingScaleId,
        minPercent: { lte: percentage },
        maxPercent: { gte: percentage }
      },
      orderBy: { minPercent: 'desc' }
    });

    return band ? { label: band.label, gradePoints: band.gradePoints } : null;
  }

  static async _setAsDefault(schoolId, scaleId) {
    await prisma.gradingScale.updateMany({
      where: { schoolId, isDefault: true, id: { not: scaleId } },
      data: { isDefault: false }
    });
    await prisma.school.update({
      where: { id: schoolId },
      data: { defaultGradingScaleId: scaleId }
    });
  }
}

module.exports = GradingScaleService;
