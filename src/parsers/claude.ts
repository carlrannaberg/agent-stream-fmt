import { VendorParser, ParseError } from './types.js';
import { AgentEvent, MessageEvent, ToolEvent, CostEvent, ErrorEvent, DebugEvent } from '../types.js';

/**
 * Claude Code JSONL parser
 * 
 * Parses the JSONL output from Claude Code CLI when using the --json flag.
 * Handles message events, tool use/result events, usage events, and error events.
 * 
 * @example
 * ```typescript
 * const parser = new ClaudeParser();
 * const events = parser.parse('{"type":"message","role":"assistant","content":"Hello"}');
 * ```
 */
export class ClaudeParser implements VendorParser {
  /** Vendor identifier */
  vendor = 'claude';
  
  /** Parser metadata */
  metadata = {
    version: '1.0.0',
    supportedVersions: ['3.5', '3.6'],
    documentationUrl: 'https://docs.anthropic.com/claude-code/cli-reference'
  };
  
  /**
   * Detect if a line belongs to Claude's JSONL format
   * 
   * Fast detection method that checks for Claude-specific event types.
   * Does not throw errors and returns false for any parsing issues.
   * 
   * @param line - Raw JSONL line to test
   * @returns True if this parser can handle the line
   */
  detect(line: string): boolean {
    try {
      const obj = JSON.parse(line);
      
      // Claude events always have a 'type' field with specific values
      return typeof obj.type === 'string' && (
        obj.type === 'message' ||
        obj.type === 'tool_use' ||
        obj.type === 'tool_result' ||
        obj.type === 'usage' ||
        obj.type === 'error'
      );
    } catch {
      return false;
    }
  }
  
  /**
   * Parse a single JSONL line into zero or more events
   * 
   * Converts Claude's JSONL format into normalized AgentEvent objects.
   * Handles all known Claude event types and converts unknowns to DebugEvent.
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
        error
      );
    }
    
    const events: AgentEvent[] = [];
    
    switch (obj.type) {
      case 'message':
        events.push(this.parseMessage(obj));
        break;
        
      case 'tool_use':
        events.push(this.parseToolStart(obj));
        break;
        
      case 'tool_result':
        events.push(...this.parseToolResult(obj));
        break;
        
      case 'usage':
        const cost = this.parseUsage(obj);
        if (cost) events.push(cost);
        break;
        
      case 'error':
        events.push(this.parseError(obj));
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
   * Converts Claude message objects into normalized MessageEvent.
   * Handles user, assistant, and system messages.
   * 
   * @param obj - Raw message object from Claude
   * @returns Normalized MessageEvent
   */
  private parseMessage(obj: any): MessageEvent {
    return {
      t: 'msg',
      role: this.normalizeRole(obj.role),
      text: obj.content || ''
    };
  }
  
  /**
   * Parse a tool use event (start phase)
   * 
   * Converts Claude tool_use objects into ToolEvent with start phase.
   * Includes tool input as formatted JSON text.
   * 
   * @param obj - Raw tool_use object from Claude
   * @returns ToolEvent with start phase
   */
  private parseToolStart(obj: any): ToolEvent {
    return {
      t: 'tool',
      name: obj.name || 'unknown',
      phase: 'start',
      text: obj.input ? JSON.stringify(obj.input, null, 2) : undefined
    };
  }
  
  /**
   * Parse a tool result event
   * 
   * Converts Claude tool_result objects into one or more ToolEvent objects.
   * Handles stdout content, stderr errors, and completion phases.
   * 
   * @param obj - Raw tool_result object from Claude
   * @returns Array of ToolEvent objects for different phases
   */
  private parseToolResult(obj: any): ToolEvent[] {
    const events: ToolEvent[] = [];
    const toolName = obj.tool_use_id || 'unknown';
    
    // Handle stdout content
    if (obj.content && obj.output) {
      events.push({
        t: 'tool',
        name: toolName,
        phase: 'stdout',
        text: obj.output
      });
    }
    
    // Handle stderr errors 
    if (obj.error) {
      events.push({
        t: 'tool',
        name: toolName,
        phase: 'stderr',
        text: typeof obj.error === 'string' ? obj.error : 
              obj.error.message || JSON.stringify(obj.error)
      });
    }
    
    // Always add completion event
    events.push({
      t: 'tool',
      name: toolName,
      phase: 'end',
      exitCode: obj.error ? 1 : 0
    });
    
    return events;
  }
  
  /**
   * Parse a usage event into cost information
   * 
   * Converts Claude usage objects into CostEvent using token counts.
   * Uses approximate Claude 3.5 Sonnet pricing for cost calculation.
   * 
   * @param obj - Raw usage object from Claude
   * @returns CostEvent or null if no tokens used
   */
  private parseUsage(obj: any): CostEvent | null {
    // Extract token counts with fallback to direct fields
    const inputTokens = obj.input_tokens || 0;
    const outputTokens = obj.output_tokens || 0;
    
    if (inputTokens === 0 && outputTokens === 0) {
      return null;
    }
    
    // Claude 3.5 Sonnet pricing (approximate, should be configurable)
    const inputCostPerToken = 0.000003;  // $3 per 1M tokens
    const outputCostPerToken = 0.000015; // $15 per 1M tokens
    
    const deltaUsd = (inputTokens * inputCostPerToken) + 
                     (outputTokens * outputCostPerToken);
    
    return {
      t: 'cost',
      deltaUsd
    };
  }
  
  /**
   * Parse an error event
   * 
   * Converts Claude error objects into normalized ErrorEvent.
   * Handles various error formats and message extraction.
   * 
   * @param obj - Raw error object from Claude
   * @returns Normalized ErrorEvent
   */
  private parseError(obj: any): ErrorEvent {
    return {
      t: 'error',
      message: obj.message || obj.error || JSON.stringify(obj)
    };
  }
  
  /**
   * Normalize role field to supported values
   * 
   * Ensures role field conforms to MessageEvent interface requirements.
   * Defaults to 'assistant' for unknown roles.
   * 
   * @param role - Raw role value from Claude
   * @returns Normalized role
   */
  private normalizeRole(role: any): 'user' | 'assistant' | 'system' {
    if (role === 'user' || role === 'assistant' || role === 'system') {
      return role;
    }
    return 'assistant';
  }
}

/**
 * Singleton instance of Claude parser
 * 
 * Pre-configured parser instance ready for use in the parser registry.
 * 
 * @example
 * ```typescript
 * import { claudeParser } from './claude.js';
 * const events = claudeParser.parse(jsonlLine);
 * ```
 */
export const claudeParser = new ClaudeParser();