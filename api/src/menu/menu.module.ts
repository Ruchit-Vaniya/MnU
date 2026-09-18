import { Module } from '@nestjs/common';
import { MenuController } from './menu.controller';
import { PublicMenuController } from './public-menu.controller';
import { MenuService } from './menu.service';

@Module({
  controllers: [MenuController, PublicMenuController],
  providers: [MenuService],
})
export class MenuModule {}
