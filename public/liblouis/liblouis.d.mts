// Types for the Emscripten-generated module (see src/engine/liblouis.ts for the parts we use).
declare const createLiblouis: (options?: {
  locateFile?: (file: string, prefix: string) => string;
}) => Promise<unknown>;
export default createLiblouis;
