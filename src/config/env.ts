/**
 * Environment Variable Validation Schema
 * Validates critical environment variables at startup and provides safe fallbacks for local development.
 */

export interface AppEnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  APP_URL: string;
  DATABASE_URL?: string;
  DIRECT_URL?: string;
  NEXTAUTH_SECRET?: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  EMAIL_FROM?: string;
}

export function validateEnv(): AppEnvConfig {
  const env: Record<string, string | undefined> = (typeof process !== 'undefined' && process.env) ? process.env : {};

  const nodeEnv = (env.NODE_ENV as AppEnvConfig['NODE_ENV']) || 'development';
  const appUrl = env.APP_URL || 'http://localhost:3000';

  if (nodeEnv === 'production') {
    const requiredInProd = ['APP_URL', 'DATABASE_URL', 'NEXTAUTH_SECRET'];
    const missing = requiredInProd.filter(key => !env[key]);
    if (missing.length > 0) {
      throw new Error(`[CRITICAL] Missing required production environment variables: ${missing.join(', ')}`);
    }
  }

  return {
    NODE_ENV: nodeEnv,
    APP_URL: appUrl,
    DATABASE_URL: env.DATABASE_URL,
    DIRECT_URL: env.DIRECT_URL,
    NEXTAUTH_SECRET: env.NEXTAUTH_SECRET,
    RAZORPAY_KEY_ID: env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: env.RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: env.RAZORPAY_WEBHOOK_SECRET,
    SMTP_HOST: env.SMTP_HOST || 'localhost',
    SMTP_PORT: env.SMTP_PORT ? Number(env.SMTP_PORT) : 1025,
    SMTP_USER: env.SMTP_USER,
    SMTP_PASS: env.SMTP_PASS,
    EMAIL_FROM: env.EMAIL_FROM || 'info@snappygitz.com',
  };
}

export const envConfig = validateEnv();
