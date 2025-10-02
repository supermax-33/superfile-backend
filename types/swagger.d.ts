declare module '@nestjs/swagger' {
  export function ApiTags(...args: unknown[]): MethodDecorator & ClassDecorator;
  export function ApiOperation(...args: unknown[]): MethodDecorator;
}
