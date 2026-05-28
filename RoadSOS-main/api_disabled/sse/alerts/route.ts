import { alertEmitter, ALERT_EVENTS } from "@/lib/events";

// GET /api/sse/alerts — Server-Sent Events stream for real-time alerts
export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`)
      );

      // Send heartbeat every 15s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "heartbeat", timestamp: Date.now() })}\n\n`)
          );
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      // Listen to all alert events
      const handlers: Record<string, (data: unknown) => void> = {};

      Object.values(ALERT_EVENTS).forEach((eventName) => {
        const handler = (data: unknown) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: eventName, data, timestamp: Date.now() })}\n\n`)
            );
          } catch {
            // Client disconnected
            cleanup();
          }
        };
        handlers[eventName] = handler;
        alertEmitter.on(eventName, handler);
      });

      // Cleanup on close
      const cleanup = () => {
        clearInterval(heartbeat);
        Object.entries(handlers).forEach(([event, handler]) => {
          alertEmitter.off(event, handler);
        });
      };

      // Handle client disconnect via abort signal
      const abortHandler = () => cleanup();
      if (typeof controller.close === "function") {
        // Fallback: set a timeout to check if stream is still alive
        const checkAlive = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(":\n\n")); // SSE comment as ping
          } catch {
            clearInterval(checkAlive);
            cleanup();
          }
        }, 30000);
      }

      // Return cleanup for when the request is aborted
      return abortHandler;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// Force dynamic
export const dynamic = "force-dynamic";
