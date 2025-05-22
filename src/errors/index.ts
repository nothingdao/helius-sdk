import { AxiosError } from 'axios';

export enum HeliusErrorCode {
  // API Errors
  API_KEY_INVALID = 'API_KEY_INVALID',
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  API_REQUEST_FAILED = 'API_REQUEST_FAILED',
  
  // Asset/DAS Errors
  ASSET_NOT_FOUND = 'ASSET_NOT_FOUND',
  
  // Webhook Errors
  WEBHOOK_NOT_FOUND = 'WEBHOOK_NOT_FOUND',
  WEBHOOK_ADDRESS_LIMIT = 'WEBHOOK_ADDRESS_LIMIT',
  
  // Transaction Errors
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  TRANSACTION_SIMULATE_FAILED = 'TRANSACTION_SIMULATE_FAILED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  
  // Validation Errors
  INVALID_INPUT = 'INVALID_INPUT',
  
  // Network Errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  
  // Generic
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class HeliusError extends Error {
  public readonly code: HeliusErrorCode;
  public readonly statusCode?: number;
  public readonly retryable: boolean;
  public readonly operation?: string;

  constructor(
    code: HeliusErrorCode,
    message: string,
    options: {
      statusCode?: number;
      retryable?: boolean;
      operation?: string;
    } = {}
  ) {
    super(message);
    this.name = 'HeliusError';
    this.code = code;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable || false;
    this.operation = options.operation;
  }

  isRetryable(): boolean {
    return this.retryable;
  }

  getUserMessage(): string {
    switch (this.code) {
      case HeliusErrorCode.API_KEY_INVALID:
        return 'Invalid API key. Please check your API key in the Helius dashboard.';
      case HeliusErrorCode.API_RATE_LIMIT:
        return 'Rate limit exceeded. Please wait before making more requests.';
      case HeliusErrorCode.WEBHOOK_ADDRESS_LIMIT:
        return 'Webhook address limit exceeded. Maximum 100,000 addresses per webhook.';
      case HeliusErrorCode.INSUFFICIENT_FUNDS:
        return 'Insufficient funds for this transaction.';
      default:
        return this.message;
    }
  }
}

// Error factory function
export const createHeliusError = (error: any, operation?: string): HeliusError => {
  // Handle Axios errors (95% of cases)
  if (error.response) {
    const status = error.response.status;
    const message = error.response.data?.error || error.message;
    
    const statusCodeMap: Record<number, HeliusErrorCode> = {
      401: HeliusErrorCode.API_KEY_INVALID,
      429: HeliusErrorCode.API_RATE_LIMIT,
      404: HeliusErrorCode.ASSET_NOT_FOUND,
      500: HeliusErrorCode.API_REQUEST_FAILED,
      502: HeliusErrorCode.API_REQUEST_FAILED,
      503: HeliusErrorCode.API_REQUEST_FAILED,
    };

    return new HeliusError(
      statusCodeMap[status] || HeliusErrorCode.NETWORK_ERROR,
      message,
      {
        statusCode: status,
        retryable: [429, 500, 502, 503].includes(status),
        operation
      }
    );
  }

  // Handle business logic errors
  const errorMessage = error.message || String(error);
  
  if (errorMessage.includes('100,000 addresses') || errorMessage.includes('address limit')) {
    return new HeliusError(HeliusErrorCode.WEBHOOK_ADDRESS_LIMIT, errorMessage, { operation });
  }
  
  if (errorMessage.includes('insufficient funds')) {
    return new HeliusError(HeliusErrorCode.INSUFFICIENT_FUNDS, errorMessage, { operation });
  }
  
  if (errorMessage.includes('simulation failed')) {
    return new HeliusError(HeliusErrorCode.TRANSACTION_SIMULATE_FAILED, errorMessage, { operation });
  }

  // Default case
  return new HeliusError(
    HeliusErrorCode.UNKNOWN_ERROR,
    errorMessage,
    { operation }
  );
};

// Utility functions
export const isHeliusError = (error: any): error is HeliusError => {
  return error instanceof HeliusError;
};

export const isRetryableError = (error: any): boolean => {
  return isHeliusError(error) && error.isRetryable();
};
