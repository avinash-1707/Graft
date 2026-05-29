import type { Logger } from '@graft/observability';
import nodemailer, { type Transporter } from 'nodemailer';
import type { GatewayEnv } from '../env.js';

export interface Mailer {
  sendVerificationCode(to: string, name: string, code: string): Promise<void>;
  sendPasswordResetCode(to: string, name: string, code: string): Promise<void>;
  sendAgentInvite(to: string, name: string, orgName: string, code: string): Promise<void>;
}

/**
 * Builds a nodemailer-backed mailer. When SMTP is configured it sends for real;
 * otherwise it falls back to nodemailer's jsonTransport (no network) and logs the
 * rendered message so local dev can read the code. The dev fallback is the only
 * place a code touches the logs, and only when no SMTP host is set.
 */
export function createMailer(env: GatewayEnv, logger: Logger): Mailer {
  const usingSmtp = Boolean(env.SMTP_HOST);
  const transport: Transporter = usingSmtp
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT ?? 587,
        secure: env.SMTP_SECURE,
        ...(env.SMTP_USER && env.SMTP_PASS
          ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } }
          : {}),
      })
    : nodemailer.createTransport({ jsonTransport: true });

  if (!usingSmtp) {
    logger.warn('SMTP not configured; using jsonTransport (emails are logged, not sent)');
  }

  const send = async (to: string, subject: string, text: string): Promise<void> => {
    const info = await transport.sendMail({ from: env.EMAIL_FROM, to, subject, text });
    if (!usingSmtp) {
      logger.warn({ to, subject, body: text, messageId: info.messageId }, 'dev email (not sent)');
    }
  };

  return {
    sendVerificationCode: (to, name, code) =>
      send(
        to,
        `Verify your ${env.APP_NAME} email`,
        `Hi ${name},\n\nYour ${env.APP_NAME} verification code is: ${code}\n\n` +
          `It expires in ${Math.round(env.OTP_TTL_MS / 60000)} minutes.\n` +
          `If you didn't sign up, you can ignore this email.`,
      ),
    sendPasswordResetCode: (to, name, code) =>
      send(
        to,
        `Reset your ${env.APP_NAME} password`,
        `Hi ${name},\n\nYour ${env.APP_NAME} password reset code is: ${code}\n\n` +
          `It expires in ${Math.round(env.OTP_TTL_MS / 60000)} minutes.\n` +
          `If you didn't request this, you can ignore this email.`,
      ),
    sendAgentInvite: (to, name, orgName, code) =>
      send(
        to,
        `You've been invited to ${orgName} on ${env.APP_NAME}`,
        `Hi ${name},\n\nYou've been invited to join ${orgName} as a support agent on ` +
          `${env.APP_NAME}. Your invite code is: ${code}\n\n` +
          `Use it to set your password and activate your account. ` +
          `It expires in ${Math.round(env.OTP_TTL_MS / 60000)} minutes.\n` +
          `If you weren't expecting this, you can ignore this email.`,
      ),
  };
}
