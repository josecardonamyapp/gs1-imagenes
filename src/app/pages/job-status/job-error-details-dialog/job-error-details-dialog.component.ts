import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface JobErrorDetailsDialogData {
    jobId: string;
    statusDescription?: string;
    errors: Array<{
        error: string;
        timestamp?: string;
    }>;
    summary?: {
        total_errors?: number;
        failed_images_count?: number;
        common_issues?: string[];
    };
}

@Component({
    selector: 'app-job-error-details-dialog',
    standalone: true,
    templateUrl: './job-error-details-dialog.component.html',
    styleUrls: ['./job-error-details-dialog.component.scss'],
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule
    ]
})
export class JobErrorDetailsDialogComponent {
    constructor(
        @Inject(MAT_DIALOG_DATA) public data: JobErrorDetailsDialogData,
        private dialogRef: MatDialogRef<JobErrorDetailsDialogComponent>
    ) { }

    close(): void {
        this.dialogRef.close();
    }

    get hasSummary(): boolean {
        const summary = this.data?.summary;
        return !!summary && (
            (summary.total_errors ?? 0) > 0 ||
            (summary.failed_images_count ?? 0) > 0 ||
            (Array.isArray(summary.common_issues) && summary.common_issues.length > 0)
        );
    }
}
