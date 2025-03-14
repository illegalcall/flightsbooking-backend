import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { FlightModule } from './flight/flight.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [ConfigModule, PrismaModule, UserModule, AuthModule, FlightModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
