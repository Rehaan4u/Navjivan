import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { storage } from "storage";

const sqsClient = new SQSClient({});
const COMPANY_JOBS_QUEUE_URL = process.env.COMPANY_JOBS_QUEUE_URL as string;

interface TriggerEvent {
  triggerSource?: string; // "cron" or "manual"
}

export const handler = async (event: TriggerEvent = {}) => {
  const triggerSource = event.triggerSource || "cron";
  const runDate = new Date();
  runDate.setUTCHours(0, 0, 0, 0);
  const schedulerRun = await storage.createSchedulerRun({ runDate, triggerSource });
  const schedulerRunId = schedulerRun?.id ?? null;

  const subscriptions = await storage.getAllActiveSubscriptions();
  const companySet = new Set<string>();
  for (const sub of subscriptions) {
    sub.companies.split(",").map((c) => c.trim()).filter(Boolean).forEach((c) => companySet.add(c));
  }
  const remainingCompanies = Array.from(companySet);

  if (remainingCompanies.length === 0) {
    if (schedulerRunId) {
      await storage.updateSchedulerRun(schedulerRunId, {
        completedAt: new Date(), status: "completed", successCount: "0", failureCount: "0",
      });
    }
    return { message: "No active companies found" };
  }

  await sqsClient.send(new SendMessageCommand({
    QueueUrl: COMPANY_JOBS_QUEUE_URL,
    MessageBody: JSON.stringify({ schedulerRunId, remainingCompanies, calledLlamaThisChain: false }),
  }));

  return { message: "Newsletter generation started", totalCompanies: remainingCompanies.length };
};