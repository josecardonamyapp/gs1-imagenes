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
import { firstValueFrom } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

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
    MatTooltipModule
  ],
  templateUrl: './job-status.component.html',
  styleUrls: ['./job-status.component.scss']
})
export class JobStatusComponent implements OnInit, OnDestroy {
  jobs: any[] = [];
  loading = false;
  private refreshInterval: any;

  constructor(
    private productService: ProductService,
    private http: HttpClient,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadJobs();
    this.checkJobsStatus();
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

    this.jobs = reversedJobIds.map((id: string) => ({
      job_id: id,
      status: 'LOADING',
      progress: { progress_percentage: 0, processed_images: 0, total_images: 0 },
      product_name: '',
      gtin: '',
      processed_files: [],
      errors: []
    }));

    //('Jobs cargados desde localStorage:', this.jobs);
  }

  checkJobsStatus(): void {
    if (this.jobs.length === 0) {
      return;
    }

    this.loading = true;
    let completedRequests = 0;

    this.jobs.forEach((job, index) => {
      this.productService.getJobStatus(job.job_id).subscribe({
        next: (result: any) => {
          //(`Job ${job.job_id} resultado:`, result);
          this.jobs[index] = { ...this.jobs[index], ...result };

          completedRequests++;
          if (completedRequests === this.jobs.length) {
            this.loading = false;
          }
        },
        error: (error: any) => {
          console.error(`Error consultando job ${job.job_id}:`, error);
          this.jobs[index] = {
            ...this.jobs[index],
            status: 'ERROR',
            status_description: 'Error al consultar el estado del trabajo'
          };

          completedRequests++;
          if (completedRequests === this.jobs.length) {
            this.loading = false;
          }
        }
      });
    });
  }

  getDownloadUrl(job: any): string | null {
    this.productService.getJobDownloadUrl(job.job_id).subscribe({
      next: (result: any) => {
        console.log(`Download URL para job ${job.job_id}:`, result);
        let downloadUrl = result.zip_file_info.download_url;
        navigator.clipboard.writeText(downloadUrl)

        alert('URL copiado al portapapeles');
      },
      error: (error: any) => {
        console.error(`Error obteniendo download URL para job ${job.job_id}:`, error);
      }
    });
    return null;
  }

  refreshJobStatus(job: any): void {
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
        alert('Error al descargar el archivo');
      });
  }

  async downloadAllFiles(job: any): Promise<void> {
    const processedFiles = job?.processed_files ?? [];
    if (processedFiles.length === 0) {
      return;
    }

    const jobId = job.job_id;
    job.downloading = true;
    this.updateJobState(jobId, { downloading: true });

    try {
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
            console.error(`Error: blob vacio para ${file.output_filename}`);
          }
        } catch (error) {
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

    } catch (error) {
      console.error('Error creando el ZIP:', error);
      alert('Error al crear el archivo ZIP: ' + error);
    } finally {
      job.downloading = false;
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
    return job?.timing?.updated_at || job?.timing?.created_at || new Date();
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
    if (action === 'refresh') { this.refreshJobStatus(job); }
    if (action === 'download') { this.downloadAllFiles(job); }
    if (action === 'link') { this.getDownloadUrl(job); }
    if (action === 'delete') { this.removeJob(job.job_id); }
    if (action === 'regenerate') {
      // Navegar a productProcessingView con los parámetros del canal y los GTIN procesados
      const params = { ...(job.channel_params || {}) };
      // Extraer todos los gtin únicos de los archivos procesados
      if (Array.isArray(job.processed_files)) {
        const gtins = job.processed_files
          .map((file: any) => {
            // Buscar GTIN en el nombre del archivo (asume que el GTIN es la primera secuencia de 8-14 dígitos)
            const match = file.output_filename.match(/\d{8,14}/);
            return match ? match[0] : null;
          })
          .filter((gtin: string | null, idx: number, arr: any[]) => gtin && arr.indexOf(gtin) === idx);
        if (gtins.length > 0) {
          // Eliminar cualquier gtin existente en params
          delete params.gtin;
          // Navegar usando un objeto de queryParams con gtin repetido
          const queryParams: any = { ...params };
          // Angular permite pasar un array, pero para forzar gtin=...&gtin=... usamos un objeto especial
          // que repite la clave gtin para cada valor
          // Esto solo funciona si el router respeta el array como múltiples params
          // Si no, se puede usar NavigationExtras.queryParamsHandling
          // Pero aquí lo forzamos:
          (queryParams as any)['gtin'] = gtins;
          this.router.navigate(['/product-catalog'], { queryParams: queryParams });
          return;
        }
      }
      this.router.navigate(['/product-catalog'], { queryParams: params });
    }
  }

}


