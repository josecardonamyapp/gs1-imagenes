import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProductService } from '../../services/product.service';
import { HttpClient } from '@angular/common/http';
import { saveAs } from 'file-saver';
import { firstValueFrom, forkJoin, of } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { JobErrorDetailsDialogComponent } from './job-error-details-dialog/job-error-details-dialog.component';
import { catchError } from 'rxjs/operators';
import { createProductKey } from '../../utils/product-key';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';

const JSZip = require('jszip');

@Component({
  selector: 'app-job-status',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
    FormsModule,
    MatInputModule
  ],
  templateUrl: './job-status.component.html',
  styleUrls: ['./job-status.component.scss']
})
export class JobStatusComponent implements OnInit, OnDestroy {
  jobs: any[] = [];
  completedJobs: any[] = [];
  loading = false;
  completedLoading = false;
  private refreshInterval: any;
  editingJobId: string | null = null;
  tempJobName: string = '';

  constructor(
    private productService: ProductService,
    private http: HttpClient,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.loadJobs();
    this.checkJobsStatus();
    this.loadCompletedJobs();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  private updateJobState(jobId: string, changes: Partial<any>): void {
    this.jobs = this.jobs.map(job =>
      job.job_id === jobId ? { ...job, ...changes } : job
    );
  }

  startAutoRefresh(): void {
    // Refrescar todos los jobs cada 10 segundos
    this.refreshInterval = setInterval(() => {
      if (this.jobs.length > 0 && !this.loading) {
        this.checkJobsStatus();
      }
    }, 10000); // 10 segundos
  }

  loadJobs(): void {
    // Obtener job IDs del localStorage
    const storedJobs = localStorage.getItem('processing_jobs');
    const jobIds = storedJobs ? JSON.parse(storedJobs) : [];
    // console.log(jobIds)

    // Invertir el orden para mostrar los más recientes primero
    const reversedJobIds = [...jobIds].reverse();
    console.log('Job IDs cargados desde localStorage:', reversedJobIds);

    this.jobs = reversedJobIds.map((id: string) => ({
      job_id: id,
      status: 'LOADING',
      progress: { progress_percentage: 0, processed_images: 0, total_images: 0 },
      product_name: '',
      gtin: '',
      processed_files: [],
      errors: [],
      selectedAction: null
    }));
    console.log('Jobs cargados desde localStorage:', this.jobs);

    //('Jobs cargados desde localStorage:', this.jobs);
  }

  // checkJobsStatus2(): void {
  //   if (this.jobs.length === 0) {
  //     return;
  //   }

  //   this.loading = true;
  //   let completedRequests = 0;

  //   this.jobs.forEach((job, index) => {
  //     this.productService.getJobStatus(job.job_id).subscribe({
  //       next: (result: any) => {
  //         //(`Job ${job.job_id} resultado:`, result);
  //         this.jobs[index] = { ...this.jobs[index], ...result };

  //         completedRequests++;
  //         if (completedRequests === this.jobs.length) {
  //           this.loading = false;
  //         }
  //       },
  //       error: (error: any) => {
  //         console.error(`Error consultando job ${job.job_id}:`, error);
  //         this.jobs[index] = {
  //           ...this.jobs[index],
  //           status: 'ERROR',
  //           status_description: 'Error al consultar el estado del trabajo'
  //         };

  //         completedRequests++;
  //         if (completedRequests === this.jobs.length) {
  //           this.loading = false;
  //         }
  //       }
  //     });
  //   });
  // }

  checkJobsStatus(): void {
    if (this.jobs.length === 0) {
      return;
    }

    this.loading = true;

    // Creamos un arreglo de observables (uno por cada job)
    const jobRequests = this.jobs.map(job =>
      this.productService.getJobStatus(job.job_id).pipe(
        catchError(error => {
          console.error(`Error consultando job ${job.job_id}:`, error);
          // Retornamos un objeto con estado de error
          return of({
            job_id: job.job_id,
            status: 'ERROR',
            status_description: 'Error al consultar el estado del trabajo'
          });
        })
      )
    );

    // Ejecuta todas las peticiones en paralelo
    forkJoin(jobRequests).subscribe({
      next: (results: any[]) => {
        // results es un arreglo con el resultado de cada job
        const updatedJobs: any[] = [];

        results.forEach(result => {
          // Si el job terminó o tiene errores → eliminarlo
          const status = (result.status || '').toUpperCase();
          if (status === 'COMPLETED' || status === 'COMPLETED_WITH_ERRORS' || status === 'ERROR') {
            // Eliminar del localStorage
            const jobsLS = JSON.parse(localStorage.getItem('processing_jobs') || '[]');
            const updatedLS = jobsLS.filter((id: string) => id !== result.job_id);
            localStorage.setItem('processing_jobs', JSON.stringify(updatedLS));
          } else {
            // Si no ha terminado, mantenerlo en la lista local
            const existingJob = this.jobs.find(j => j.job_id === result.job_id);
            updatedJobs.push({ ...existingJob, ...result });
          }
        });

        // Actualiza el array con solo los jobs activos
        this.jobs = updatedJobs;

        this.loading = false;
      },
      error: err => {
        console.error('Error general al consultar los jobs:', err);
        this.loading = false;
      }
    });
  }

  getDownloadUrl(job: any): string | null {
    // Activar loading para generar link
    job.generatingLink = true;
    this.loading = true;
    this.productService.getJobDownloadUrl(job.job_id).subscribe({
      next: (result: any) => {
        console.log(`Download URL para job ${job.job_id}:`, result);
        let downloadUrl = result.zip_file_info.download_url;
        navigator.clipboard.writeText(downloadUrl)
        this.snackBar.open('URL copiado al portapapeles', 'Cerrar', {
          duration: 2500,
          verticalPosition: 'top'
        });
        job.generatingLink = false;
        this.loading = false;
      },
      error: (error: any) => {
        console.error(`Error obteniendo download URL para job ${job.job_id}:`, error);
        this.snackBar.open('Error al generar el link de descarga', 'Cerrar', {
          duration: 3000,
          verticalPosition: 'top'
        });
        job.generatingLink = false;
        this.loading = false;
      }
    });
    return null;
  }

  refreshJobStatus(job: any): void {
    console.log(`Refrescando estado del job`, job);
    job.status = 'LOADING';

    this.productService.getJobStatus(job.job_id).subscribe({
      next: (result: any) => {
        const index = this.jobs.findIndex(j => j.job_id === job.job_id);
        if (index !== -1) {
          this.jobs[index] = { ...this.jobs[index], ...result };
        }
      },
      error: (error: any) => {
        console.error(`Error actualizando job ${job.job_id}:`, error);
        job.status = 'ERROR';
        job.status_description = 'Error al actualizar el estado del trabajo';
      }
    });
  }

  refreshCompletedJobStatus(job: any): void {
    console.log(`Refrescando estado del job`, job);
    job.status = 'LOADING';

    this.productService.getJobStatus(job.job_id).subscribe({
      next: (result: any) => {
        const index = this.completedJobs.findIndex(j => j.job_id === job.job_id);
        if (index !== -1) {
          this.completedJobs[index] = { ...this.completedJobs[index], ...result };
        }
      },
      error: (error: any) => {
        console.error(`Error actualizando job ${job.job_id}:`, error);
        job.status = 'ERROR';
        job.status_description = 'Error al actualizar el estado del trabajo';
      }
    });
  }

  downloadSingleFile(url: string, filename: string): void {
    //('Descargando archivo:', filename);

    fetch(url)
      .then(response => response.blob())
      .then(blob => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
      })
      .catch(error => {
        console.error('Error descargando archivo:', error);
        this.snackBar.open('Error al descargar el archivo', 'Cerrar', {
          duration: 3000,
          verticalPosition: 'top'
        });
      });
  }

