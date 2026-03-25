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
    // Don't throw — email failures should never break the main flow
    return null;
  }
};

// ────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ────────────────────────────────────────────────────────────────────────────

const emailWrapper = (body) => `
  <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#333;">
    <div style="background:#1a1a2e;padding:20px 24px;border-radius:8px 8px 0 0;">
      <h2 style="color:#fff;margin:0;font-size:20px;">BuyBack Platform</h2>
    </div>
    <div style="padding:28px 24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;background:#fff;">
      ${body}
    </div>
    <p style="text-align:center;color:#aaa;font-size:12px;margin-top:12px;">
      This is an automated email. Please do not reply directly.
    </p>
  </div>
`;

const infoRow = (label, value) => `
  <tr>
    <td style="padding:8px 12px;background:#f7f7f7;font-weight:bold;width:40%;border-bottom:1px solid #eee;">${label}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #eee;">${value}</td>
  </tr>
`;

const table = (rows) => `
  <table style="width:100%;border-collapse:collapse;margin:16px 0;border-radius:6px;overflow:hidden;">
    ${rows}
  </table>
`;

// ────────────────────────────────────────────────────────────────────────────
// 1. ORDER CREATED
// ────────────────────────────────────────────────────────────────────────────

const sendOrderCreatedEmail = async (order, user) => {
  const itemsHtml = order.items.map((item) => {
    const optRows = item.selectedOptions
      .map((o) => `<tr><td style="padding:4px 8px;color:#555;">${o.stepTitle}</td><td style="padding:4px 8px;">${o.optionLabel}</td></tr>`)
      .join('');
    return `
      <div style="margin-bottom:16px;padding:12px;background:#f9f9f9;border-radius:6px;border-left:4px solid #1a1a2e;">
        <strong style="font-size:15px;">${item.productName}</strong>
        <table style="width:100%;margin-top:8px;font-size:13px;">${optRows}</table>
        <p style="margin:6px 0 0;font-size:13px;">Quoted Price: <strong>$${item.calculatedPrice.toFixed(2)}</strong></p>
      </div>
    `;
  }).join('');

  await sendEmail({
    to: user.email,
    subject: `Order Received — ${order.orderNumber}`,
    html: emailWrapper(`
      <h3 style="color:#1a1a2e;">Your Sell Order Has Been Received!</h3>
      <p>Hi <strong>${user.name}</strong>, thank you for submitting your sell order.</p>
      ${table([
        infoRow('Order Number', order.orderNumber),
        infoRow('Status', 'Pending'),
        infoRow('Total Quoted Price', `$${order.totalCalculatedPrice.toFixed(2)}`),
        infoRow('Fulfillment', order.fulfillmentType === 'pickup' ? 'Pickup' : 'Ship to Us'),
      ])}
      <h4 style="margin-top:20px;">Items Submitted</h4>
      ${itemsHtml}
      <p style="color:#555;margin-top:20px;font-size:14px;">
        We will review your order and send you next steps shortly.
        The final payout may vary after physical inspection.
      </p>
    `),
  });
};

// ────────────────────────────────────────────────────────────────────────────
// 2. SHIPPING LABEL SENT
// ────────────────────────────────────────────────────────────────────────────

const sendShippingLabelEmail = async (order, user) => {
  const { shippingDetails } = order;

  await sendEmail({
    to: user.email,
    subject: `Shipping Label Ready — ${order.orderNumber}`,
    html: emailWrapper(`
      <h3 style="color:#1a1a2e;">Your Prepaid Shipping Label Is Ready!</h3>
      <p>Hi <strong>${user.name}</strong>, your shipping label has been created. Please package your device(s) and ship them to us.</p>
      ${table([
        infoRow('Order Number', order.orderNumber),
        infoRow('Courier', shippingDetails.courier || '—'),
        infoRow('Tracking Number', shippingDetails.trackingNumber || '—'),
      ])}
      <div style="margin:20px 0;text-align:center;">
        <a href="${shippingDetails.labelUrl}" style="display:inline-block;background:#1a1a2e;color:#fff;padding:14px 28px;text-decoration:none;border-radius:6px;font-size:15px;">
          📦 Download Shipping Label
        </a>
      </div>
      <h4>Shipping Instructions:</h4>
      <ol style="color:#555;font-size:14px;line-height:1.8;">
        <li>Print the label and attach it securely to your package.</li>
        <li>Pack your device(s) carefully with padding material.</li>
        <li>Drop off at any <strong>${shippingDetails.courier || ''}</strong> location.</li>
        <li>Keep the tracking number for your records.</li>
      </ol>
      <p style="font-size:13px;color:#888;">Once we receive and inspect your device(s), you will be notified with the final payout amount.</p>
    `),
  });
};

// ────────────────────────────────────────────────────────────────────────────
// 3. STATUS UPDATED
// ────────────────────────────────────────────────────────────────────────────

