// Rendering functionality
// Placeholder implementation

export interface RenderOptions {
  format: 'ansi' | 'html' | 'json';
  collapseTools?: boolean;
  hideTools?: boolean;
  hideCost?: boolean;
  hideDebug?: boolean;
}

export function createRenderer(_options: RenderOptions) {
  // Placeholder implementation
  throw new Error(
    'Render functionality will be migrated from agent-stream-fmt package',
  );
}
