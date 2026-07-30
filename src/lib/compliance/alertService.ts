import { getPayload } from "payload";
import config from "@/payload.config";
import type { Organisation, RegulatoryDeadline } from "@/payload-types";

const ALERT_INTERVALS = [90, 60, 30, 14, 7]; // days before deadline
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds between retries

type NotificationRecord = NonNullable<RegulatoryDeadline["notificationsSent"]>[number];

type DeadlineAlert = {
  id: string;
  name: string;
  dueDate: string;
  organisationId: string;
  organisationName: string;
  contactEmail: string;
  daysUntilDeadline: number;
  alertInterval: number;
  alreadySent: boolean;
  notificationsSent: NotificationRecord[];
};

/**
 * Email alert service for regulatory deadlines.
 * Sends notifications at defined intervals before due dates.
 */
export class DeadlineAlertService {
  private payloadPromise = getPayload({ config });

  /**
   * Get SMTP transporter (mocked for now, use Resend in production).
   */
  private getMailer() {
    // For development, use console logging
    return {
      sendMail: async (options: {
        to: string;
        subject: string;
        daysUntil: number;
        html: string;
      }) => {
        console.log("[ALERT EMAIL]", {
          to: options.to,
          subject: options.subject,
          daysUntil: options.daysUntil,
        });
      },
    };
  }

  /**
   * Find deadlines that need alerts in the next N days.
   */
  async getDeadlinesNeedingAlerts(): Promise<DeadlineAlert[]> {
    try {
      const payload = await this.payloadPromise;
      const today = new Date();
      const results: DeadlineAlert[] = [];

      for (const interval of ALERT_INTERVALS) {
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() + interval);
        const targetDateStr = targetDate.toISOString().split("T")[0];

        const deadlines = await payload.find({
          collection: "regulatory-deadlines",
          where: {
            and: [
              {
                dueDate: {
                  equals: targetDateStr,
                },
              },
              {
                status: {
                  not_in: ["verified", "submitted"],
                },
              },
              {
                unsubscribed: {
                  not_equals: true,
                },
              },
            ],
          },
          depth: 1,
          limit: 100,
        });

        for (const deadline of deadlines.docs) {
          const org =
            typeof deadline.organisation === "object" && deadline.organisation !== null
              ? (deadline.organisation as Organisation)
              : null;
          const notificationsSent = deadline.notificationsSent ?? [];
          const alreadySent = notificationsSent.some(
            (n) => n.daysUntilDeadline === interval,
          );

          results.push({
            id: deadline.id,
            name: deadline.name,
            dueDate: deadline.dueDate,
            organisationId: org?.id ?? String(deadline.organisation),
            organisationName: org?.name ?? "Unknown Organisation",
            contactEmail: "admin@example.com",
            daysUntilDeadline: interval,
            alertInterval: interval,
            alreadySent,
            notificationsSent,
          });
        }
      }

      return results;
    } catch (error) {
      console.error("Error fetching deadlines needing alerts:", error);
      return [];
    }
  }

  /**
   * Send alert emails for deadlines and record delivery.
   */
  async sendAlerts(): Promise<{
    sent: number;
    failed: number;
  }> {
    const payload = await this.payloadPromise;
    const deadlines = await this.getDeadlinesNeedingAlerts();
    const mailer = this.getMailer();

    let sent = 0;
    let failed = 0;

    for (const deadline of deadlines) {
      if (deadline.alreadySent) continue;

      let retries = 0;
      let success = false;

      while (retries < MAX_RETRIES && !success) {
        try {
          await mailer.sendMail({
            to: deadline.contactEmail,
            subject: `Reminder: ${deadline.name} due in ${deadline.daysUntilDeadline} days`,
            daysUntil: deadline.daysUntilDeadline,
            html: this.renderEmailTemplate(deadline),
          });

          // Record successful send
          await payload.update({
            collection: "regulatory-deadlines",
            id: deadline.id,
            data: {
              notificationsSent: [
                ...deadline.notificationsSent,
                {
                  daysUntilDeadline: deadline.daysUntilDeadline,
                  sentAt: new Date().toISOString().split("T")[0],
                  retryCount: retries,
                  status: "sent",
                },
              ],
            },
          });

          success = true;
          sent++;
        } catch {
          retries++;
          if (retries < MAX_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          }
        }
      }

      if (!success) {
        // Record failed send after all retries
        await payload.update({
          collection: "regulatory-deadlines",
          id: deadline.id,
          data: {
            notificationsSent: [
              ...deadline.notificationsSent,
              {
                daysUntilDeadline: deadline.daysUntilDeadline,
                sentAt: new Date().toISOString().split("T")[0],
                retryCount: MAX_RETRIES,
                status: "failed",
              },
            ],
          },
        });

        failed++;
      }
    }

    return { sent, failed };
  }

  /**
   * Email template renderer.
   */
  private renderEmailTemplate(deadline: {
    name: string;
    daysUntilDeadline: number;
    dueDate: string;
    organisationName: string;
  }): string {
    return `
      <h2>Regulatory Deadline Reminder</h2>
      <p>Hi ${deadline.organisationName},</p>
      <p>This is a reminder that the following deadline is due in <strong>${deadline.daysUntilDeadline} days</strong>:</p>
      <ul>
        <li><strong>${deadline.name}</strong></li>
        <li>Due: ${deadline.dueDate}</li>
      </ul>
      <p>Log in to ClearESG to update the status and view any required actions.</p>
      <p><a href="https://app.clearesg.com/compliance/calendar">View Calendar</a></p>
      <hr />
      <p><small><a href="https://app.clearesg.com/compliance/calendar/unsubscribe?deadline=${deadline.name}">Unsubscribe from this reminder</a></small></p>
    `;
  }
}

// Export singleton instance
export const deadlineAlertService = new DeadlineAlertService();
