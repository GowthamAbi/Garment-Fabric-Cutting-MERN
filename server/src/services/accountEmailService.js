import crypto from "node:crypto";

export async function issueEmailVerification(user, companyKey) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  user.emailVerificationToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();
  const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].replace(/\/$/, "");
  const activationUrl = `${clientUrl}/c/${companyKey}/login?verifyToken=${rawToken}`;
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    const result = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [user.email],
        subject: "Activate your UG SaaS account",
        html: `<h2>UG SaaS account activation</h2><p>Your User ID is <b>${user.userId}</b>.</p><p><a href="${activationUrl}">Verify email and activate account</a></p><p>This link expires in 24 hours. UG SaaS will never email your password.</p>`,
      }),
    });
    if (!result.ok) throw new Error("Activation email could not be sent");
  }
  return activationUrl;
}

