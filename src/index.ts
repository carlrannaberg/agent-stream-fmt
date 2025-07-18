// Re-export all public types
export * from './types.js';
export type { VendorParser, ParseError } from './parsers/types.js';

// Export parser registry
export { registry, selectParser } from './parsers/index.js';

// Export streaming functions
export { streamEvents, streamFormat, collectEvents } from './stream.js';
export type { StreamOptions } from './stream.js';

// Export utilities
export { createLineReader, createLineReaderWithLineNumbers } from './utils/line-reader.js';
export type { LineReaderOptions } from './utils/line-reader.js';

// Export rendering components
export { 
  createRenderer,
  isFormatSupported,
  getSupportedFormats,
  AnsiRenderer,
  HtmlRenderer,
  JsonRenderer
} from './render/index.js';
export type { 
  Renderer, 
  RenderOptions, 
  RenderContext 
} from './render/index.js';