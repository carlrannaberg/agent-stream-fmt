import { VendorParser, ParseError } from './types.js';
import { AgentEvent, MessageEvent, CostEvent, DebugEvent } from '../types.js';

/**
 * Gemini CLI JSONL parser
 * 
 * Parses the JSONL output from Gemini CLI when using the --jsonl flag.
 * Handles user/assistant messages, metadata, and usage events.
 * 
 * @example
 * ```typescript
 * const parser = new GeminiParser();
 * const events = parser.parse('{"type":"user","content":"Hello"}');
 * ```
 */
export class GeminiParser implements VendorParser {
  /** Vendor identifier */
  vendor = 'gemini';
  
  /** Parser metadata */
  metadata = {
    version: '1.0.0',
    supportedVersions: ['0.10', '0.11'],
    documentationUrl: 'https://docs.google.com/gemini-cli'
  };
  
  /**
   * Detect if a line belongs to Gemini's JSONL format
   * 
   * Fast detection method that checks for Gemini-specific event types.
   * Does not throw errors and returns false for any parsing issues.
   * 
   * @param line - Raw JSONL line to test
   * @returns True if this parser can handle the line
   */
  detect(line: string): boolean {
    try {
      const obj = JSON.parse(line);
      
      // Gemini events have specific type patterns
      return typeof obj.type === 'string' && (
        obj.type === 'user' ||
        obj.type === 'assistant' ||
        obj.type === 'metadata'
      );
    } catch {
      return false;
    }
  }
  
  /**
   * Parse a single JSONL line into zero or more events
   * 
   * Converts Gemini's JSONL format into normalized AgentEvent objects.
   * Handles all known Gemini event types and converts unknowns to DebugEvent.
   * 
   * @param line - Raw JSONL line to parse
   * @returns Array of parsed events
   * @throws {ParseError} When JSON parsing fails
   */
  parse(line: string): AgentEvent[] {
    let obj: any;
    try {
      obj = JSON.parse(line);
    } catch (error) {
      throw new ParseError(
        'Invalid JSON',
        this.vendor,
        line,
        error,
        {
          expectedFormat: 'Valid JSON object with "type" field (user, assistant, or metadata)'
        }
      );
    }
    
    const events: AgentEvent[] = [];
    
    switch (obj.type) {
      case 'user':
        events.push(this.parseMessage(obj, 'user'));
        break;
        
      case 'assistant':
        events.push(this.parseMessage(obj, 'assistant'));
        break;
        
      case 'metadata':
        const cost = this.parseMetadata(obj);
        if (cost) events.push(cost);
        break;
        
      default:
        // Unknown event type - emit as debug
        events.push({
          t: 'debug',
          raw: obj
        });
    }
    
    return events;
  }
  
  /**
   * Parse a message event
   * 
   * Converts Gemini message objects into normalized MessageEvent.
   * 
   * @param obj - Raw message object from Gemini
   * @param role - Message role (user or assistant)
   * @returns Normalized MessageEvent
   */
  private parseMessage(obj: any, role: 'user' | 'assistant'): MessageEvent {
    return {
      t: 'msg',
      role,
      text: obj.content || ''
    };
  }
  
  /**
   * Parse metadata into cost information
   * 
   * Converts Gemini metadata objects into CostEvent using token counts.
   * Uses approximate Gemini pricing for cost calculation.
   * 
   * @param obj - Raw metadata object from Gemini
   * @returns CostEvent or null if no usage data
   */
  private parseMetadata(obj: any): CostEvent | null {
    if (!obj.usage) return null;
    
    const inputTokens = obj.usage.input_tokens || 0;
    const outputTokens = obj.usage.output_tokens || 0;
    
    if (inputTokens === 0 && outputTokens === 0) {
      return null;
    }
    
    // Approximate Gemini pricing
    const inputCostPerToken = 0.000001;  // $1 per 1M tokens
    const outputCostPerToken = 0.000003; // $3 per 1M tokens
    
    const deltaUsd = (inputTokens * inputCostPerToken) + 
                     (outputTokens * outputCostPerToken);
    
    return {
      t: 'cost',
      deltaUsd
    };
  }
}

/**
 * Singleton instance of Gemini parser
 */
export const geminiParser = new GeminiParser();