/**
 * Fallback Scoring System
 * Provides intelligent lead scores when AI analysis fails
 * Prevents contacts from having 0 scores
 */

interface Message {
  from: string;
  text: string;
  timestamp?: Date;
}

interface FallbackScore {
  leadScore: number;
  leadStatus: string;
  reasoning: string;
  confidence: number;
}

/**
 * Calculate fallback lead score based on conversation characteristics
 * This prevents contacts from having 0 scores when AI fails
 */
export function calculateFallbackScore(
  messages: Message[],
  conversationAge?: Date
): FallbackScore {
  
  if (!messages || messages.length === 0) {
    return {
      leadScore: 15, // Minimum score for contacts with no conversation
      leadStatus: 'NEW',
      reasoning: 'No conversation data available - assigned minimum score',
      confidence: 50
    };
  }

  let score = 20; // Base score (better than 0)
  const factors: string[] = [];

  // Factor 1: Message count (shows engagement)
  const messageCount = messages.length;
  if (messageCount >= 20) {
    score += 25;
    factors.push('high message count (20+)');
  } else if (messageCount >= 10) {
    score += 15;
    factors.push('moderate message count (10-19)');
  } else if (messageCount >= 5) {
    score += 10;
    factors.push('some messages (5-9)');
  } else {
    score += 5;
    factors.push('few messages (<5)');
  }

  // Factor 2: Message length (shows serious interest)
  const avgMessageLength = messages.reduce((sum, msg) => sum + msg.text.length, 0) / messages.length;
  if (avgMessageLength > 100) {
    score += 15;
    factors.push('detailed messages (avg 100+ chars)');
  } else if (avgMessageLength > 50) {
    score += 10;
    factors.push('moderate messages (avg 50-100 chars)');
  } else {
    score += 5;
    factors.push('short messages');
  }

  // Factor 3: Buying signals (keyword detection)
  const conversationText = messages.map(m => m.text.toLowerCase()).join(' ');
  const buyingKeywords = [
    'price', 'cost', 'buy', 'purchase', 'order',
    'how much', 'available', 'delivery', 'shipping',
    'payment', 'invoice', 'quote', 'interested',
    'need', 'want', 'looking for', 'urgent'
  ];
  
  const keywordMatches = buyingKeywords.filter(keyword => 
    conversationText.includes(keyword)
  ).length;

  if (keywordMatches >= 5) {
    score += 20;
    factors.push('strong buying signals');
  } else if (keywordMatches >= 3) {
    score += 12;
    factors.push('some buying signals');
  } else if (keywordMatches >= 1) {
    score += 6;
    factors.push('minimal buying signals');
  }

  // Factor 4: Response pattern (back and forth = engaged)
  const senderChanges = messages.slice(1).filter((msg, i) => 
    msg.from !== messages[i].from
  ).length;
  
  const responseRate = senderChanges / Math.max(messages.length - 1, 1);
  if (responseRate > 0.7) {
    score += 15;
    factors.push('active conversation');
  } else if (responseRate > 0.4) {
    score += 8;
    factors.push('moderate back-and-forth');
  }

  // Factor 5: Recency (if available)
  if (conversationAge) {
    const daysSinceLastMessage = Math.floor(
      (Date.now() - conversationAge.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceLastMessage <= 1) {
      score += 10;
      factors.push('very recent activity');
    } else if (daysSinceLastMessage <= 7) {
      score += 5;
      factors.push('recent activity');
    } else if (daysSinceLastMessage > 30) {
      score -= 10;
      factors.push('old conversation');
    }
  }

  // Cap score at 80 (reserve 81-100 for AI with high confidence)
  score = Math.min(Math.max(score, 15), 80);

  // Determine lead status based on score
  let leadStatus: string;
  if (score >= 60) {
    leadStatus = 'QUALIFIED';
  } else if (score >= 40) {
    leadStatus = 'CONTACTED';
  } else {
    leadStatus = 'NEW';
  }

  const reasoning = `Fallback scoring (AI unavailable): ${factors.join(', ')}. Score: ${score}`;

  return {
    leadScore: score,
    leadStatus,
    reasoning,
    confidence: 60 // Lower confidence than AI
  };
}

/**
 * Check if a score looks like it might be a failed analysis (0 or suspiciously low)
 */
export function isLowQualityScore(score: number, hasMessages: boolean): boolean {
  // 0 score is always low quality
  if (score === 0) return true;
  
  // Very low score with messages suggests failed analysis
  if (hasMessages && score < 15) return true;
  
  return false;
}

/**
 * Enhance an existing score if it seems too low
 */
export function enhanceLowScore(
  currentScore: number,
  messages: Message[],
  conversationAge?: Date
): number {
  if (!isLowQualityScore(currentScore, messages.length > 0)) {
    return currentScore;
  }

  const fallback = calculateFallbackScore(messages, conversationAge);
  
  // Use the higher of current and fallback
  return Math.max(currentScore, fallback.leadScore);
}

