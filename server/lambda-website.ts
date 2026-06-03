import {
  EC2Client,
  RunInstancesCommand,
  DescribeInstancesCommand,
  DescribeInstancesCommandOutput,
  StopInstancesCommand,
} from "@aws-sdk/client-ec2";

const ec2 = new EC2Client({ region: process.env.AWS_REGION || "ap-south-1" });

const AMI_ID         = process.env.EC2_AMI_ID!;           // your pre-built AMI
const INSTANCE_TYPE  = process.env.EC2_INSTANCE_TYPE || "t2.micro";
const SECURITY_GROUP = process.env.EC2_SECURITY_GROUP_ID!; // must allow port 80/443
const KEY_NAME       = process.env.EC2_KEY_NAME!;          // your EC2 key pair name
const AUTO_STOP_MINS = parseInt(process.env.AUTO_STOP_MINUTES || "15");

// ── Wait for EC2 to reach a state (e.g. "running") ──
async function waitForInstanceState(
  instanceId: string,
  targetState: string,
  maxWaitSeconds = 120
): Promise<string | null> {
  const interval = 5000; // poll every 5 seconds
  const maxAttempts = (maxWaitSeconds * 1000) / interval;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, interval));

    const result: DescribeInstancesCommandOutput = await ec2.send(
      new DescribeInstancesCommand({ InstanceIds: [instanceId] })
    );

    const instance = result.Reservations?.[0]?.Instances?.[0];
    const state = instance?.State?.Name;
    const publicIp = instance?.PublicIpAddress;

    console.log(`[EC2] Instance ${instanceId} state: ${state}`);

    if (state === targetState && publicIp) {
      return publicIp;
    }
  }

  return null; // timed out
}

// ── Check if a running instance already exists ──
async function getRunningInstance(): Promise<{ id: string; ip: string } | null> {
  const result = await ec2.send(
    new DescribeInstancesCommand({
      Filters: [
        { Name: "image-id",     Values: [AMI_ID] },
        { Name: "instance-state-name", Values: ["running", "pending"] },
      ],
    })
  );

  const instance = result.Reservations?.[0]?.Instances?.[0];
  if (instance?.InstanceId && instance?.PublicIpAddress) {
    return { id: instance.InstanceId, ip: instance.PublicIpAddress };
  }

  return null;
}

// ── Start a new EC2 instance from your AMI ──
async function startNewInstance(): Promise<string> {
  // User data script: auto-stop the instance after AUTO_STOP_MINS minutes
  const userData = Buffer.from(`#!/bin/bash
    # Auto-stop after ${AUTO_STOP_MINS} minutes
    sleep ${AUTO_STOP_MINS * 60}
    sudo shutdown -h now
  `).toString("base64");

  const result = await ec2.send(
    new RunInstancesCommand({
      ImageId:          AMI_ID,
      InstanceType:     INSTANCE_TYPE as any,
      MinCount:         1,
      MaxCount:         1,
      KeyName:          KEY_NAME,
      SecurityGroupIds: [SECURITY_GROUP],
      UserData:         userData,
      TagSpecifications: [
        {
          ResourceType: "instance",
          Tags: [
            { Key: "Name",    Value: "navjivan-website" },
            { Key: "AutoStop", Value: "true" },
          ],
        },
      ],
    })
  );

  const instanceId = result.Instances?.[0]?.InstanceId;
  if (!instanceId) throw new Error("Failed to start EC2 instance");

  console.log(`[EC2] Started new instance: ${instanceId}`);
  return instanceId;
}

// ── Lambda Handler ──
export const handler = async (event: any) => {
  console.log("🌐 Website request received — checking EC2 status...");

  try {
    // 1. Check if an instance is already running
    const existing = await getRunningInstance();

    if (existing) {
      console.log(`[EC2] Reusing running instance: ${existing.id} at ${existing.ip}`);
      return buildRedirectResponse(`http://${existing.ip}`);
    }

    // 2. No running instance — start a new one from your AMI
    console.log("[EC2] No running instance found — starting new one...");
    const instanceId = await startNewInstance();

    // 3. Wait for it to be ready (up to 2 minutes)
    console.log("[EC2] Waiting for instance to reach running state...");
    const publicIp = await waitForInstanceState(instanceId, "running", 120);

    if (!publicIp) {
      throw new Error("Instance did not start within 2 minutes");
    }

    console.log(`✅ Instance ready at: ${publicIp}`);

    // 4. Redirect the user to the EC2 instance
    return buildRedirectResponse(`http://${publicIp}`);

  } catch (error: any) {
    console.error("❌ Error starting EC2 instance:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Failed to start website. Please try again in a moment.",
        error: error.message,
      }),
    };
  }
};

// ── HTML redirect response (works better than 302 for browsers) ──
function buildRedirectResponse(url: string) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta http-equiv="refresh" content="2;url=${url}" />
          <title>Starting Navjivan...</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center;
                   align-items: center; height: 100vh; margin: 0; background: #F0F6FF; }
            .box { text-align: center; padding: 40px; background: white;
                   border-radius: 12px; box-shadow: 0 2px 20px rgba(0,0,0,0.1); }
            h2   { color: #0052CC; }
            p    { color: #5E6C84; }
          </style>
        </head>
        <body>
          <div class="box">
            <h2>☁️ Navjivan is starting...</h2>
            <p>Your cloud briefing is being prepared.</p>
            <p>You'll be redirected automatically in a moment.</p>
            <p><a href="${url}">Click here if not redirected</a></p>
          </div>
        </body>
      </html>
    `,
  };
}