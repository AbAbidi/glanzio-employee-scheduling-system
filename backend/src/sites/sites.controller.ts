import {
  Body,
  Controller,
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
import { UserRole } from '../generated/prisma/client';
import { CreateSiteDto } from './dto/create-site.dto';
import { SetSiteStatusDto } from './dto/set-site-status.dto';
import { SiteQueryDto } from './dto/site-query.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { SitesService } from './sites.service';

@Controller('sites')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateSiteDto) {
    return this.sitesService.create(user.id, input);
  }

  @Get()
  list(@Query() query: SiteQueryDto) {
    return this.sitesService.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sitesService.findOne(id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateSiteDto,
  ) {
    return this.sitesService.update(user.id, id, input);
  }

  @Patch(':id/status')
  setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SetSiteStatusDto,
  ) {
    return this.sitesService.setStatus(user.id, id, input);
  }
}
