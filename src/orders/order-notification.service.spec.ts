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

  describe('enviarConfirmacaoParaCliente', () => {
    const confirmacao = {
      id: 'pedido-1',
      clienteEmail: 'cliente@exemplo.com',
      itens: [
        { titulo: 'Tecido Jeans', cor: 'Azul', quantidade: '2', precoUnitario: '50.00' },
      ],
      subtotal: '100.00',
      frete: '15.00',
      freteTransportadora: 'Correios',
      fretePrazoDias: 7,
      valorTotal: '115.00',
      metodoPagamento: 'pix',
      enderecoEntrega: {
        rua: 'Av. Paulista',
        numero: '1000',
        complemento: null,
        bairro: 'Bela Vista',
        cidade: 'Sao Paulo',
        estado: 'SP',
        cep: '01310-000',
      },
    };

    it('nao tenta enviar se RESEND_API_KEY nao estiver configurada', async () => {
      const configService = criarConfigService({});
      const service = new OrderNotificationService(configService as any);

      await service.enviarConfirmacaoParaCliente(confirmacao);

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('envia a confirmacao para o e-mail do cliente com itens e frete', async () => {
      sendMock.mockResolvedValue({ data: { id: 'email-2' }, error: null });
      const configService = criarConfigService({ RESEND_API_KEY: 'chave-teste' });
      const service = new OrderNotificationService(configService as any);

      await service.enviarConfirmacaoParaCliente(confirmacao);

      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'cliente@exemplo.com',
          subject: expect.stringContaining('115.00'),
          html: expect.stringContaining('Tecido Jeans'),
        }),
      );
    });

    it('nao lanca excecao quando a Resend retorna erro', async () => {
      sendMock.mockResolvedValue({ data: null, error: { message: 'invalid to', name: 'invalid_to_address' } });
      const configService = criarConfigService({ RESEND_API_KEY: 'chave-teste' });
      const service = new OrderNotificationService(configService as any);

      await expect(service.enviarConfirmacaoParaCliente(confirmacao)).resolves.toBeUndefined();
    });

    it('nao lanca excecao quando a chamada rejeita (erro de rede)', async () => {
      sendMock.mockRejectedValue(new Error('timeout'));
      const configService = criarConfigService({ RESEND_API_KEY: 'chave-teste' });
      const service = new OrderNotificationService(configService as any);

      await expect(service.enviarConfirmacaoParaCliente(confirmacao)).resolves.toBeUndefined();
    });
  });
});
