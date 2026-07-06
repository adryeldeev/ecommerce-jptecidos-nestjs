import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'ecommerce-jptecidos-nestjs',
      timestamp: new Date().toISOString(),
    };
  }
}
