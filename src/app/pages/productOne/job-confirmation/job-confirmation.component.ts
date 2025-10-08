import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { ProductService } from 'src/app/services/product.service';
import { Subscription, interval, of } from 'rxjs';
import { catchError, startWith, switchMap } from 'rxjs/operators';

type ProgressMode = 'determinate' | 'indeterminate';

const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'ERROR', 'CANCELED', 'CANCELLED'];

interface JobErrorItem {
  error: string;
  timestamp?: Date | null;
}

@Component({
  selector: 'app-job-confirmation',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    CommonModule
  ],
  templateUrl: './job-confirmation.component.html',
  styleUrls: ['./job-confirmation.component.scss']
})
export class JobConfirmationComponent implements OnInit, OnDestroy {
  status = 'PROCESSING';
  progressMode: ProgressMode = 'indeterminate';
  progressPercentage = 0;
  processedImages = 0;
  failedImages = 0;
  remainingImages = 0;
  totalImages = 0;
  statusMessage = 'Procesando imagenes...';
  elapsedSeconds = 0;
  estimatedRemainingSeconds: number | null = null;
  estimatedRemainingText: string | null = null;
  pollingError = false;
  jobErrors: JobErrorItem[] = [];

  private pollingSub?: Subscription;
  private elapsedTimerSub?: Subscription;
  private elapsedStopped = false;
  private readonly startTimestamp = Date.now();
  private createdAt?: Date;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<JobConfirmationComponent>,
    private productService: ProductService
  ) {}

  ngOnInit(): void {
    this.elapsedStopped = false;

    if (this.data) {
      this.applyJobPayload(this.data, true);
    }

    this.startElapsedTimer();

    if (this.data?.job_id) {
      this.startPollingJob(this.data.job_id);
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.elapsedStopped = true;
    this.elapsedTimerSub?.unsubscribe();
  }

  get elapsedTimeLabel(): string {
    return this.formatDuration(this.elapsedSeconds);
  }

  get remainingTimeLabel(): string | null {
    if (this.estimatedRemainingText) {
      return this.estimatedRemainingText;
    }
    if (this.estimatedRemainingSeconds != null) {
      return this.formatDuration(this.estimatedRemainingSeconds);
    }
    return null;
  }

  get hasProgressTotals(): boolean {
    return this.totalImages > 0;
  }

  get hasFailures(): boolean {
    return this.failedImages > 0;
  }

  get hasRemaining(): boolean {
    return this.remainingImages > 0;
  }

  get hasErrors(): boolean {
    return this.jobErrors.length > 0;
  }

  get primaryStatusText(): string {
    return this.statusMessage || this.status || 'Procesando imágenes...';
  }

  get heroSpinnerMode(): ProgressMode {
    return this.isTerminalStatus ? 'determinate' : 'indeterminate';
  }


  get heroSpinnerValue(): number {
    return this.isTerminalStatus ? 100 : 0;
  }

  get heroSpinnerIcon(): string | null {
    if (!this.isTerminalStatus) {
      return null;
    }
    const normalized = (this.status || '').toUpperCase();
    if (normalized === 'COMPLETED') {
      return 'check_circle';
    }
    if (normalized === 'FAILED' || normalized === 'ERROR') {
      return 'error';
    }
    if (normalized === 'CANCELED' || normalized === 'CANCELLED') {
      return 'cancel';
    }
    return 'hourglass_bottom';
  }

  get heroSpinnerStateClass(): string {
    if (!this.isTerminalStatus) {
      return 'is-processing';
    }
    const normalized = (this.status || '').toUpperCase();
    if (normalized === 'COMPLETED') {
      return 'is-success';
    }
    if (normalized === 'FAILED' || normalized === 'ERROR') {
      return 'is-error';
    }
    if (normalized === 'CANCELED' || normalized === 'CANCELLED') {
      return 'is-cancel';
    }
    return 'is-terminal';
  }

  get isTerminalStatus(): boolean {
    return TERMINAL_STATUSES.includes((this.status || '').toUpperCase());
  }

  get statusIcon(): string {
    const normalized = (this.status || '').toUpperCase();
    if (normalized === 'COMPLETED') {
      return 'check_circle';
    }
    if (normalized === 'FAILED' || normalized === 'ERROR') {
      return 'error';
    }
    if (normalized === 'PROCESSING' || normalized === 'IN_PROGRESS') {
      return 'hourglass_top';
    }
    return 'hourglass_empty';
  }

  goToJobs(): void {
    this.dialogRef.close(true);
  }

  closeModal(): void {
    this.dialogRef.close(false);
  }

  private startPollingJob(jobId: string): void {
    this.pollingSub = interval(5000)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.productService.getJobStatus(jobId).pipe(
            catchError(error => {
              console.error('Error fetching job status:', error);
              this.pollingError = true;
              return of(null);
            })
          )
        )
      )
      .subscribe(result => {
        if (!result) {
          return;
        }

        this.pollingError = false;
        this.applyJobPayload(result);

        if (TERMINAL_STATUSES.includes((this.status || '').toUpperCase())) {
          this.stopPolling();
    this.elapsedStopped = true;
        }
      });
  }

  private stopPolling(): void {
    if (this.pollingSub) {
      this.pollingSub.unsubscribe();
      this.pollingSub = undefined;
    }
  }

  private startElapsedTimer(): void {
    this.elapsedTimerSub = interval(1000).subscribe(() => {
      if (this.elapsedStopped) {
        return;
      }
      const start = this.createdAt?.getTime() ?? this.startTimestamp;
      this.elapsedSeconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
    });
  }

  private applyJobPayload(job: any, isInitial = false): void {
    if (!job || typeof job !== 'object') {
      return;
    }

    if (job.status) {
      this.status = job.status;
    }

    if (job.status_description) {
      this.statusMessage = job.status_description;
    } else if (job.message) {
      this.statusMessage = job.message;
    } else if (isInitial && this.data?.message) {
      this.statusMessage = this.data.message;
    }

    const progress = job.progress || {};
    this.updateProgressMetrics(progress, job);
    this.updateTiming(job.timing);
    this.updateErrors(job.errors, isInitial);

    if (TERMINAL_STATUSES.includes((this.status || '').toUpperCase())) {
      this.elapsedStopped = true;
    }
  }

  private updateProgressMetrics(progress: any, job: any): void {
    if (typeof progress?.total_images === 'number') {
      this.totalImages = Math.max(0, progress.total_images);
    }

    if (typeof progress?.processed_images === 'number') {
      this.processedImages = Math.max(0, progress.processed_images);
    }

    if (typeof progress?.failed_images === 'number') {
      this.failedImages = Math.max(0, progress.failed_images);
    }

    if (typeof progress?.remaining_images === 'number') {
      this.remainingImages = Math.max(0, progress.remaining_images);
    }

    if (Array.isArray(job?.processed_files)) {
      const processedCount = job.processed_files.length;
      if (processedCount > this.processedImages) {
        this.processedImages = processedCount;
      }
    }

    const percent = this.computeProgressPercentage(progress);
    if (percent != null) {
      this.progressPercentage = percent;
      this.progressMode = 'determinate';
    } else {
      this.progressMode = 'indeterminate';
    }
  }

  private updateTiming(timing: any): void {
    if (!timing) {
      return;
    }

    if (timing.created_at) {
      const created = new Date(timing.created_at);
      if (!isNaN(created.getTime())) {
        this.createdAt = created;
      }
    }

    if (typeof timing.elapsed_time_seconds === 'number') {
      this.elapsedSeconds = Math.max(0, Math.floor(timing.elapsed_time_seconds));
    }

    if (typeof timing.estimated_time_remaining_seconds === 'number') {
      this.estimatedRemainingSeconds = Math.max(0, Math.floor(timing.estimated_time_remaining_seconds));
      this.estimatedRemainingText = null;
    } else if (timing.estimated_time_remaining) {
      this.estimatedRemainingText = timing.estimated_time_remaining;
      this.estimatedRemainingSeconds = null;
    }
  }

  private updateErrors(errors: any, isInitial: boolean): void {
    const sourceErrors = Array.isArray(errors)
      ? errors
      : isInitial && Array.isArray(this.data?.errors)
        ? this.data.errors
        : [];

    if (!Array.isArray(sourceErrors)) {
      this.jobErrors = [];
      return;
    }

    this.jobErrors = sourceErrors
      .filter(item => item && typeof item.error === 'string')
      .map(item => ({
        error: item.error,
        timestamp: item.timestamp ? this.safeParseDate(item.timestamp) : null
      }));

  }

  private computeProgressPercentage(progress: any): number | null {
    let percent: number | null = null;
    const provided = Number(progress?.progress_percentage);
    if (isFinite(provided)) {
      percent = provided;
    }

    if (this.totalImages > 0) {
      const completed = this.processedImages + this.failedImages;
      const derived = (completed / this.totalImages) * 100;
      if (isFinite(derived)) {
        if (percent == null) {
          percent = derived;
        } else {
          percent = Math.max(percent, derived);
        }
      }
    }

    if (percent == null) {
      return null;
    }

    percent = Math.max(0, Math.min(100, Math.round(percent)));

    const normalizedStatus = (this.status || '').toUpperCase();
    const isTerminal = TERMINAL_STATUSES.includes(normalizedStatus);
    const isComplete = progress?.is_complete === true;

    if (!isTerminal && !isComplete && percent >= 100) {
      percent = 99;
    }

    return percent;
  }

  private safeParseDate(value: string): Date | null {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  private formatDuration(totalSeconds: number): string {
    if (!isFinite(totalSeconds) || totalSeconds < 0) {
      return '0s';
    }

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0) {
      return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    }

    return `${seconds}s`;
  }
}
