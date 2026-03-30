/**
 * Minimal MCP Apps SDK client for the DoiT widget.
 * Implements the ui/initialize handshake and tool-result subscription
 * without pulling in the full @modelcontextprotocol/sdk bundle.
 */

const PROTOCOL_VERSION = "2026-01-26";
const APP_INFO = { name: "DoiT Cloud Intelligence", version: "1.0.0" };

export interface ToolResultParams {
  content?: unknown[];
  structuredContent?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
  isError?: boolean;
}

export interface HostContext {
  theme?: { mode?: "light" | "dark" };
  styles?: { variables?: Record<string, string | undefined> };
  displayMode?: string;
  containerDimensions?: unknown;
}

type Handler = (params: unknown) => void;

export class McpApp {
  private handlers = new Map<string, Handler[]>();
  private reqId = 0;
  private pending = new Map<
    number | string,
    { resolve: (v: unknown) => void; reject: (e: unknown) => void }
  >();
  private hostOrigin: string | null = null;

  constructor() {
    window.addEventListener("message", this._onMessage.bind(this));
  }

  private _onMessage(ev: MessageEvent) {
    const msg = ev.data;
    if (typeof msg !== "object" || msg?.jsonrpc !== "2.0") return;

    // Capture the host origin from the first valid message (the ui/initialize response).
    // Subsequent messages from other origins are ignored.
    if (!this.hostOrigin) {
      this.hostOrigin = ev.origin;
    } else if (ev.origin !== this.hostOrigin) {
      return;
    }

    if ("id" in msg && this.pending.has(msg.id)) {
      const p = this.pending.get(msg.id)!;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(msg.error);
      else p.resolve(msg.result);
    } else if (typeof msg.method === "string") {
      const handlers = this.handlers.get(msg.method) ?? [];
      handlers.forEach((h) => h(msg.params ?? {}));
    }
  }

  private _send(msg: object) {
    // Use the captured host origin instead of wildcard "*".
    // Falls back to "*" only for the initial handshake before origin is known.
    window.parent.postMessage(msg, this.hostOrigin ?? "*");
  }

  private _request(method: string, params: object): Promise<unknown> {
    const id = ++this.reqId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this._send({ jsonrpc: "2.0", id, method, params });
    });
  }

  private _notify(method: string, params?: object) {
    this._send({ jsonrpc: "2.0", method, params: params ?? {} });
  }

  on(method: string, handler: Handler) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method)!.push(handler);
  }

  /** Perform the ui/initialize handshake and start the resize observer. */
  async connect(): Promise<HostContext> {
    const result = (await this._request("ui/initialize", {
      protocolVersion: PROTOCOL_VERSION,
      appInfo: APP_INFO,
      appCapabilities: {},
    })) as { hostContext?: HostContext } | undefined;

    this._notify("ui/notifications/initialized");
    this._setupResize();
    return result?.hostContext ?? {};
  }

  private _setupResize() {
    let prevH = 0;
    const report = () => {
      const h = Math.ceil(document.documentElement.getBoundingClientRect().height);
      if (h !== prevH) {
        prevH = h;
        this._notify("ui/notifications/size-changed", { height: h });
      }
    };
    const ro = new ResizeObserver(report);
    ro.observe(document.documentElement);
    ro.observe(document.body);
    report();
  }
}
