const sendMock = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

import { OrderNotificationService } from './order-notification.service';

describe('OrderNotificationService', () => {
  const pedido = {
    id: 'pedido-1',
    valorTotal: '150.00',
    metodoPagamento: 'pix',
    clienteEmail: 'cliente@exemplo.com',
  };

  const criarConfigService = (valores: Record<string, string | undefined>) => ({
    get: jest.fn((key: string) => valores[key]),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('nao tenta enviar se RESEND_API_KEY nao estiver configurada', async () => {
    const configService = criarConfigService({ ADMIN_EMAIL: 'admin@jptecidos.com' });
    const service = new OrderNotificationService(configService as any);

    await service.notificarPedidoNovo(pedido);

    expect(sendMock).not.toHaveBeenCalled();
  });

  it('nao tenta enviar se nao houver e-mail de destino configurado', async () => {
    const configService = criarConfigService({ RESEND_API_KEY: 'chave-teste' });
    const service = new OrderNotificationService(configService as any);

    await service.notificarPedidoNovo(pedido);

    expect(sendMock).not.toHaveBeenCalled();
  });

  it('envia usando NOTIFICATION_EMAIL quando definido, senao cai no ADMIN_EMAIL', async () => {
    sendMock.mockResolvedValue({ data: { id: 'email-1' }, error: null });
    const configService = criarConfigService({
      RESEND_API_KEY: 'chave-teste',
      ADMIN_EMAIL: 'admin@jptecidos.com',
      NOTIFICATION_EMAIL: 'pedidos@jptecidos.com',
    });
    const service = new OrderNotificationService(configService as any);

    await service.notificarPedidoNovo(pedido);

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'pedidos@jptecidos.com',
        subject: expect.stringContaining('150.00'),
      }),
    );
  });

  it('nao lanca excecao quando a Resend retorna erro', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'invalid from', name: 'invalid_from_address' } });
    const configService = criarConfigService({
      RESEND_API_KEY: 'chave-teste',
      ADMIN_EMAIL: 'admin@jptecidos.com',
    });
    const service = new OrderNotificationService(configService as any);

    await expect(service.notificarPedidoNovo(pedido)).resolves.toBeUndefined();
  });

  it('nao lanca excecao quando a chamada rejeita (erro de rede)', async () => {
    sendMock.mockRejectedValue(new Error('timeout'));
    const configService = criarConfigService({
      RESEND_API_KEY: 'chave-teste',
      ADMIN_EMAIL: 'admin@jptecidos.com',
    });
    const service = new OrderNotificationService(configService as any);

    await expect(service.notificarPedidoNovo(pedido)).resolves.toBeUndefined();
  });
});
