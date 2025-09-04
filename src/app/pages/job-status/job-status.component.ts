import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
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
    private http: HttpClient
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
    if (!job.processed_files || job.processed_files.length === 0) {
      return;
    }

    job.downloading = true;
    //(`Iniciando descarga de ${job.processed_files.length} archivos para GTIN: ${job.gtin}`);

    try {
      // Crear un nuevo ZIP
      const zip = new JSZip();

      // Descargar todos los archivos de forma secuencial para evitar problemas
      for (const file of job.processed_files) {
        // console.log(file.)
        try {
          //(`Descargando: ${file.output_filename} desde ${file.s3_url}`);

          // Usar HttpClient en lugar de fetch para manejar mejor el CORS
          const blob = await firstValueFrom(this.http.get(file.s3_url, {
            responseType: 'blob'
          }));

          if (blob) {
            //(`Archivo ${file.output_filename} descargado. Tamaño: ${blob.size} bytes`);

            // Agregar el archivo al ZIP con su nombre output_filename
            zip.file(file.output_filename, blob);
            //(`Archivo ${file.output_filename} agregado al ZIP`);
          } else {
            console.error(`Error: blob vacío para ${file.output_filename}`);
          }
          job.downloading = false;
        } catch (error) {
          job.downloading = false;
          console.error(`Error descargando ${file.output_filename}:`, error);
        }
      }

      //('Generando archivo ZIP...');

      // Generar el ZIP
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      //(`ZIP generado. Tamaño: ${zipBlob.size} bytes`);

      // Descargar el ZIP con el nombre del GTIN
      const zipFilename = `${job.job_id}.zip`;
      saveAs(zipBlob, zipFilename);

      job.downloading = false;
      //(`ZIP ${zipFilename} descargado exitosamente con ${job.processed_files.length} archivos`);

    } catch (error) {
      job.downloading = false;
      console.error('Error creando el ZIP:', error);
      alert('Error al crear el archivo ZIP: ' + error);
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
  }

}
