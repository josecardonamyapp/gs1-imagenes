// src/app/core/tour/tour.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TourDirective } from './tour.directive';

@NgModule({
  declarations: [TourDirective],
  imports: [CommonModule],
  exports: [TourDirective]
})
export class TourModule {}
