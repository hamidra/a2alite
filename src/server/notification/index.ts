/**
 * Notification client for handling different notification channels
 */
import { PushNotificationConfig } from "../../types/types.ts";

export interface INotificationClient {
  /**
   * Send a notification
   * @param channel - The notification channel (e.g., 'email', 'sms', 'push')
   * @param recipient - The recipient's contact information
   * @param message - The message content
   * @param metadata - Additional metadata for the notification
   */
  sendNotification(
    pushNotificationConfig: PushNotificationConfig
  ): Promise<boolean>;
}
