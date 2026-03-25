# 🚀 Production Backend — Node.js + Express + MongoDB

A complete, production-ready REST API with authentication, dynamic pricing engine, admin panel, email notifications, and clean MVC architecture.

---

## 📦 Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Email | Nodemailer |
| Validation | express-validator |
| Security | helmet, cors, express-rate-limit |

---

## 🗂 Project Structure

```
src/
├── config/
│   ├── db.js              # MongoDB connection
│   └── email.js           # Nodemailer transporter
├── controllers/
│   ├── admin/             # All admin controllers
│   │   ├── dashboard.controller.js
│   │   ├── category.controller.js
│   │   ├── brand.controller.js
│   │   ├── product.controller.js
│   │   ├── order.controller.js
│   │   ├── user.controller.js
│   │   ├── contact.controller.js
│   │   ├── faq.controller.js
│   │   └── blog.controller.js
│   ├── auth.controller.js
│   ├── order.controller.js
│   ├── product.controller.js
│   ├── contact.controller.js
│   └── public.controller.js
├── middlewares/
│   ├── auth.middleware.js  # verifyToken, isAdmin
│   ├── error.middleware.js # Global error handler
│   └── validate.middleware.js
├── models/
│   ├── User.js
│   ├── Category.js
│   ├── Brand.js
│   ├── Product.js          # Includes dynamic steps/pricing
│   ├── Order.js
│   ├── Contact.js
│   ├── FAQ.js
│   └── Blog.js
├── routes/
│   ├── admin/             # Admin-only routes (protected)
│   │   ├── index.js
│   │   ├── dashboard.routes.js
│   │   ├── category.routes.js
│   │   ├── brand.routes.js
│   │   ├── product.routes.js
│   │   ├── order.routes.js
│   │   ├── user.routes.js
│   │   ├── contact.routes.js
│   │   ├── faq.routes.js
│   │   └── blog.routes.js
│   ├── auth.routes.js
│   ├── order.routes.js
│   ├── product.routes.js
│   ├── public.routes.js
│   └── index.js
├── services/
│   ├── auth.service.js
│   ├── email.service.js
│   └── pricing.service.js  # Dynamic pricing engine
├── utils/
│   ├── ApiError.js
│   ├── ApiResponse.js
│   ├── asyncHandler.js
│   ├── pagination.js
│   └── seedAdmin.js
├── app.js
└── server.js
```

---

## ⚡ Quick Start

### 1. Clone and install

```bash
git clone <repo-url>
cd backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your MongoDB URI, email credentials, etc.
```

### 3. Start the server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The server starts at `http://localhost:5000` and **automatically seeds the admin account** on first run.

---

## 🔐 Authentication

All protected routes require:
```
Authorization: Bearer <token>
```

| Role | Access |
|------|--------|
| `user` | Register, login, browse products, place orders, view own orders |
| `admin` | Full access to all `/api/admin/*` routes |

---

## 💰 Dynamic Pricing Engine

Products have a `basePrice` plus configurable `steps`. Each step has `options` that modify the price:

**modifierType: `fixed`** — adds/subtracts a flat amount  
**modifierType: `percentage`** — multiplies running total by `(1 + modifier/100)`

Example product step:
```json
{
  "title": "Storage",
  "key": "storage",
  "isRequired": true,
  "options": [
    { "label": "128GB", "value": "128gb", "priceModifier": 0, "modifierType": "fixed" },
    { "label": "256GB", "value": "256gb", "priceModifier": 50, "modifierType": "fixed" },
    { "label": "512GB", "value": "512gb", "priceModifier": 120, "modifierType": "fixed" }
  ]
}
```

Calculate price before ordering:
```
POST /api/orders/calculate-price
{
  "productId": "...",
  "selectedOptions": [
    { "stepKey": "storage", "optionValue": "256gb" }
  ]
}
```

---

## 📧 Email Notifications

Emails are sent automatically on:
- ✅ Order placed → confirmation email to user
- ✅ Order status updated → status update email to user
- ✅ Forgot password → reset link email

Email failures are **non-blocking** — they log a warning but do not break API responses.

---

## 📊 Pagination

All list endpoints support:

| Query Param | Default | Description |
|-------------|---------|-------------|
| `page` | 1 | Page number |
| `limit` | 10 | Items per page (max 100) |
| `sortBy` | `createdAt` | Field to sort by |
| `order` | `desc` | `asc` or `desc` |
| `search` | — | Text search |

Response includes a `pagination` object:
```json
{
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

## 🛡 Security Features

- Helmet.js for HTTP headers
- CORS configured per environment
- Rate limiting: 100 req/15min globally, 20 req/15min on auth routes
- Passwords hashed with bcrypt (salt rounds: 12)
- JWT with expiry
- Mongoose query sanitization via schema validation

---

## 🌱 Admin Seed

On first startup, an admin account is created using:
```
ADMIN_EMAIL=admin@yourapp.com
ADMIN_PASSWORD=Admin@123456
```
Change these values in `.env` before deploying.

---

## 📄 API Documentation

See `API_DOCS.md` for the full endpoint reference.
