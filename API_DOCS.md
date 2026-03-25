# 📘 API Documentation

**Base URL:** `http://localhost:5000/api`  
**Auth Header:** `Authorization: Bearer <token>`

---

## 🔷 AUTH

### POST /auth/register

Register a new user.

**Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "phone": "+1234567890"
}
```

**Response 201:**

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "_id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user"
    },
    "token": "eyJ..."
  }
}
```

---

### POST /auth/login

Login as user.

**Body:**

```json
{ "email": "john@example.com", "password": "password123" }
```

---

### POST /auth/admin/login

Login as admin only.

**Body:**

```json
{ "email": "admin@yourapp.com", "password": "Admin@123456" }
```

---

### POST /auth/forgot-password

Request password reset email.

**Body:**

```json
{ "email": "john@example.com" }
```

---

### POST /auth/reset-password/:token

Reset password using token from email.

**Body:**

```json
{ "password": "newpassword123" }
```

---

### GET /auth/me

Get current authenticated user profile.  
🔒 Requires: `Bearer token`

---

## 🔷 PUBLIC ROUTES

### GET /products

List active products with filtering & pagination.

**Query Params:**
| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Search by name |
| `categoryId` | ObjectId | Filter by category |
| `brandId` | ObjectId | Filter by brand |
| `minPrice` | number | Min base price |
| `maxPrice` | number | Max base price |
| `page` | number | Page number |
| `limit` | number | Items per page |
| `sortBy` | string | Sort field |
| `order` | asc/desc | Sort direction |

---

### GET /products/:id

Get a single product by ID.

---

### GET /products/slug/:slug

Get a single product by slug.

---

### GET /faqs

List public FAQs.

**Query Params:** `category`, `page`, `limit`

---

### GET /blogs

List published blog posts.

**Query Params:** `search`, `tag`, `page`, `limit`

---

### GET /blogs/:slug

Get a single blog post by slug. (Increments view count.)

---

### GET /categories

List all active categories.

---

### GET /brands

List all active brands.

---

### POST /contact

Submit a contact message.

