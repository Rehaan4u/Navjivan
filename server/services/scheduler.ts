/*NEW */
import cron from "node-cron";
import { storage } from "../storage";
import { generateNewsletterForSubscription } from "./newsletter";
import { generateNewsletterPDF } from "./pdf";
import { sendNewsletterEmail } from "./email";

let schedulerRunning = false;
let lastScheduledRun: Date | null = null;

async function runDailyNewsletterGeneration(triggerSource: string = "cron") {
  const startTime = new Date();
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📅 NEWSLETTER GENERATION STARTED`);
  console.log(`🕐 Time: ${startTime.toISOString()} (${startTime.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })} IST)`);
  console.log(`📍 Trigger Source: ${triggerSource}`);
  console.log(`${"=".repeat(60)}\n`);

  const runDate = new Date();
  runDate.setUTCHours(0, 0, 0, 0);

  const schedulerRun = await storage.createSchedulerRun({ runDate, triggerSource });
  const schedulerRunId = schedulerRun?.id ?? null;
  if (schedulerRunId) {
    console.log(`📊 Scheduler run ID: ${schedulerRunId}`);
  }

  try {
    const subscriptions = await storage.getAllActiveSubscriptions();
    console.log(`📊 Found ${subscriptions.length} active subscription(s)`);

    if (subscriptions.length === 0) {
      console.log(`⚠️  No active subscriptions found`);
      await storage.updateSchedulerRun(schedulerRunId, {
        completedAt: new Date(),
        status: "completed",
        successCount: "0",
        failureCount: "0",
      });
      lastScheduledRun = startTime;
      return;
    }

    // Always process all subscriptions — no skip guard
    const subscriptionsToProcess = [...subscriptions];
    console.log(`\n✅ Processing all ${subscriptionsToProcess.length} subscription(s)`);

    let successCount = 0;
    let failureCount = 0;

    for (const subscription of subscriptionsToProcess) {
      try {
        const user = await storage.getUser(subscription.userId);
        console.log(`\n📧 Processing subscription ${subscription.id}`);
        console.log(`   User: ${user?.email || subscription.userId}`);
        console.log(`   Companies: ${subscription.companies}`);

        // Generate newsletter (returns existing if content unchanged)
        const newsletter = await generateNewsletterForSubscription(subscription.id);

        if (!newsletter) {
          console.log(`   ❌ Newsletter generation returned null — skipping`);
          failureCount++;
          continue;
        }

        console.log(`   ✅ Newsletter ${newsletter.id} ready`);

        // Generate PDF
        try {
          const pdfPath = await generateNewsletterPDF(newsletter.id);
          await storage.updateNewsletterPdf(newsletter.id, pdfPath);
          console.log(`   📄 PDF generated: ${pdfPath}`);
        } catch (error) {
          console.error(`   ⚠️  PDF generation failed:`, error);
          // Continue to email even if PDF fails
        }

        // Send email — always send regardless of whether content is new or reused
        if (user?.email) {
          try {
            await sendNewsletterEmail(newsletter.id, user.email);
            console.log(`   ✉️  Email sent to ${user.email}`);
            successCount++;
          } catch (error) {
            console.error(`   ❌ Email sending failed:`, error);
            failureCount++;
          }
        } else {
          console.log(`   ⚠️  No email address for user ${subscription.userId}`);
          failureCount++;
        }

      } catch (error) {
        console.error(`   ❌ Error processing subscription ${subscription.id}:`, error);
        failureCount++;
      }
    }

    const endTime = new Date();
    const duration = ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(2);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 SUMMARY`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failureCount}`);
    console.log(`   ⏱️  Duration: ${duration}s`);
    console.log(`${"=".repeat(60)}\n`);

    await storage.updateSchedulerRun(schedulerRunId, {
      completedAt: endTime,
      status: "completed",
      successCount: successCount.toString(),
      failureCount: failureCount.toString(),
    });

    lastScheduledRun = startTime;

  } catch (error) {
    console.error(`\n❌ FATAL ERROR:`, error);
    try {
      await storage.updateSchedulerRun(schedulerRunId, {
        completedAt: new Date(),
        status: "failed",
        successCount: "0",
        failureCount: "0",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    } catch (updateError) {
      console.error(`Failed to update scheduler run:`, updateError);
    }
  }
}

export function startScheduler() {
  if (schedulerRunning) {
    console.log("Scheduler already running");
    return;
  }

  const cronExpression = "30 3 * * *"; // 3:30 AM UTC = 9:00 AM IST
  cron.schedule(cronExpression, async () => {
    await runDailyNewsletterGeneration("cron");
  });

  schedulerRunning = true;
  console.log("✅ Newsletter scheduler started (runs daily at 9:00 AM IST)");
}

export async function triggerNewsletterGeneration(triggerSource: string = "manual") {
  console.log(`\n🚀 Newsletter generation triggered (source: ${triggerSource})`);
  await runDailyNewsletterGeneration(triggerSource);
  return { success: true, message: "Newsletter generation completed" };
}

export function getSchedulerStatus() {
  return {
    running: schedulerRunning,
    lastRun: lastScheduledRun,
    nextRunUTC: "3:30 AM UTC",
    nextRunIST: "9:00 AM IST",
  };
}