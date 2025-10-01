declare module '@nestjs/swagger' {
  export function ApiTags(...args: unknown[]): ClassDecorator;
  export function ApiOperation(...args: unknown[]): MethodDecorator & ClassDecorator;
  export function ApiParam(...args: unknown[]): MethodDecorator & ClassDecorator;
  export function ApiCreatedResponse(...args: unknown[]): MethodDecorator;
  export function ApiOkResponse(...args: unknown[]): MethodDecorator;
  export function ApiNoContentResponse(...args: unknown[]): MethodDecorator;
  export function ApiProperty(...args: unknown[]): PropertyDecorator;
  export function ApiPropertyOptional(...args: unknown[]): PropertyDecorator;
}
