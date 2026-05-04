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
      <h2 style="color:#fff;margin:0;font-size:20px;">QuickieCell</h2>
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

  const recipientEmail = user?.email || order?.guest_email;
  const recipientName = user?.name || order?.userDetails?.name || order?.guest_name || 'Customer';

  await sendEmail({
    to: recipientEmail,
    subject: `Order Received — ${order.orderNumber}`,
    html: emailWrapper(`
      <h3 style="color:#1a1a2e;">Your Sell Order Has Been Received!</h3>
      <p>Hi <strong>${recipientName}</strong>, thank you for submitting your sell order.</p>
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
  const recipientEmail = user?.email || order?.guest_email;
  const recipientName = user?.name || order?.userDetails?.name || order?.guest_name || 'Customer';

  await sendEmail({
    to: recipientEmail,
    subject: `Shipping Label Ready — ${order.orderNumber}`,
    html: emailWrapper(`
      <h3 style="color:#1a1a2e;">Your Prepaid Shipping Label Is Ready!</h3>
      <p>Hi <strong>${recipientName}</strong>, your shipping label has been created. Please package your device(s) and ship them to us.</p>
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

  const recipientEmail = user?.email || order?.guest_email;
  const recipientName = user?.name || order?.userDetails?.name || order?.guest_name || 'Customer';

  await sendEmail({
    to: recipientEmail,
    subject: `Order Update — ${order.orderNumber} is now "${cfg.label}"`,
    html: emailWrapper(`
      <div style="background:${cfg.color};padding:16px 20px;border-radius:6px;margin-bottom:20px;">
        <h3 style="color:#fff;margin:0;">Status: ${cfg.label}</h3>
      </div>
      <p>Hi <strong>${recipientName}</strong>,</p>
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

  const recipientEmail = user?.email || order?.guest_email;
  const recipientName = user?.name || order?.userDetails?.name || order?.guest_name || 'Customer';

  await sendEmail({
    to: recipientEmail,
    subject: `Payment Sent — ${order.orderNumber}`,
    html: emailWrapper(`
      <div style="background:#27ae60;padding:16px 20px;border-radius:6px;margin-bottom:20px;">
        <h3 style="color:#fff;margin:0;">💸 Your Payment Has Been Sent!</h3>
      </div>
      <p>Hi <strong>${recipientName}</strong>, great news — your payment is on its way!</p>
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

const sendPasswordResetEmail = async (user, resetCode) => {
  await sendEmail({
    to: user.email,
    subject: 'Password Reset Code',
    html: emailWrapper(`
      <h3 style="color:#1a1a2e;">Reset Your Password</h3>
      <p>Hi <strong>${user.name}</strong>, you requested to reset your password.</p>
      <p>Use the following code to reset your password:</p>
      <div style="margin:24px 0;text-align:center;">
        <div style="display:inline-block;background:#1a1a2e;color:#fff;padding:20px 32px;border-radius:6px;font-size:32px;font-weight:bold;letter-spacing:4px;font-family:monospace;">
          ${resetCode}
        </div>
      </div>
      <p style="color:#aaa;font-size:13px;">This code expires in 15 minutes. If you did not request a reset, please ignore this email.</p>
    `),
  });
};

// ────────────────────────────────────────────────────────────────────────────
// 6. PICKUP ASSIGNED
// ────────────────────────────────────────────────────────────────────────────

const sendPickupScheduledEmail = async (order, user) => {
  const { pickupDetails } = order;
  const recipientEmail = user?.email || order?.guest_email || order?.userDetails?.email;
  const recipientName = user?.name || order?.userDetails?.name || order?.guest_name || 'Customer';

  const addressBlock = [
    pickupDetails?.addressLine1,
    pickupDetails?.addressLine2,
    pickupDetails?.city,
    pickupDetails?.state,
    pickupDetails?.zipCode,
    pickupDetails?.address,  // fallback flat address
  ].filter(Boolean).join(', ') || '—';

  await sendEmail({
    to: recipientEmail,
    subject: `Pickup Scheduled — ${order.orderNumber}`,
    html: emailWrapper(`
      <div style="background:#1a1a2e;padding:16px 20px;border-radius:6px;margin-bottom:20px;">
        <h3 style="color:#fff;margin:0;">🚗 Your Pickup Has Been Scheduled!</h3>
      </div>
      <p>Hi <strong>${recipientName}</strong>, a driver has been assigned for your pickup order. Please be ready at the scheduled time.</p>
      ${table([
        infoRow('Order Number', order.orderNumber),
        infoRow('Pickup Date', pickupDetails?.date ? new Date(pickupDetails.date).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) : '—'),
        infoRow('Time Slot', pickupDetails?.timeSlot || pickupDetails?.time || '—'),
        infoRow('Pickup Address', addressBlock),
      ])}
      ${pickupDetails?.notes ? `<div style="background:#fffbe6;border-left:4px solid #f0c040;padding:12px 16px;border-radius:4px;margin-top:16px;"><strong>Special Instructions:</strong><br/><span style="color:#555;">${pickupDetails.notes}</span></div>` : ''}
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin-top:20px;">
        <p style="margin:0;font-size:14px;color:#0369a1;">📌 <strong>Please make sure:</strong></p>
        <ul style="color:#555;font-size:14px;line-height:1.8;margin-top:8px;">
          <li>Someone is available at the address during the time slot.</li>
          <li>Your items are ready and accessible for the driver.</li>
          <li>You have a valid photo ID ready if needed.</li>
        </ul>
      </div>
      <p style="color:#888;font-size:13px;margin-top:20px;">If you need to reschedule or have questions, please contact our support team.</p>
    `),
  });
};

// ────────────────────────────────────────────────────────────────────────────
// 7. DRIVER ASSIGNMENT NOTIFICATION
// ────────────────────────────────────────────────────────────────────────────

const sendDriverAssignmentEmail = async (driver, pickup) => {
  const pd = pickup.pickupDetails || {};
  const order = pickup.orderId;

  // Build full pickup address
  const addressLines = [
    pd.addressLine1,
    pd.addressLine2,
  ].filter(Boolean);
  const cityStateZip = [
    pd?.city || "Los Angeles",
    pd?.state || "CA",
    pd?.zipCode || "90001",
  ].filter(Boolean).join(', ');
  const fullAddress = pickup.pickupAddress || [...addressLines, cityStateZip].filter(Boolean).join('<br/>') || '—';

  // Customer contact info
  const customerName  = pickup.userDetails?.name  || '—';
  const customerPhone = pickup.userDetails?.phone  || pd.phone || '—';
  const customerEmail = pickup.userDetails?.email  || pickup.guest_email || '—';

  // Schedule info
  const pickupDate = pd.pickupDate
    ? new Date(pd.pickupDate).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
    : '—';
  const timeSlot = pd.time || '—';

  // Order items summary
  const itemsHtml = Array.isArray(order?.items) && order.items.length
    ? order.items.map(item => `
        <li style="padding:6px 0;border-bottom:1px solid #eee;font-size:14px;">
          <strong>${item.productName || 'Item'}</strong>
          <span style="float:right;color:#27ae60;font-weight:bold;">$${(item.calculatedPrice || 0).toFixed(2)}</span>
        </li>
      `).join('')
    : '<li style="color:#888;font-size:14px;">No item details available</li>';

  await sendEmail({
    to: driver.email,
    subject: `New Pickup Assignment — ${order?.orderNumber || pickup.pickupId}`,
    html: emailWrapper(`
      <div style="background:#16a34a;padding:16px 20px;border-radius:6px;margin-bottom:20px;">
        <h3 style="color:#fff;margin:0;">📦 You Have a New Pickup Assignment!</h3>
      </div>

      <p>Hi <strong>${driver.name}</strong>, you have been assigned a new pickup. Please review the details below and be at the location on time.</p>

      <h4 style="color:#1a1a2e;border-bottom:2px solid #1a1a2e;padding-bottom:6px;margin-top:24px;">📅 Schedule</h4>
      ${table([
        infoRow('Pickup Date', pickupDate),
        infoRow('Time Slot',   timeSlot),
        infoRow('Order #',     order?.orderNumber || pickup.pickupId),
        infoRow('Status',      '<span style="color:#16a34a;font-weight:bold;">Assigned to You</span>'),
      ])}

      <h4 style="color:#1a1a2e;border-bottom:2px solid #1a1a2e;padding-bottom:6px;margin-top:24px;">📍 Pickup Address</h4>
      <div style="background:#f9f9f9;border-left:4px solid #1a1a2e;padding:16px 20px;border-radius:4px;font-size:15px;line-height:1.8;">
        ${fullAddress}
      </div>

      <h4 style="color:#1a1a2e;border-bottom:2px solid #1a1a2e;padding-bottom:6px;margin-top:24px;">👤 Customer Contact</h4>
      ${table([
        infoRow('Name',  customerName),
        infoRow('Phone', `<a href="tel:${customerPhone}" style="color:#1a1a2e;">${customerPhone}</a>`),
        infoRow('Email', `<a href="mailto:${customerEmail}" style="color:#1a1a2e;">${customerEmail}</a>`),
      ])}

      <h4 style="color:#1a1a2e;border-bottom:2px solid #1a1a2e;padding-bottom:6px;margin-top:24px;">🛍️ Items to Collect</h4>
      <ul style="list-style:none;padding:0;margin:0;">
        ${itemsHtml}
      </ul>
      <p style="margin-top:10px;font-size:14px;font-weight:bold;text-align:right;">Total Value: <span style="color:#1a1a2e;">$${(order?.totalCalculatedPrice || pickup.totalCalculatedPrice || 0).toFixed(2)}</span></p>

      ${pickup.pickupNotes ? `<div style="background:#fffbe6;border-left:4px solid #f0c040;padding:12px 16px;border-radius:4px;margin-top:20px;"><strong>📝 Special Instructions:</strong><br/><span style="color:#555;">${pickup.pickupNotes}</span></div>` : ''}

      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-top:24px;">
        <p style="margin:0;font-size:14px;color:#dc2626;">⚠️ <strong>Important Reminders:</strong></p>
        <ul style="color:#555;font-size:14px;line-height:1.8;margin-top:8px;">
          <li>Verify customer identity before accepting items.</li>
          <li>Inspect items for any visible damage and note it.</li>
          <li>Get the customer's signature on receipt.</li>
          <li>Contact dispatch immediately if you encounter any issues.</li>
        </ul>
      </div>

      <p style="color:#888;font-size:13px;margin-top:24px;">If you have any questions or cannot complete this pickup, contact the admin immediately.</p>
    `),
  });
};

// ────────────────────────────────────────────────────────────────────────────
// 8. CONTACT FORM SUBMISSION
// ────────────────────────────────────────────────────────────────────────────

const sendContactNotificationEmail = async (contact) => {
  const adminEmail = process.env.EMAIL_FROM;

  await sendEmail({
    to: adminEmail,
    subject: `New Contact Form Submission — ${contact.name}`,
    html: emailWrapper(`
      <h3 style="color:#1a1a2e;">📬 New Contact Form Submission</h3>
      <p>You have received a new message from a visitor.</p>
      ${table([
      infoRow('Name', contact.name),
      infoRow('Email', `<a href="mailto:${contact.email}" style="color:#1a1a2e;text-decoration:none;">${contact.email}</a>`),
      infoRow('Phone', contact.phone || '—'),
      infoRow('Company Name', contact.company_name || '—'),
      infoRow('Submitted At', new Date(contact.createdAt).toLocaleString()),
    ])}
      <h4 style="margin-top:20px;color:#1a1a2e;">Message:</h4>
      <div style="background:#f9f9f9;padding:16px;border-left:4px solid #1a1a2e;border-radius:4px;margin:12px 0;white-space:pre-wrap;word-wrap:break-word;">${contact.message}</div>
      
    `),
  });
};

// ────────────────────────────────────────────────────────────────────────────
// 9. DRIVER WELCOME / REGISTRATION
// ────────────────────────────────────────────────────────────────────────────

const sendDriverWelcomeEmail = async (driver, plainPassword) => {
  await sendEmail({
    to: driver.email,
    subject: `Welcome to QuickieCell — Your Driver Account Is Ready`,
    html: emailWrapper(`
      <div style="background:#1a1a2e;padding:16px 20px;border-radius:6px;margin-bottom:20px;">
        <h3 style="color:#fff;margin:0;">🚗 Welcome to the QuickieCell Driver Team!</h3>
      </div>

      <p>Hi <strong>${driver.name}</strong>,</p>
      <p>
        The admin has registered you as a driver on the <strong>QuickieCell</strong> platform.
      </p>

      ${table([
        infoRow('Name',  driver.name),
        infoRow('Phone', driver.phone),
        infoRow('Email (Login)', `<a href="mailto:${driver.email}" style="color:#1a1a2e;">${driver.email}</a>`),
      ])}

      <h4 style="color:#1a1a2e;margin-top:24px;">🔑 Your Temporary Password</h4>
      <div style="margin:16px 0;text-align:center;">
        <div style="display:inline-block;background:#1a1a2e;color:#fff;padding:18px 36px;border-radius:8px;font-size:28px;font-weight:bold;letter-spacing:6px;font-family:monospace;">
          ${plainPassword}
        </div>
      </div>

     

      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:14px 18px;margin-top:16px;">
        <p style="margin:0;font-size:14px;color:#0369a1;">
          📞 If you have any questions or need help, please contact your admin directly.
        </p>
      </div>

      <p style="color:#888;font-size:13px;margin-top:24px;">
        This is an automated registration notification. Please do not reply to this email.
      </p>
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
  sendDriverAssignmentEmail,
  sendDriverWelcomeEmail,
  sendContactNotificationEmail,
};