import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { Env } from '../config/env.schema';
import { digest, matchesBearer } from './bearer-token';
import { InvalidBotTokenError } from './invalid-bot-token.error';

// A credencial de bot das rotas /v1/bot (LLD, "Segurança"): `Authorization: Bearer
// <CHAT_BOT_TOKEN>`, conferida em tempo constante. A credencial do Worker é recusada.
@Injectable()
export class BotTokenGuard implements CanActivate {
  private readonly expected: Buffer[];

  constructor(config: ConfigService<Env, true>) {
    this.expected = [digest(config.get('CHAT_BOT_TOKEN', { infer: true }))];
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!matchesBearer(request.headers.authorization, this.expected)) {
      throw new InvalidBotTokenError();
    }
    return true;
  }
}
