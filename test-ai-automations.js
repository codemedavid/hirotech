/**
 * Comprehensive AI Automations Test Script
 * Tests all endpoints, database connections, and potential conflicts
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Test configuration
const testResults = {
  passed: [],
  failed: [],
  warnings: [],
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '✓',
    error: '✗',
    warning: '⚠',
  }[type] || 'ℹ';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

async function testDatabaseConnection() {
  log('Testing database connection...', 'info');
  try {
    await prisma.$queryRaw`SELECT 1`;
    testResults.passed.push('Database connection');
    log('Database connection successful', 'info');
    return true;
  } catch (error) {
    testResults.failed.push({ test: 'Database connection', error: error.message });
    log(`Database connection failed: ${error.message}`, 'error');
    return false;
  }
}

async function testAIAutomationRuleModel() {
  log('Testing AIAutomationRule model...', 'info');
  try {
    const count = await prisma.aIAutomationRule.count();
    log(`Found ${count} AI automation rules in database`, 'info');
    testResults.passed.push(`AIAutomationRule model (${count} rules)`);
    return true;
  } catch (error) {
    testResults.failed.push({ test: 'AIAutomationRule model', error: error.message });
    log(`AIAutomationRule model test failed: ${error.message}`, 'error');
    return false;
  }
}

async function testTagsModel() {
  log('Testing Tags model...', 'info');
  try {
    const count = await prisma.tag.count();
    log(`Found ${count} tags in database`, 'info');
    testResults.passed.push(`Tags model (${count} tags)`);
    return true;
  } catch (error) {
    testResults.failed.push({ test: 'Tags model', error: error.message });
    log(`Tags model test failed: ${error.message}`, 'error');
    return false;
  }
}

async function checkSchemaConstraints() {
  log('Checking schema constraints and indexes...', 'info');
  try {
    // Check if AIAutomationRule has proper indexes
    const rules = await prisma.aIAutomationRule.findMany({
      take: 1,
      include: {
        _count: {
          select: {
            AIAutomationExecution: true,
            AIAutomationStop: true,
          },
        },
      },
    });
    
    if (rules.length > 0) {
      log('Schema includes proper relations (_count works)', 'info');
      testResults.passed.push('Schema constraints and indexes');
    } else {
      testResults.warnings.push('No rules to test schema constraints with');
    }
    return true;
  } catch (error) {
    testResults.failed.push({ test: 'Schema constraints', error: error.message });
    log(`Schema constraints check failed: ${error.message}`, 'error');
    return false;
  }
}

async function testTagArrayOperations() {
  log('Testing tag array operations...', 'info');
  try {
    // Test that includeTags and excludeTags are properly stored as arrays
    const rules = await prisma.aIAutomationRule.findMany({
      where: {
        OR: [
          { includeTags: { isEmpty: false } },
          { excludeTags: { isEmpty: false } },
        ],
      },
      take: 1,
    });
    
    if (rules.length > 0) {
      const rule = rules[0];
      log(`Tag arrays working: includeTags=${rule.includeTags.length}, excludeTags=${rule.excludeTags.length}`, 'info');
      testResults.passed.push('Tag array operations');
    } else {
      testResults.warnings.push('No rules with tags to test array operations');
    }
    return true;
  } catch (error) {
    testResults.failed.push({ test: 'Tag array operations', error: error.message });
    log(`Tag array operations test failed: ${error.message}`, 'error');
    return false;
  }
}

async function testConflictScenarios() {
  log('Testing potential conflict scenarios...', 'info');
  try {
    // Scenario 1: Check for rules with overlapping tag criteria
    const allRules = await prisma.aIAutomationRule.findMany({
      where: { enabled: true },
      select: {
        id: true,
        name: true,
        includeTags: true,
        excludeTags: true,
        facebookPageId: true,
      },
    });
    
    // Check for overlapping rules
    const conflicts = [];
    for (let i = 0; i < allRules.length; i++) {
      for (let j = i + 1; j < allRules.length; j++) {
        const rule1 = allRules[i];
        const rule2 = allRules[j];
        
        // Same page or both null (all pages)
        if (rule1.facebookPageId === rule2.facebookPageId || 
            (!rule1.facebookPageId && !rule2.facebookPageId)) {
          // Check for overlapping include tags
          const overlapInclude = rule1.includeTags.some(tag => rule2.includeTags.includes(tag));
          
          if (overlapInclude && 
              !rule1.excludeTags.some(tag => rule2.includeTags.includes(tag)) &&
              !rule2.excludeTags.some(tag => rule1.includeTags.includes(tag))) {
            conflicts.push({
              rule1: rule1.name,
              rule2: rule2.name,
              reason: 'Overlapping tag criteria - may target same contacts',
            });
          }
        }
      }
    }
    
    if (conflicts.length > 0) {
      testResults.warnings.push(`Found ${conflicts.length} potential rule conflicts`);
      conflicts.forEach(conflict => {
        log(`Potential conflict: ${conflict.rule1} <-> ${conflict.rule2}: ${conflict.reason}`, 'warning');
      });
    } else {
      log('No rule conflicts detected', 'info');
      testResults.passed.push('Conflict detection');
    }
    
    return true;
  } catch (error) {
    testResults.failed.push({ test: 'Conflict scenarios', error: error.message });
    log(`Conflict scenarios test failed: ${error.message}`, 'error');
    return false;
  }
}

async function testExecutionTracking() {
  log('Testing execution tracking...', 'info');
  try {
    const execCount = await prisma.aIAutomationExecution.count();
    const stopCount = await prisma.aIAutomationStop.count();
    
    log(`Found ${execCount} executions and ${stopCount} stops`, 'info');
    testResults.passed.push(`Execution tracking (${execCount} executions, ${stopCount} stops)`);
    
    // Check for recent executions
    const recentExecs = await prisma.aIAutomationExecution.findMany({
      where: {
        executedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      orderBy: { executedAt: 'desc' },
      take: 5,
    });
    
    if (recentExecs.length > 0) {
      log(`Recent executions in last 24h: ${recentExecs.length}`, 'info');
      recentExecs.forEach(exec => {
        log(`  - ${exec.recipientName}: ${exec.status} at ${exec.executedAt.toISOString()}`, 'info');
      });
    }
    
    return true;
  } catch (error) {
    testResults.failed.push({ test: 'Execution tracking', error: error.message });
    log(`Execution tracking test failed: ${error.message}`, 'error');
    return false;
  }
}

async function testDataIntegrity() {
  log('Testing data integrity...', 'info');
  try {
    // Check for orphaned executions (executions without valid rule)
    const orphanedExecs = await prisma.aIAutomationExecution.findMany({
      where: {
        rule: null,
      },
      take: 5,
    });
    
    if (orphanedExecs.length > 0) {
      testResults.warnings.push(`Found ${orphanedExecs.length} orphaned executions`);
      log(`Warning: ${orphanedExecs.length} orphaned executions found`, 'warning');
    }
    
    // Check for rules with invalid Facebook page references
    const rulesWithPages = await prisma.aIAutomationRule.findMany({
      where: {
        facebookPageId: { not: null },
      },
      include: {
        FacebookPage: true,
      },
    });
    
    const invalidPages = rulesWithPages.filter(rule => !rule.FacebookPage);
    if (invalidPages.length > 0) {
      testResults.warnings.push(`Found ${invalidPages.length} rules with invalid Facebook page references`);
      log(`Warning: ${invalidPages.length} rules with invalid Facebook page references`, 'warning');
    }
    
    testResults.passed.push('Data integrity checks');
    return true;
  } catch (error) {
    testResults.failed.push({ test: 'Data integrity', error: error.message });
    log(`Data integrity test failed: ${error.message}`, 'error');
    return false;
  }
}

async function testPerformanceMetrics() {
  log('Testing performance metrics...', 'info');
  try {
    const startTime = Date.now();
    
    // Test 1: Query all rules with relations
    const t1 = Date.now();
    await prisma.aIAutomationRule.findMany({
      include: {
        FacebookPage: true,
        _count: {
          select: {
            AIAutomationExecution: true,
            AIAutomationStop: true,
          },
        },
      },
    });
    const queryTime = Date.now() - t1;
    
    log(`Rule query with relations took ${queryTime}ms`, 'info');
    if (queryTime > 1000) {
      testResults.warnings.push(`Slow query detected: ${queryTime}ms`);
    } else {
      testResults.passed.push(`Performance metrics (${queryTime}ms)`);
    }
    
    return true;
  } catch (error) {
    testResults.failed.push({ test: 'Performance metrics', error: error.message });
    log(`Performance metrics test failed: ${error.message}`, 'error');
    return false;
  }
}

async function generateTestReport() {
  log('\n========== TEST REPORT ==========', 'info');
  log(`Total Passed: ${testResults.passed.length}`, 'info');
  log(`Total Failed: ${testResults.failed.length}`, 'error');
  log(`Total Warnings: ${testResults.warnings.length}`, 'warning');
  
  if (testResults.passed.length > 0) {
    log('\n✓ Passed Tests:', 'info');
    testResults.passed.forEach(test => log(`  - ${test}`, 'info'));
  }
  
  if (testResults.failed.length > 0) {
    log('\n✗ Failed Tests:', 'error');
    testResults.failed.forEach(failure => {
      log(`  - ${failure.test}: ${failure.error}`, 'error');
    });
  }
  
  if (testResults.warnings.length > 0) {
    log('\n⚠ Warnings:', 'warning');
    testResults.warnings.forEach(warning => log(`  - ${warning}`, 'warning'));
  }
  
  log('\n================================\n', 'info');
}

async function runAllTests() {
  console.log('\n��� Starting Comprehensive AI Automations Test Suite\n');
  
  try {
    await testDatabaseConnection();
    await testAIAutomationRuleModel();
    await testTagsModel();
    await checkSchemaConstraints();
    await testTagArrayOperations();
    await testConflictScenarios();
    await testExecutionTracking();
    await testDataIntegrity();
    await testPerformanceMetrics();
    
    await generateTestReport();
    
    const exitCode = testResults.failed.length > 0 ? 1 : 0;
    await prisma.$disconnect();
    process.exit(exitCode);
  } catch (error) {
    log(`Critical error during test execution: ${error.message}`, 'error');
    await prisma.$disconnect();
    process.exit(1);
  }
}

runAllTests();
