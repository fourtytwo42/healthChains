/**
 * AI Tools - Tool schemas and execution functions for Groq function calling
 * 
 * Provides OpenAI-compatible tool definitions and client-side execution
 */

import { apiClient } from './api-client';
import type { Patient, Provider } from './api-client';

// Tool schemas in OpenAI function calling format
export const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_patients',
      description: 'Get a paginated list of all patients. Use this to see available patients.',
      parameters: {
        type: 'object',
        properties: {
          page: {
            type: 'number',
            description: 'Page number (default: 1)',
          },
          limit: {
            type: 'number',
            description: 'Number of items per page (default: 10, max: 100)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_patients',
      description: 'Search for patients by name, patient ID, or wallet address. Returns matching patients.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query - can be patient name, patient ID (e.g., PAT-000001), or wallet address',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pending_requests',
      description: 'Get pending consent requests that are waiting for patient approval. Shows requests you have sent.',
      parameters: {
        type: 'object',
        properties: {
          page: {
            type: 'number',
            description: 'Page number (default: 1)',
          },
          limit: {
            type: 'number',
            description: 'Number of items per page (default: 10)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_granted_consents',
      description: 'Get list of patients who have granted consent to you. Shows active consents.',
      parameters: {
        type: 'object',
        properties: {
          page: {
            type: 'number',
            description: 'Page number (default: 1)',
          },
          limit: {
            type: 'number',
            description: 'Number of items per page (default: 10)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_consent_history',
      description: 'Get complete consent history including all requests, approvals, denials, and revocations. Shows full timeline.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_patient_data',
      description: 'Get detailed patient data including demographics and medical information. Only returns data the patient has consented to share with you.',
      parameters: {
        type: 'object',
        properties: {
          patientId: {
            type: 'string',
            description: 'Patient ID (e.g., PAT-000001)',
          },
        },
        required: ['patientId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_consent',
      description: 'Request consent from a patient to access their data. This will trigger a MetaMask transaction that the patient must approve.',
      parameters: {
        type: 'object',
        properties: {
          patientAddress: {
            type: 'string',
            description: 'Patient wallet address (0x...)',
          },
          dataTypes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of data types to request (e.g., ["medical_records", "vital_signs"])',
          },
          purposes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of purposes for the request (e.g., ["treatment", "research"])',
          },
          expirationTime: {
            type: 'number',
            description: 'Optional expiration timestamp in seconds (Unix timestamp). Use 0 for no expiration.',
          },
        },
        required: ['patientAddress', 'dataTypes', 'purposes'],
      },
    },
  },
] as const;

export type ToolName = typeof AI_TOOLS[number]['function']['name'];

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: ToolName;
    arguments: string; // JSON string
  };
}

export interface ToolResult {
  tool_call_id: string;
  role: 'tool';
  name: ToolName;
  content: string; // JSON string of result
}

/**
 * Execute a tool call on the client side
 */
export async function executeTool(
  toolName: ToolName,
  args: Record<string, unknown>,
  providerAddress: string
): Promise<unknown> {
  console.group(`[AI Tool] Executing: ${toolName}`);
  console.log('Arguments:', args);
  console.log('Provider Address:', providerAddress);

  try {
    let result: unknown;

    switch (toolName) {
      case 'get_patients': {
        const page = (args.page as number) || 1;
        const limit = Math.min((args.limit as number) || 10, 100);
        const response = await apiClient.getPatients();
        if (!response.success || !response.data) {
          throw new Error('Failed to fetch patients');
        }
        const allPatients = response.data;
        const start = (page - 1) * limit;
        const end = start + limit;
        result = {
          patients: allPatients.slice(start, end),
          pagination: {
            page,
            limit,
            total: allPatients.length,
            totalPages: Math.ceil(allPatients.length / limit),
          },
        };
        break;
      }

      case 'search_patients': {
        const query = (args.query as string)?.toLowerCase() || '';
        if (!query) {
          throw new Error('Search query is required');
        }
        const response = await apiClient.getPatients();
        if (!response.success || !response.data) {
          throw new Error('Failed to fetch patients');
        }
        const allPatients = response.data;
        const matches = allPatients.filter((p: Patient) => {
          const name = `${p.demographics?.firstName || ''} ${p.demographics?.lastName || ''}`.toLowerCase();
          const patientId = p.patientId?.toLowerCase() || '';
          const address = p.blockchainIntegration?.walletAddress?.toLowerCase() || '';
          return name.includes(query) || patientId.includes(query) || address.includes(query);
        });
        result = { patients: matches, count: matches.length };
        break;
      }

      case 'get_pending_requests': {
        const page = (args.page as number) || 1;
        const limit = (args.limit as number) || 10;
        const response = await apiClient.getProviderPendingRequests(
          providerAddress,
          page,
          limit
        );
        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to fetch pending requests');
        }
        // Response might have data directly or wrapped
        result = response.data || response;
        break;
      }

      case 'get_granted_consents': {
        const page = (args.page as number) || 1;
        const limit = (args.limit as number) || 10;
        const response = await apiClient.getProviderPatients(
          providerAddress,
          page,
          limit
        );
        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to fetch granted consents');
        }
        // Response might have data directly or wrapped
        result = response.data || response;
        break;
      }

      case 'get_consent_history': {
        // Fetch all consent events and access request events
        const [consentEventsResponse, requestEventsResponse] = await Promise.all([
          apiClient.getConsentEvents(),
          apiClient.getAccessRequestEvents(),
        ]);

        const allEvents = [
          ...(consentEventsResponse.success && consentEventsResponse.data
            ? consentEventsResponse.data
            : []),
          ...(requestEventsResponse.success && requestEventsResponse.data
            ? requestEventsResponse.data
            : []),
        ];

        // Filter by provider address
        const providerEvents = allEvents.filter((event: any) => {
          if (event.type === 'ConsentGranted' || event.type === 'ConsentRevoked') {
            return event.provider?.toLowerCase() === providerAddress.toLowerCase();
          }
          if (
            event.type === 'AccessRequested' ||
            event.type === 'AccessApproved' ||
            event.type === 'AccessDenied'
          ) {
            return event.requester?.toLowerCase() === providerAddress.toLowerCase();
          }
          return false;
        });

        // Fetch patient info for enrichment
        const patientsResponse = await apiClient.getPatients();
        const patients =
          patientsResponse.success && patientsResponse.data ? patientsResponse.data : [];

        const enrichedEvents = providerEvents.map((event: any) => {
          const patient = event.patient
            ? patients.find(
                (p: Patient) =>
                  p.blockchainIntegration?.walletAddress?.toLowerCase() ===
                  event.patient?.toLowerCase()
              )
            : null;

          return {
            ...event,
            patientInfo: patient
              ? {
                  patientId: patient.patientId,
                  firstName: patient.demographics?.firstName,
                  lastName: patient.demographics?.lastName,
                  age: patient.demographics?.age,
                  gender: patient.demographics?.gender,
                }
              : null,
          };
        });

        result = { events: enrichedEvents, count: enrichedEvents.length };
        break;
      }

      case 'get_patient_data': {
        const patientId = args.patientId as string;
        if (!patientId) {
          throw new Error('Patient ID is required');
        }
        const response = await apiClient.getProviderPatientData(providerAddress, patientId);
        if (!response.success) {
          if (response.error?.code === 'NOT_FOUND' || response.error?.message?.includes('404')) {
            result = {
              error: 'No consent found',
              message: 'This patient has not granted consent to share data with you yet.',
            };
          } else {
            throw new Error(response.error?.message || 'Failed to fetch patient data');
          }
        } else {
          result = response.data;
        }
        break;
      }

      case 'request_consent': {
        // This will be handled specially in the chat component to trigger MetaMask
        // Return a special marker that indicates MetaMask interaction is needed
        result = {
          requiresMetaMask: true,
          patientAddress: args.patientAddress as string,
          dataTypes: args.dataTypes as string[],
          purposes: args.purposes as string[],
          expirationTime: (args.expirationTime as number) || 0,
        };
        break;
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }

    console.log('Result:', result);
    console.groupEnd();
    return result;
  } catch (error) {
    console.error('Tool execution error:', error);
    console.groupEnd();
    throw error;
  }
}

