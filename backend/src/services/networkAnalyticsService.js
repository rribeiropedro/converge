import Connection from '../models/Connection.js';
import Interaction from '../models/Interaction.js';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function callOpenRouter(prompt, maxTokens = 2048) {
  const openRouterApiKey = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY;
  
  if (!openRouterApiKey) {
    throw new Error('OpenRouter API key not configured');
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openRouterApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4.5',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export async function getNetworkAnalytics(userId) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const connections = await Connection.find({ 
    user_id: userId,
    status: 'approved'
  }).lean();

  const allConnections = await Connection.find({ user_id: userId }).lean();
  const needsReviewConnections = allConnections.filter(c => c.needs_review);

  const totalConnections = connections.length;
  const newConnectionsThisMonth = connections.filter(c => {
    const createdDate = c.context?.first_met || c.created_at;
    return createdDate && new Date(createdDate) >= thirtyDaysAgo;
  }).length;

  let totalFollowUps = 0;
  let completedFollowUps = 0;
  connections.forEach(c => {
    if (c.audio?.follow_up_hooks) {
      c.audio.follow_up_hooks.forEach(hook => {
        totalFollowUps++;
        if (hook.completed) completedFollowUps++;
      });
    }
  });
  const followUpCompletionRate = totalFollowUps > 0 
    ? Math.round((completedFollowUps / totalFollowUps) * 100) 
    : 0;

  const totalInteractions = connections.reduce((sum, c) => sum + (c.interaction_count || 0), 0);
  const averageInteractions = totalConnections > 0 
    ? totalInteractions / totalConnections 
    : 0;

  const activeConnectionsCount = connections.filter(c => {
    const lastContact = c.last_contacted || c.last_interaction;
    return lastContact && new Date(lastContact) >= thirtyDaysAgo;
  }).length;

  const growthData = calculateGrowthData(connections);
  const industryData = aggregateByField(connections, 'industry');
  const locationData = aggregateByLocation(connections);
  const companyData = aggregateByCompany(connections);
  const eventTypeData = aggregateByEventType(connections);
  const followUpData = aggregateFollowUpData(connections);
  const topicsData = aggregateTopics(connections);

  return {
    metrics: {
      totalConnections,
      newConnectionsThisMonth,
      followUpCompletionRate,
      needsReviewCount: needsReviewConnections.length,
      averageInteractions,
      activeConnectionsCount,
    },
    growthData,
    industryData,
    locationData,
    companyData,
    eventTypeData,
    followUpData,
    topicsData,
  };
}

function calculateGrowthData(connections) {
  const monthlyData = {};
  
  connections.forEach(c => {
    const date = c.context?.first_met || c.created_at;
    if (!date) return;
    
    const monthKey = new Date(date).toISOString().slice(0, 7);
    monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
  });

  const sortedMonths = Object.keys(monthlyData).sort();
  let cumulative = 0;
  
  return sortedMonths.map(month => {
    cumulative += monthlyData[month];
    return {
      date: month,
      count: monthlyData[month],
      cumulative,
    };
  });
}