  async downloadAllFiles(job: any): Promise<void> {
    const processedFiles = job?.processed_files ?? [];
    if (processedFiles.length === 0) {
      return;
    }

    const jobId = job.job_id;
    job.downloading = true;
    this.loading = true;
    this.updateJobState(jobId, { downloading: true });

    try {
      const presignedTriggered = await this.tryDownloadUsingPresignedLink(job);
      if (presignedTriggered) {
        job.downloading = false;
        this.loading = false;
        this.updateJobState(jobId, { downloading: false });
        return;
      }

      const zip = new JSZip();
      // Leer folder_structure desde channel_params
      const folderStructure = job?.channel_params?.folder_structure;
      for (const file of processedFiles) {
        try {
          const blob = await firstValueFrom(this.http.get(file.s3_url, {
            responseType: 'blob'
          }));

          if (blob) {
            if (folderStructure === 1) {
              // Guardar por carpeta GTIN
              // Extraer GTIN del s3_key o del nombre del archivo
              let gtin = '';
              if (file.s3_key) {
                // s3_key: .../GTIN/filename
                const parts = file.s3_key.split('/');
                if (parts.length > 1) gtin = parts[parts.length - 2];
              }
              if (!gtin && file.output_filename) {
                // fallback: primer bloque numérico
                const match = file.output_filename.match(/\d{8,}/);
                if (match) gtin = match[0];
              }
              const path = gtin ? `${gtin}/${file.output_filename}` : file.output_filename;
              zip.file(path, blob);
            } else {
              // Todas las imágenes en una sola carpeta
              zip.file(file.output_filename, blob);
            }
          } else {
            this.loading = false;
            console.error(`Error: blob vacio para ${file.output_filename}`);
          }
        } catch (error) {
          this.loading = false;
          console.error(`Error descargando ${file.output_filename}:`, error);
        }
      }

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      const zipFilename = `${jobId}.zip`;
      saveAs(zipBlob, zipFilename);

    } catch (error: any) {
      this.loading = false;
      console.error('Error creando el ZIP:', error);
      const msg = (error && (error.message || `${error}`)) || 'Error al crear el archivo ZIP';
      this.snackBar.open(msg, 'Cerrar', {
        duration: 3500,
        verticalPosition: 'top'
      });
    } finally {
      job.downloading = false;
      this.loading = false;
      this.updateJobState(jobId, { downloading: false });
    }
  }
  getDownloadLink(job: any): string | null {
    if (job.status === 'COMPLETED' && job.processed_files && job.processed_files.length > 0) {
      return job.processed_files[0].s3_url; // Retornar el enlace del primer archivo procesado
    }
    return null;
  }



