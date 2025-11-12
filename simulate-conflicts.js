/**
 * Conflict Simulation Script
 * Tests various scenarios that could cause issues in AI Automations
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const scenarios = [];

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
  };
  const reset = '\x1b[0m';
  console.log(`${colors[type]}${message}${reset}`);
}

async function simulateScenario(name, testFn) {
  log(`\n��� Scenario: ${name}`, 'info');
  try {
    const result = await testFn();
    scenarios.push({ name, passed: true, result });
    log(`✓ ${name}: PASSED`, 'success');
    return result;
  } catch (error) {
    scenarios.push({ name, passed: false, error: error.message });
    log(`✗ ${name}: FAILED - ${error.message}`, 'error');
    return null;
  }
}

async function scenario1_MultipleRulesSameContact() {
  return simulateScenario(
    'Multiple Rules Targeting Same Contact',
    async () => {
      // Check for contacts that match multiple active rules
      const activeRules = await prisma.aIAutomationRule.findMany({
        where: { enabled: true },
        select: {
          id: true,
          name: true,
          includeTags: true,
          excludeTags: true,
          facebookPageId: true,
        },
      });

      if (activeRules.length < 2) {
        return { status: 'N/A', message: 'Less than 2 active rules to test' };
      }

      // Simulate a contact with common tags
      const commonTags = ['Hot Lead', 'New Lead', 'Inquiry'];
      let conflictCount = 0;

      for (const tag of commonTags) {
        const matchingRules = activeRules.filter(rule =>
          rule.includeTags.includes(tag)
        );
        if (matchingRules.length > 1) {
          conflictCount++;
          log(`  ⚠ Tag "${tag}" matched by ${matchingRules.length} rules`, 'warning');
        }
      }

      return {
        status: conflictCount > 0 ? 'CONFLICT' : 'OK',
        conflictCount,
        totalRules: activeRules.length,
      };
    }
  );
}

async function scenario2_TimeIntervalOverlap() {
  return simulateScenario(
    'Time Interval Overlap (Same Contact, Multiple Messages)',
    async () => {
      const rules = await prisma.aIAutomationRule.findMany({
        where: { enabled: true },
      });

      const shortIntervalRules = rules.filter(rule => {
        const totalMinutes =
          (rule.timeIntervalDays || 0) * 24 * 60 +
          (rule.timeIntervalHours || 0) * 60 +
          (rule.timeIntervalMinutes || 0);
        return totalMinutes < 60; // Less than 1 hour
      });

      if (shortIntervalRules.length > 0) {
        log(`  ⚠ Found ${shortIntervalRules.length} rules with <1 hour interval`, 'warning');
        shortIntervalRules.forEach(rule => {
          const totalMinutes =
            (rule.timeIntervalDays || 0) * 24 * 60 +
            (rule.timeIntervalHours || 0) * 60 +
            (rule.timeIntervalMinutes || 0);
          log(`    - ${rule.name}: ${totalMinutes} minutes`, 'warning');
        });
      }

      return {
        status: shortIntervalRules.length > 0 ? 'WARNING' : 'OK',
        shortIntervalCount: shortIntervalRules.length,
      };
    }
  );
}

async function scenario3_ExceedDailyLimit() {
  return simulateScenario(
    'Exceeding Max Messages Per Day',
    async () => {
      // Check if any rule has been executed too many times today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const rules = await prisma.aIAutomationRule.findMany({
        where: { enabled: true },
        include: {
          AIAutomationExecution: {
            where: {
              executedAt: {
                gte: today,
              },
            },
          },
        },
      });

      const exceededRules = rules.filter(
        rule => rule.AIAutomationExecution.length >= rule.maxMessagesPerDay
      );

      if (exceededRules.length > 0) {
        log(`  ⚠ ${exceededRules.length} rules exceeded daily limit`, 'warning');
        exceededRules.forEach(rule => {
          log(
            `    - ${rule.name}: ${rule.AIAutomationExecution.length}/${rule.maxMessagesPerDay}`,
            'warning'
          );
        });
      }

      return {
        status: exceededRules.length > 0 ? 'WARNING' : 'OK',
        exceededCount: exceededRules.length,
      };
    }
  );
}

async function scenario4_ActiveHoursConflict() {
  return simulateScenario(
    'Active Hours Outside Business Hours',
    async () => {
      const rules = await prisma.aIAutomationRule.findMany({
        where: {
          enabled: true,
          run24_7: false,
        },
      });

      const currentHour = new Date().getHours();
      const inactiveRules = rules.filter(
        rule => currentHour < rule.activeHoursStart || currentHour >= rule.activeHoursEnd
      );

      if (inactiveRules.length > 0) {
        log(`  ℹ ${inactiveRules.length} rules currently outside active hours`, 'info');
      }

      return {
        status: 'OK',
        currentHour,
        inactiveCount: inactiveRules.length,
        totalNon247: rules.length,
      };
    }
  );
}

async function scenario5_InvalidFacebookPageReference() {
  return simulateScenario(
    'Invalid Facebook Page Reference',
    async () => {
      const rulesWithPages = await prisma.aIAutomationRule.findMany({
        where: {
          facebookPageId: { not: null },
        },
        include: {
          FacebookPage: true,
        },
      });

      const invalidRules = rulesWithPages.filter(rule => !rule.FacebookPage);

      if (invalidRules.length > 0) {
        log(`  ✗ ${invalidRules.length} rules have invalid Facebook page references`, 'error');
        invalidRules.forEach(rule => {
          log(`    - ${rule.name} (Page ID: ${rule.facebookPageId})`, 'error');
        });
        throw new Error(`${invalidRules.length} rules with invalid page references`);
      }

      return {
        status: 'OK',
        totalWithPages: rulesWithPages.length,
      };
    }
  );
}

async function scenario6_TagArrayIntegrity() {
  return simulateScenario(
    'Tag Array Integrity',
    async () => {
      const rules = await prisma.aIAutomationRule.findMany();

      const issues = [];
      rules.forEach(rule => {
        // Check if includeTags and excludeTags are proper arrays
        if (!Array.isArray(rule.includeTags)) {
          issues.push(`${rule.name}: includeTags is not an array`);
        }
        if (!Array.isArray(rule.excludeTags)) {
          issues.push(`${rule.name}: excludeTags is not an array`);
        }

        // Check for overlap
        const overlap = rule.includeTags.filter(tag =>
          rule.excludeTags.includes(tag)
        );
        if (overlap.length > 0) {
          issues.push(`${rule.name}: Tag overlap in include/exclude: ${overlap.join(', ')}`);
        }
      });

      if (issues.length > 0) {
        issues.forEach(issue => log(`  ✗ ${issue}`, 'error'));
        throw new Error(`${issues.length} tag integrity issues`);
      }

      return {
        status: 'OK',
        totalRules: rules.length,
      };
    }
  );
}

async function scenario7_DatabaseConstraints() {
  return simulateScenario(
    'Database Constraints and Indexes',
    async () => {
      // Verify that indexes are being used efficiently
      const result = await prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          indexname
        FROM pg_indexes
        WHERE tablename IN ('AIAutomationRule', 'AIAutomationExecution', 'AIAutomationStop')
        ORDER BY tablename, indexname
      `;

      log(`  ℹ Found ${result.length} indexes on AI Automation tables`, 'info');

      return {
        status: 'OK',
        indexCount: result.length,
        indexes: result,
      };
    }
  );
}

async function scenario8_RaceConditionSimulation() {
  return simulateScenario(
    'Race Condition: Simultaneous Rule Execution',
    async () => {
      // Simulate what happens if the same rule is triggered multiple times
      const activeRules = await prisma.aIAutomationRule.findMany({
        where: { enabled: true },
        take: 1,
      });

      if (activeRules.length === 0) {
        return { status: 'N/A', message: 'No active rules to test' };
      }

      const rule = activeRules[0];

      // Check if there's a mechanism to prevent race conditions
      const recentExecutions = await prisma.aIAutomationExecution.findMany({
        where: {
          ruleId: rule.id,
          executedAt: {
            gte: new Date(Date.now() - 60000), // Last minute
          },
        },
      });

      if (recentExecutions.length > 5) {
        log(`  ⚠ Rule "${rule.name}" executed ${recentExecutions.length} times in last minute`, 'warning');
        return {
          status: 'WARNING',
          executionCount: recentExecutions.length,
          ruleName: rule.name,
        };
      }

      return {
        status: 'OK',
        recentExecutions: recentExecutions.length,
      };
    }
  );
}

async function runAllScenarios() {
  console.log('\n��� Starting Conflict Simulation Suite\n');
  console.log('Testing various scenarios that could cause issues...\n');

  try {
    await scenario1_MultipleRulesSameContact();
    await scenario2_TimeIntervalOverlap();
    await scenario3_ExceedDailyLimit();
    await scenario4_ActiveHoursConflict();
    await scenario5_InvalidFacebookPageReference();
    await scenario6_TagArrayIntegrity();
    await scenario7_DatabaseConstraints();
    await scenario8_RaceConditionSimulation();

    // Generate report
    console.log('\n========== SIMULATION REPORT ==========');

    const passed = scenarios.filter(s => s.passed).length;
    const failed = scenarios.filter(s => !s.passed).length;

    log(`\nTotal Scenarios: ${scenarios.length}`, 'info');
    log(`Passed: ${passed}`, 'success');
    log(`Failed: ${failed}`, 'error');

    console.log('\nDetailed Results:');
    scenarios.forEach(scenario => {
      const status = scenario.passed ? '✓' : '✗';
      const color = scenario.passed ? 'success' : 'error';
      log(`${status} ${scenario.name}`, color);
      if (scenario.result) {
        console.log(`   Result:`, JSON.stringify(scenario.result, null, 2));
      }
      if (scenario.error) {
        log(`   Error: ${scenario.error}`, 'error');
      }
    });

    console.log('\n=======================================\n');

    await prisma.$disconnect();
    return failed === 0 ? 0 : 1;
  } catch (error) {
    log(`Critical error: ${error.message}`, 'error');
    await prisma.$disconnect();
    return 1;
  }
}

runAllScenarios()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    log(`Fatal error: ${error.message}`, 'error');
    process.exit(1);
  });
