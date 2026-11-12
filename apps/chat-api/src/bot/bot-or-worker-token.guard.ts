import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { Env } from '../config/env.schema';
import { digest, matchesBearer } from './bearer-token';
import { InvalidBotTokenError } from './invalid-bot-token.error';

// A falha do Relatório aceita a credencial de bot, do Serviço de agentes quando enfileirar falha, e
// a do Worker (spec da F14, "Ações de bot do Relatório"). A recusa usa o mesmo código das outras
// rotas /v1/bot, para não dizer a quem tenta qual credencial existe.
@Injectable()
export class BotOrWorkerTokenGuard implements CanActivate {
  private readonly expected: Buffer[];

  constructor(config: ConfigService<Env, true>) {
    this.expected = [
      digest(config.get('CHAT_BOT_TOKEN', { infer: true })),
      digest(config.get('CHAT_WORKER_TOKEN', { infer: true })),
    ];
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!matchesBearer(request.headers.authorization, this.expected)) {
      throw new InvalidBotTokenError();
    }
    return true;
  }
}
