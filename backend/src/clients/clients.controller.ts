import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  ManagerScope,
  ManagerScopeGuard,
} from '../common/guards/manager-scope.guard';
import { UserRole } from '../generated/prisma/client';
import { ClientsService } from './clients.service';
import { ClientQueryDto } from './dto/client-query.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { SetClientStatusDto } from './dto/set-client-status.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard, ManagerScopeGuard)
@ManagerScope('client')
@Roles(UserRole.ADMIN, UserRole.MANAGER)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateClientDto,
  ) {
    return this.clientsService.create(user.id, input);
  }

  @Get()
  list(@Query() query: ClientQueryDto) {
    return this.clientsService.list(query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.clientsService.findOne(id, user);
  }

  @Get(':id/overview')
  overview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.clientsService.overview(id, user);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateClientDto,
  ) {
    return this.clientsService.update(user.id, id, input);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SetClientStatusDto,
  ) {
    return this.clientsService.setStatus(user.id, id, input);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.clientsService.archive(user.id, id);
  }
}
