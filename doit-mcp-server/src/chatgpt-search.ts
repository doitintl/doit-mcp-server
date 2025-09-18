import { z } from "zod";

// Search arguments schema for ChatGPT MCP
export const SearchArgumentsSchema = z.object({
  query: z.string().describe("Search query string"),
  limit: z.number().optional().describe("Maximum number of results to return"),
});

export type SearchArguments = z.infer<typeof SearchArgumentsSchema>;

// Search result interface
interface SearchResult {
  title: string;
  content: string;
  url?: string;
  metadata?: Record<string, any>;
}

// Main search handler that ChatGPT expects
export async function handleSearch(
  args: SearchArguments,
  token: string,
  customerContext?: string
): Promise<{ results: SearchResult[] }> {
  const { query, limit = 10 } = args;
  
  // Search across DoiT resources based on query
  const results: SearchResult[] = [];
  
  try {
    // Search in reports
    if (query.toLowerCase().includes('report') || query.toLowerCase().includes('cost') || query.toLowerCase().includes('analytics')) {
      try {
        const { handleReportsRequest } = await import("../../src/tools/reports.js");
        const reportsResponse = await handleReportsRequest({ customerContext }, token);
        
        if (reportsResponse.content?.[0]?.text) {
          const reports = JSON.parse(reportsResponse.content[0].text);
          reports.slice(0, Math.min(3, limit)).forEach((report: any) => {
            results.push({
              title: `Report: ${report.name || report.id}`,
              content: `DoiT Analytics Report - ${report.description || 'Cloud cost and usage analytics'}`,
              metadata: { type: 'report', id: report.id }
            });
          });
        }
      } catch (error) {
        console.error('Reports search error:', error);
      }
    }
    
    // Search in anomalies
    if (query.toLowerCase().includes('anomaly') || query.toLowerCase().includes('alert') || query.toLowerCase().includes('unusual')) {
      try {
        const { handleAnomaliesRequest } = await import("../../src/tools/anomalies.js");
        const anomaliesResponse = await handleAnomaliesRequest({ customerContext }, token);
        
        if (anomaliesResponse.content?.[0]?.text) {
          const anomalies = JSON.parse(anomaliesResponse.content[0].text);
          anomalies.slice(0, Math.min(3, limit - results.length)).forEach((anomaly: any) => {
            results.push({
              title: `Anomaly: ${anomaly.title || anomaly.id}`,
              content: `Cost anomaly detected - ${anomaly.description || 'Unusual spending pattern identified'}`,
              metadata: { type: 'anomaly', id: anomaly.id }
            });
          });
        }
      } catch (error) {
        console.error('Anomalies search error:', error);
      }
    }
    
    // Search in cloud incidents
    if (query.toLowerCase().includes('incident') || query.toLowerCase().includes('issue') || query.toLowerCase().includes('outage')) {
      try {
        const { handleCloudIncidentsRequest } = await import("../../src/tools/cloudIncidents.js");
        const incidentsResponse = await handleCloudIncidentsRequest({ customerContext }, token);
        
        if (incidentsResponse.content?.[0]?.text) {
          const incidents = JSON.parse(incidentsResponse.content[0].text);
          incidents.slice(0, Math.min(3, limit - results.length)).forEach((incident: any) => {
            results.push({
              title: `Incident: ${incident.title || incident.id}`,
              content: `Cloud service incident - ${incident.description || 'Service disruption or issue'}`,
              metadata: { type: 'incident', id: incident.id }
            });
          });
        }
      } catch (error) {
        console.error('Incidents search error:', error);
      }
    }
    
    // Search in tickets
    if (query.toLowerCase().includes('ticket') || query.toLowerCase().includes('support')) {
      try {
        const { handleListTicketsRequest } = await import("../../src/tools/tickets.js");
        const ticketsResponse = await handleListTicketsRequest({ customerContext }, token);
        
        if (ticketsResponse.content?.[0]?.text) {
          const tickets = JSON.parse(ticketsResponse.content[0].text);
          tickets.slice(0, Math.min(3, limit - results.length)).forEach((ticket: any) => {
            results.push({
              title: `Ticket: ${ticket.subject || ticket.id}`,
              content: `Support ticket - ${ticket.description || 'Customer support request'}`,
              metadata: { type: 'ticket', id: ticket.id }
            });
          });
        }
      } catch (error) {
        console.error('Tickets search error:', error);
      }
    }
    
    // If no specific matches, provide general DoiT information
    if (results.length === 0) {
      results.push({
        title: "DoiT Platform Overview",
        content: `DoiT provides cloud cost optimization, analytics, and support services. Available data includes cost reports, anomaly detection, cloud incidents, and support tickets. Try searching for specific terms like 'reports', 'anomalies', 'incidents', or 'tickets'.`,
        metadata: { type: 'general' }
      });
    }
    
  } catch (error) {
    console.error('Search error:', error);
    results.push({
      title: "Search Error",
      content: `Unable to complete search for "${query}". Please check your authentication and try again.`,
      metadata: { type: 'error' }
    });
  }
  
  return { results: results.slice(0, limit) };
}

// Export the search tool definition
export const searchTool = {
  name: "search",
  description: "Search across DoiT platform data including reports, anomalies, incidents, and tickets",
};
