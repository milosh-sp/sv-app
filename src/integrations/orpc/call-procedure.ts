// ponytail: oRPC's callable options are invariant, so tests infer the result and cast once.
type Invoked<P> = P extends { callable(...args: any): infer Client }
  ? Client extends (...args: any) => infer R
    ? Awaited<R>
    : never
  : never;

export function callProcedure<P extends object>(
  procedure: P,
  context: object,
  ...input: [] | [object | undefined]
): Promise<Invoked<P>> {
  const run = (
    procedure as {
      callable: (options: object) => (...args: [] | [object | undefined]) => Promise<Invoked<P>>;
    }
  ).callable({ context });
  return run(...input);
}
