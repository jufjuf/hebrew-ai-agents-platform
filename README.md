# 🤖 Hebrew AI Agents Platform - פלטפורמת AI Agents בעברית

<div dir="rtl">

## 🎯 סקירה כללית

פלטפורמת AI Agents מתקדמת עם תמיכה מלאה בעברית, המבוססת על ארכיטקטורה מודרנית בהשראת Botpress. הפלטפורמה מאפשרת בניית AI agents חכמים עם יכולות עיבוד שפה טבעית בעברית, ממשק ויזואלי לבנייה, ואינטגרציה עם מערכות ישראליות.

### ✨ תכונות עיקריות
- 🌐 תמיכה מלאה בעברית (RTL, ניקוד, דקדוק)
- 🤖 אינטגרציה עם מודלי שפה מתקדמים (GPT-4, Claude, Llama)
- 🎨 ממשק ויזואלי Drag & Drop לבניית agents
- 🔧 מנוע inference מותאם לעברית
- 🔌 אינטגרציות עם מערכות ישראליות (Priority, Tranzila, בנקים)
- ☁️ תשתית ענן סקיילבילית
- 📊 ניתוחים ודוחות מתקדמים
- 🔒 אבטחה ועמידה בתקנות ישראליות

## 🏗️ ארכיטקטורת המערכת

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React + RTL)                  │
├─────────────────────────────────────────────────────────────┤
│                      API Gateway (Express)                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐  │
│  │ Agent Engine│  │ NLP Service │  │ Integration Hub   │  │
│  └─────────────┘  └─────────────┘  └───────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐  │
│  │  PostgreSQL │  │    Redis    │  │   Vector DB     │  │
│  └─────────────┘  └─────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 התחלה מהירה

### דרישות מקדימות
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 14+
- Redis 6+

### התקנה

```bash
# Clone the repository
git clone https://github.com/jufjuf/hebrew-ai-agents-platform.git
cd hebrew-ai-agents-platform

# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Run with Docker
docker-compose up -d

# Run migrations
npm run db:migrate

# Start development server
npm run dev
```

### הגדרת מודל שפה

```javascript
// config/llm.js
export default {
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      models: ['gpt-4', 'gpt-4-turbo'],
      hebrewOptimized: true
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      models: ['claude-3-opus', 'claude-3-sonnet']
    }
  }
};
```

## 📁 מבנה הפרויקט

```
hebrew-ai-agents-platform/
├── frontend/               # React frontend עם RTL
│   ├── src/
│   │   ├── components/    # רכיבי UI
│   │   ├── pages/        # דפי אפליקציה
│   │   ├── services/     # API services
│   │   └── utils/        # כלים לעברית
├── backend/               # Node.js backend
│   ├── src/
│   │   ├── api/          # REST API endpoints
│   │   ├── agents/       # Agent engine
│   │   ├── nlp/          # עיבוד שפה טבעית
│   │   └── integrations/ # אינטגרציות חיצוניות
├── packages/              # חבילות משותפות
│   ├── hebrew-nlp/       # עיבוד עברית
│   ├── rtl-ui/          # רכיבי UI ל-RTL
│   └── shared-types/     # TypeScript types
├── docker/               # Docker configurations
├── docs/                 # תיעוד
└── tests/               # בדיקות
```

## 🛠️ טכנולוגיות

### Frontend
- **React 18** - עם תמיכה מלאה ב-RTL
- **Material-UI** - עם theme מותאם לעברית
- **Redux Toolkit** - ניהול state
- **React Flow** - לבניית flows ויזואליים

### Backend
- **Node.js + Express** - שרת API
- **TypeScript** - type safety
- **Prisma** - ORM
- **Bull** - תורי משימות

### AI & NLP
- **LangChain** - orchestration של LLMs
- **Pinecone** - vector database
- **Hebrew NLP** - ספריות מותאמות לעברית

### Infrastructure
- **Docker** - containerization
- **Redis** - caching & sessions
- **PostgreSQL** - database
- **MinIO** - object storage

## 📚 תיעוד

- [מדריך למתחילים](docs/getting-started.md)
- [ארכיטקטורה](docs/architecture.md)
- [API Reference](docs/api-reference.md)
- [עיבוד עברית](docs/hebrew-processing.md)
- [אינטגרציות](docs/integrations.md)

## 🤝 תרומה לפרויקט

אנחנו מזמינים אתכם לתרום לפרויקט! ראו את [CONTRIBUTING.md](CONTRIBUTING.md) להנחיות.

## 📄 רישיון

פרויקט זה מופץ תחת רישיון MIT - ראו את קובץ [LICENSE](LICENSE) לפרטים.

## 🙏 קרדיטים

- נבנה בהשראת ארכיטקטורת Botpress
- תודה לקהילת הקוד הפתוח הישראלית
- תמיכה בעברית בזכות [דיקטה](https://dicta.org.il/) ופרויקטים נוספים

## 📞 יצירת קשר

- אתר: [https://hebrew-ai-agents.co.il](https://hebrew-ai-agents.co.il)
- אימייל: support@hebrew-ai-agents.co.il
- Discord: [הצטרפו לקהילה](https://discord.gg/hebrew-ai-agents)

</div>