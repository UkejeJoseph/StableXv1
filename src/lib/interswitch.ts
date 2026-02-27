const API_BASE = '/api/interswitch';

export interface PurchaseRequest {
  customerId: string;
  amount: number;
  authData: string;
  transactionRef: string;
}

export interface PurchaseResponse {
  success: boolean;
  transactionRef: string;
  paymentId: string;
  message: string;
  amount: string;
  responseCode: string;
  plainTextSupportMessage?: string;
  error?: string;
}

export interface OTPVerifyRequest {
  paymentId: string;
  otp: string;
  transactionRef: string;
}

export interface OTPVerifyResponse {
  success: boolean;
  transactionRef: string;
  message: string;
  transactionIdentifier?: string;
  amount: string;
  responseCode: string;
  retrievalReferenceNumber?: string;
  error?: string;
}

export interface TransactionStatusResponse {
  success: boolean;
  Amount: number;
  CardNumber: string;
  MerchantReference: string;
  PaymentReference: string;
  ResponseCode: string;
  ResponseDescription: string;
  error?: string;
}

export function generateTransactionRef(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `STX${timestamp}${random}`.toUpperCase();
}

export function encryptCardData(
  cardNumber: string,
  expiryMonth: string,
  expiryYear: string,
  cvv: string,
  pin?: string
): string {
  const cardData = `${cardNumber}${expiryMonth}${expiryYear}${cvv}${pin || ''}`;
  return btoa(cardData);
}

export async function initiatePurchase(request: PurchaseRequest): Promise<PurchaseResponse> {
  const response = await fetch(`${API_BASE}/purchase`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return response.json();
}

export async function verifyOTP(request: OTPVerifyRequest): Promise<OTPVerifyResponse> {
  const response = await fetch(`${API_BASE}/verify-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return response.json();
}

export async function resendOTP(paymentId: string, transactionRef: string): Promise<{ success: boolean; message?: string }> {
  const response = await fetch(`${API_BASE}/resend-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentId, transactionRef }),
  });

  return response.json();
}

export async function getTransactionStatus(
  transactionRef: string,
  amount: number
): Promise<TransactionStatusResponse> {
  const response = await fetch(
    `${API_BASE}/transaction-status?transactionRef=${transactionRef}&amount=${amount}`
  );

  return response.json();
}

export function isOTPRequired(responseCode: string): boolean {
  return responseCode === 'T0';
}

export function is3DSecureRequired(responseCode: string): boolean {
  return responseCode === 'S0';
}

export function isTransactionSuccessful(responseCode: string): boolean {
  return responseCode === '00';
}
