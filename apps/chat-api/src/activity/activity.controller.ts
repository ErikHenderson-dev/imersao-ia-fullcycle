import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Person } from '../people/person.entity';
import { AuthGuard } from '../sessions/auth.guard';
import { CurrentPerson } from '../sessions/current-person.decorator';
import {
  type ActivityItemResponse,
  type ActivityUnreadResponse,
  toActivityItemResponse,
  toActivityUnreadResponse,
} from './activity.response';
import { ActivityService } from './activity.service';
import { ListActivityQuery } from './list-activity.query';
import { ReadActivityDto } from './read-activity.dto';

// A Atividade da Pessoa da Sessão (spec da F08, "Rotas").
@Controller('activity')
@UseGuards(AuthGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  async list(
    @CurrentPerson() person: Person,
    @Query() query: ListActivityQuery,
  ): Promise<{ items: ActivityItemResponse[]; has_more: boolean }> {
    const page = await this.activity.listPage(person.id, query.kind, {
      before: query.before,
      limit: query.limit,
    });
    return {
      items: page.items.map((item) => toActivityItemResponse(item, person)),
      has_more: page.hasMore,
    };
  }

  @Get('unread')
  async unread(
    @CurrentPerson() person: Person,
  ): Promise<ActivityUnreadResponse> {
    return toActivityUnreadResponse(await this.activity.countUnread(person.id));
  }

  @Put('read')
  @HttpCode(200)
  async read(
    @CurrentPerson() person: Person,
    @Body() body: ReadActivityDto,
  ): Promise<ActivityUnreadResponse> {
    return toActivityUnreadResponse(
      await this.activity.markRead(
        person.id,
        body.message_id !== undefined
          ? { messageId: body.message_id }
          : { taskNotificationId: body.task_notification_id! },
      ),
    );
  }

  // Abre uma Notificação de Tarefa (spec da F12, "Atividade").
  @Put('task-notifications/:id/read')
  @HttpCode(204)
  async readTaskNotification(
    @CurrentPerson() person: Person,
    @Param('id') notificationId: string,
  ): Promise<void> {
    await this.activity.markTaskNotificationRead(person.id, notificationId);
  }
}
