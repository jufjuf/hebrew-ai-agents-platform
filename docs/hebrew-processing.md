# Hebrew Language Processing Guide

## Overview

The Hebrew AI Agents Platform includes comprehensive support for Hebrew language processing, addressing the unique challenges of Hebrew text analysis, including right-to-left (RTL) rendering, morphological complexity, and cultural context.

## Hebrew NLP Features

### 1. Text Normalization

#### Character Normalization
- Handles multiple Unicode representations
- Normalizes Hebrew quotation marks (״ → ")
- Normalizes Hebrew apostrophes (׳ → ')
- Normalizes Hebrew hyphens (־ → -)

#### Final Letter Handling
```javascript
// Automatic conversion of final letters
כ → ך (kaf → final kaf)
מ → ם (mem → final mem)
נ → ן (nun → final nun)
פ → ף (pe → final pe)
צ → ץ (tsadi → final tsadi)
```

### 2. Tokenization

#### Challenges in Hebrew
- Words can be composed of multiple morphemes
- Prefixes like ב, ל, מ, ה, ו, ש are attached to words
- Suffixes for possession and pronouns

#### Implementation
```javascript
// Example tokenization
Input: "בבית הספר שלנו"
Tokens: ["ב", "בית", "ה", "ספר", "שלנו"]
Morphemes: [
  { prefix: "ב", root: "בית" },
  { prefix: "ה", root: "ספר" },
  { prefix: "של", suffix: "נו" }
]
```

### 3. Named Entity Recognition (NER)

#### Supported Entity Types
- **PERSON**: שמות אנשים
- **LOCATION**: מקומות
- **ORGANIZATION**: ארגונים
- **DATE**: תאריכים
- **NUMBER**: מספרים
- **HEBREW_DATE**: תאריכים עבריים

#### Hebrew-Specific Patterns
```javascript
// Hebrew date patterns
"כ״א בתשרי" → { type: 'HEBREW_DATE', value: '21 Tishrei' }
"יום העצמאות" → { type: 'HOLIDAY', value: 'Independence Day' }

// Hebrew names
"דוד בן גוריון" → { type: 'PERSON', value: 'David Ben-Gurion' }
```

### 4. Sentiment Analysis

#### Hebrew Sentiment Lexicon
- Positive terms: מצוין, נהדר, מושלם
- Negative terms: גרוע, נורא, איום
- Intensifiers: מאוד, ביותר, לגמרי

#### Context-Aware Analysis
```javascript
// Example sentiment analysis
Input: "השירות היה מצוין, אבל הזמן המתנה היה ארוך מדי"
Output: {
  overall: 'mixed',
  scores: {
    positive: 0.6,
    negative: 0.4
  },
  aspects: [
    { aspect: 'שירות', sentiment: 'positive' },
    { aspect: 'זמן המתנה', sentiment: 'negative' }
  ]
}
```

### 5. Nikud (Vocalization) Support

#### Automatic Nikud Addition
```javascript
// Using Dicta API integration
Input: "שלום"
Output: "שָׁלוֹם"

Input: "הבית הלבן"
Output: "הַבַּיִת הַלָּבָן"
```

#### Nikud Removal
```javascript
// For search and comparison
Input: "שָׁלוֹם"
Output: "שלום"
```

## Integration with LLMs

### 1. Prompt Engineering for Hebrew

#### System Prompts
```javascript
const hebrewSystemPrompt = `
אתה עוזר AI דובר עברית. יש לך הבנה מעמיקה של השפה העברית, כולל:
- דקדוק ותחביר
- ניבים וסלנג
- הקשר תרבותי ישראלי
- חגים ומועדים

ענה תמיד בעברית תקנית וברורה.
השתמש בסימני פיסוק נכונים.
התאם את התשובות לרמת השפה של המשתמש.
`;
```

#### Context Enhancement
```javascript
// Add Hebrew-specific context
function enhanceHebrewContext(userInput, context) {
  return {
    ...context,
    language: 'he',
    calendar: 'hebrew', // Support Hebrew dates
    culturalContext: 'israeli',
    writingDirection: 'rtl',
    dateFormat: 'DD/MM/YYYY',
    currencySymbol: '₪',
    workWeek: 'Sunday-Thursday'
  };
}
```

### 2. Token Optimization for Hebrew

#### Hebrew Token Characteristics
- Hebrew text typically uses 30-50% more tokens than English
- Nikud significantly increases token count
- Prefixes and suffixes affect tokenization

#### Optimization Strategies
```javascript
// Remove nikud for token optimization
function optimizeHebrewTokens(text) {
  // Remove nikud marks
  const withoutNikud = text.replace(/[֑-ׇ]/g, '');
  
  // Compress common phrases
  const compressed = withoutNikud
    .replace(/בסדר גמור/g, 'בסד״ג')
    .replace(/תודה רבה/g, 'תוד״ר');
  
  return compressed;
}
```

## RTL User Interface Considerations

### 1. CSS Adjustments

```css
/* Global RTL support */
html[dir="rtl"] {
  direction: rtl;
  text-align: right;
}

/* Flex direction reversal */
[dir="rtl"] .flex-row {
  flex-direction: row-reverse;
}

/* Margin and padding adjustments */
[dir="rtl"] .ml-4 {
  margin-left: 0;
  margin-right: 1rem;
}
```

### 2. Mixed Content Handling

```javascript
// Handle mixed Hebrew-English text
function wrapMixedContent(text) {
  // Wrap English in LTR spans
  return text.replace(
    /([a-zA-Z0-9]+)/g,
    '<span dir="ltr">$1</span>'
  );
}

// Smart direction detection
function detectTextDirection(text) {
  const hebrewChars = (text.match(/[֐-׿]/g) || []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
  return hebrewChars > latinChars ? 'rtl' : 'ltr';
}
```

## Hebrew-Specific Features

### 1. Gematria Support

```javascript
const gematriaValues = {
  'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5,
  'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9, 'י': 10,
  'כ': 20, 'ל': 30, 'מ': 40, 'נ': 50, 'ס': 60,
  'ע': 70, 'פ': 80, 'צ': 90, 'ק': 100, 'ר': 200,
  'ש': 300, 'ת': 400
};

function calculateGematria(word) {
  return word.split('').reduce((sum, char) => {
    return sum + (gematriaValues[char] || 0);
  }, 0);
}
```

### 2. Hebrew Calendar Integration

```javascript
// Convert Hebrew date to Gregorian
function hebrewToGregorian(hebrewDate) {
  // Integration with hebcal library
  const { HDate } = require('@hebcal/core');
  const hd = new HDate(hebrewDate);
  return hd.greg();
}

// Holiday detection
function getHebrewHolidays(date) {
  const holidays = [
    { name: 'ראש השנה', month: 'Tishrei', day: 1 },
    { name: 'יום כיפור', month: 'Tishrei', day: 10 },
    { name: 'סוכות', month: 'Tishrei', day: 15 },
    { name: 'פסח', month: 'Nisan', day: 15 }
  ];
  // Return matching holidays
}
```

### 3. Slang and Colloquial Hebrew

```javascript
const hebrewSlang = {
  'סבבה': ['cool', 'great'],
  'אחלה': ['awesome', 'amazing'],
  'וואלה': ['wow', 'damn'],
  'יאללה': ['let\'s go'],
  'בלגאן': ['mess', 'chaos']
};

// Normalize slang for processing
function normalizeSlang(text) {
  let normalized = text;
  Object.entries(hebrewSlang).forEach(([slang, meanings]) => {
    normalized = normalized.replace(
      new RegExp(slang, 'g'),
      meanings[0]
    );
  });
  return normalized;
}
```

## Performance Optimization

### 1. Caching Strategies

```javascript
// Cache Hebrew NLP results
const hebrewNLPCache = new Map();

function getCachedAnalysis(text) {
  const cacheKey = crypto.createHash('md5')
    .update(text)
    .digest('hex');
  
  if (hebrewNLPCache.has(cacheKey)) {
    return hebrewNLPCache.get(cacheKey);
  }
  
  const analysis = performHebrewAnalysis(text);
  hebrewNLPCache.set(cacheKey, analysis);
  return analysis;
}
```

### 2. Batch Processing

```javascript
// Process multiple Hebrew texts efficiently
async function batchProcessHebrew(texts) {
  const batches = [];
  const batchSize = 10;
  
  for (let i = 0; i < texts.length; i += batchSize) {
    batches.push(texts.slice(i, i + batchSize));
  }
  
  const results = await Promise.all(
    batches.map(batch => processBatch(batch))
  );
  
  return results.flat();
}
```

## Best Practices

### 1. Hebrew Text Input
- Always validate Hebrew character encoding
- Handle both full and defective spelling (כתיב מלא וחסר)
- Support common typing mistakes

### 2. Search and Matching
- Implement fuzzy matching for Hebrew
- Consider morphological variations
- Support search with and without nikud

### 3. Data Storage
- Use UTF-8 encoding
- Store both original and normalized versions
- Index Hebrew content properly

### 4. User Experience
- Provide Hebrew keyboard shortcuts
- Support Hebrew voice input
- Implement Hebrew autocomplete

## Testing Hebrew Features

### Unit Tests
```javascript
describe('Hebrew Text Processing', () => {
  test('normalizes final letters correctly', () => {
    expect(normalizeFinalLetters('מים')).toBe('מים');
    expect(normalizeFinalLetters('מימ')).toBe('מים');
  });
  
  test('detects Hebrew text', () => {
    expect(isHebrewText('שלום')).toBe(true);
    expect(isHebrewText('Hello')).toBe(false);
    expect(isHebrewText('שלום Hello')).toBe(true);
  });
});
```

### Integration Tests
```javascript
describe('Hebrew NLP Integration', () => {
  test('analyzes Hebrew sentiment correctly', async () => {
    const result = await analyzeSentiment('השירות מצוין');
    expect(result.sentiment).toBe('positive');
    expect(result.score).toBeGreaterThan(0.5);
  });
});
```

## Resources and References

### Hebrew NLP Libraries
- [Dicta](https://dicta.org.il/) - Hebrew NLP tools
- [Hebrew-NLP](https://github.com/HebrewNLP/awesome-hebrew-nlp) - Collection of Hebrew NLP resources
- [HebMorph](https://github.com/synhershko/HebMorph) - Hebrew morphological analyzer

### Hebrew Datasets
- Hebrew Wikipedia dump
- Hebrew news corpora
- Hebrew social media datasets

### Standards and Guidelines
- Unicode Hebrew block (U+0590–U+05FF)
- Hebrew keyboard layouts
- Israeli accessibility standards