import cron from "node-cron";
import { storage } from "../storage";
import { generateNewsletterForSubscription } from "./newsletter";
import { generateNewsletterPDF } from "./pdf";
import { sendNewsletterEmail } from "./email";

let schedulerRunning = false;

export function startScheduler() {
  if (schedulerRunning) {
    console.log("Scheduler already running");
    return;
  }

  // Schedule newsletter generation for 9:00 AM IST daily
  // IST is UTC+5:30, so 9:00 AM IST = 3:30 AM UTC
  // Cron format: minute hour day month weekday
  const cronExpression = "30 3 * * *"; // 3:30 AM UTC = 9:00 AM IST

  cron.schedule(cronExpression, async () => {
    console.log("Starting daily newsletter generation...");

    try {
      const subscriptions = await storage.getAllActiveSubscriptions();
      console.log(`Found ${subscriptions.length} active subscriptions`);

      for (const subscription of subscriptions) {
        try {
          console.log(`Processing subscription ${subscription.id}...`);

          // Generate newsletter with AI summaries
          const newsletter = await generateNewsletterForSubscription(
            subscription.id
          );

          if (!newsletter) {
            console.log(`Skipping subscription ${subscription.id} - newsletter generation failed`);
            continue;
          }

          // Generate PDF
          try {
            const pdfPath = await generateNewsletterPDF(newsletter.id);
            await storage.updateNewsletterPdf(newsletter.id, pdfPath);
            console.log(`PDF generated for newsletter ${newsletter.id}`);
          } catch (error) {
            console.error(`Error generating PDF for newsletter ${newsletter.id}:`, error);
            // Continue even if PDF generation fails
          }

          // Send email
          const user = await storage.getUser(subscription.userId);
          if (user?.email) {
            try {
              await sendNewsletterEmail(newsletter.id, user.email);
              console.log(`Email sent for newsletter ${newsletter.id}`);
            } catch (error) {
              console.error(`Error sending email for newsletter ${newsletter.id}:`, error);
            }
          }
        } catch (error) {
          console.error(`Error processing subscription ${subscription.id}:`, error);
          // Continue with other subscriptions
        }
      }

      console.log("Daily newsletter generation completed");
    } catch (error) {
      console.error("Error in scheduled newsletter generation:", error);
    }
  });

  schedulerRunning = true;
  console.log("Newsletter scheduler started (runs daily at 9:00 AM IST)");
}

// Helper function to manually trigger newsletter generation (for testing)
export async function triggerNewsletterGeneration() {
  console.log("Manually triggering newsletter generation...");

  const subscriptions = await storage.getAllActiveSubscriptions();
  const results = [];

  for (const subscription of subscriptions) {
    try {
      const newsletter = await generateNewsletterForSubscription(subscription.id);
      
      if (newsletter) {
        // Generate PDF
        try {
          const pdfPath = await generateNewsletterPDF(newsletter.id);
          await storage.updateNewsletterPdf(newsletter.id, pdfPath);
        } catch (error) {
          console.error(`PDF generation failed for newsletter ${newsletter.id}:`, error);
        }

        // Send email
        const user = await storage.getUser(subscription.userId);
        if (user?.email) {
          try {
            await sendNewsletterEmail(newsletter.id, user.email);
          } catch (error) {
            console.error(`Email sending failed for newsletter ${newsletter.id}:`, error);
          }
        }

        results.push({ success: true, newsletterId: newsletter.id });
      } else {
        results.push({ success: false, subscriptionId: subscription.id });
      }
    } catch (error: any) {
      console.error(`Error for subscription ${subscription.id}:`, error);
      results.push({ success: false, subscriptionId: subscription.id, error: error.message });
    }
  }

  return results;
}
