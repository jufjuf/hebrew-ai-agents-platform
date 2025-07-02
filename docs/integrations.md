# Integrations Guide

## Overview

The Hebrew AI Agents Platform supports a wide range of integrations to connect your agents with various messaging channels, business systems, and third-party services.

## Messaging Channels

### WhatsApp Business

#### Prerequisites
- WhatsApp Business Account
- Facebook Business Manager access
- Verified phone number

#### Setup Steps

1. **Get WhatsApp Business API Access**
   ```bash
   # Configure in the platform
   {
     "accessToken": "your-access-token",
     "phoneNumberId": "your-phone-number-id",
     "webhookVerifyToken": "your-verify-token"
   }
   ```

2. **Configure Webhook**
   ```
   https://api.your-domain.com/webhooks/whatsapp
   ```

3. **Message Templates (Hebrew)**
   ```json
   {
     "name": "order_confirmation_he",
     "language": "he",
     "components": [
       {
         "type": "body",
         "text": "שלום {{1}}, הזמנתך מספר {{2}} התקבלה בהצלחה!"
       }
     ]
   }
   ```

#### Handling Hebrew Text
```javascript
// Ensure proper RTL formatting
function formatWhatsAppMessage(text) {
  // Add RTL mark for Hebrew text
  if (isHebrew(text)) {
    return `\u202B${text}\u202C`;
  }
  return text;
}
```

### Telegram

#### Setup Steps

1. **Create Bot with BotFather**
   ```
   /newbot
   Name: הבוט שלי
   Username: MyHebrewBot
   ```

2. **Configure Bot**
   ```javascript
   {
     "botToken": "bot-token-from-botfather",
     "webhookUrl": "https://api.your-domain.com/webhooks/telegram"
   }
   ```

3. **Hebrew Keyboard**
   ```javascript
   const hebrewKeyboard = {
     reply_markup: {
       keyboard: [
         ['כן', 'לא'],
         ['עזרה', 'תפריט ראשי'],
         ['דבר עם נציג']
       ],
       resize_keyboard: true
     }
   };
   ```

### Facebook Messenger

#### Setup Steps

1. **Create Facebook App**
2. **Add Messenger Product**
3. **Configure Webhook**
4. **Set Page Access Token**

#### Hebrew Quick Replies
```javascript
const quickReplies = [
  {
    content_type: 'text',
    title: 'כן',
    payload: 'YES'
  },
  {
    content_type: 'text',
    title: 'לא',
    payload: 'NO'
  },
  {
    content_type: 'text',
    title: 'אולי',
    payload: 'MAYBE'
  }
];
```

### Web Widget

#### Installation

```html
<!-- Add to your website -->
<script>
  (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'hebrew-ai-widget.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://widget.hebrew-ai-agents.co.il/widget.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','hebrewAI','YOUR-AGENT-ID');
</script>

<!-- Widget Configuration -->
<script>
  window.hebrewAIConfig = {
    agentId: 'YOUR-AGENT-ID',
    position: 'bottom-left', // RTL aware
    language: 'he',
    theme: {
      primaryColor: '#3f51b5',
      fontFamily: 'Assistant, sans-serif'
    },
    welcomeMessage: 'שלום! איך אוכל לעזור?',
    placeholder: 'הקלד הודעה...'
  };
</script>
```

#### Customization

```css
/* RTL-aware styling */
.hebrew-ai-widget {
  direction: rtl;
  text-align: right;
  font-family: 'Assistant', 'Heebo', sans-serif;
}

.hebrew-ai-widget.position-bottom-left {
  left: 20px;
  right: auto;
}

.hebrew-ai-widget .message.user {
  background-color: #e3f2fd;
  margin-right: auto;
  margin-left: 20px;
}

.hebrew-ai-widget .message.agent {
  background-color: #f5f5f5;
  margin-left: auto;
  margin-right: 20px;
}
```

## Business Systems

### CRM Integration

#### Salesforce

