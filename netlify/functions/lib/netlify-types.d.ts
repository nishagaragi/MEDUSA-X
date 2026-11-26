// Type stubs for @netlify/functions
// These are replaced by the actual package after npm install

declare module '@netlify/functions' {
  export interface HandlerEvent {
    httpMethod: string
    path: string
    headers: Record<string, string | undefined>
    queryStringParameters: Record<string, string> | null
    body: string | null
    isBase64Encoded: boolean
    rawUrl: string
  }

  export interface HandlerContext {
    callbackWaitsForEmptyEventLoop: boolean
  }

  export interface HandlerResponse {
    statusCode: number
    headers?: Record<string, string>
    body?: string
    isBase64Encoded?: boolean
  }

  export type Handler = (
    event: HandlerEvent,
    context: HandlerContext
  ) => Promise<HandlerResponse> | HandlerResponse
}
