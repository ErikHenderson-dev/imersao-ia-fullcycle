import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { SessionsModule } from '../sessions/sessions.module';
import { MessageReportsController } from './message-reports.controller';
import { MessageReportsService } from './message-reports.service';
import { OBJECT_STORAGE } from './object-storage';
import { S3ObjectStorage } from './s3-object-storage';
import { storageConfig } from './storage.config';

// O download do PDF do Relatório (spec da F14, "Referência ao PDF e download").
@Module({
  imports: [
    ConfigModule.forFeature(storageConfig),
    ConversationsModule,
    MessagesModule,
    SessionsModule,
  ],
  controllers: [MessageReportsController],
  providers: [
    MessageReportsService,
    { provide: OBJECT_STORAGE, useClass: S3ObjectStorage },
  ],
})
export class ReportsModule {}