function aggregateByField(connections, field) {
  const counts = {};
  
  connections.forEach(c => {
    const value = c[field] || 'Unknown';
    counts[value] = (counts[value] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

function aggregateByLocation(connections) {
  const counts = {};
  
  connections.forEach(c => {
    const city = c.context?.location?.city || 'Unknown';
    counts[city] = (counts[city] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function aggregateByCompany(connections) {
  const counts = {};
  
  connections.forEach(c => {
    const company = c.company?.value || 'Unknown';
    counts[company] = (counts[company] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([company, count]) => ({ company, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function aggregateByEventType(connections) {
  const counts = {};
  
  connections.forEach(c => {
    const type = c.context?.event?.type || 'other';
    counts[type] = (counts[type] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

function aggregateFollowUpData(connections) {
  const followUpStats = {};
  
  connections.forEach(c => {
    if (c.audio?.follow_up_hooks) {
      c.audio.follow_up_hooks.forEach(hook => {
        const type = hook.type || 'other';
        if (!followUpStats[type]) {
          followUpStats[type] = { completed: 0, pending: 0 };
        }
        if (hook.completed) {
          followUpStats[type].completed++;
        } else {
          followUpStats[type].pending++;
        }
      });
    }
  });

  return Object.entries(followUpStats)
    .map(([type, stats]) => ({ type, ...stats }))
    .sort((a, b) => (b.completed + b.pending) - (a.completed + a.pending));
}

function aggregateTopics(connections) {
  const topicCounts = {};
  
  connections.forEach(c => {
    if (c.audio?.topics_discussed) {
      c.audio.topics_discussed.forEach(topic => {
        const normalizedTopic = topic.toLowerCase().trim();
        topicCounts[normalizedTopic] = (topicCounts[normalizedTopic] || 0) + 1;
      });
    }
  });

  return Object.entries(topicCounts)
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

export async function generateNetworkRecommendations(userId) {
  const connections = await Connection.find({ 
    user_id: userId,
    status: 'approved'
  }).lean();

  if (connections.length === 0) {
    return [];
  }

  const networkSummary = buildNetworkSummary(connections);

  const prompt = `You are a professional networking advisor. Analyze this network data and provide actionable recommendations.

NETWORK SUMMARY:
${JSON.stringify(networkSummary, null, 2)}

Based on this data, provide 4-6 specific, actionable recommendations. Consider:
1. Connections that need follow-up (pending follow-up hooks)
2. Stale connections (not contacted recently)  
3. Network gaps (industries or skills underrepresented)
4. High-value connections to prioritize
5. Patterns in successful networking (what events work best)

Return ONLY valid JSON as an array of recommendations:
[
  {
    "type": "action|insight|warning|opportunity",
    "title": "Short title (max 50 chars)",
    "description": "1-2 sentence description",
    "priority": "high|medium|low",
    "actionableStep": "Specific next step to take",
    "relatedConnection": "Name of related connection if applicable"
  }
]

Focus on actionable insights. Be specific - mention names, companies, and concrete actions.`;

  try {
    const responseText = await callOpenRouter(prompt);
    
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('Failed to extract JSON from LLM response');
      return getDefaultRecommendations(connections);
    }

    const recommendations = JSON.parse(jsonMatch[0]);
    return recommendations.slice(0, 6);
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return getDefaultRecommendations(connections);
  }
}

function buildNetworkSummary(connections) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const pendingFollowUps = [];
  const staleConnections = [];
  const recentConnections = [];
  const industryBreakdown = {};
  const eventTypes = {};

  connections.forEach(c => {
    const name = c.name?.value || 'Unknown';
    const company = c.company?.value || 'Unknown';
    
    if (c.audio?.follow_up_hooks) {
      c.audio.follow_up_hooks.forEach(hook => {
        if (!hook.completed) {
          pendingFollowUps.push({
            connection: name,
            company,
            type: hook.type,
            detail: hook.detail,
          });
        }
      });
    }

    const lastContact = c.last_contacted || c.last_interaction || c.created_at;
    if (lastContact && new Date(lastContact) < thirtyDaysAgo) {
      staleConnections.push({ name, company, lastContact });
    }

    if (c.context?.first_met && new Date(c.context.first_met) >= thirtyDaysAgo) {
      recentConnections.push({ name, company, event: c.context?.event?.name });
    }

    const industry = c.industry || 'Unknown';
    industryBreakdown[industry] = (industryBreakdown[industry] || 0) + 1;

    const eventType = c.context?.event?.type || 'other';
    eventTypes[eventType] = (eventTypes[eventType] || 0) + 1;
  });

  return {
    totalConnections: connections.length,
    pendingFollowUps: pendingFollowUps.slice(0, 10),
    staleConnections: staleConnections.slice(0, 10),
    recentConnections: recentConnections.slice(0, 5),
    industryBreakdown,
    eventTypes,
    topCompanies: getTopCompanies(connections, 5),
  };
}

function getTopCompanies(connections, limit) {
  const counts = {};
  connections.forEach(c => {
    const company = c.company?.value;
    if (company) {
      counts[company] = (counts[company] || 0) + 1;
    }
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function getDefaultRecommendations(connections) {
  const recommendations = [];
  
  const pendingFollowUps = connections.filter(c => 
    c.audio?.follow_up_hooks?.some(h => !h.completed)
  );
  
  if (pendingFollowUps.length > 0) {
    const conn = pendingFollowUps[0];
    recommendations.push({
      type: 'action',
      title: 'Complete pending follow-ups',
      description: `You have ${pendingFollowUps.length} connections with pending follow-up actions.`,
      priority: 'high',
      actionableStep: `Start with ${conn.name?.value || 'your oldest pending follow-up'}`,
      relatedConnection: conn.name?.value,
    });
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const staleConnections = connections.filter(c => {
    const lastContact = c.last_contacted || c.last_interaction;
    return lastContact && new Date(lastContact) < thirtyDaysAgo;
  });

  if (staleConnections.length > 0) {
    recommendations.push({
      type: 'warning',
      title: 'Re-engage dormant connections',
      description: `${staleConnections.length} connections haven't been contacted in over 30 days.`,
      priority: 'medium',
      actionableStep: 'Schedule a quick check-in with your most valuable dormant connection',
    });
  }

  if (connections.length > 0) {
    recommendations.push({
      type: 'insight',
      title: 'Network health overview',
      description: `Your network has ${connections.length} approved connections. Keep growing!`,
      priority: 'low',
    });
  }

  return recommendations;
}
