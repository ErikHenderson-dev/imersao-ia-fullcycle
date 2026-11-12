import {
  CanActivate,
  ExecutionContext,
  Injectable,
  mixin,
  Type,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { Env } from '../config/env.schema';
import { digest, matchesBearer } from './bearer-token';
import { InvalidBotTokenError } from './invalid-bot-token.error';

type TokenKey = 'CHAT_BOT_TOKEN' | 'CHAT_WORKER_TOKEN';

// O guard das rotas /v1/bot que aceita as credenciais `keys` em `Authorization: Bearer`, conferidas
// em tempo constante (LLD, "Segurança"). A recusa é sempre `invalid_bot_token`, para não dizer a
// quem tenta qual credencial existe.
export function bearerTokenGuard(...keys: TokenKey[]): Type<CanActivate> {
  @Injectable()
  class BearerTokenGuard implements CanActivate {
    private readonly expected: Buffer[];

    constructor(config: ConfigService<Env, true>) {
      this.expected = keys.map((key) =>
        digest(config.get(key, { infer: true })),
      );
    }

    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest<Request>();
      if (!matchesBearer(request.headers.authorization, this.expected)) {
        throw new InvalidBotTokenError();
      }
      return true;
    }
  }
  return mixin(BearerTokenGuard);
}

// A credencial de bot, do Serviço de agentes: a das rotas /v1/bot, que recusam a do Worker.
export const BotTokenGuard = bearerTokenGuard('CHAT_BOT_TOKEN');

// A falha do Relatório aceita a credencial de bot, quando enfileirar falha, e a do Worker (spec da
// F14, "Ações de bot do Relatório").
export const BotOrWorkerTokenGuard = bearerTokenGuard(
  'CHAT_BOT_TOKEN',
  'CHAT_WORKER_TOKEN',
);