**Body:**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+1234567890",
  "subject": "Question",
  "message": "Hello, I have a question..."
}
```

---

## 🔷 USER — ORDERS

🔒 All require: `Bearer token`

### POST /orders/calculate-price

Calculate final price before placing an order.

**Body:**

```json
{
  "productId": "64abc...",
  "selectedOptions": [
    { "stepKey": "storage", "optionValue": "256gb" },
    { "stepKey": "condition", "optionValue": "good" }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "basePrice": 500,
    "calculatedPrice": 420,
    "priceBreakdown": [
      { "label": "Base Price", "amount": 500, "runningTotal": 500 },
      {
        "label": "Storage: 256GB",
        "modifier": 50,
        "adjustment": 50,
        "runningTotal": 550
      },
      {
        "label": "Condition: Good",
        "modifierType": "percentage",
        "modifier": -20,
        "adjustment": -110,
        "runningTotal": 440
      }
    ]
  }
}
```

---

### POST /orders

Place an order.

**Body:**

```json
{
  "productId": "64abc...",
  "selectedOptions": [{ "stepKey": "storage", "optionValue": "256gb" }],
  "notes": "Optional customer note"
}
```

---

### GET /orders

Get logged-in user's orders.

**Query Params:** `status`, `page`, `limit`

---

### GET /orders/:id

Get a specific order (must belong to the logged-in user).

---

## 🔷 ADMIN PANEL

🔒 All require: `Bearer token` with role `admin`

---

### GET /admin/dashboard

Returns platform overview stats.

**Query Params:** `days` (default: 30)

**Response:**

```json
{
  "data": {
    "stats": {
      "totalUsers": 250,
      "totalOrders": 1024,
      "totalPayout": 87450.00
    },
    "ordersByStatus": {
      "pending": 15,
      "confirmed": 8,
      "received": 5,
      "inspected": 3,
      "paid": 993
    },
    "recentOrders": [...],
    "dailyRevenue": [
      { "_id": "2024-01-01", "revenue": 1200, "orders": 4 }
    ],
    "topProducts": [...]
  }
}
```

---

### CATEGORY MANAGEMENT

| Method | Endpoint                | Description                                    |
| ------ | ----------------------- | ---------------------------------------------- |
| POST   | `/admin/categories`     | Create category                                |
| GET    | `/admin/categories`     | List categories (search, isActive, pagination) |
| PUT    | `/admin/categories/:id` | Update category                                |
| DELETE | `/admin/categories/:id` | Delete category                                |

**Create body:**

```json
{
  "name": "Smartphones",
  "description": "Mobile phones",
  "image": "url",
  "isActive": true
}
```

---

### BRAND MANAGEMENT

| Method | Endpoint            | Description  |
| ------ | ------------------- | ------------ |
| POST   | `/admin/brands`     | Create brand |
| GET    | `/admin/brands`     | List brands  |
| PUT    | `/admin/brands/:id` | Update brand |
| DELETE | `/admin/brands/:id` | Delete brand |

**Create body:**

```json
{
  "name": "Apple",
  "description": "...",
  "logo": "url",
  "website": "https://apple.com"
}
```

---

### PRODUCT MANAGEMENT

| Method | Endpoint                            | Description                                                                 |
| ------ | ----------------------------------- | --------------------------------------------------------------------------- |
| POST   | `/admin/products`                   | Create product                                                              |
| GET    | `/admin/products`                   | List products (search, categoryId, brandId, minPrice, maxPrice, pagination) |
| GET    | `/admin/products/:id`               | Get product                                                                 |
| PUT    | `/admin/products/:id`               | Update product (basePrice, name, steps, etc.)                               |
| DELETE | `/admin/products/:id`               | Delete product                                                              |
| POST   | `/admin/products/:id/steps`         | Add a step                                                                  |
| PUT    | `/admin/products/:id/steps/:stepId` | Update a step                                                               |
| DELETE | `/admin/products/:id/steps/:stepId` | Remove a step                                                               |
| GET    | `/admin/products/:id/analytics`     | Revenue analytics for product                                               |

**Create product body:**

```json
{
  "name": "iPhone 14 Pro",
  "description": "Apple iPhone 14 Pro sell/trade",
  "categoryId": "64abc...",
  "brandId": "64def...",
  "basePrice": 800,
  "images": ["url1", "url2"],
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

**Product analytics response:**

```json
{
  "data": {
    "analytics": [
      { "_id": "2024-01-15", "dailyRevenue": 2500, "dailyOrders": 3 }
    ],
    "totalPayout": 12500,
    "totalOrders": 18,
    "days": 30
  }
}
```

---

### ORDER MANAGEMENT

| Method | Endpoint                   | Description                                                                         |
| ------ | -------------------------- | ----------------------------------------------------------------------------------- |
| GET    | `/admin/orders`            | List all orders (status, userId, productId, search, startDate, endDate, pagination) |
| GET    | `/admin/orders/:id`        | Get single order                                                                    |
| PUT    | `/admin/orders/:id/status` | Update order status                                                                 |

**Update status body:**

```json
{
  "status": "confirmed",
  "note": "Order verified and confirmed."
}
```

**Valid statuses:** `pending` → `confirmed` → `received` → `inspected` → `paid`

> Triggers an email to the user on every status change.

---

### USER MANAGEMENT

| Method | Endpoint                         | Description                                   |
| ------ | -------------------------------- | --------------------------------------------- |
| GET    | `/admin/users`                   | List all users (search, isActive, pagination) |
| GET    | `/admin/users/:id`               | Get user + order stats                        |
| DELETE | `/admin/users/:id`               | Delete user                                   |
| PATCH  | `/admin/users/:id/toggle-status` | Activate / deactivate user                    |

---

### CONTACT MANAGEMENT

| Method | Endpoint                   | Description                                |
| ------ | -------------------------- | ------------------------------------------ |
| GET    | `/admin/contacts`          | List contacts (search, isRead, pagination) |
| PATCH  | `/admin/contacts/:id/read` | Mark as read                               |
| DELETE | `/admin/contacts/:id`      | Delete contact                             |

---

### FAQ MANAGEMENT

| Method | Endpoint          | Description                            |
| ------ | ----------------- | -------------------------------------- |
| POST   | `/admin/faqs`     | Create FAQ                             |
| GET    | `/admin/faqs`     | List FAQs (search, category, isActive) |
| PUT    | `/admin/faqs/:id` | Update FAQ                             |
| DELETE | `/admin/faqs/:id` | Delete FAQ                             |

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

---

### BLOG MANAGEMENT

| Method | Endpoint           | Description                                            |
| ------ | ------------------ | ------------------------------------------------------ |
| POST   | `/admin/blogs`     | Create blog post                                       |
| GET    | `/admin/blogs`     | List blog posts (search, isPublished, tag, pagination) |
| PUT    | `/admin/blogs/:id` | Update blog post                                       |
| DELETE | `/admin/blogs/:id` | Delete blog post                                       |

**Body:**

```json
{
  "title": "How to Get the Best Price for Your Phone",
  "content": "<p>Full HTML content...</p>",
  "excerpt": "Short summary shown in listing",
  "coverImage": "url",
  "tags": ["tips", "phones"],
  "isPublished": true
}
```

---

## 🔷 Standard Response Format

**Success:**

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

**Paginated:**

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

**Error:**

```json
{
  "success": false,
  "message": "Error description",
  "errors": [{ "field": "email", "message": "Valid email is required" }]
}
```

---

## 🔷 HTTP Status Codes

| Code | Meaning                        |
| ---- | ------------------------------ |
| 200  | OK                             |
| 201  | Created                        |
| 400  | Bad Request / Validation Error |
| 401  | Unauthorized                   |
| 403  | Forbidden                      |
| 404  | Not Found                      |
| 409  | Conflict (duplicate)           |
| 429  | Too Many Requests              |
| 500  | Internal Server Error          |
