/**
 * Pipeline Validation Utilities
 * Input validation and business rule enforcement
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate lead score range
 */
export function validateScoreRange(
  leadScoreMin: number,
  leadScoreMax: number
): ValidationResult {
  const errors: string[] = [];

  // Check if numbers are valid
  if (typeof leadScoreMin !== 'number' || typeof leadScoreMax !== 'number') {
    errors.push('Lead scores must be numbers');
  }

  // Check bounds
  if (leadScoreMin < 0 || leadScoreMin > 100) {
    errors.push('leadScoreMin must be between 0 and 100');
  }

  if (leadScoreMax < 0 || leadScoreMax > 100) {
    errors.push('leadScoreMax must be between 0 and 100');
  }

  // Check logical order
  if (leadScoreMin > leadScoreMax) {
    errors.push('leadScoreMin must be less than or equal to leadScoreMax');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate array of contact IDs
 */
export function validateContactIds(contactIds: unknown): ValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(contactIds)) {
    errors.push('contactIds must be an array');
    return { valid: false, errors };
  }

  if (contactIds.length === 0) {
    errors.push('contactIds array cannot be empty');
  }

  if (contactIds.length > 1000) {
    errors.push('contactIds array cannot exceed 1000 items (use batch processing)');
  }

  // Check if all items are strings
  const invalidIds = contactIds.filter((id) => typeof id !== 'string');
  if (invalidIds.length > 0) {
    errors.push('All contactIds must be strings');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate array of pipeline IDs
 */
export function validatePipelineIds(pipelineIds: unknown): ValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(pipelineIds)) {
    errors.push('pipelineIds must be an array');
    return { valid: false, errors };
  }

  if (pipelineIds.length === 0) {
    errors.push('pipelineIds array cannot be empty');
  }

  if (pipelineIds.length > 100) {
    errors.push('pipelineIds array cannot exceed 100 items');
  }

  // Check if all items are strings
  const invalidIds = pipelineIds.filter((id) => typeof id !== 'string');
  if (invalidIds.length > 0) {
    errors.push('All pipelineIds must be strings');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate pipeline name
 */
export function validatePipelineName(name: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof name !== 'string') {
    errors.push('Pipeline name must be a string');
    return { valid: false, errors };
  }

  const trimmedName = name.trim();

  if (trimmedName.length === 0) {
    errors.push('Pipeline name cannot be empty');
  }

  if (trimmedName.length > 100) {
    errors.push('Pipeline name cannot exceed 100 characters');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate stage order
 */
export function validateStageOrder(order: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof order !== 'number') {
    errors.push('Stage order must be a number');
    return { valid: false, errors };
  }

  if (order < 0) {
    errors.push('Stage order cannot be negative');
  }

  if (!Number.isInteger(order)) {
    errors.push('Stage order must be an integer');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check for overlapping score ranges in a pipeline
 */
export function detectScoreRangeOverlaps(
  stages: Array<{
    id: string;
    name: string;
    leadScoreMin: number;
    leadScoreMax: number;
    type: string;
  }>
): Array<{
  stage1: string;
  stage2: string;
  overlap: string;
}> {
  const overlaps: Array<{
    stage1: string;
    stage2: string;
    overlap: string;
  }> = [];

  // Only check overlaps for stages that aren't WON/LOST/ARCHIVED
  const activeStages = stages.filter(
    (s) => s.type !== 'WON' && s.type !== 'LOST' && s.type !== 'ARCHIVED'
  );

  for (let i = 0; i < activeStages.length; i++) {
    for (let j = i + 1; j < activeStages.length; j++) {
      const stage1 = activeStages[i];
      const stage2 = activeStages[j];

      // Check if ranges overlap
      const overlaps1 =
        stage1.leadScoreMin <= stage2.leadScoreMax &&
        stage1.leadScoreMax >= stage2.leadScoreMin;

      if (overlaps1) {
        const overlapStart = Math.max(stage1.leadScoreMin, stage2.leadScoreMin);
        const overlapEnd = Math.min(stage1.leadScoreMax, stage2.leadScoreMax);

        overlaps.push({
          stage1: stage1.name,
          stage2: stage2.name,
          overlap: `${overlapStart}-${overlapEnd}`,
        });
      }
    }
  }

  return overlaps;
}

/**
 * Sanitize user input (prevent XSS, SQL injection)
 * Note: Prisma already prevents SQL injection, but this adds extra safety
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
}

/**
 * Validate hex color code
 */
export function validateColor(color: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof color !== 'string') {
    errors.push('Color must be a string');
    return { valid: false, errors };
  }

  const hexColorRegex = /^#[0-9A-F]{6}$/i;
  if (!hexColorRegex.test(color)) {
    errors.push('Color must be a valid hex color code (e.g., #3b82f6)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

