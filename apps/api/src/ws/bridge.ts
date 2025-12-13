// ============================================================================
// WebSocket Bridge - Connect browser to gateway EC2 directly
// ============================================================================

import WebSocket, { type RawData } from 'ws';

/**
 * Bridge two WebSocket connections bidirectionally.
 * Data from browser is forwarded to gateway and vice versa.
 */
export function bridgeWebSockets(
    browserWs: WebSocket,
    gatewayWs: WebSocket,
    sessionId: string,
    log: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void }
): void {
    log.info({ sessionId }, 'Bridge established');

    // Forward browser → gateway
    browserWs.on('message', (data: RawData) => {
        if (gatewayWs.readyState === WebSocket.OPEN) {
            gatewayWs.send(data);
        }
    });

    // Forward gateway → browser
    gatewayWs.on('message', (data: RawData) => {
        if (browserWs.readyState === WebSocket.OPEN) {
            browserWs.send(data);
        }
    });

    // Handle gateway disconnect
    gatewayWs.on('close', (code: number, reason: Buffer) => {
        log.info({ sessionId, code }, `Gateway disconnected: ${reason.toString()}`);
        if (browserWs.readyState === WebSocket.OPEN) {
            // Notify browser that session terminated
            browserWs.send(JSON.stringify({ type: 'session.terminated', sessionId }));
            browserWs.close(4001, 'Session terminated');
        }
    });

    gatewayWs.on('error', (err: Error) => {
        log.error({ sessionId, err: err.message }, 'Gateway error');
        if (browserWs.readyState === WebSocket.OPEN) {
            browserWs.close(4002, 'Gateway error');
        }
    });

    // Handle browser disconnect - close gateway connection
    browserWs.on('close', () => {
        log.info({ sessionId }, 'Browser disconnected');
        if (gatewayWs.readyState === WebSocket.OPEN) {
            gatewayWs.close();
        }
    });

    browserWs.on('error', (err: Error) => {
        log.error({ sessionId, err: err.message }, 'Browser WebSocket error');
        if (gatewayWs.readyState === WebSocket.OPEN) {
            gatewayWs.close();
        }
    });
}