```javascript
// Configuration
{
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "refreshToken": "your-refresh-token",
  "instanceUrl": "https://your-instance.salesforce.com"
}

// Create lead from conversation
async function createSalesforceLeadFromConversation(conversation) {
  const lead = {
    FirstName: conversation.user.hebrewFirstName || conversation.user.firstName,
    LastName: conversation.user.hebrewLastName || conversation.user.lastName,
    Email: conversation.user.email,
    Description: `שיחה מתאריך: ${new Date(conversation.startedAt).toLocaleDateString('he-IL')}`,
    LeadSource: 'AI Chat',
    Custom_Hebrew_Notes__c: conversation.summary
  };
  
  return await salesforce.create('Lead', lead);
}
```

#### HubSpot

```javascript
// Configuration
{
  "apiKey": "your-api-key",
  "portalId": "your-portal-id"
}

// Sync contact with Hebrew fields
async function syncHubSpotContact(user) {
  const properties = {
    email: user.email,
    firstname: user.firstName,
    lastname: user.lastName,
    hebrew_first_name: user.hebrewFirstName,
    hebrew_last_name: user.hebrewLastName,
    preferred_language: 'he'
  };
  
  return await hubspot.contacts.create(properties);
}
```

### Israeli Payment Gateways

#### Tranzila

```javascript
// Configuration
{
  "terminalName": "your-terminal",
  "terminalPassword": "your-password",
  "currency": "ILS"
}

// Process payment
async function processTranzilaPayment(amount, customerDetails) {
  const params = {
    terminal_name: config.terminalName,
    terminal_password: config.terminalPassword,
    sum: amount,
    currency: 'ILS',
    cred_type: '1', // Regular credit
    contact: customerDetails.name,
    email: customerDetails.email,
    phone: customerDetails.phone,
    lang: 'he' // Hebrew interface
  };
  
  return await tranzila.process(params);
}
```

#### Cardcom

```javascript
// Configuration
{
  "terminalNumber": "your-terminal",
  "userName": "your-username",
  "apiName": "your-api-name",
  "apiPassword": "your-api-password"
}

// Create invoice
async function createCardcomInvoice(details) {
  const invoice = {
    TerminalNumber: config.terminalNumber,
    UserName: config.userName,
    APILevel: config.apiName,
    codepage: '65001', // UTF-8 for Hebrew
    Operation: '1', // Create invoice
    Language: 'he',
    CoinID: '1', // ILS
    Amount: details.amount,
    ProductName: details.productName,
    CustomerName: details.customerName,
    SendByEmail: 'true',
    EmailAddress: details.email
  };
  
  return await cardcom.createInvoice(invoice);
}
```

### Email Integration

#### Hebrew Email Templates

```javascript
// Email configuration with Hebrew support
const emailConfig = {
  from: {
    name: 'צוות התמיכה',
    email: 'support@company.co.il'
  },
  templates: {
    welcome: {
      subject: 'ברוך הבא ל-{{companyName}}!',
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif;">
          <h1>שלום {{userName}},</h1>
          <p>אנו שמחים שהצטרפת אלינו!</p>
          <p>החשבון שלך נוצר בהצלחה.</p>
        </div>
      `
    }
  }
};
```

### SMS Integration (Israeli Providers)

#### Infobip Israel

```javascript
// Send Hebrew SMS
async function sendHebrewSMS(phone, message) {
  const sms = {
    from: 'Company',
    to: phone,
    text: message,
    language: {
      languageCode: 'HE'
    },
    transliteration: 'HEBREW'
  };
  
  return await infobip.send(sms);
}
```

## Custom Integrations

### Webhook Integration

```javascript
// Webhook handler for custom integrations
app.post('/webhooks/custom/:integrationId', async (req, res) => {
  const { integrationId } = req.params;
  const { event, data } = req.body;
  
  // Verify webhook signature
  const signature = req.headers['x-webhook-signature'];
  if (!verifyWebhookSignature(req.body, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process based on event type
  switch (event) {
    case 'message.received':
      await handleIncomingMessage(integrationId, data);
      break;
    case 'status.update':
      await handleStatusUpdate(integrationId, data);
      break;
  }
  
  res.json({ success: true });
});
```

### API Integration Template

```javascript
class CustomIntegration {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept-Language': 'he'
    };
  }
  
  async sendMessage(recipient, message) {
    const payload = {
      recipient,
      message: {
        text: message,
        language: 'he',
        direction: 'rtl'
      },
      timestamp: new Date().toISOString()
    };
    
    return await this.post('/messages', payload);
  }
  
  async post(endpoint, data) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    return await response.json();
  }
}
```

## Integration Best Practices

### 1. Hebrew Text Handling

```javascript
// Ensure proper encoding
function ensureHebrewEncoding(text) {
  // Convert to UTF-8
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(encoder.encode(text));
}

