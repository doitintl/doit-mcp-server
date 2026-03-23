/**
 * DoiT API Example: Query Costs by Service
 *
 * This example demonstrates how to query the DoiT Platform Analytics API
 * to get costs grouped by service for the last 30 days.
 *
 * Usage:
 *   DOIT_API_KEY=your_api_key npx ts-node query-costs-by-service.ts
 */

interface DoitQueryConfig {
  config: {
    dataSource: string;
    metric: { type: string; value: string };
    timeRange: { mode: string; amount: number; unit: string; includeCurrent: boolean };
    group: Array<{
      id: string;
      type: string;
      limit: { metric: { type: string; value: string }; sort: string; value: number };
    }>;
  };
}

interface QueryResults {
  schema: Array<{ name: string; type: string }>;
  rows: any[][];
}

async function getCostsByService(apiKey: string): Promise<QueryResults> {
  const queryConfig: DoitQueryConfig = {
    config: {
      dataSource: 'billing',
      metric: { type: 'basic', value: 'cost' },
      timeRange: {
        mode: 'last',
        amount: 30,
        unit: 'day',
        includeCurrent: false
      },
      group: [{
        id: 'service_description',
        type: 'fixed',
        limit: {
          metric: { type: 'basic', value: 'cost' },
          sort: 'desc',
          value: 25
        }
      }]
    }
  };

  const response = await fetch('https://api.doit.com/analytics/v1/reports/query', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(queryConfig)
  });

  if (!response.ok) {
    throw new Error(`DoiT API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Main execution
async function main() {
  const apiKey = process.env.DOIT_API_KEY;
  if (!apiKey) {
    console.error('Error: DOIT_API_KEY environment variable is required');
    process.exit(1);
  }

  try {
    const results = await getCostsByService(apiKey);

    console.log('Costs by Service (Last 30 Days):');
    console.log('================================');

    results.rows.forEach(row => {
      const service = row[0];
      const cost = row[3];
      console.log(`${service}: $${cost.toFixed(2)}`);
    });
  } catch (error) {
    console.error('Failed to query DoiT API:', error);
    process.exit(1);
  }
}

main();
