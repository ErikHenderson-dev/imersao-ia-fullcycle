import { Module } from '@nestjs/common';
import { PeopleModule } from '../people/people.module';
import { SessionsModule } from '../sessions/sessions.module';
import { ProfilesController } from './profiles.controller';

@Module({
  imports: [PeopleModule, SessionsModule],
  controllers: [ProfilesController],
})
export class ProfilesModule {}
