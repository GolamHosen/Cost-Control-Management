declare module 'hot-formula-parser' {
  export class Parser {
    constructor();
    on(event: string, callback: (...args: any[]) => void): void;
    parse(expression: string): {
      error: string | null;
      result: any;
    };
  }
}
