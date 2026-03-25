const transporter = require('../config/email');

const sendEmail = async ({ to, subject, html, text }) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
    text,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ Email failed to ${to}:`, error.message);
    // Don't throw — email failure should not break order/user flow
    return null;
  }
};

// ────────────────────────────────────────────
// EMAIL TEMPLATES
// ────────────────────────────────────────────

const sendOrderCreatedEmail = async (order, user) => {
  const optionsHtml = order.selectedOptions
    .map((o) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;">${o.stepTitle}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;">${o.optionLabel}</td></tr>`)
    .join('');

  await sendEmail({
    to: user.email,
    subject: `Order Confirmed — ${order.orderNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#2c3e50;">Your Order Has Been Received!</h2>
        <p>Hi <strong>${user.name}</strong>,</p>
        <p>Thank you for your order. Here are the details:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr style="background:#f4f4f4;">
            <th style="padding:8px 12px;text-align:left;">Order Number</th>
            <td style="padding:8px 12px;">${order.orderNumber}</td>
          </tr>
          <tr>
            <th style="padding:8px 12px;text-align:left;">Status</th>
            <td style="padding:8px 12px;text-transform:capitalize;">${order.status}</td>
          </tr>
          <tr style="background:#f4f4f4;">
            <th style="padding:8px 12px;text-align:left;">Total Price</th>
            <td style="padding:8px 12px;font-weight:bold;">$${order.calculatedPrice.toFixed(2)}</td>
          </tr>
        </table>
        <h4>Selected Options:</h4>
        <table style="width:100%;border-collapse:collapse;">
          <tr style="background:#2c3e50;color:#fff;">
            <th style="padding:8px 12px;text-align:left;">Step</th>
            <th style="padding:8px 12px;text-align:left;">Selection</th>
          </tr>
          ${optionsHtml}
        </table>
        <p style="margin-top:24px;color:#666;">We will notify you when your order status changes.</p>
      </div>
    `,
  });
};

const sendOrderStatusUpdateEmail = async (order, user) => {
  const statusMessages = {
    confirmed: 'Your order has been confirmed and is being processed.',
    received: 'We have received your item and it is now in our facility.',
    inspected: 'Your item has been inspected. Final price may be adjusted.',
    paid: 'Payment has been processed. Thank you for doing business with us!',
  };

  const statusColors = {
    confirmed: '#3498db',
    received: '#f39c12',
    inspected: '#9b59b6',
    paid: '#27ae60',
  };

  const message = statusMessages[order.status] || `Your order status has been updated to: ${order.status}.`;
  const color = statusColors[order.status] || '#2c3e50';

  await sendEmail({
    to: user.email,
    subject: `Order Update — ${order.orderNumber} is now "${order.status.toUpperCase()}"`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:${color};padding:20px;border-radius:8px 8px 0 0;">
          <h2 style="color:#fff;margin:0;">Order Status Updated</h2>
        </div>
        <div style="padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px;">
          <p>Hi <strong>${user.name}</strong>,</p>
          <p>${message}</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr style="background:#f4f4f4;">
              <th style="padding:8px 12px;text-align:left;">Order Number</th>
              <td style="padding:8px 12px;">${order.orderNumber}</td>
            </tr>
            <tr>
              <th style="padding:8px 12px;text-align:left;">New Status</th>
              <td style="padding:8px 12px;font-weight:bold;color:${color};text-transform:capitalize;">${order.status}</td>
            </tr>
            <tr style="background:#f4f4f4;">
              <th style="padding:8px 12px;text-align:left;">Calculated Price</th>
              <td style="padding:8px 12px;">$${order.calculatedPrice.toFixed(2)}</td>
            </tr>
          </table>
          ${order.notes ? `<p><strong>Admin Note:</strong> ${order.notes}</p>` : ''}
          <p style="color:#666;margin-top:24px;">If you have any questions, please contact our support team.</p>
        </div>
      </div>
    `,
  });
};

const sendPasswordResetEmail = async (user, resetUrl) => {
  await sendEmail({
    to: user.email,
    subject: 'Password Reset Request',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#2c3e50;">Reset Your Password</h2>
        <p>Hi <strong>${user.name}</strong>,</p>
        <p>You requested to reset your password. Click the button below to proceed:</p>
        <a href="${resetUrl}" style="display:inline-block;background:#3498db;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;margin:16px 0;">Reset Password</a>
        <p style="color:#999;font-size:13px;">This link will expire in 1 hour. If you did not request a password reset, please ignore this email.</p>
        <p style="color:#999;font-size:12px;">Or paste this URL in your browser: ${resetUrl}</p>
      </div>
    `,
  });
};

module.exports = {
  sendEmail,
  sendOrderCreatedEmail,
  sendOrderStatusUpdateEmail,
  sendPasswordResetEmail,
};
