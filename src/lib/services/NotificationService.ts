import nodemailer from 'nodemailer';
import { WebhookClient } from 'discord.js';
import axios from 'axios';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export interface WebhookConfig {
  discord?: string;
  slack?: string;
  custom?: Array<{
    url: string;
    headers?: Record<string, string>;
  }>;
}

export interface NotificationTemplates {
  email: {
    subject: string;
    text: string;
    html: string;
  };
  webhook: any;
}

export interface NotificationPayload {
  type: 'EMAIL' | 'WEBHOOK' | 'SMS' | 'PUSH';
  to: string | string[];
  template: keyof typeof NotificationTemplates;
  data: Record<string, any>;
  metadata?: {
    priority?: 'high' | 'normal' | 'low';
    tags?: string[];
    [key: string]: any;
  };
}

export class NotificationService {
  private emailTransport: nodemailer.Transporter | null = null;
  private webhookConfig: WebhookConfig;
  private templates: Record<string, NotificationTemplates> = {
    CREDENTIAL_ISSUED: {
      email: {
        subject: 'Your Academic Credential Has Been Issued',
        text: 'Your credential has been successfully issued.',
        html: '<p>Your credential has been successfully issued.</p>',
      },
      webhook: {
        title: 'New Credential Issued',
        message: 'A new academic credential has been issued.',
      },
    },
    // Add more templates as needed
  };

  constructor(emailConfig?: EmailConfig, webhookConfig: WebhookConfig = {}) {
    if (emailConfig) {
      this.emailTransport = nodemailer.createTransport({
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        auth: emailConfig.auth,
      });
    }
    this.webhookConfig = webhookConfig;
  }

  /**
   * Send a notification
   */
  async send(notification: NotificationPayload): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      switch (notification.type) {
        case 'EMAIL':
          return await this.sendEmail(notification);
        case 'WEBHOOK':
          return await this.sendWebhook(notification);
        default:
          throw new Error(`Unsupported notification type: ${notification.type}`);
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Send an email notification
   */
  private async sendEmail(notification: NotificationPayload) {
    if (!this.emailTransport) {
      throw new Error('Email transport not configured');
    }

    const template = this.templates[notification.template]?.email;
    if (!template) {
      throw new Error(`Template not found: ${notification.template}`);
    }

    const recipients = Array.isArray(notification.to) ? notification.to : [notification.to];
    const results = await Promise.all(
      recipients.map((to) =>
        this.emailTransport!.sendMail({
          from: process.env.EMAIL_FROM || 'noreply@academic-verification.org',
          to,
          subject: this.renderTemplate(template.subject, notification.data),
          text: this.renderTemplate(template.text, notification.data),
          html: this.renderTemplate(template.html, notification.data),
          priority: notification.metadata?.priority || 'normal',
        })
      )
    );

    return {
      success: results.every((result) => result.accepted.length > 0),
      message: `Sent ${results.length} email(s)`,
      details: results,
    };
  }

  /**
   * Send a webhook notification
   */
  private async sendWebhook(notification: NotificationPayload) {
    const template = this.templates[notification.template]?.webhook;
    if (!template) {
      throw new Error(`Template not found: ${notification.template}`);
    }

    const webhooks: Array<{ url: string; headers?: Record<string, string> }> = [];

    // Add Discord webhook if configured
    if (this.webhookConfig.discord) {
      webhooks.push({
        url: this.webhookConfig.discord,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Add Slack webhook if configured
    if (this.webhookConfig.slack) {
      webhooks.push({
        url: this.webhookConfig.slack,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Add custom webhooks
    if (this.webhookConfig.custom) {
      webhooks.push(...this.webhookConfig.custom);
    }

    const results = await Promise.all(
      webhooks.map((webhook) =>
        axios.post(webhook.url, template, { headers: webhook.headers })
      )
    );

    return {
      success: results.every((result) => result.status >= 200 && result.status < 300),
      message: `Sent ${results.length} webhook(s)`,
      details: results.map((r) => r.data),
    };
  }

  /**
   * Render a template with data
   */
  private renderTemplate(template: string, data: Record<string, any>): string {
    return Object.entries(data).reduce(
      (result, [key, value]) =>
        result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value)),
      template
    );
  }

  /**
   * Add or update a notification template
   */
  setTemplate(name: string, template: Partial<NotificationTemplates>) {
    this.templates[name] = {
      ...(this.templates[name] || {}),
      ...template,
      email: {
        ...(this.templates[name]?.email || {}),
        ...(template.email || {}),
      },
      webhook: {
        ...(this.templates[name]?.webhook || {}),
        ...(template.webhook || {}),
      },
    };
  }
}
