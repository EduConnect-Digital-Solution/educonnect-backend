/**
 * Simple test to identify dashboard cache issue
 * Tests the current state of invitations and dashboard data
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models and services
const Invitation = require('./src/models/Invitation');
const DashboardService = require('./src/services/dashboardService');

async function testDashboardCache() {
  try {
    console.log('🔧 Starting dashboard cache test...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');

    // Get the most recent school ID
    const School = require('./src/models/School');
    const school = await School.findOne({ isActive: true }).sort({ createdAt: -1 });
    
    if (!school) {
      console.log('❌ No active school found');
      return;
    }

    const schoolId = school.schoolId;
    console.log(`📊 Testing with school: ${schoolId} (${school.schoolName})`);

    // 1. Check raw invitation data from database
    console.log('\n--- RAW DATABASE DATA ---');
    const rawInvitations = await Invitation.find({ schoolId }).sort({ createdAt: -1 });
    console.log(`Total invitations in DB: ${rawInvitations.length}`);
    
    rawInvitations.forEach((inv, index) => {
      console.log(`${index + 1}. ${inv.email} - Status: ${inv.status} - Created: ${inv.createdAt.toISOString()}`);
      if (inv.cancelledAt) {
        console.log(`   ↳ Cancelled at: ${inv.cancelledAt.toISOString()}`);
      }
    });

    // 2. Check invitation aggregation stats
    console.log('\n--- INVITATION STATS ---');
    const invitationStats = await Invitation.aggregate([
      { $match: { schoolId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    console.log('Invitation stats from aggregation:', invitationStats);

    // 3. Check dashboard service data
    console.log('\n--- DASHBOARD SERVICE DATA ---');
    const dashboardData = await DashboardService.getDashboardAnalytics(schoolId);
    console.log('Dashboard invitation statistics:', dashboardData.invitationStatistics);
    console.log('Dashboard overview:', dashboardData.overview);

    // 4. Check if there's a mismatch
    console.log('\n--- ANALYSIS ---');
    const dbPending = rawInvitations.filter(inv => inv.status === 'pending').length;
    const dbCancelled = rawInvitations.filter(inv => inv.status === 'cancelled').length;
    const dashboardPending = dashboardData.invitationStatistics.byStatus.pending;
    const dashboardCancelled = dashboardData.invitationStatistics.byStatus.cancelled;

    console.log(`DB Pending: ${dbPending}, Dashboard Pending: ${dashboardPending}`);
    console.log(`DB Cancelled: ${dbCancelled}, Dashboard Cancelled: ${dashboardCancelled}`);

    if (dbPending !== dashboardPending || dbCancelled !== dashboardCancelled) {
      console.log('❌ MISMATCH DETECTED! Dashboard data does not match database data.');
    } else {
      console.log('✅ Dashboard data matches database data.');
    }

    // 5. Check recent invitations
    console.log('\n--- RECENT INVITATIONS ---');
    const recentInvitations = dashboardData.recentActivity.invitations;
    console.log(`Recent invitations count: ${recentInvitations.length}`);
    recentInvitations.forEach((inv, index) => {
      console.log(`${index + 1}. ${inv.email} - Status: ${inv.status} - Created: ${inv.createdAt}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    // Disconnect from database
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the test
testDashboardCache();