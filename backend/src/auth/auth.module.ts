import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ManagerScopeGuard } from '../common/guards/manager-scope.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard, ManagerScopeGuard],
  exports: [JwtAuthGuard, RolesGuard, ManagerScopeGuard, JwtModule],
})
export class AuthModule {}
