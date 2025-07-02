import axios from 'axios';
import { logger } from '../../utils/logger';

export interface HebrewTextAnalysis {
  text: string;
  normalizedText: string;
  tokens: string[];
  nikud?: string;
  entities: Entity[];
  sentiment: SentimentResult;
  language: string;
  isHebrew: boolean;
}

export interface Entity {
  text: string;
  type: 'PERSON' | 'LOCATION' | 'ORGANIZATION' | 'DATE' | 'NUMBER' | 'OTHER';
  startIndex: number;
  endIndex: number;
  confidence: number;
}

export interface SentimentResult {
  score: number; // -1 to 1
  label: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

export class HebrewNLPService {
  private baseUrl: string;
  private enableNikud: boolean;
  private enableSpellCheck: boolean;

  constructor() {
    this.baseUrl = process.env.HEBREW_NLP_SERVICE_URL || 'http://localhost:5000';
    this.enableNikud = process.env.ENABLE_NIKUD === 'true';
    this.enableSpellCheck = process.env.ENABLE_SPELL_CHECK === 'true';
  }

  /**
   * Analyze Hebrew text
   */
  async analyzeText(text: string): Promise<HebrewTextAnalysis> {
    try {
      const isHebrew = this.isHebrewText(text);
      
      if (!isHebrew) {
        return {
          text,
          normalizedText: text,
          tokens: text.split(' '),
          entities: [],
          sentiment: { score: 0, label: 'neutral', confidence: 0 },
          language: 'en',
          isHebrew: false
        };
      }

      // Normalize text
      const normalizedText = this.normalizeHebrewText(text);

      // Tokenize
      const tokens = await this.tokenize(normalizedText);

      // Extract entities
      const entities = await this.extractEntities(normalizedText);

      // Analyze sentiment
      const sentiment = await this.analyzeSentiment(normalizedText);

      // Add nikud if enabled
      let nikudText;
      if (this.enableNikud) {
        nikudText = await this.addNikud(normalizedText);
      }

      return {
        text,
        normalizedText,
        tokens,
        nikud: nikudText,
        entities,
        sentiment,
        language: 'he',
        isHebrew: true
      };
    } catch (error) {
      logger.error('Hebrew NLP analysis failed:', error);
      throw error;
    }
  }

  /**
   * Check if text contains Hebrew characters
   */
  isHebrewText(text: string): boolean {
    const hebrewRegex = /[֐-׿]/;
    return hebrewRegex.test(text);
  }

  /**
   * Normalize Hebrew text
   */
  normalizeHebrewText(text: string): string {
    // Remove excessive whitespace
    let normalized = text.replace(/\s+/g, ' ').trim();
    
    // Fix common Hebrew typing issues
    normalized = normalized
      .replace(/״/g, '"') // Replace Hebrew quotation marks
      .replace(/׳/g, "'") // Replace Hebrew apostrophe
      .replace(/־/g, '-'); // Replace Hebrew hyphen
    
    // Handle final letters
    normalized = this.fixFinalLetters(normalized);
    
    return normalized;
  }

  /**
   * Fix Hebrew final letters
   */
  private fixFinalLetters(text: string): string {
    const finalLetterMap: { [key: string]: string } = {
      'כ': 'ך',
      'מ': 'ם',
      'נ': 'ן',
      'פ': 'ף',
      'צ': 'ץ'
    };

    const words = text.split(' ');
    return words.map(word => {
      if (word.length > 1) {
        const lastChar = word[word.length - 1];
        const secondLastChar = word[word.length - 2];
        
        // Check if we need to replace with final letter
        if (finalLetterMap[secondLastChar] && !/[֐-׿]/.test(lastChar)) {
          return word.slice(0, -2) + finalLetterMap[secondLastChar] + lastChar;
        }
      }
      return word;
    }).join(' ');
  }

  /**
   * Tokenize Hebrew text
   */
  async tokenize(text: string): Promise<string[]> {
    try {
      // For now, simple tokenization. In production, use proper Hebrew tokenizer
      const tokens = text.split(/\s+/);
      return tokens.filter(token => token.length > 0);
    } catch (error) {
      logger.error('Tokenization failed:', error);
      return text.split(' ');
    }
  }

  /**
   * Extract named entities from Hebrew text
   */
  async extractEntities(text: string): Promise<Entity[]> {
    try {
      // In production, integrate with Hebrew NER service
      // For now, return mock data
      const entities: Entity[] = [];
      
      // Simple pattern matching for demonstration
      const patterns = [
        { regex: /\d{2}\/\d{2}\/\d{4}/g, type: 'DATE' as const },
        { regex: /\d+/g, type: 'NUMBER' as const },
        { regex: /[א-ת]+ [א-ת]+/g, type: 'PERSON' as const } // Very simple Hebrew name pattern
      ];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.regex.exec(text)) !== null) {
          entities.push({
            text: match[0],
            type: pattern.type,
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            confidence: 0.8
          });
        }
      }

      return entities;
    } catch (error) {
      logger.error('Entity extraction failed:', error);
      return [];
    }
  }

  /**
   * Analyze sentiment of Hebrew text
   */
  async analyzeSentiment(text: string): Promise<SentimentResult> {
    try {
      // In production, use Hebrew sentiment analysis model
      // For now, return neutral sentiment
      return {
        score: 0,
        label: 'neutral',
        confidence: 0.5
      };
    } catch (error) {
      logger.error('Sentiment analysis failed:', error);
      return {
        score: 0,
        label: 'neutral',
        confidence: 0
      };
    }
  }

  /**
   * Add nikud (vocalization) to Hebrew text
   */
  async addNikud(text: string): Promise<string> {
    try {
      // In production, integrate with Dicta or similar service
      // For now, return the original text
      return text;
    } catch (error) {
      logger.error('Nikud addition failed:', error);
      return text;
    }
  }

  /**
   * Translate text between Hebrew and English
   */
  async translate(text: string, targetLang: 'he' | 'en'): Promise<string> {
    try {
      // In production, use translation API
      // For now, return the original text
      return text;
    } catch (error) {
      logger.error('Translation failed:', error);
      return text;
    }
  }

  /**
   * Check spelling and suggest corrections
   */
  async spellCheck(text: string): Promise<{ original: string; suggestions: string[] }[]> {
    try {
      // In production, integrate with Hebrew spell checker
      return [];
    } catch (error) {
      logger.error('Spell check failed:', error);
      return [];
    }
  }

  /**
   * Generate Hebrew text summary
   */
  async summarize(text: string, maxLength: number = 100): Promise<string> {
    try {
      // In production, use Hebrew summarization model
      const words = text.split(' ');
      if (words.length <= maxLength) {
        return text;
      }
      return words.slice(0, maxLength).join(' ') + '...';
    } catch (error) {
      logger.error('Summarization failed:', error);
      return text.substring(0, maxLength * 5) + '...';
    }
  }
}

export const hebrewNLP = new HebrewNLPService();