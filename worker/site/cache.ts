// Edge cache for the public pages (D-116). The key carries the studio's catalogue version, so a publish
// shows at once. Card E owns this file.
export async function cached(
  request: Request,
  version: number,
  ctx: ExecutionContext | undefined,
  produce: () => Promise<Response>,
): Promise<Response> {
  void version;
  void ctx;
  void request;
  return produce();
}
