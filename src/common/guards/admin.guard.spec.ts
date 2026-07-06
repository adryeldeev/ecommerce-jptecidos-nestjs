import { ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  it('permite acesso para admin', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { ehAdmin: true } }),
      }),
    } as any;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('bloqueia acesso para cliente final', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { ehAdmin: false } }),
      }),
    } as any;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
