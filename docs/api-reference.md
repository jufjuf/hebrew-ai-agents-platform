# API Reference

## Base URL

```
https://api.hebrew-ai-agents.co.il/api
```

For local development:
```
http://localhost:3001/api
```

## Authentication

All API requests require authentication using JWT tokens.

### Headers

```http
Authorization: Bearer <token>
Content-Type: application/json
```

## API Endpoints

### Authentication

#### Register User

```http
POST /auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "hebrewFirstName": "יוחנן",
  "hebrewLastName": "כהן",
  "organizationName": "My Company"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    }
  }
}
```

#### Login

```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "role": "USER",
      "organizations": [
        {
          "id": "org-uuid",
          "name": "My Company",
          "role": "OWNER"
        }
      ]
    },
    "token": "jwt-token",
    "refreshToken": "refresh-token"
  }
}
```

#### Refresh Token

```http
POST /auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "refresh-token"
}
```

### Agents

#### List Agents

```http
GET /agents?organizationId=<orgId>&page=1&limit=20&search=<query>&isActive=true
```

**Query Parameters:**
- `organizationId` (optional): Filter by organization
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `search` (optional): Search query
- `isActive` (optional): Filter by status

**Response:**
```json
{
  "success": true,
  "data": {
    "agents": [
      {
        "id": "agent-uuid",
        "name": "Customer Support Agent",
        "hebrewName": "סוכן תמיכת לקוחות",
        "description": "Handles customer inquiries",
        "model": "gpt-4",
        "temperature": 0.7,
        "maxTokens": 2000,
        "language": "he",
        "isActive": true,
        "createdAt": "2024-01-01T00:00:00Z",
        "_count": {
          "conversations": 150,
          "knowledgeBases": 3,
          "skills": 5
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

#### Get Agent

```http
GET /agents/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "agent": {
      "id": "agent-uuid",
      "name": "Customer Support Agent",
      "hebrewName": "סוכן תמיכת לקוחות",
      "description": "Handles customer inquiries",
      "prompt": "You are a helpful customer support agent...",
      "model": "gpt-4",
      "temperature": 0.7,
      "maxTokens": 2000,
      "language": "he",
      "isActive": true,
      "creator": {
        "id": "user-uuid",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com"
      },
      "organization": {
        "id": "org-uuid",
        "name": "My Company"
      },
      "knowledgeBases": [
        {
          "id": "kb-uuid",
          "name": "Product Documentation",
          "type": "DOCUMENT",
          "_count": {
            "documents": 25
          }
        }
      ],
      "skills": [
        {
          "id": "skill-uuid",
          "name": "API Call",
          "type": "API_CALL",
          "configuration": {}
        }
      ]
    }
  }
}
```

#### Create Agent

```http
POST /agents
```

**Request Body:**
```json
{
  "name": "Sales Assistant",
  "hebrewName": "עוזר מכירות",
  "description": "Helps with sales inquiries",
  "prompt": "You are a knowledgeable sales assistant...",
  "model": "gpt-4",
  "temperature": 0.8,
  "maxTokens": 3000,
  "language": "he",
  "organizationId": "org-uuid"
}
```

#### Update Agent

```http
PUT /agents/:id
```

**Request Body:** Same as create, all fields optional

#### Delete Agent

```http
DELETE /agents/:id
```

#### Test Agent

```http
POST /agents/:id/test
```

**Request Body:**
```json
{
  "message": "שלום, אני צריך עזרה"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "response": "שלום! אשמח לעזור לך. במה אוכל לסייע?",
    "confidence": 0.95,
    "suggestedActions": [
      "לקבל מידע על מוצרים",
      "לבדוק סטטוס הזמנה"
    ],
    "metadata": {
      "language": "he",
      "processedAt": "2024-01-01T00:00:00Z"
    }
  }
}
```

### Conversations

#### List Conversations

```http
GET /conversations?agentId=<id>&status=ACTIVE&channel=web&page=1&limit=20
```

**Query Parameters:**
- `agentId` (optional): Filter by agent
- `status` (optional): ACTIVE, PAUSED, ENDED, TRANSFERRED
- `channel` (optional): web, whatsapp, telegram, etc.
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string
- `search` (optional): Search in messages

#### Get Conversation

```http
GET /conversations/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "conversation": {
      "id": "conv-uuid",
      "agent": {
        "id": "agent-uuid",
        "name": "Support Agent",
        "hebrewName": "סוכן תמיכה"
      },
      "user": {
        "id": "user-uuid",
        "firstName": "John",
        "lastName": "Doe"
      },
      "status": "ACTIVE",
      "channel": "web",
      "startedAt": "2024-01-01T00:00:00Z",
      "messages": [
        {
          "id": "msg-uuid",
          "role": "USER",
          "content": "שלום, אני צריך עזרה",
          "createdAt": "2024-01-01T00:00:00Z"
        },
        {
          "id": "msg-uuid-2",
          "role": "ASSISTANT",
          "content": "שלום! אשמח לעזור. במה אוכל לסייע?",
          "createdAt": "2024-01-01T00:00:01Z"
        }
      ],
      "sentimentAnalysis": {
        "overall": "neutral",
        "score": 0.1,
        "breakdown": []
      }
    }
  }
}
```

#### Start Conversation

```http
POST /conversations
```

**Request Body:**
```json
{
  "agentId": "agent-uuid",
  "channel": "web",
  "metadata": {
    "source": "website",
    "page": "/products"
  }
}
```

#### Send Message

```http
POST /conversations/:id/messages
```

**Request Body:**
```json
{
  "content": "מה המחיר של המוצר?",
  "metadata": {
    "productId": "prod-123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "response": "המחיר של המוצר הוא 299 ₪. האם תרצה לשמוע על התכונות?",
    "confidence": 0.98,
    "suggestedActions": [
      "לקבל פרטים נוספים",
      "להוסיף לסל"
    ]
  }
}
```

#### End Conversation

```http
PUT /conversations/:id/end
```

#### Transfer to Human

```http
PUT /conversations/:id/transfer
```

**Request Body:**
```json
{
  "reason": "הלקוח מבקש לדבר עם נציג אנושי"
}
```

### Knowledge Base

#### List Knowledge Bases

```http
GET /knowledge-bases?agentId=<id>
```

#### Create Knowledge Base

```http
POST /knowledge-bases
```

**Request Body:**
```json
{
  "name": "Product Documentation",
  "description": "All product manuals and guides",
  "type": "DOCUMENT",
  "agentId": "agent-uuid"
}
```

#### Upload Document

```http
POST /knowledge-bases/:id/documents
```

**Request:** Multipart form data
- `file`: Document file (PDF, TXT, DOCX)
- `metadata`: JSON metadata

### Integrations

#### List Available Integrations

```http
GET /integrations/available?category=messaging
```

#### List Connected Integrations

```http
GET /integrations?organizationId=<id>
```

#### Connect Integration

```http
POST /integrations
```

**Request Body:**
```json
{
  "type": "whatsapp",
  "name": "WhatsApp Business",
  "organizationId": "org-uuid",
  "configuration": {
    "accessToken": "token",
    "phoneNumberId": "phone-id"
  }
}
```

#### Test Integration

```http
POST /integrations/:id/test
```

### Analytics

#### Get Overview

```http
GET /analytics/overview?organizationId=<id>&startDate=2024-01-01&endDate=2024-01-31
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalConversations": 1500,
    "totalMessages": 12000,
    "activeAgents": 5,
    "activeConversations": 23,
    "avgResponseTime": 1200,
    "satisfactionRate": 92.5,
    "resolutionRate": 85.3,
    "sentiment": {
      "positive": 1100,
      "negative": 200,
      "neutral": 200
    },
    "dateRange": {
      "start": "2024-01-01",
      "end": "2024-01-31"
    }
  }
}
```

#### Get Conversation Analytics

```http
GET /analytics/conversations?organizationId=<id>&groupBy=day
```

#### Get Agent Performance

```http
GET /analytics/agents?organizationId=<id>
```

#### Get Popular Topics

```http
GET /analytics/topics?organizationId=<id>&limit=20
```

## WebSocket Events

### Connection

```javascript
const socket = io('ws://localhost:3001', {
  auth: {
    token: 'jwt-token'
  }
});
```

### Events

#### Join Conversation
```javascript
socket.emit('join-conversation', conversationId);
```

#### Leave Conversation
```javascript
socket.emit('leave-conversation', conversationId);
```

#### Incoming Events

```javascript
// New message in conversation
socket.on('message:new', (data) => {
  console.log('New message:', data);
});

// Agent typing indicator
socket.on('agent:typing', (data) => {
  console.log('Agent is typing...');
});

// Conversation ended
socket.on('conversation:ended', (data) => {
  console.log('Conversation ended:', data);
});

// Error
socket.on('agent:error', (data) => {
  console.error('Agent error:', data);
});
```

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

### Common Error Codes

- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error

## Rate Limiting

- Default: 100 requests per 15 minutes per IP
- Auth endpoints: 5 requests per 15 minutes per IP
- API endpoints: 30 requests per minute per API key

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1609459200
```

## Pagination

Paginated responses include:

```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

## Webhooks

Configure webhooks to receive real-time events:

### Webhook Events

- `conversation.started`
- `conversation.ended`
- `conversation.transferred`
- `message.received`
- `agent.error`

### Webhook Payload

```json
{
  "event": "conversation.started",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "conversationId": "conv-uuid",
    "agentId": "agent-uuid",
    "channel": "web"
  }
}
```

### Webhook Security

Verify webhook signatures:

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return hash === signature;
}
```