  removeJob(jobId: string): void {
    // Confirmar antes de eliminar
    if (confirm('¿Estás seguro de que quieres eliminar este trabajo?')) {
      // Eliminar del localStorage
      const storedJobs = localStorage.getItem('processing_jobs');
      const jobIds = storedJobs ? JSON.parse(storedJobs) : [];
      const filteredJobs = jobIds.filter((id: string) => id !== jobId);
      localStorage.setItem('processing_jobs', JSON.stringify(filteredJobs));

      // Eliminar de la vista
      this.jobs = this.jobs.filter(job => job.job_id !== jobId);

      //('Job eliminado:', jobId);
    }
  }



  getStatusChipColor(status: string): string {
    switch (status) {
      case 'COMPLETED': return 'primary';
      case 'PROCESSING': return 'accent';
      case 'ERROR': return 'warn';
      case 'LOADING': return 'basic';
      default: return 'basic';
    }
  }

  statusClass(status: string | undefined) {
    switch ((status || '').toUpperCase()) {
      case 'COMPLETED': return 'completed';
      case 'FAILED':
      case 'ERROR': return 'failed';
      case 'PROCESSING':
      case 'IN_PROGRESS':
      case 'LOADING': return 'processing';
      default: return 'neutral';
    }
  }

  getUpdatedAt(job: any): Date | string {
    // Primero intenta con updated_at en nivel raíz o dentro de timing
    const updatedAt = job?.updated_at || job?.timing?.updated_at;
    if (updatedAt) return updatedAt;
    
    // Si no hay updated_at, usa created_at en nivel raíz o dentro de timing
    const createdAt = job?.created_at || job?.timing?.created_at;
    if (createdAt) return createdAt;
    
    // Fallback a la fecha actual (esto solo debería pasar si no hay ningún campo de fecha)
    console.warn('Job sin fecha de actualización ni creación:', job?.job_id);
    return new Date();
  }

  /** Obtiene una miniatura: puedes ajustar estas fuentes según tu modelo */
  getThumb(job: any): string | null {
    // intenta con un campo de thumbnail propio
    if (job?.thumbnailUrl) return job.thumbnailUrl;
    // primera imagen procesada (si ya hay)
    if (job?.processed_files?.length) return job.processed_files[0].s3_url;
    // fallback (si guardas una imagen original)
    if (job?.original_image_url) return job.original_image_url;
    return null;
  }
  handleAction(action: string, job: any) {
    switch (action) {
      case 'refresh':
        // this.refreshJobStatus(job);
        this.refreshCompletedJobStatus(job);
        break;
      case 'download':
        this.downloadAllFiles(job);
        break;
      case 'link':
        this.getDownloadUrl(job);
        break;
      case 'delete':
        this.removeJob(job.job_id);
        break;
      case 'errors':
        this.openErrorDetails(job);
        break;
      case 'regenerate': {
        // Navegar a productProcessingView con los parametros del canal y los productKeys (GTIN+GLN)
        // channel_params puede ser un objeto único o un array de objetos (multi-canal)
        const channelParams = job.channel_params;
        let params: any = {};
        let channelGln: string | null = null;

        // Determinar si es array o objeto único
        if (Array.isArray(channelParams)) {
          // Multi-canal: usar el primer canal como referencia para el GLN
          if (channelParams.length > 0) {
            channelGln = channelParams[0]?.gln || null;
          }
          // Serializar el array como JSON para enviarlo en queryParams
          params.channel_params = JSON.stringify(channelParams);
        } else if (channelParams && typeof channelParams === 'object') {
          // Canal único (compatibilidad con jobs antiguos)
          params = { ...channelParams };
          channelGln = channelParams.gln || null;
        }
        
        if (Array.isArray(job.processed_files) && job.processed_files.length > 0) {
          // Extraer GTINs únicos de los archivos procesados
          const gtins = job.processed_files
            .map((file: any) => {
              const match = file.output_filename.match(/\d{8,14}/);
              return match ? match[0] : null;
            })
            .filter((gtin: string | null, idx: number, arr: any[]) => gtin && arr.indexOf(gtin) === idx);
          
          if (gtins.length > 0) {
            // Crear productKeys usando la utilidad createProductKey
            const productKeys = gtins.map((gtin: string) => {
              // Formato: "gtin::gln"
              return `${gtin}::${channelGln || ''}`;
            });
            
            // Limpiar params individuales si existen
            delete params.gtin;
            delete params.gln;
            
            const queryParams: any = { ...params };
            queryParams['productKey'] = productKeys;
            
            console.log('Regenerating with productKeys:', productKeys);
            console.log('Regenerating with channel_params:', channelParams);
            this.router.navigate(['/product-catalog'], { queryParams: queryParams });
            break;
          }
        }
        
        // Fallback: si no hay archivos procesados, navegar solo con los params del canal
        this.router.navigate(['/product-catalog'], { queryParams: params });
        break;
      }
      default:
        break;
    }

    if (job) {
      job.selectedAction = null;
    }
  }