// Add RTL markers when needed
function wrapRTL(text) {
  return `\u202B${text}\u202C`;
}
```

### 2. Error Handling

```javascript
// Retry mechanism for integrations
async function retryIntegration(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
}
```

### 3. Rate Limiting

```javascript
// Rate limiter for external APIs
class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }
  
  async checkLimit(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Clean old entries
    const requests = this.requests.get(key) || [];
    const recentRequests = requests.filter(time => time > windowStart);
    
    if (recentRequests.length >= this.maxRequests) {
      throw new Error('Rate limit exceeded');
    }
    
    recentRequests.push(now);
    this.requests.set(key, recentRequests);
  }
}
```

### 4. Data Synchronization

```javascript
// Sync data between systems
class DataSync {
  async syncUser(user, integrations) {
    const results = await Promise.allSettled(
      integrations.map(integration => 
        this.syncToIntegration(user, integration)
      )
    );
    
    // Log failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error(`Sync failed for ${integrations[index].name}:`, 
          result.reason
        );
      }
    });
    
    return results;
  }
  
  async syncToIntegration(user, integration) {
    switch (integration.type) {
      case 'salesforce':
        return await this.syncToSalesforce(user, integration);
      case 'hubspot':
        return await this.syncToHubspot(user, integration);
      // Add more integrations
    }
  }
}
```

## Testing Integrations

### Integration Test Suite

```javascript
describe('WhatsApp Integration', () => {
  it('should send Hebrew message correctly', async () => {
    const message = 'שלום, זהו מסר בדיקה';
    const result = await whatsapp.sendMessage('+972501234567', message);
    
    expect(result.status).toBe('sent');
    expect(result.message.text).toContain('\u202B'); // RTL mark
  });
  
  it('should handle Hebrew templates', async () => {
    const template = await whatsapp.sendTemplate(
      '+972501234567',
      'order_confirmation_he',
      ['יוסי', '12345']
    );
    
    expect(template.language).toBe('he');
  });
});
```

### Mock External Services

```javascript
// Mock for testing
class MockIntegration {
  constructor() {
    this.messages = [];
  }
  
  async sendMessage(recipient, message) {
    this.messages.push({ recipient, message, timestamp: Date.now() });
    return { id: `mock-${Date.now()}`, status: 'sent' };
  }
  
  getMessages() {
    return this.messages;
  }
  
  clear() {
    this.messages = [];
  }
}
```

## Monitoring Integrations

### Health Checks

```javascript
// Integration health monitoring
class IntegrationMonitor {
  async checkHealth(integration) {
    const checks = {
      connectivity: await this.checkConnectivity(integration),
      authentication: await this.checkAuth(integration),
      rateLimit: await this.checkRateLimit(integration),
      lastSync: await this.checkLastSync(integration)
    };
    
    const status = Object.values(checks).every(check => check.passed)
      ? 'healthy'
      : 'unhealthy';
    
    return { status, checks };
  }
  
  async checkConnectivity(integration) {
    try {
      const response = await integration.ping();
      return { passed: true, latency: response.latency };
    } catch (error) {
      return { passed: false, error: error.message };
    }
  }
}
```

### Metrics Collection

```javascript
// Track integration metrics
class IntegrationMetrics {
  constructor() {
    this.metrics = new Map();
  }
  
  track(integration, event, data) {
    const key = `${integration.id}:${event}`;
    const existing = this.metrics.get(key) || [];
    
    existing.push({
      timestamp: Date.now(),
      ...data
    });
    
    this.metrics.set(key, existing);
  }
  
  getMetrics(integration, event, timeRange) {
    const key = `${integration.id}:${event}`;
    const all = this.metrics.get(key) || [];
    
    const start = Date.now() - timeRange;
    return all.filter(m => m.timestamp > start);
  }
}
```