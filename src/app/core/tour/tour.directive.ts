// src/app/core/tour/tour.directive.ts
import {
  Directive,
  ElementRef,
  Input,
  OnInit
} from '@angular/core';
import { DriverTourService } from './driver-tour.service';

@Directive({
  selector: '[tourSteps]'
})
export class TourDirective implements OnInit {
  @Input('tourSteps') steps: any[] = [];
  @Input('tourTrigger') trigger: string = 'click'; // o 'auto' para inmediato
  @Input('tourUserId') userId: string = 'defaultUser'; // ID del usuario logueado
  @Input('tourKey') tourKey: string = 'defaultTour'; // clave del tour (por módulo)

  constructor(
    private el: ElementRef,
    private tourService: DriverTourService
  ) {}

  ngOnInit() {
    if (!this.steps?.length) return;

    if (this.trigger === 'auto') {
      // iniciar automáticamente solo si es la primera vez
      this.tourService.startTourIfFirstTime(this.userId, this.tourKey, this.steps);
    } else {
      this.el.nativeElement.addEventListener(this.trigger, () => {
        this.tourService.startTourIfFirstTime(this.userId, this.tourKey, this.steps);
      });
    }
  }
}