  private openErrorDetails(job: any): void {
    const errorsFromJob = Array.isArray(job?.errors) ? job.errors : [];
    const errorsFromSummary = Array.isArray(job?.error_summary?.errors) ? job.error_summary.errors : [];
    const errors = errorsFromJob.length ? errorsFromJob : errorsFromSummary;

    if (!errors.length) {
      return;
    }

    const dialogRef = this.dialog.open(JobErrorDetailsDialogComponent, {
      width: '520px',
      data: {
        jobId: job?.job_id || '',
        statusDescription: job?.status_description,
        errors,
        summary: job?.error_summary
      }
    });

    dialogRef.afterClosed().subscribe(() => {
      if (job) {
        job.selectedAction = null;
      }
    });
  }

  private async tryDownloadUsingPresignedLink(job: any): Promise<boolean> {
    if (job?.zipDownloadUrl) {
      this.triggerBrowserDownload(job.zipDownloadUrl, `${job.job_id}.zip`);
      return true;
    }

    try {
      const response = await firstValueFrom(this.productService.getJobDownloadUrl(job.job_id));
      const downloadUrl = response?.zip_file_info?.download_url || response?.download_url;
      if (!downloadUrl) {
        return false;
      }

      job.zipDownloadUrl = downloadUrl;
      this.triggerBrowserDownload(downloadUrl, `${job.job_id}.zip`);
      return true;
    } catch (error) {
      console.error(`Error obteniendo link prefirmado para job ${job?.job_id}:`, error);
      return false;
    }
  }

  private triggerBrowserDownload(url: string, filename: string): void {
    if (!url) {
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename || 'descarga.zip';
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  async loadCompletedJobs() {
    this.loading = true;
    this.productService.getProcessingJobsByGln().subscribe({
      next: (result: any) => {
        this.loading = false;
        if (typeof (result) === 'object') {
          this.completedJobs = result.channels.filter((job: any) => {
            const status = (job.status || '').toUpperCase();
            return status !== 'PROCESSING' && status !== 'IN_PROGRESS' && status !== 'LOADING';
          });
        }
      },
      error: (error: any) => {
        this.loading = false;
        console.error('Error cargando jobs procesados:', error);
      },
      complete: () => {
        this.loading = false;
      }
    })
  }

  startEditJobName(job: any): void {
    this.editingJobId = job.job_id;
    this.tempJobName = job.job_name || job.product_name || '';
  }

  cancelEditJobName(): void {
    this.editingJobId = null;
    this.tempJobName = '';
  }

  saveJobName(job: any): void {
    if (!this.tempJobName.trim()) {
      this.snackBar.open('El nombre no puede estar vacío', 'Cerrar', {
        duration: 3000,
        verticalPosition: 'top'
      });
      return;
    }

    this.loading = true;
    this.productService.updateJobName(job.job_id, this.tempJobName).subscribe({
      next: (result: any) => {
        job.product_name = this.tempJobName;
        job.job_name = this.tempJobName;
        this.editingJobId = null;
        this.tempJobName = '';
        this.snackBar.open('Nombre actualizado correctamente', 'Cerrar', {
          duration: 2500,
          verticalPosition: 'top'
        });
        // Recargar la lista de completedJobs
        this.loadCompletedJobs();
      },
      error: (error: any) => {
        console.error('Error actualizando nombre del job:', error);
        this.loading = false;
        this.snackBar.open('Error al actualizar el nombre', 'Cerrar', {
          duration: 3000,
          verticalPosition: 'top'
        });
      }
    });
  }

}




