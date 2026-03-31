# 📘 API Documentation — Buyback Platform

**Base URL:** `http://localhost:5000/api`  
**Auth Header:** `Authorization: Bearer <token>`  
**Content-Type:** `application/json`

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Standard Response Format](#standard-response-format)
4. [Auth Endpoints](#auth-endpoints)
5. [Public Endpoints](#public-endpoints)
6. [Orders (User)](#orders--user-)
7. [Admin — Dashboard](#admin--dashboard)
8. [Admin — Categories](#admin--categories)
9. [Admin — Brands](#admin--brands)
10. [Admin — Products](#admin--products)
11. [Admin — Orders](#admin--orders)
12. [Admin — Users](#admin--users)
13. [Admin — Contacts](#admin--contacts)
14. [Admin — FAQs](#admin--faqs)
15. [Admin — Blogs](#admin--blogs)
16. [Error Codes](#error-codes)

---

## Overview

This is a production-ready REST API for a **device buyback platform**. Users submit devices for sale, choose configuration options, get a dynamic price quote, and place orders. Admins manage the full lifecycle: confirm, receive, inspect, and pay out.

**Key Features:**

- JWT-based authentication (user + admin roles)
- Dynamic pricing engine (fixed + percentage modifiers per product step)
- Full order lifecycle: `pending → confirmed → received → inspected → paid`
- Automated email notifications on order creation and every status change
- Paginated list endpoints with search and filter support

---

## Authentication

All protected routes require a Bearer token in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

| Role    | Access Level                                                       |
| ------- | ------------------------------------------------------------------ |
| `user`  | Register, login, browse products/public content, manage own orders |
| `admin` | Full access to all `/api/admin/*` routes                           |

**Rate Limits:**

- Global API: **100 requests / 15 minutes**
- Auth routes: **20 requests / 15 minutes**

---

## Standard Response Format

### Success

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

### Paginated

```json
{
  "success": true,
  "message": "Success",
  "data": [...],
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

### Error

```json
{
  "success": false,
  "message": "Error description",
  "errors": [{ "field": "email", "message": "Valid email is required" }]
}
```

---

## Auth Endpoints

### `POST /auth/register`

Register a new user account.

**Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "phone": "+1234567890"
}
```

**Validation:**

- `name` — required, non-empty string
- `email` — required, valid email format
- `password` — required, min 6 characters

**Response `201`:**

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "_id": "64abc123...",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "role": "user",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "eyJ..."
  }
}
```

**Errors:** `409` Email already registered | `400` Validation failed

---

### `POST /auth/login`

Login as a regular user.

**Body:**

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response `200`:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "...",
      "name": "John Doe",
      "email": "...",
      "role": "user"
    },
    "token": "eyJ..."
  }
}
```

**Errors:** `401` Invalid credentials | `403` Account deactivated

---

### `POST /auth/admin/login`

Login as admin only. Returns `403` if the account role is not `admin`.

**Body:**

```json
{
  "email": "admin@yourapp.com",
  "password": "Admin@123456"
}
```

**Response `200`:** Same shape as `/auth/login`

---

### `POST /auth/forgot-password`

Request a password reset email. Always returns success to prevent email enumeration.

**Body:**

```json
{
  "email": "john@example.com"
}
```

**Response `200`:**

```json
{
  "success": true,
  "message": "If that email exists, a reset code has been sent.",
  "data": {}
}
```

> 📧 **Email Trigger:** Sends a 5-digit reset code valid for **15 minutes** to the user's email.

---

### `POST /auth/reset-password`

Reset password using the code received via email.

**Body:**

```json
{
  "code": "12345",
  "password": "newpassword123"
}
```

**Response `200`:**

```json
{
  "success": true,
  "message": "Password reset successful",
  "data": {
    "user": { ... },
    "token": "eyJ..."
  }
}
```

**Errors:** `400` Reset code invalid or expired

---

### `GET /auth/me`

🔒 **Requires:** Bearer token

Get the currently authenticated user's profile.

**Response `200`:**

```json
{
  "success": true,
  "message": "Profile fetched",
  "data": {
    "user": {
      "_id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "isActive": true
    }
  }
}
```

---

## Public Endpoints

These endpoints require no authentication.

---

### `GET /products`

List active products with filtering and pagination.

**Query Parameters:**

| Param        | Type     | Description                            |
| ------------ | -------- | -------------------------------------- |
| `search`     | string   | Search by product name                 |
| `categoryId` | ObjectId | Filter by category                     |
| `brandId`    | ObjectId | Filter by brand                        |
| `minPrice`   | number   | Minimum base price filter              |
| `maxPrice`   | number   | Maximum base price filter              |
| `page`       | number   | Page number (default: 1)               |
| `limit`      | number   | Items per page (default: 10, max: 100) |
| `sortBy`     | string   | Sort field (default: createdAt)        |
| `order`      | string   | `asc` or `desc` (default: desc)        |

**Response `200` (paginated):**

```json
{
  "success": true,
  "data": [
    {
      "_id": "64abc...",
      "name": "iPhone 14 Pro",
      "slug": "iphone-14-pro-1700000000000",
      "description": "...",
      "categoryId": { "_id": "...", "name": "Smartphones", "slug": "smartphones" },
      "brandId": { "_id": "...", "name": "Apple", "slug": "apple", "logo": "url" },
      "basePrice": 800,
      "steps": [ ... ],
      "images": ["url1"],
      "isActive": true
    }
  ],
  "pagination": { "total": 50, "page": 1, "limit": 10, "totalPages": 5, "hasNextPage": true, "hasPrevPage": false }
}
```

> Note: `totalOrders` and `totalPayout` fields are excluded from public responses.

---

### `GET /products/:id`

Get a single active product by MongoDB ID.

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "product": {
      "_id": "...",
      "name": "iPhone 14 Pro",
      "basePrice": 800,
      "steps": [
        {
          "_id": "...",
          "title": "Storage",
          "key": "storage",
          "isRequired": true,
          "order": 1,
          "options": [
            {
              "label": "128GB",
              "value": "128gb",
              "priceModifier": 0,
              "modifierType": "fixed"
            },
            {
              "label": "256GB",
              "value": "256gb",
              "priceModifier": 50,
              "modifierType": "fixed"
            }
          ]
        },
        {
          "title": "Condition",
          "key": "condition",
          "isRequired": true,
          "order": 2,
          "options": [
            {
              "label": "Like New",
              "value": "like_new",
              "priceModifier": 0,
              "modifierType": "percentage"
            },
            {
              "label": "Good",
              "value": "good",
              "priceModifier": -10,
              "modifierType": "percentage"
            },
            {
              "label": "Fair",
              "value": "fair",
              "priceModifier": -25,
              "modifierType": "percentage"
            },
            {
              "label": "Poor",
              "value": "poor",
              "priceModifier": -45,
              "modifierType": "percentage"
            }
          ]
        }
      ]
    }
  }
}
```

**Errors:** `404` Product not found

---

### `GET /products/slug/:slug`

Get a single active product by its URL slug.

**Response `200`:** Same as `GET /products/:id`

---

### `GET /faqs`

List public active FAQs.

**Query Parameters:** `category` (string), `page` (number), `limit` (number)

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "faqs": [
      {
        "_id": "...",
        "question": "How long does payment take?",
        "answer": "Payment is processed within 24 hours of inspection.",
        "category": "Payments",
        "order": 1,
        "isActive": true
      }
    ]
  }
}
```

---

### `GET /blogs`

List published blog posts (content field excluded).

**Query Parameters:** `search` (title search), `tag` (string), `page`, `limit`

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "blogs": [
      {
        "_id": "...",
        "title": "How to Get the Best Price for Your Phone",
        "slug": "how-to-get-best-price-...",
        "excerpt": "Short summary...",
        "coverImage": "url",
        "author": { "_id": "...", "name": "Admin" },
        "tags": ["tips", "phones"],
        "isPublished": true,
        "publishedAt": "2024-01-01T00:00:00.000Z",
        "views": 142
      }
    ]
  }
}
```

---

### `GET /blogs/:slug`

Get a single published blog post by slug. **Increments view count** on each request.

**Response `200`:** Full blog object including `content` field.

**Errors:** `404` Blog post not found

---

### `GET /categories`

List all active categories, sorted by name.

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "_id": "...",
        "name": "Smartphones",
        "slug": "smartphones",
        "description": "...",
        "image": "url",
        "isActive": true
      }
    ]
  }
}
```

---

### `GET /brands`

List all active brands, sorted by name.

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "brands": [
      {
        "_id": "...",
        "name": "Apple",
        "slug": "apple",
        "logo": "url",
        "website": "https://apple.com",
        "isActive": true
      }
    ]
  }
}
```

---

### `POST /contact`

Submit a contact/support message.

**Body:**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+1234567890",
  "subject": "Question about my order",
  "message": "Hello, I have a question about..."
}
```

**Validation:** `name`, `email`, `message` are required.

**Response `201`:**

```json
{
  "success": true,
  "message": "Message received. We will get back to you shortly.",
  "data": {
    "contact": {
      "_id": "...",
      "name": "Jane Doe",
      "email": "...",
      "message": "...",
      "isRead": false
    }
  }
}
```

---

## Orders (User)

🔒 **All require:** Bearer token (user role)

---

### `POST /orders/calculate-price`

Calculate the final buyback quote price **before** placing an order. No order is created.

**Body:**

```json
{
  "productId": "64abc123...",
  "selectedOptions": [
    { "stepKey": "storage", "optionValue": "256gb" },
    { "stepKey": "condition", "optionValue": "good" }
  ]
}
```

**Pricing Engine Logic:**

- Starts with `product.basePrice`
- `modifierType: "fixed"` → adds/subtracts flat amount from running total
- `modifierType: "percentage"` → multiplies running total by `(1 + modifier/100)`
- Price cannot go below `$0`

**Response `200`:**

```json
{
  "success": true,
  "message": "Price calculated",
  "data": {
    "basePrice": 800,
    "calculatedPrice": 756.0,
    "priceBreakdown": [
      { "label": "Base Price", "amount": 800, "runningTotal": 800 },
      {
        "label": "Storage: 256GB",
        "modifierType": "fixed",
        "modifier": 50,
        "adjustment": 50,
        "runningTotal": 850
      },
      {
        "label": "Condition: Good",
        "modifierType": "percentage",
        "modifier": -10,
        "adjustment": -85,
        "runningTotal": 765
      }
    ],
    "enrichedOptions": [
      {
        "stepKey": "storage",
        "stepTitle": "Storage",
        "optionLabel": "256GB",
        "optionValue": "256gb",
        "priceModifier": 50,
        "modifierType": "fixed"
      },
      {
        "stepKey": "condition",
        "stepTitle": "Condition",
        "optionLabel": "Good",
        "optionValue": "good",
        "priceModifier": -10,
        "modifierType": "percentage"
      }
    ],
    "productName": "iPhone 14 Pro"
  }
}
```

**Errors:** `404` Product not found | `400` Invalid option selection | `400` Required step missing

---

### `POST /orders`

Place a buyback order for a product.

> 📧 **Email Trigger:** Sends an order confirmation email to the user.

**Body:**

```json
{
  "productId": "64abc123...",
  "selectedOptions": [
    { "stepKey": "storage", "optionValue": "256gb" },
    { "stepKey": "condition", "optionValue": "good" }
  ],
  "notes": "Screen has a minor scratch on the back"
}
```

**Validation:** `productId` must be a valid MongoDB ObjectId. `selectedOptions` must be an array.

**Response `201`:**

```json
{
  "success": true,
  "message": "Order placed successfully",
  "data": {
    "order": {
      "_id": "...",
      "orderNumber": "ORD-1700000000000-0001",
      "userId": "...",
      "productId": { "_id": "...", "name": "iPhone 14 Pro" },
      "selectedOptions": [ ... ],
      "basePrice": 800,
      "calculatedPrice": 756.00,
      "priceBreakdown": [ ... ],
      "status": "pending",
      "statusHistory": [
        { "status": "pending", "note": "Order placed by user", "changedAt": "2024-01-01T00:00:00.000Z" }
      ],
      "userDetails": { "name": "John Doe", "email": "john@example.com", "phone": "+1234567890" },
      "notes": "Screen has a minor scratch on the back",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

---

### `GET /orders`

Get all orders belonging to the authenticated user.

**Query Parameters:** `status` (filter), `page`, `limit`, `sortBy`, `order`

**Valid Statuses:** `pending`, `confirmed`, `received`, `inspected`, `paid`

**Response `200` (paginated):** Array of order objects with `productId` populated (name, basePrice, images).

---

### `GET /orders/:id`

Get a single order by ID. Must belong to the authenticated user.

**Response `200`:** Full order object with product details including `steps`.

**Errors:** `404` Order not found (or does not belong to user)

---

## Admin — Dashboard

🔒 **All admin routes require:** Bearer token with `admin` role

---

### `GET /admin/dashboard`

Get platform overview statistics and analytics.

**Query Parameters:** `days` (number, default: 30) — analytics window

**Response `200`:**

```json
{
  "success": true,
  "message": "Dashboard data fetched",
  "data": {
    "stats": {
      "totalUsers": 250,
      "totalOrders": 1024,
      "totalPayout": 87450.0
    },
    "ordersByStatus": {
      "pending": 15,
      "confirmed": 8,
      "received": 5,
      "inspected": 3,
      "paid": 993
    },
    "recentOrders": [
      {
        "_id": "...",
        "orderNumber": "ORD-...",
        "userId": { "name": "John Doe", "email": "john@example.com" },
        "productId": { "name": "iPhone 14 Pro" },
        "status": "pending",
        "calculatedPrice": 756.0,
        "createdAt": "..."
      }
    ],
    "dailyRevenue": [{ "_id": "2024-01-01", "revenue": 1200.0, "orders": 4 }],
    "topProducts": [
      {
        "_id": "...",
        "productName": "iPhone 14 Pro",
        "revenue": 12500.0,
        "orders": 18
      }
    ]
  }
}
```

---

## Admin — Categories

### `POST /admin/categories`

Create a new category.

**Body:**

```json
{
  "name": "Smartphones",
  "description": "Mobile phones and smartphones",
  "image": "https://cdn.example.com/smartphones.jpg",
  "isActive": true
}
```

**Validation:** `name` required.  
**Response `201`:** `{ "category": { ... } }`

---

### `GET /admin/categories`

List categories with pagination.

**Query Parameters:** `search`, `isActive` (true/false), `page`, `limit`, `sortBy`, `order`

**Response `200` (paginated)**

---

### `PUT /admin/categories/:id`

Update a category by ID.

**Body:** Any subset of category fields.  
**Response `200`:** `{ "category": { ... } }`  
**Errors:** `404` Category not found

---

### `DELETE /admin/categories/:id`

Delete a category by ID.

**Response `200`:** `{}`  
**Errors:** `404` Category not found

---

## Admin — Brands

### `POST /admin/brands`

Create a new brand. Slug is auto-generated from `name`.

**Body:**

```json
{
  "name": "Apple",
  "description": "Apple Inc.",
  "logo": "https://cdn.example.com/apple-logo.png",
  "website": "https://apple.com",
  "isActive": true
}
```

**Validation:** `name` required.  
**Response `201`:** `{ "brand": { ... } }`

---

### `GET /admin/brands`

List brands with pagination.

**Query Parameters:** `search`, `isActive` (true/false), `page`, `limit`, `sortBy`, `order`

---

### `PUT /admin/brands/:id`

Update a brand by ID.

---

### `DELETE /admin/brands/:id`

Delete a brand by ID.

---

## Admin — Products

### `POST /admin/products`

Create a new product with pricing steps.

**Body:**

```json
{
  "name": "iPhone 14 Pro",
  "description": "Apple iPhone 14 Pro buyback",
  "categoryId": "64abc...",
  "brandId": "64def...",
  "basePrice": 800,
  "images": ["https://cdn.example.com/iphone14pro.jpg"],
  "isActive": true,
  "steps": [
    {
      "title": "Storage",
      "key": "storage",
      "isRequired": true,
      "order": 1,
      "options": [
        {
          "label": "128GB",
          "value": "128gb",
          "priceModifier": 0,
          "modifierType": "fixed"
        },
        {
          "label": "256GB",
          "value": "256gb",
          "priceModifier": 50,
          "modifierType": "fixed"
        },
        {
          "label": "512GB",
          "value": "512gb",
          "priceModifier": 120,
          "modifierType": "fixed"
        }
      ]
    },
    {
      "title": "Condition",
      "key": "condition",
      "isRequired": true,
      "order": 2,
      "options": [
        {
          "label": "Like New",
          "value": "like_new",
          "priceModifier": 0,
          "modifierType": "percentage"
        },
        {
          "label": "Good",
          "value": "good",
          "priceModifier": -10,
          "modifierType": "percentage"
        },
        {
          "label": "Fair",
          "value": "fair",
          "priceModifier": -25,
          "modifierType": "percentage"
        },
        {
          "label": "Poor",
          "value": "poor",
          "priceModifier": -45,
          "modifierType": "percentage"
        }
      ]
    }
  ]
}
```

**Validation:** `name`, `categoryId` (MongoId), `brandId` (MongoId), `basePrice` (≥0) required.  
**Response `201`:** `{ "product": { ... } }` with populated category and brand.

---

### `GET /admin/products`

List all products (including inactive) with pagination.

**Query Parameters:** `search`, `categoryId`, `brandId`, `isActive` (true/false), `minPrice`, `maxPrice`, `page`, `limit`, `sortBy`, `order`

---

### `GET /admin/products/:id`

Get a single product by ID.

---

### `PUT /admin/products/:id`

Update a product. Can update any field including `basePrice`, `steps`, `isActive`.

---

### `DELETE /admin/products/:id`

Delete a product permanently.

---

### `POST /admin/products/:id/steps`

Add a new pricing step to a product.

**Body:**

```json
{
  "title": "Color",
  "key": "color",
  "isRequired": false,
  "order": 3,
  "options": [
    {
      "label": "Black",
      "value": "black",
      "priceModifier": 0,
      "modifierType": "fixed"
    },
    {
      "label": "White",
      "value": "white",
      "priceModifier": 0,
      "modifierType": "fixed"
    }
  ]
}
```

**Response `200`:** Full updated product.

---

### `PUT /admin/products/:id/steps/:stepId`

Update an existing step by its embedded document ID.

**Body:** Any step fields to update.  
**Response `200`:** Full updated product.  
**Errors:** `404` Step not found

---

### `DELETE /admin/products/:id/steps/:stepId`

Remove a step from a product.

**Response `200`:** Full updated product.

---

### `GET /admin/products/:id/analytics`

Get revenue analytics for a specific product.

**Query Parameters:** `days` (number, default: 30)

**Response `200`:**

```json
{
  "success": true,
  "message": "Product analytics fetched",
  "data": {
    "analytics": [
      { "_id": "2024-01-15", "dailyRevenue": 2500.0, "dailyOrders": 3 }
    ],
    "totalPayout": 12500.0,
    "totalOrders": 18,
    "days": 30
  }
}
```

---

## Admin — Orders

### `GET /admin/orders`

List all orders with advanced filtering.

**Query Parameters:**

| Param       | Type     | Description                          |
| ----------- | -------- | ------------------------------------ |
| `status`    | string   | Filter by order status               |
| `userId`    | ObjectId | Filter by specific user              |
| `productId` | ObjectId | Filter by product                    |
| `search`    | string   | Search by order number               |
| `startDate` | ISO date | Filter orders created on/after date  |
| `endDate`   | ISO date | Filter orders created on/before date |
| `page`      | number   | Page number                          |
| `limit`     | number   | Items per page                       |

**Response `200` (paginated):** Orders with user (name, email, phone) and product (name, basePrice) populated.

---

### `GET /admin/orders/:id`

Get a single order with full details including product steps.

---

### `PUT /admin/orders/:id/status`

Update order status and optionally add a note.

> 📧 **Email Trigger:** Sends a status update email to the user when status changes.

**Body:**

```json
{
  "status": "confirmed",
  "note": "Order verified and item confirmed for acceptance."
}
```

**Valid Statuses:** `pending` → `confirmed` → `received` → `inspected` → `paid`

**Response `200`:**

```json
{
  "success": true,
  "message": "Order status updated to \"confirmed\"",
  "data": {
    "order": {
      "status": "confirmed",
      "statusHistory": [
        {
          "status": "pending",
          "note": "Order placed by user",
          "changedAt": "..."
        },
        {
          "status": "confirmed",
          "note": "Order verified...",
          "changedAt": "..."
        }
      ]
    }
  }
}
```

**Errors:** `400` Invalid status value | `404` Order not found

### `PUT /admin/orders/:id/shipping`

**Body:**

````json
{
  "labelUrl": "https:img.....",
  "trackingNumber": "tr11....",
  "courier": "esc"
}


### `PUT /admin/orders/:id/pay`

**Body:**
```json
{
  "paymentMethod":"cash"
}


---

## Admin — Users

### `GET /admin/users`

List all users with `role: "user"` (admins excluded).

**Query Parameters:** `search` (name or email), `isActive` (true/false), `page`, `limit`, `sortBy`, `order`

---

### `GET /admin/users/:id`

Get a specific user with order statistics.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "user": { "_id": "...", "name": "...", "email": "...", "isActive": true },
    "stats": {
      "totalOrders": 5,
      "totalSpent": 3200.00
    }
  }
}
````

**Errors:** `404` User not found

---

### `DELETE /admin/users/:id`

Permanently delete a user account.

**Errors:** `404` User not found

---

### `PATCH /admin/users/:id/toggle-status`

Toggle a user's `isActive` status (activate/deactivate).

**Response `200`:**

```json
{
  "success": true,
  "message": "User activated",
  "data": { "user": { ..., "isActive": true } }
}
```

---

## Admin — Contacts

### `GET /admin/contacts`

List all contact form submissions.

**Query Parameters:** `search` (name, email, or subject), `isRead` (true/false), `page`, `limit`, `sortBy`, `order`

---

### `PATCH /admin/contacts/:id/read`

Mark a contact message as read.

**Response `200`:** `{ "contact": { ..., "isRead": true } }`  
**Errors:** `404` Contact not found

---

### `DELETE /admin/contacts/:id`

Delete a contact submission.

**Errors:** `404` Contact not found

---

## Admin — FAQs

### `POST /admin/faqs`

Create a new FAQ entry.

**Body:**

```json
{
  "question": "How long does payment take?",
  "answer": "Payment is processed within 24 hours of inspection.",
  "category": "Payments",
  "order": 1,
  "isActive": true
}
```

**Validation:** `question` and `answer` are required.  
**Response `201`:** `{ "faq": { ... } }`

---

### `GET /admin/faqs`

List all FAQs (including inactive).

**Query Parameters:** `search` (question text), `category`, `isActive` (true/false)

> Note: This endpoint does NOT paginate. Results sorted by `order` then `createdAt` descending.

---

### `PUT /admin/faqs/:id`

Update a FAQ entry.

---

### `DELETE /admin/faqs/:id`

Delete a FAQ entry.

---

## Admin — Blogs

### `POST /admin/blogs`

Create a new blog post. Slug is auto-generated from title + timestamp.

**Body:**

```json
{
  "title": "How to Get the Best Price for Your Phone",
  "content": "<p>Full HTML content goes here...</p>",
  "excerpt": "Short summary shown in listing pages",
  "coverImage": "https://cdn.example.com/blog-cover.jpg",
  "tags": ["tips", "phones", "guide"],
  "isPublished": false
}
```

**Validation:** `title` and `content` are required.

> **Note:** Setting `isPublished: true` automatically sets `publishedAt` timestamp.

**Response `201`:** `{ "blog": { ... } }` with author populated.

---

### `GET /admin/blogs`

List all blog posts (published and unpublished).

**Query Parameters:** `search` (title), `isPublished` (true/false), `tag`, `page`, `limit`, `sortBy`, `order`

---

### `PUT /admin/blogs/:id`

Update a blog post. Can publish/unpublish by setting `isPublished`.

---

### `DELETE /admin/blogs/:id`

Delete a blog post.

---

## Email Notifications

Emails are sent automatically — no direct API endpoint required. Email failures are **non-blocking** (logged but do not break API responses).

| Trigger                       | Recipient | Subject                                          |
| ----------------------------- | --------- | ------------------------------------------------ |
| Order placed (`POST /orders`) | User      | `Order Confirmed — {orderNumber}`                |
| Order status updated          | User      | `Order Update — {orderNumber} is now "{STATUS}"` |
| Forgot password request       | User      | `Password Reset Request`                         |

---

## Dynamic Pricing Engine

Products have a `basePrice` plus configurable `steps`. Each step contains `options` that modify the running price:

| `modifierType` | Behavior                                           |
| -------------- | -------------------------------------------------- |
| `fixed`        | Adds/subtracts a flat dollar amount                |
| `percentage`   | Multiplies running total by `(1 + modifier / 100)` |

Price is clamped at `$0` minimum.

**Example Calculation:**

```
Base Price:          $800.00
+ 256GB (fixed +50): $850.00
+ Good (% -10):      $850 × 0.90 = $765.00
Final Quote:         $765.00
```

---

## Pagination

All list endpoints support:

| Query Param | Default     | Description               |
| ----------- | ----------- | ------------------------- |
| `page`      | `1`         | Page number               |
| `limit`     | `10`        | Items per page (max: 100) |
| `sortBy`    | `createdAt` | Field to sort by          |
| `order`     | `desc`      | `asc` or `desc`           |

---

## Error Codes

| Code | Meaning                              |
| ---- | ------------------------------------ |
| 200  | OK                                   |
| 201  | Created                              |
| 400  | Bad Request / Validation Error       |
| 401  | Unauthorized (missing/invalid token) |
| 403  | Forbidden (wrong role / deactivated) |
| 404  | Resource Not Found                   |
| 409  | Conflict (e.g., duplicate email)     |
| 429  | Too Many Requests (rate limited)     |
| 500  | Internal Server Error                |

### Common Error Scenarios

| Scenario                        | Code | Message                                     |
| ------------------------------- | ---- | ------------------------------------------- |
| Invalid MongoDB ObjectId        | 400  | `Invalid _id: <value>`                      |
| Duplicate email on register     | 409  | `Email already exists.`                     |
| Mongoose validation failure     | 400  | `Validation failed` + field errors array    |
| Missing/invalid JWT             | 401  | `Invalid token`                             |
| Expired JWT                     | 401  | `Token expired`                             |
| Non-admin accessing admin route | 403  | `Access denied. Admin privileges required.` |
| Deactivated user login          | 403  | `Your account has been deactivated.`        |
