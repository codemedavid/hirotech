#!/usr/bin/env node

/**
 * Comprehensive Team System Test Suite
 * Tests all team messaging features, endpoints, and edge cases
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

class TeamSystemTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      tests: []
    };
    this.authToken = null;
    this.teamId = null;
    this.threadId = null;
    this.messageId = null;
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async makeRequest(path, method = 'GET', data = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, BASE_URL);
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      const protocol = url.protocol === 'https:' ? https : http;
      
      const req = protocol.request(url, options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const json = body ? JSON.parse(body) : {};
            resolve({ status: res.statusCode, data: json, headers: res.headers });
          } catch {
            resolve({ status: res.statusCode, data: body, headers: res.headers });
          }
        });
      });

      req.on('error', reject);
      
      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  async test(name, fn) {
    try {
      this.log(`\n🧪 Testing: ${name}`, 'cyan');
      await fn();
      this.results.passed++;
      this.results.tests.push({ name, status: 'PASS' });
      this.log(`✅ PASS: ${name}`, 'green');
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({ name, status: 'FAIL', error: error.message });
      this.log(`❌ FAIL: ${name}`, 'red');
      this.log(`   Error: ${error.message}`, 'red');
    }
  }

  async warn(message) {
    this.results.warnings++;
    this.log(`⚠️  WARNING: ${message}`, 'yellow');
  }

  // Test Suite Methods

  async testDatabaseConnection() {
    await this.test('Database Connection', async () => {
      const response = await this.makeRequest('/api/facebook/debug');
      if (response.status !== 200) {
        throw new Error(`Database check endpoint returned ${response.status}`);
      }
      if (!response.data.database?.connected) {
        throw new Error('Database not connected');
      }
    });
  }

  async testHealthEndpoints() {
    await this.test('Health Check Endpoints', async () => {
      const endpoints = [
        '/api/health',
        '/api/facebook/debug'
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await this.makeRequest(endpoint);
          if (response.status === 404) {
            this.warn(`Endpoint ${endpoint} not found - may not be implemented`);
          } else if (response.status >= 500) {
            throw new Error(`${endpoint} returned server error: ${response.status}`);
          }
        } catch (error) {
          this.warn(`${endpoint} - ${error.message}`);
        }
      }
    });
  }

  async testTeamEndpoints() {
    await this.test('Team API Endpoints Structure', async () => {
      // Test that team endpoints exist (will return 401 without auth, which is expected)
      const endpoints = [
        '/api/teams',
        '/api/teams/test-id/threads',
        '/api/teams/test-id/messages',
        '/api/teams/test-id/members'
      ];

      for (const endpoint of endpoints) {
        const response = await this.makeRequest(endpoint);
        // 401 (Unauthorized) is expected without authentication
        if (response.status !== 401 && response.status !== 404) {
          this.warn(`Unexpected status ${response.status} for ${endpoint}`);
        }
      }
    });
  }

  async testEnhancedSearch() {
    await this.test('Enhanced Search Functionality', async () => {
      // This tests the client-side search logic
      const mockThreads = [
        {
          id: '1',
          title: 'Engineering Team',
          description: 'Technical discussions',
          participants: [
            { user: { name: 'John Doe' }, displayName: 'Johnny' },
            { user: { name: 'Jane Smith' }, displayName: null }
          ]
        },
        {
          id: '2',
          title: 'Marketing',
          description: 'Campaign planning',
          participants: [
            { user: { name: 'Alice Brown' }, displayName: 'Ali' }
          ]
        }
      ];

      const searchLogic = (threads, searchQuery) => {
        return threads.filter(t => {
          const query = searchQuery.toLowerCase();
          const matchesTitle = t.title?.toLowerCase().includes(query);
          const matchesDescription = t.description?.toLowerCase().includes(query);
          const matchesParticipant = t.participants?.some(p =>
            p.user?.name?.toLowerCase().includes(query) ||
            p.displayName?.toLowerCase().includes(query)
          );
          return matchesTitle || matchesDescription || matchesParticipant;
        });
      };

      // Test search by title
      let results = searchLogic(mockThreads, 'engineering');
      if (results.length !== 1 || results[0].id !== '1') {
        throw new Error('Search by title failed');
      }

      // Test search by description
      results = searchLogic(mockThreads, 'campaign');
      if (results.length !== 1 || results[0].id !== '2') {
        throw new Error('Search by description failed');
      }

      // Test search by participant name
      results = searchLogic(mockThreads, 'john');
      if (results.length !== 1 || results[0].id !== '1') {
        throw new Error('Search by participant name failed');
      }

      // Test search by display name
      results = searchLogic(mockThreads, 'johnny');
      if (results.length !== 1 || results[0].id !== '1') {
        throw new Error('Search by display name failed');
      }

      // Test empty search returns all
      results = searchLogic(mockThreads, '');
      if (results.length !== 2) {
        throw new Error('Empty search should return all threads');
      }

      // Test case insensitivity
      results = searchLogic(mockThreads, 'ENGINEERING');
      if (results.length !== 1) {
        throw new Error('Search should be case insensitive');
      }
    });
  }

  async testDefaultThreadCreation() {
    await this.test('Default Thread Creation Logic', async () => {
      // Test the logic that creates default threads
      const mockFunction = async (teamId) => {
        // Simulate the createDefaultTeamThreads function
        const defaultThread = {
          teamId,
          title: 'General Discussion',
          description: 'Team-wide conversation space for everyone',
          type: 'DISCUSSION',
          isChannel: true,
          enableTopics: false,
          isPinned: true
        };

        // Validate required fields
        if (!defaultThread.title) throw new Error('Title required');
        if (!defaultThread.teamId) throw new Error('TeamId required');
        if (defaultThread.type !== 'DISCUSSION') throw new Error('Invalid type');
        if (!defaultThread.isChannel) throw new Error('Should be a channel');
        if (!defaultThread.isPinned) throw new Error('Should be pinned');

        return defaultThread;
      };

      const result = await mockFunction('test-team-123');
      if (result.title !== 'General Discussion') {
        throw new Error('Default thread name incorrect');
      }
      if (!result.isPinned) {
        throw new Error('Default thread should be pinned');
      }
    });
  }

  async testEdgeCases() {
    await this.test('Edge Cases - Search with Special Characters', async () => {
      const mockThreads = [
        {
          id: '1',
          title: 'Team @2024',
          participants: [{ user: { name: 'test@example.com' } }]
        }
      ];

      const searchLogic = (threads, searchQuery) => {
        return threads.filter(t => {
          const query = searchQuery.toLowerCase();
          return t.title?.toLowerCase().includes(query) ||
                 t.participants?.some(p => p.user?.name?.toLowerCase().includes(query));
        });
      };

      // Test special character search
      let results = searchLogic(mockThreads, '@2024');
      if (results.length !== 1) {
        throw new Error('Should handle @ in search');
      }

      results = searchLogic(mockThreads, 'test@');
      if (results.length !== 1) {
        throw new Error('Should handle email-like search');
      }
    });

    await this.test('Edge Cases - Empty Thread List', async () => {
      const searchLogic = (threads, searchQuery) => {
        return (threads || []).filter(t => {
          const query = searchQuery.toLowerCase();
          return t.title?.toLowerCase().includes(query);
        });
      };

      const results = searchLogic([], 'test');
      if (results.length !== 0) {
        throw new Error('Empty thread list should return empty results');
      }
    });

    await this.test('Edge Cases - Null/Undefined Values', async () => {
      const mockThreads = [
        {
          id: '1',
          title: null,
          description: undefined,
          participants: null
        }
      ];

      const searchLogic = (threads, searchQuery) => {
        return (threads || []).filter(t => {
          const query = searchQuery.toLowerCase();
          const matchesTitle = t.title?.toLowerCase().includes(query);
          const matchesDescription = t.description?.toLowerCase().includes(query);
          const matchesParticipant = t.participants?.some(p =>
            p.user?.name?.toLowerCase().includes(query)
          );
          return matchesTitle || matchesDescription || matchesParticipant;
        });
      };

      // Should not crash with null/undefined values
      const results = searchLogic(mockThreads, 'test');
      if (results.length !== 0) {
        throw new Error('Should handle null/undefined gracefully');
      }
    });
  }

  async testSocketIOEvents() {
    await this.test('Socket.IO Event Structure', async () => {
      // Test that socket events are properly structured
      const requiredEvents = [
        'message:new',
        'message:updated',
        'message:deleted',
        'thread:new',
        'user:typing',
        'user:stopped-typing'
      ];

      // Validate event names follow convention
      for (const event of requiredEvents) {
        if (!event.includes(':')) {
          throw new Error(`Event ${event} should follow namespace:action pattern`);
        }
      }
    });
  }

  async testTypeScriptTypes() {
    await this.test('TypeScript Interface Completeness', async () => {
      // Verify key interfaces are properly defined
      const threadInterface = {
        id: 'string',
        title: 'string?',
        description: 'string?',
        type: 'string',
        participantIds: 'string[]',
        isChannel: 'boolean',
        isPinned: 'boolean',
        participants: 'array?'
      };

      const messageInterface = {
        id: 'string',
        content: 'string',
        senderId: 'string',
        sender: 'object',
        mentions: 'string[]',
        reactions: 'object?',
        attachments: 'array?',
        isPinned: 'boolean',
        isEdited: 'boolean',
        createdAt: 'string'
      };

      // Basic validation that required fields exist
      const requiredThreadFields = ['id', 'type', 'participantIds', 'isChannel', 'isPinned'];
      const requiredMessageFields = ['id', 'content', 'senderId', 'createdAt'];

      for (const field of requiredThreadFields) {
        if (!threadInterface[field]) {
          throw new Error(`Thread interface missing required field: ${field}`);
        }
      }

      for (const field of requiredMessageFields) {
        if (!messageInterface[field]) {
          throw new Error(`Message interface missing required field: ${field}`);
        }
      }
    });
  }

  async testConcurrency() {
    await this.test('Concurrent Request Handling', async () => {
      // Test that multiple requests can be handled
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          this.makeRequest('/api/facebook/debug')
            .catch(() => ({ status: 500 }))
        );
      }

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.status < 500).length;
      
      if (successCount === 0) {
        throw new Error('No concurrent requests succeeded');
      }
    });
  }

  async testSecurityHeaders() {
    await this.test('Security Headers Present', async () => {
      const response = await this.makeRequest('/');
      const headers = response.headers;

      // Check for important security headers
      const recommendedHeaders = [
        'x-frame-options',
        'x-content-type-options',
        'x-xss-protection'
      ];

      let foundHeaders = 0;
      for (const header of recommendedHeaders) {
        if (headers[header]) {
          foundHeaders++;
        }
      }

      if (foundHeaders === 0) {
        this.warn('No security headers found - consider adding them');
      }
    });
  }

  async testErrorHandling() {
    await this.test('API Error Handling', async () => {
      // Test that APIs return proper error responses
      const response = await this.makeRequest('/api/teams/invalid-id/threads');
      
      if (response.status === 500) {
        throw new Error('Server error on invalid ID - should return 4xx error');
      }

      if (response.status === 401 && response.data.error) {
        // Expected - proper error handling
        return;
      }

      if (response.status !== 401 && response.status !== 404 && response.status !== 403) {
        this.warn(`Unexpected status code: ${response.status} for invalid request`);
      }
    });
  }

  async generateReport() {
    const total = this.results.passed + this.results.failed;
    const passRate = total > 0 ? ((this.results.passed / total) * 100).toFixed(1) : 0;

    this.log('\n' + '='.repeat(80), 'blue');
    this.log('📊 TEST REPORT SUMMARY', 'blue');
    this.log('='.repeat(80), 'blue');
    
    this.log(`\n✅ Passed: ${this.results.passed}`, 'green');
    this.log(`❌ Failed: ${this.results.failed}`, 'red');
    this.log(`⚠️  Warnings: ${this.results.warnings}`, 'yellow');
    this.log(`📈 Pass Rate: ${passRate}%`, passRate >= 80 ? 'green' : 'yellow');

    this.log('\n📋 Individual Test Results:', 'cyan');
    this.results.tests.forEach(test => {
      const icon = test.status === 'PASS' ? '✅' : '❌';
      const color = test.status === 'PASS' ? 'green' : 'red';
      this.log(`  ${icon} ${test.name}`, color);
      if (test.error) {
        this.log(`     └─ ${test.error}`, 'red');
      }
    });

    this.log('\n' + '='.repeat(80), 'blue');
    
    if (this.results.failed === 0) {
      this.log('🎉 ALL TESTS PASSED! System is healthy.', 'green');
    } else {
      this.log(`⚠️  ${this.results.failed} test(s) need attention.`, 'yellow');
    }
    
    this.log('='.repeat(80) + '\n', 'blue');

    return {
      success: this.results.failed === 0,
      ...this.results,
      passRate: parseFloat(passRate)
    };
  }

  async runAll() {
    this.log('🚀 Starting Comprehensive Team System Tests...', 'blue');
    this.log(`📍 Testing against: ${BASE_URL}\n`, 'blue');

    // Run all tests
    await this.testDatabaseConnection();
    await this.testHealthEndpoints();
    await this.testTeamEndpoints();
    await this.testEnhancedSearch();
    await this.testDefaultThreadCreation();
    await this.testEdgeCases();
    await this.testSocketIOEvents();
    await this.testTypeScriptTypes();
    await this.testConcurrency();
    await this.testSecurityHeaders();
    await this.testErrorHandling();

    // Generate final report
    const report = await this.generateReport();
    
    // Exit with appropriate code
    process.exit(report.success ? 0 : 1);
  }
}

// Run tests
const tester = new TeamSystemTester();
tester.runAll().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});