const sendStatusUpdateEmail = async (order, user, note) => {
  const statusConfig = {
    confirmed: { label: 'Confirmed', color: '#3498db', message: 'Your order has been confirmed and is being processed.' },
    label_sent: { label: 'Label Sent', color: '#e67e22', message: 'A prepaid shipping label has been sent. Please check the separate email.' },
    shipped: { label: 'Shipped', color: '#f39c12', message: 'We have received tracking activity on your shipment.' },
    received: { label: 'Received', color: '#8e44ad', message: 'We have received your device(s) at our facility.' },
    inspected: { label: 'Inspected', color: '#2980b9', message: 'Your device(s) have been inspected. Final payout may be adjusted from the initial quote.' },
    paid: { label: 'Paid', color: '#27ae60', message: 'Payment has been sent to you. Thank you for choosing us!' },
  };

  const cfg = statusConfig[order.status] || {
    label: order.status,
    color: '#555',
    message: `Your order status has been updated to: ${order.status}`,
  };

  await sendEmail({
    to: user.email,
    subject: `Order Update — ${order.orderNumber} is now "${cfg.label}"`,
    html: emailWrapper(`
      <div style="background:${cfg.color};padding:16px 20px;border-radius:6px;margin-bottom:20px;">
        <h3 style="color:#fff;margin:0;">Status: ${cfg.label}</h3>
      </div>
      <p>Hi <strong>${user.name}</strong>,</p>
      <p>${cfg.message}</p>
      ${table([
        infoRow('Order Number', order.orderNumber),
        infoRow('New Status', `<span style="color:${cfg.color};font-weight:bold;">${cfg.label}</span>`),
        infoRow('Total Quoted Price', `$${order.totalCalculatedPrice.toFixed(2)}`),
      ])}
      ${note ? `<div style="background:#fffbe6;border-left:4px solid #f0c040;padding:12px 16px;border-radius:4px;margin-top:16px;"><strong>Note from Admin:</strong><br/><span style="color:#555;">${note}</span></div>` : ''}
      <p style="color:#888;font-size:13px;margin-top:20px;">If you have any questions, please contact our support team.</p>
    `),
  });
};

// ────────────────────────────────────────────────────────────────────────────
// 4. PAYMENT SENT
// ────────────────────────────────────────────────────────────────────────────

const sendPaymentSentEmail = async (order, user) => {
  const methodLabels = {
    zelle: 'Zelle',
    paypal: 'PayPal',
    apple_pay: 'Apple Pay',
    venmo: 'Venmo',
    check: 'Check',
  };

  await sendEmail({
    to: user.email,
    subject: `Payment Sent — ${order.orderNumber}`,
    html: emailWrapper(`
      <div style="background:#27ae60;padding:16px 20px;border-radius:6px;margin-bottom:20px;">
        <h3 style="color:#fff;margin:0;">💸 Your Payment Has Been Sent!</h3>
      </div>
      <p>Hi <strong>${user.name}</strong>, great news — your payment is on its way!</p>
      ${table([
        infoRow('Order Number', order.orderNumber),
        infoRow('Payment Method', methodLabels[order.paymentMethod] || order.paymentMethod),
        infoRow('Transaction ID', order.transactionId || '—'),
        infoRow('Amount', `$${order.totalCalculatedPrice.toFixed(2)}`),
        infoRow('Paid At', order.paidAt ? new Date(order.paidAt).toLocaleString() : '—'),
      ])}
      <p style="color:#555;font-size:14px;">
        Please allow a short time for the funds to appear in your account depending on the payment method.
      </p>
      <p style="color:#555;font-size:14px;">Thank you for choosing us! We hope to do business with you again.</p>
    `),
  });
};

// ────────────────────────────────────────────────────────────────────────────
// 5. PASSWORD RESET
// ────────────────────────────────────────────────────────────────────────────

const sendPasswordResetEmail = async (user, resetUrl) => {
  await sendEmail({
    to: user.email,
    subject: 'Password Reset Request',
    html: emailWrapper(`
      <h3 style="color:#1a1a2e;">Reset Your Password</h3>
      <p>Hi <strong>${user.name}</strong>, you requested to reset your password.</p>
      <div style="margin:24px 0;text-align:center;">
        <a href="${resetUrl}" style="display:inline-block;background:#1a1a2e;color:#fff;padding:14px 28px;text-decoration:none;border-radius:6px;font-size:15px;">
          Reset Password
        </a>
      </div>
      <p style="color:#aaa;font-size:13px;">This link expires in 1 hour. If you did not request a reset, please ignore this email.</p>
      <p style="color:#aaa;font-size:12px;">Or copy this URL: ${resetUrl}</p>
    `),
  });
};

// ────────────────────────────────────────────────────────────────────────────
// 6. PICKUP ASSIGNED
// ────────────────────────────────────────────────────────────────────────────

const sendPickupScheduledEmail = async (order, user) => {
  const { pickupDetails } = order;

  await sendEmail({
    to: user.email,
    subject: `Pickup Scheduled — ${order.orderNumber}`,
    html: emailWrapper(`
      <h3 style="color:#1a1a2e;">Your Pickup Has Been Scheduled!</h3>
      <p>Hi <strong>${user.name}</strong>, a driver has been assigned for your pickup.</p>
      ${table([
        infoRow('Order Number', order.orderNumber),
        infoRow('Pickup Date', pickupDetails.date ? new Date(pickupDetails.date).toLocaleDateString() : '—'),
        infoRow('Time Slot', pickupDetails.timeSlot || '—'),
        infoRow('Address', pickupDetails.address || '—'),
      ])}
      ${pickupDetails.notes ? `<p style="color:#555;"><strong>Notes:</strong> ${pickupDetails.notes}</p>` : ''}
      <p style="color:#555;font-size:14px;">Please ensure someone is available at the address during the time slot.</p>
    `),
  });
};

module.exports = {
  sendEmail,
  sendOrderCreatedEmail,
  sendShippingLabelEmail,
  sendStatusUpdateEmail,
  sendPaymentSentEmail,
  sendPasswordResetEmail,
  sendPickupScheduledEmail,
};