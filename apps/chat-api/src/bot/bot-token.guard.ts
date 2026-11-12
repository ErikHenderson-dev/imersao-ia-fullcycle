import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Env } from '../config/env.schema';
import { InvalidBotTokenError } from './invalid-bot-token.error';

// A credencial de bot das rotas /v1/bot (LLD, "Segurança"): `Authorization: Bearer
// <CHAT_BOT_TOKEN>`, conferida em tempo constante. Compara os SHA-256, para os comprimentos
// baterem sem revelar o da credencial.
@Injectable()
export class BotTokenGuard implements CanActivate {
  private readonly expected: Buffer;

  constructor(config: ConfigService<Env, true>) {
    this.expected = digest(config.get('CHAT_BOT_TOKEN', { infer: true }));
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    if (
      scheme?.toLowerCase() !== 'bearer' ||
      !token ||
      !timingSafeEqual(digest(token), this.expected)
    ) {
      throw new InvalidBotTokenError();
    }
    return true;
  }
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
