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
const EC2_SUBNET_ID            = process.env.EC2_SUBNET_ID!;
const EC2_IAM_PROFILE          = process.env.EC2_IAM_PROFILE!;  // ← new
 
// ── Wait for EC2 to reach a target state ──
// Returns true as soon as state matches — does NOT wait for public IP
// (Elastic IP is assigned separately after this)
async function waitForInstanceState(
  instanceId: string,
  targetState: string,
  maxWaitSeconds = 120
): Promise<boolean> {
  const interval = 5000;
  const maxAttempts = (maxWaitSeconds * 1000) / interval;
 
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, interval));
 
    const result: DescribeInstancesCommandOutput = await ec2.send(
      new DescribeInstancesCommand({ InstanceIds: [instanceId] })
    );
 
    const instance = result.Reservations?.[0]?.Instances?.[0];
    const state = instance?.State?.Name;
 
    console.log(`[EC2] Instance ${instanceId} → state: ${state}`);
 
    if (state === targetState) {
      return true;
    }
  }
 
  console.error(`[EC2] Timed out waiting for ${targetState}`);
  return false;
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
      SubnetId:         EC2_SUBNET_ID,
      IamInstanceProfile: {
        Name: EC2_IAM_PROFILE,             // ← new: attaches SES role to EC2
      },
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
 
  // ── EXTRACT COGNITO WHITELIST EMAIL ──
  // Extracts who logged into 'Moksha' to execute this request
  const userEmail = event.requestContext?.authorizer?.jwt?.claims?.email || "Unknown/DirectInvoke";
  console.log(`🔒 Security Verification passed for user: [ ${userEmail} ]`);
 
  try {
    // 1. Is an instance already running from this AMI?
    const existing = await getRunningInstance();
 
    if (existing) {
      console.log(`[EC2] Instance already running: ${existing.id} — reusing Elastic IP`);
      return buildJsonResponse(`http://${ELASTIC_IP}`, userEmail);
    }
 
    // 2. No running instance — start a fresh one
    console.log("[EC2] No running instance — starting new one from AMI...");
    const instanceId = await startNewInstance();
 
    // 3. Wait for instance to reach "running" state (up to 2 minutes)
    console.log("[EC2] Waiting for instance to be ready...");
    const isReady = await waitForInstanceState(instanceId, "running", 120);
 
    if (!isReady) {
      throw new Error("Instance did not reach running state within 2 minutes");
    }
 
    // 4. Assign fixed Elastic IP to this new instance
    await assignElasticIp(instanceId);
 
    console.log(`✅ Instance ready — returning landing data to user: ${userEmail}`);
 
    // 5. Return target JSON package cleanly back to frontend
    return buildJsonResponse(`http://${ELASTIC_IP}`, userEmail);
 
  } catch (error: any) {
    console.error("❌ Error starting EC2 instance:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        error: "Failed to initialize server background scripts.",
        details: error.message 
      }),
    };
  }
};
 
// ── JSON Response Builder ──
// Changed from 302 redirect to a 200 JSON object.
// Why: Browsers executing background fetch API actions cannot follow 302 redirects natively 
// without scrubbing custom HTTP headers like "Karma-Vairagya-Bhakti".
function buildJsonResponse(targetUrl: string, userEmail: string) {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*", // Allows browser calls cleanly
    },
    body: JSON.stringify({
      status: "ready",
      targetUrl: targetUrl,
      authorizedUser: userEmail
    }),
  };
}
