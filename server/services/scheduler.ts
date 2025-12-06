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
  console.log(`📅 SCHEDULED NEWSLETTER GENERATION STARTED`);
  console.log(`🕐 Time: ${startTime.toISOString()} (${startTime.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })} IST)`);
  console.log(`📍 Trigger Source: ${triggerSource}`);
  console.log(`${"=".repeat(60)}\n`);

  // Create scheduler run record (may be null if table doesn't exist in production)
  const runDate = new Date();
  runDate.setUTCHours(0, 0, 0, 0);
  
  const schedulerRun = await storage.createSchedulerRun({
    runDate,
    triggerSource,
  });
  
  const schedulerRunId = schedulerRun?.id ?? null;
  if (schedulerRunId) {
    console.log(`📊 Scheduler run ID: ${schedulerRunId}`);
  }

  try {
    const subscriptions = await storage.getAllActiveSubscriptions();
    console.log(`📊 Found ${subscriptions.length} active subscription(s)`);

    if (subscriptions.length === 0) {
      console.log(`⚠️  No active subscriptions found - skipping newsletter generation`);
      
      // Update scheduler run record before returning
      await storage.updateSchedulerRun(schedulerRunId, {
        completedAt: new Date(),
        status: "completed",
        successCount: "0",
        failureCount: "0",
      });
      
      lastScheduledRun = startTime;
      return;
    }

    // Check which subscriptions already have newsletters successfully sent today
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    
    const subscriptionsToProcess = [];
    let skippedCount = 0;
    
    for (const subscription of subscriptions) {
      const newsletters = await storage.getUserNewsletters(subscription.userId);
      const todayNewsletter = newsletters.find(n => {
        if (!n.generatedAt) return false;
        const generatedDate = new Date(n.generatedAt);
        return generatedDate >= todayStart && n.subscriptionId === subscription.id && n.emailSent;
      });
      
      if (todayNewsletter) {
        skippedCount++;
        console.log(`   ⏭️  Skipping subscription ${subscription.id} - newsletter already sent today`);
      } else {
        subscriptionsToProcess.push(subscription);
      }
    }
    
    if (skippedCount > 0) {
      console.log(`\n📋 Skipped ${skippedCount} subscription(s) that already received newsletters today`);
    }
    
    if (subscriptionsToProcess.length === 0) {
      console.log(`✅ All subscriptions already have newsletters for today - nothing to process`);
      
      // Update scheduler run record before returning
      await storage.updateSchedulerRun(schedulerRunId, {
        completedAt: new Date(),
        status: "completed",
        successCount: "0",
        failureCount: "0",
      });
      
      lastScheduledRun = startTime;
      return;
    }

    let successCount = 0;
    let failureCount = 0;

    for (const subscription of subscriptionsToProcess) {
      try {
        const user = await storage.getUser(subscription.userId);
        console.log(`\n📧 Processing subscription ${subscription.id}`);
        console.log(`   User: ${user?.email || subscription.userId}`);
        console.log(`   Companies: ${subscription.companies}`);

        // Generate newsletter with AI summaries
        const newsletter = await generateNewsletterForSubscription(
          subscription.id
        );

        if (!newsletter) {
          console.log(`   ❌ Newsletter generation failed`);
          failureCount++;
          continue;
        }

        console.log(`   ✅ Newsletter ${newsletter.id} generated`);

        // Generate PDF
        try {
          const pdfPath = await generateNewsletterPDF(newsletter.id);
          await storage.updateNewsletterPdf(newsletter.id, pdfPath);
          console.log(`   📄 PDF generated: ${pdfPath}`);
        } catch (error) {
          console.error(`   ⚠️  PDF generation failed:`, error);
          // Continue even if PDF generation fails
        }

        // Send email
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
          console.log(`   ⚠️  No email address found for user ${subscription.userId}`);
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
    console.log(`📊 NEWSLETTER GENERATION SUMMARY`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failureCount}`);
    if (skippedCount > 0) {
      console.log(`   ⏭️  Skipped (already sent): ${skippedCount}`);
    }
    console.log(`   ⏱️  Duration: ${duration} seconds`);
    console.log(`   🕐 Completed: ${endTime.toISOString()}`);
    console.log(`${"=".repeat(60)}\n`);

    // Update scheduler run record
    await storage.updateSchedulerRun(schedulerRunId, {
      completedAt: endTime,
      status: "completed",
      successCount: successCount.toString(),
      failureCount: failureCount.toString(),
    });

    lastScheduledRun = startTime;
  } catch (error) {
    console.error(`\n❌ FATAL ERROR in scheduled newsletter generation:`, error);
    console.error(`${"=".repeat(60)}\n`);
    
    // Update scheduler run record with error
    try {
      await storage.updateSchedulerRun(schedulerRunId, {
        completedAt: new Date(),
        status: "failed",
        successCount: "0",
        failureCount: "0",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    } catch (updateError) {
      console.error(`Failed to update scheduler run record:`, updateError);
    }
  }
}

export async function checkAndRunMissedNewsletter() {
  console.log(`\n🔍 Checking for missed newsletter runs...`);
  
  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  
  // Scheduled time is 3:30 AM UTC (9:00 AM IST)
  const scheduledHour = 3;
  const scheduledMinute = 30;
  
  // Check if current time is past the scheduled time today
  const currentMinutes = utcHours * 60 + utcMinutes;
  const scheduledMinutes = scheduledHour * 60 + scheduledMinute;
  
  if (currentMinutes > scheduledMinutes && !lastScheduledRun) {
    console.log(`⏰ Application started after scheduled time (3:30 AM UTC / 9:00 AM IST)`);
    
    // Check database for today's successful run
    const todayRun = await storage.getTodaySchedulerRun();
    
    if (todayRun && todayRun.status === "completed") {
      console.log(`✅ Found completed scheduler run from today (${todayRun.startedAt.toISOString()}) - skipping duplicate`);
      lastScheduledRun = todayRun.startedAt;
      return;
    }
    
    // Check if newsletters were already successfully sent today
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    
    const subscriptions = await storage.getAllActiveSubscriptions();
    let alreadySentCount = 0;
    let needsGenerationCount = 0;
    
    for (const subscription of subscriptions) {
      const newsletters = await storage.getUserNewsletters(subscription.userId);
      const todayNewsletter = newsletters.find(n => {
        if (!n.generatedAt) return false;
        const generatedDate = new Date(n.generatedAt);
        return generatedDate >= todayStart && n.subscriptionId === subscription.id && n.emailSent;
      });
      
      if (todayNewsletter) {
        alreadySentCount++;
      } else {
        needsGenerationCount++;
      }
    }
    
    if (alreadySentCount > 0) {
      console.log(`✅ Found ${alreadySentCount} newsletter(s) already sent today - skipping duplicate generation`);
    }
    
    if (needsGenerationCount > 0) {
      console.log(`🚀 Running missed newsletter generation for ${needsGenerationCount} subscription(s)...`);
      await runDailyNewsletterGeneration("startup");
    } else if (alreadySentCount === 0) {
      console.log(`ℹ️  No active subscriptions found`);
    }
  } else if (lastScheduledRun) {
    console.log(`✅ Newsletter already ran today at ${lastScheduledRun.toISOString()}`);
  } else {
    console.log(`✅ No missed newsletter - scheduled run is at 3:30 AM UTC (9:00 AM IST)`);
  }
}

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
    await runDailyNewsletterGeneration("cron");
  });

  schedulerRunning = true;
  console.log("Newsletter scheduler started (runs daily at 9:00 AM IST)");
  
  // Check for missed newsletters on startup
  setTimeout(() => {
    checkAndRunMissedNewsletter();
  }, 5000); // Wait 5 seconds after startup to check
}

// Helper function to manually trigger newsletter generation (for testing/cron)
export async function triggerNewsletterGeneration(triggerSource: string = "manual") {
  console.log(`Triggering newsletter generation (source: ${triggerSource})...`);
  
  // Use the same function that the scheduler uses
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
