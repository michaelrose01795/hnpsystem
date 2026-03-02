import nodemailer from "nodemailer";

export const SMTP_HOST = process.env.SMTP_HOST;
export const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
export const SMTP_USER = process.env.SMTP_USER;
export const SMTP_PASS = process.env.SMTP_PASS;
export const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
export const SMTP_ALLOW_SELF_SIGNED = process.env.SMTP_ALLOW_SELF_SIGNED === "true";

export function isSmtpConfigured() {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

export function createSmtpTransport() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: !SMTP_ALLOW_SELF_SIGNED,
    },
  });
}

