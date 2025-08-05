import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { driver } from 'driver.js';

@Injectable({ providedIn: 'root' })
export class DriverTourService {

  constructor(private router: Router) {}

  private buildKey(userId: string, tourKey: string): string {
    return `tour_seen_${userId}_${tourKey}`;
  }

  hasSeenTour(userId: string, tourKey: string): boolean {
    return localStorage.getItem(this.buildKey(userId, tourKey)) === 'true';
  }

  markTourAsSeen(userId: string, tourKey: string): void {
    localStorage.setItem(this.buildKey(userId, tourKey), 'true');
  }

  startTourIfFirstTime(userId: string, tourKey: string, steps: any[]): void {
    if (this.hasSeenTour(userId, tourKey)) return;

    const tour = driver({
      steps,
      showProgress: true,
      showButtons: ['previous', 'next'],
      allowClose: true,
      animate: true,
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Finalizar',
      onDestroyed: () => {
        this.markTourAsSeen(userId, tourKey);
      }
    });

    tour.drive();
  }

  forceStartTour(steps: any[]): void {
    driver({
      steps,
      showProgress: true,
      showButtons: ['previous', 'next'],
      allowClose: true,
      animate: true,
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Finalizar'
    }).drive();
  }

  /**
   * Tour que recorre múltiples páginas y pasos por ruta
   */
  startMultiPageTour(
    userId: string,
    tourKey: string,
    tourSequence: string[],
    tourByRoute: Record<string, any[]>
  ): void {
    if (this.hasSeenTour(userId, tourKey)) return;

    let currentIndex = 0;

    const runStep = () => {
      const route = tourSequence[currentIndex];
      const steps = tourByRoute[route];

      if (!steps || steps.length === 0) {
        currentIndex++;
        if (currentIndex < tourSequence.length) {
          runStep(); // salta a la siguiente ruta si no hay pasos
        }
        return;
      }

      this.router.navigateByUrl(route).then(() => {
        setTimeout(() => {
          const el = document.querySelector(steps[0].element);
          const isVisible = el && el.clientHeight > 0;

          if (isVisible) {
            const tour = driver({
              steps,
              showProgress: true,
              allowClose: true,
              animate: true,
              nextBtnText: 'Siguiente',
              prevBtnText: 'Anterior',
              doneBtnText: 'Finalizar',
              showButtons: ['previous', 'next'],
              onDestroyed: () => {
                currentIndex++;
                if (currentIndex < tourSequence.length) {
                  runStep();
                } else {
                  this.markTourAsSeen(userId, tourKey);
                }
              }
            });

            tour.drive();
          } else {
            setTimeout(runStep, 300); 
          }
        }, 500); 
      });
    };

    runStep();
  }
}
