import "dotenv/config"
import { triggerNewsletterGeneration } from "./services/scheduler.ts";

/* AWS lamda handler entry point
EVENTBRIDGE DIRECTLY TRIGGERS THIS POINT
*/
export const handler = async (event: any) => {
    console.log("⏰ EventBridge triggered the daily newsletter automation!");

    try {
        // Triggers your core database lookups and email loops safely
        const result = await triggerNewsletterGeneration("eventbridge");
        console.log("✅ Scheduler execution complete:", result.message);

        return {
            statusCode:200,
            body: JSON.stringify(result),
        };
    } catch (error: any) {
        console.error("❌ Fatal error during Lambda execution:", error);
        throw error;
    }
};

