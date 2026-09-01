import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../generated/prisma/client';
import { AssignmentsService } from './assignments.service';
import { AssignmentQueryDto } from './dto/assignment-query.dto';
import { RoutePreviewDto } from './dto/route-preview.dto';
import {
  LocationSearchDto,
  ReverseGeocodeDto,
} from './dto/location-search.dto';
import { RouteEstimationService } from './route-estimation.service';

@Controller('calendar')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
export class CalendarController {
  constructor(
    private readonly assignmentsService: AssignmentsService,
    private readonly routeEstimationService: RouteEstimationService,
  ) {}

  @Get()
  getCalendar(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AssignmentQueryDto,
  ) {
    return this.assignmentsService.list(user, query);
  }

  @Post('route-preview')
  @Roles(UserRole.ADMIN)
  routePreview(@Body() input: RoutePreviewDto) {
    return this.routeEstimationService.estimate(
      input.originAddress,
      input.destinationAddress,
      input.originLatitude !== undefined && input.originLongitude !== undefined
        ? {
            latitude: input.originLatitude,
            longitude: input.originLongitude,
          }
        : undefined,
      input.destinationLatitude !== undefined &&
        input.destinationLongitude !== undefined
        ? {
            latitude: input.destinationLatitude,
            longitude: input.destinationLongitude,
          }
        : undefined,
    );
  }

  @Post('location-search')
  @Roles(UserRole.ADMIN)
  locationSearch(@Body() input: LocationSearchDto) {
    return this.routeEstimationService.search(input.query);
  }

  @Post('reverse-geocode')
  @Roles(UserRole.ADMIN)
  reverseGeocode(@Body() input: ReverseGeocodeDto) {
    return this.routeEstimationService.reverse(input.latitude, input.longitude);
  }
}
