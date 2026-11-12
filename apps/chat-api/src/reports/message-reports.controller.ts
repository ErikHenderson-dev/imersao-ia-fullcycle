import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Person } from '../people/person.entity';
import { AuthGuard } from '../sessions/auth.guard';
import { CurrentPerson } from '../sessions/current-person.decorator';
import { MessageReportsService } from './message-reports.service';

// O PDF da entrega do Relatório, com a Sessão (spec da F14, "Referência ao PDF e download").
@Controller('messages/:messageId/report')
@UseGuards(AuthGuard)
export class MessageReportsController {
  constructor(private readonly reports: MessageReportsService) {}

  @Get()
  async downloadUrl(
    @CurrentPerson() person: Person,
    @Param('messageId') messageId: string,
  ): Promise<{ url: string }> {
    return { url: await this.reports.downloadUrl(person, messageId) };
  }
}
