import { Document } from 'langchain/document';
import { OpenAIEmbeddings } from '@langchain/openai';
import { logger } from '../utils/logger';
import axios from 'axios';

interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, any>;
}

interface SearchResult {
  id: string;
  score: number;
  pageContent: string;
  metadata: Record<string, any>;
}

export class VectorStore {
  private embeddings: OpenAIEmbeddings;
  private qdrantUrl: string;
  private collectionName: string = 'hebrew-ai-documents';

  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'text-embedding-3-small',
    });
    this.qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
    this.initializeCollection();
  }

  /**
   * Initialize Qdrant collection
   */
  private async initializeCollection(): Promise<void> {
    try {
      // Check if collection exists
      const collections = await axios.get(`${this.qdrantUrl}/collections`);
      const exists = collections.data.result.collections.some(
        (c: any) => c.name === this.collectionName
      );

      if (!exists) {
        // Create collection
        await axios.put(`${this.qdrantUrl}/collections/${this.collectionName}`, {
          vectors: {
            size: 1536, // OpenAI embedding size
            distance: 'Cosine',
          },
        });
        logger.info(`Vector collection '${this.collectionName}' created`);
      }
    } catch (error) {
      logger.error('Failed to initialize vector collection:', error);
    }
  }

  /**
   * Add documents to vector store
   */
  async addDocuments(
    documents: Document[],
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const points = [];

      for (const doc of documents) {
        const embedding = await this.embeddings.embedQuery(doc.pageContent);
        points.push({
          id: doc.metadata.id || this.generateId(),
          vector: embedding,
          payload: {
            content: doc.pageContent,
            ...doc.metadata,
            ...metadata,
          },
        });
      }

      // Batch upsert to Qdrant
      await axios.put(
        `${this.qdrantUrl}/collections/${this.collectionName}/points`,
        {
          points,
        }
      );

      logger.info(`Added ${documents.length} documents to vector store`);
    } catch (error) {
      logger.error('Failed to add documents to vector store:', error);
      throw error;
    }
  }

  /**
   * Search for similar documents
   */
  async similaritySearch(
    query: string,
    k: number = 5,
    filter?: Record<string, any>
  ): Promise<SearchResult[]> {
    try {
      // Generate embedding for query
      const queryEmbedding = await this.embeddings.embedQuery(query);

      // Search in Qdrant
      const response = await axios.post(
        `${this.qdrantUrl}/collections/${this.collectionName}/points/search`,
        {
          vector: queryEmbedding,
          limit: k,
          filter: filter ? this.buildQdrantFilter(filter) : undefined,
          with_payload: true,
        }
      );

      return response.data.result.map((hit: any) => ({
        id: hit.id,
        score: hit.score,
        pageContent: hit.payload.content,
        metadata: hit.payload,
      }));
    } catch (error) {
      logger.error('Vector search failed:', error);
      throw error;
    }
  }

  /**
   * Delete documents by filter
   */
  async deleteDocuments(filter: Record<string, any>): Promise<void> {
    try {
      await axios.post(
        `${this.qdrantUrl}/collections/${this.collectionName}/points/delete`,
        {
          filter: this.buildQdrantFilter(filter),
        }
      );

      logger.info('Documents deleted from vector store');
    } catch (error) {
      logger.error('Failed to delete documents from vector store:', error);
      throw error;
    }
  }

  /**
   * Update document in vector store
   */
  async updateDocument(
    id: string,
    content: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const embedding = await this.embeddings.embedQuery(content);

      await axios.put(
        `${this.qdrantUrl}/collections/${this.collectionName}/points`,
        {
          points: [
            {
              id,
              vector: embedding,
              payload: {
                content,
                ...metadata,
                updatedAt: new Date().toISOString(),
              },
            },
          ],
        }
      );

      logger.info(`Document ${id} updated in vector store`);
    } catch (error) {
      logger.error(`Failed to update document ${id}:`, error);
      throw error;
    }
  }

  /**
   * Build Qdrant filter from simple filter object
   */
  private buildQdrantFilter(filter: Record<string, any>): any {
    const must = [];

    for (const [key, value] of Object.entries(filter)) {
      if (Array.isArray(value)) {
        must.push({
          key,
          match: { any: value },
        });
      } else {
        must.push({
          key,
          match: { value },
        });
      }
    }

    return { must };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get document by ID
   */
  async getDocument(id: string): Promise<SearchResult | null> {
    try {
      const response = await axios.get(
        `${this.qdrantUrl}/collections/${this.collectionName}/points/${id}`
      );

      if (response.data.result) {
        const point = response.data.result;
        return {
          id: point.id,
          score: 1.0,
          pageContent: point.payload.content,
          metadata: point.payload,
        };
      }

      return null;
    } catch (error) {
      logger.error(`Failed to get document ${id}:`, error);
      return null;
    }
  }

  /**
   * Count documents in collection
   */
  async count(filter?: Record<string, any>): Promise<number> {
    try {
      const response = await axios.post(
        `${this.qdrantUrl}/collections/${this.collectionName}/points/count`,
        {
          filter: filter ? this.buildQdrantFilter(filter) : undefined,
        }
      );

      return response.data.result.count;
    } catch (error) {
      logger.error('Failed to count documents:', error);
      return 0;
    }
  }
}

export const vectorStore = new VectorStore();