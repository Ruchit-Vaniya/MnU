import { Controller, Get, Param } from '@nestjs/common';
import { MenuService } from './menu.service';

// Deliberately NOT behind JwtAuthGuard — this is what a diner's browser
// calls to display a restaurant's menu, with no account of their own.
// A separate controller (not a guard exception added to MenuController)
// so there's no risk of an admin-only route accidentally losing its
// guard — same convention TableSessionsController already established
// in Day 8. Lives under /public/... so it's obvious at a glance which
// routes are intentionally open.
@Controller('public/restaurants/:restaurantId/menu')
export class PublicMenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  getPublicMenu(@Param('restaurantId') restaurantId: string) {
    return this.menuService.getPublicMenu(restaurantId);
  }
}
