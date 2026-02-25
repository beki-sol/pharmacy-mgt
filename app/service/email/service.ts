import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: parseInt(process.env.EMAIL_SERVER_PORT || "587"),
  secure: process.env.EMAIL_SERVER_PORT === "465",
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export async function sendEmail(options: EmailOptions) {
  try {
    const mailOptions = {
      from: options.from || process.env.EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`;
  
  await sendEmail({
    to: email,
    subject: "Reset Your Password",
    html: `
      <h1>Password Reset Request</h1>
      <p>You requested to reset your password. Click the link below to proceed:</p>
      <a href="${resetUrl}" style="
        display: inline-block;
        padding: 12px 24px;
        background-color: #3b82f6;
        color: white;
        text-decoration: none;
        border-radius: 6px;
        margin: 16px 0;
      ">Reset Password</a>
      <p>If you didn't request this, please ignore this email.</p>
      <p>This link will expire in 1 hour.</p>
    `,
  });
}

export async function sendWelcomeEmail(email: string, name: string) {
  await sendEmail({
    to: email,
    subject: "Welcome to Pharmacy Inventory System",
    html: `
      <h1>Welcome, ${name}!</h1>
      <p>Your account has been created successfully.</p>
      <p>You can now access the pharmacy inventory system.</p>
      <p>Please keep your credentials secure and enable two-factor authentication for added security.</p>
    `,
  });
}

export async function sendLowStockAlert(email: string, drugName: string, currentStock: number, minStock: number) {
  await sendEmail({
    to: email,
    subject: `Low Stock Alert: ${drugName}`,
    html: `
      <h1>Low Stock Alert</h1>
      <p>The following drug is running low on stock:</p>
      <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <h3 style="margin: 0; color: #92400e;">${drugName}</h3>
        <p style="margin: 8px 0 0 0; color: #92400e;">
          Current Stock: ${currentStock}<br/>
          Minimum Stock: ${minStock}
        </p>
      </div>
      <p>Please consider reordering this item soon.</p>
    `,
  });
}

export async function sendExpiryAlert(email: string, drugName: string, expiryDate: Date, batchNumber?: string) {
  const formattedDate = expiryDate.toLocaleDateString();
  
  await sendEmail({
    to: email,
    subject: `Expiry Alert: ${drugName}`,
    html: `
      <h1>Expiry Alert</h1>
      <p>The following drug batch is approaching its expiry date:</p>
      <div style="background-color: #fee2e2; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <h3 style="margin: 0; color: #991b1b;">${drugName}</h3>
        <p style="margin: 8px 0 0 0; color: #991b1b;">
          Batch: ${batchNumber || "N/A"}<br/>
          Expiry Date: ${formattedDate}
        </p>
      </div>
      <p>Please take appropriate action before the expiry date.</p>
    `,
  });
}