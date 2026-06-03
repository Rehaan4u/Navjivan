import {
  EC2Client,
  RunInstancesCommand,
  DescribeInstancesCommand,
  DescribeInstancesCommandOutput,
  AssociateAddressCommand,
} from "@aws-sdk/client-ec2";

// ── EC2 Client — Lambda IAM role handles credentials automatically ──
const ec2 = new EC2Client({ region: "ap-south-2" });

// ── Config from environment variables ──
const AMI_ID                   = process.env.EC2_AMI_ID!;
const INSTANCE_TYPE            = process.env.EC2_INSTANCE_TYPE || "t2.micro";
const SECURITY_GROUP           = process.env.EC2_SECURITY_GROUP_ID!;
const KEY_NAME                 = process.env.EC2_KEY_NAME!;
const AUTO_STOP_MINS           = parseInt(process.env.AUTO_STOP_MINUTES || "15");
const ELASTIC_IP               = process.env.ELASTIC_IP!;
const ELASTIC_IP_ALLOCATION_ID = process.env.ELASTIC_IP_ALLOCATION_ID!;

// ── Wait for EC2 to reach a target state ──
async function waitForInstanceState(
  instanceId: string,
  targetState: string,
  maxWaitSeconds = 120
): Promise<string | null> {
  const interval = 5000;
  const maxAttempts = (maxWaitSeconds * 1000) / interval;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, interval));

    const result: DescribeInstancesCommandOutput = await ec2.send(
      new DescribeInstancesCommand({ InstanceIds: [instanceId] })
    );

    const instance = result.Reservations?.[0]?.Instances?.[0];
    const state = instance?.State?.Name;
    const publicIp = instance?.PublicIpAddress;

    console.log(`[EC2] Instance ${instanceId} → state: ${state}`);

    if (state === targetState && publicIp) {
      return publicIp;
    }
  }

  console.error(`[EC2] Timed out waiting for ${targetState}`);
  return null;
}

// ── Check if an instance from this AMI is already running ──
async function getRunningInstance(): Promise<{ id: string } | null> {
  const result = await ec2.send(
    new DescribeInstancesCommand({
      Filters: [
        { Name: "image-id",            Values: [AMI_ID] },
        { Name: "instance-state-name", Values: ["running", "pending"] },
      ],
    })
  );

  const instance = result.Reservations?.[0]?.Instances?.[0];
  if (instance?.InstanceId) {
    return { id: instance.InstanceId };
  }

  return null;
}

// ── Start a new EC2 instance from your AMI ──
async function startNewInstance(): Promise<string> {
  const userData = Buffer.from(
`#!/bin/bash
sleep ${AUTO_STOP_MINS * 60}
sudo shutdown -h now`
  ).toString("base64");

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
            { Key: "Name",     Value: "navjivan-website" },
            { Key: "AutoStop", Value: "true" },
          ],
        },
      ],
    })
  );

  const instanceId = result.Instances?.[0]?.InstanceId;
  if (!instanceId) throw new Error("Failed to launch EC2 instance");

  console.log(`[EC2] Launched new instance: ${instanceId}`);
  return instanceId;
}

// ── Assign your fixed Elastic IP to the new instance ──
async function assignElasticIp(instanceId: string): Promise<void> {
  await ec2.send(
    new AssociateAddressCommand({
      InstanceId:   instanceId,
      AllocationId: ELASTIC_IP_ALLOCATION_ID,
    })
  );
  console.log(`[EC2] Elastic IP ${ELASTIC_IP} assigned to ${instanceId}`);
}

// ── Lambda Handler ──
export const handler = async (event: any) => {
  console.log("🌐 Website request — checking EC2 status...");

  try {
    // 1. Is an instance already running from this AMI?
    const existing = await getRunningInstance();

    if (existing) {
      console.log(`[EC2] Instance already running: ${existing.id} — reusing Elastic IP`);
      return buildRedirectResponse(`http://${ELASTIC_IP}`);
    }

    // 2. No running instance — start a fresh one
    console.log("[EC2] No running instance — starting new one from AMI...");
    const instanceId = await startNewInstance();

    // 3. Wait for it to reach "running" state (up to 2 minutes)
    console.log("[EC2] Waiting for instance to be ready...");
    const publicIp = await waitForInstanceState(instanceId, "running", 120);

    if (!publicIp) {
      throw new Error("Instance did not reach running state within 2 minutes");
    }

    // 4. Reassign Elastic IP to this new instance
    await assignElasticIp(instanceId);

    console.log(`✅ Instance ready — redirecting to http://${ELASTIC_IP}`);

    // 5. Redirect user to fixed Elastic IP
    return buildRedirectResponse(`http://${ELASTIC_IP}`);

  } catch (error: any) {
    console.error("❌ Error starting EC2 instance:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/html" },
      body: `
        <!DOCTYPE html>
        <html>
          <head><title>Error — Navjivan</title></head>
          <body style="font-family:Arial;text-align:center;padding:60px;">
            <h2 style="color:#DE350B;">⚠️ Failed to start website</h2>
            <p style="color:#5E6C84;">Something went wrong. Please try again in a moment.</p>
            <a href="javascript:location.reload()" style="color:#0052CC;">Try again</a>
          </body>
        </html>
      `,
    };
  }
};

// ── Friendly loading page with auto-redirect ──
function buildRedirectResponse(url: string) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta http-equiv="refresh" content="3;url=${url}" />
          <title>Starting Navjivan...</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              background: #F0F6FF;
            }
            .box {
              text-align: center;
              padding: 48px 40px;
              background: white;
              border-radius: 12px;
              box-shadow: 0 2px 20px rgba(0,0,0,0.1);
              max-width: 420px;
              width: 90%;
            }
            h2   { color: #0052CC; margin-bottom: 12px; font-size: 22px; }
            p    { color: #5E6C84; margin-bottom: 8px; font-size: 14px; line-height: 1.6; }
            a    { color: #0052CC; font-size: 13px; }
            .spinner {
              width: 36px; height: 36px;
              border: 4px solid #DEEBFF;
              border-top-color: #0052CC;
              border-radius: 50%;
              animation: spin 0.8s linear infinite;
              margin: 20px auto 0;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="box">
            <h2>☁️ Navjivan is starting...</h2>
            <p>Your daily cloud briefing is being prepared.</p>
            <p>You'll be redirected automatically in a few seconds.</p>
            <p><a href="${url}">Click here if not redirected</a></p>
            <div class="spinner"></div>
          </div>
        </body>
      </html>
    `,
  };
}