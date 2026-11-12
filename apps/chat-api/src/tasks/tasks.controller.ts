import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Person } from '../people/person.entity';
import { AuthGuard } from '../sessions/auth.guard';
import { CurrentPerson } from '../sessions/current-person.decorator';
import { ListTasksQuery } from './list-tasks.query';
import { TaskResponse, toTaskResponse } from './task.response';
import { TaskStatusService } from './task-status.service';

// As Tarefas da Pessoa da Sessão (spec da F12, "Concluir, reabrir e listar").
@Controller('tasks')
@UseGuards(AuthGuard)
export class TasksController {
  constructor(private readonly tasks: TaskStatusService) {}

  @Get()
  async list(
    @CurrentPerson() person: Person,
    @Query() query: ListTasksQuery,
  ): Promise<{ tasks: TaskResponse[]; next_cursor: string | null }> {
    const page = await this.tasks.list(person.id, query);
    return {
      tasks: page.tasks.map(toTaskResponse),
      next_cursor: page.nextCursor,
    };
  }

  @Get(':id')
  async get(
    @CurrentPerson() person: Person,
    @Param('id') taskId: string,
  ): Promise<{ task: TaskResponse }> {
    return { task: toTaskResponse(await this.tasks.get(person.id, taskId)) };
  }

  @Post(':id/complete')
  @HttpCode(200)
  async complete(
    @CurrentPerson() person: Person,
    @Param('id') taskId: string,
  ): Promise<{ task: TaskResponse }> {
    return {
      task: toTaskResponse(
        await this.tasks.changeStatus(person.id, taskId, 'done'),
      ),
    };
  }

  @Post(':id/reopen')
  @HttpCode(200)
  async reopen(
    @CurrentPerson() person: Person,
    @Param('id') taskId: string,
  ): Promise<{ task: TaskResponse }> {
    return {
      task: toTaskResponse(
        await this.tasks.changeStatus(person.id, taskId, 'open'),
      ),
    };
  }
}
